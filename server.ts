import express from 'express';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { checkGatekeeper, recordUsageIncrement } from './server/gatekeeper.js';
import { createCheckoutSession, createTopupCheckoutSession, createPortalSession, handleStripeWebhook, getAuthenticatedUser, confirmCheckoutSession, updateSubscription, cancelSubscription, getSubscriptionStatus, reactivateSubscription, cancelDowngrade } from './server/stripe.js';
import { redeemReferralCode, getReferralStats, backfillMissingReferralCodes } from './server/referrals.js';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('[server] CRITICAL: GEMINI_API_KEY environment variable is not set. Gemini routes will fail.');
}

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY || '' });

const app = express();
app.set('trust proxy', 1); // Trust the reverse proxy (e.g. Render) to correctly set req.ip, req.protocol, etc.
const PORT = process.env.PORT || 3000;

// Rate limiter state for audio requests
const audioRequestTimestamps: number[] = [];
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 10;

// Resolve __dirname since we are in an ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auto-detect production mode if running from the compiled dist-server directory
if (__dirname.includes('dist-server') || __dirname.includes('dist_server')) {
    process.env.NODE_ENV = 'production';
}

// Stripe Webhook Endpoint — MUST receive raw buffer for signature verification before express.json()
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    return handleStripeWebhook(req, res);
});

// Body parsing — MUST come before other routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Response compression (gzip/deflate) to dramatically reduce transferred payload
app.use(compression({
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));

// Serve frontend assets with production caching headers
if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, '../dist');
    console.log(`[server] Running in production mode. Serving static files from ${distPath} with caching headers...`);
    app.use(express.static(distPath, {
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
            const normalizedPath = filePath.replace(/\\/g, '/');

            // 1. Immutable Hashed Assets (Vite outputs /assets/* with unique hash)
            // Caches for 1 year; saves re-downloads on every repeat visit
            if (normalizedPath.includes('/assets/')) {
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
            // 2. Service Worker & PWA lifecycle scripts (Never cache so client picks up updates immediately)
            else if (
                normalizedPath.endsWith('/sw.js') ||
                normalizedPath.endsWith('/registerSW.js') ||
                normalizedPath.includes('workbox')
            ) {
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            }
            // 3. HTML pages (Always revalidate so client never uses stale index.html)
            else if (normalizedPath.endsWith('.html')) {
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            }
            // 4. Large media files (lesson videos / audio) - Cache 30 days with revalidation
            else if (normalizedPath.endsWith('.mp4') || normalizedPath.endsWith('.webm')) {
                res.setHeader('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=86400');
            }
            // 5. Static images, manifest, and icons - Cache for 7 days
            else if (
                normalizedPath.endsWith('.webmanifest') ||
                normalizedPath.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i)
            ) {
                res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
            }
            // 6. Default fallback for other static assets
            else {
                res.setHeader('Cache-Control', 'public, max-age=86400');
            }
        }
    }));
}

// Basic health route
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        geminiKeyPresent: !!GEMINI_API_KEY,
        timestamp: new Date().toISOString()
    });
});

async function translateText(text: string, targetLanguage: string): Promise<string> {
    if (!text || !targetLanguage || targetLanguage === 'Auto-Detect') return text;
    try {
        console.log(`[translateText] Translating transcript into ${targetLanguage}...`);
        const result = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                temperature: 0.1,
                maxOutputTokens: 2000,
            },
            contents: [{
                parts: [{
                    text: `Translate the following dance lesson transcript into ${targetLanguage}.
Preserve all specific dance terms, formatting, and meaning.
If the text is already in ${targetLanguage}, output it exactly as is without changes.
Output ONLY the clean translated text. Do not add any notes, introductions, explanations, or quotes.

Transcript:
${text}`
                }]
            }]
        });
        return (result.text || text).trim();
    } catch (e) {
        console.error('[translateText] Failed to translate transcript:', e);
        return text;
    }
}

async function processAudioWithGemini(base64Audio: string, mimeType: string, language: string, danceGlossary: any, danceStyle = 'Auto', availableGlossaries: any[] = []) {
    let totalPromptTokens = 0;
    let totalResponseTokens = 0;

    const languageNames: Record<string, string> = {
        'pt-br': 'Portuguese',
        'es': 'Spanish',
        'en': 'English',
        'auto': 'Auto-Detect'
    };
    const targetLanguage = languageNames[language.toLowerCase()] || 'Auto-Detect';

    const isAuto = danceStyle.toLowerCase() === 'auto';
    const availableStyleNames = Array.isArray(availableGlossaries) 
        ? availableGlossaries.map((g: any) => typeof g === 'string' ? g : g.name).filter(Boolean)
        : [];

    // If in auto mode without a specific glossary, combine terms across all active styles the user selected
    const effectiveGlossary = (isAuto && (!danceGlossary || (Array.isArray(danceGlossary) && danceGlossary.length === 0)) && Array.isArray(availableGlossaries))
        ? availableGlossaries.flatMap((g: any) => Array.isArray(g.terms) ? g.terms : [])
        : danceGlossary;

    // Flatten the glossary JSON into a dense, comma-separated string to save tokens
    const compressedGlossary = Array.isArray(effectiveGlossary) ? effectiveGlossary.map((item: any) => {
        const variants = item.variants && item.variants.length > 0 ? ` (${item.variants.join(', ')})` : '';
        return `${item.canonicalTerm || ''}${variants}`;
    }).filter(Boolean).join(', ') : '';

    const glossaryContext = compressedGlossary ? `\n\nKnown dance terminology to listen for (preserve original spelling):\n${compressedGlossary}` : '';

    let prompt = '';
    const isTranslate = targetLanguage !== 'Auto-Detect';

    if (isAuto) {
        prompt = `You are an expert dance instructor transcribing a lesson audio clip.
Dancers frequently mix languages (e.g. Portuguese terms in Brazilian Zouk, Spanish in Salsa/Bachata, French in Ballet, etc.). If foreign technical dance terms are mixed into the spoken language, preserve their exact technical spelling and original language rather than phonetically transcribing or mistranslating them.

CRITICAL INSTRUCTIONS:
- Transcribe the ENTIRE audio recording from beginning to end without stopping early.
- Remove speech disfluencies and false starts (e.g., "um", "uh").
- Output ONLY the raw transcription text in the language it is spoken.
- DO NOT return JSON. DO NOT wrap in quotes. DO NOT include markdown formatting.

${glossaryContext}`;
    } else {
        prompt = `You are an expert ${danceStyle} instructor transcribing a lesson audio clip.

CRITICAL INSTRUCTIONS:
- Transcribe the ENTIRE audio recording from beginning to end without stopping early.
- Remove speech disfluencies and false starts.
- Preserve exact technical meaning and terminology.
- Output ONLY the raw transcription text in the language it is spoken.
- DO NOT return JSON. DO NOT wrap in quotes. DO NOT include markdown formatting.

${glossaryContext}`;
    }

    const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
            temperature: 0.1,
            maxOutputTokens: 65536,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'text/plain'
        },
        contents: [
            {
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Audio
                        }
                    }
                ]
            }
        ]
    });

    totalPromptTokens = result.usageMetadata?.promptTokenCount || 0;
    totalResponseTokens = result.usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = result.usageMetadata?.totalTokenCount || (totalPromptTokens + totalResponseTokens);

    console.log(`[Gemini Transcription Usage] Prompt: ${totalPromptTokens} tokens`);
    console.log(`[Gemini Transcription Usage] Response: ${totalResponseTokens} tokens`);
    console.log(`[Gemini Transcription Usage] Total: ${totalTokens} tokens`);

    let rawText = (result.text || '').trim();

    // Defensive cleanup in case Gemini still outputted JSON or code blocks
    if (rawText.startsWith('```') || rawText.startsWith('{')) {
        try {
            const cleanJson = rawText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed.transcript) {
                rawText = parsed.transcript.trim();
            }
        } catch (_) {
            // Regex match inside "transcript": "..." even if cut off or malformed JSON
            const match = rawText.match(/"transcript"\s*:\s*"((?:[^"\\]|\\.)*)/i);
            if (match && match[1]) {
                try {
                    rawText = JSON.parse(`"${match[1]}"`);
                } catch {
                    rawText = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
                }
            } else {
                rawText = rawText.replace(/^\s*\{\s*"transcript"\s*:\s*"?/i, '').replace(/"?\s*\}?\s*$/i, '').trim();
            }
        }
    }

    let transcript = rawText.trim();
    if (isTranslate && transcript) {
        transcript = await translateText(transcript, targetLanguage);
    }

    return {
        transcript
    };
}

async function consolidateTranscriptsWithGemini(transcripts: string[], danceGlossary: any, danceStyle = 'Auto', appLanguage = 'en') {
    if (!transcripts || transcripts.length === 0) return null;

    // Flatten the glossary
    const compressedGlossary = Array.isArray(danceGlossary) ? danceGlossary.map((item: any) => {
        const variants = item.variants && item.variants.length > 0 ? ` (${item.variants.join(', ')})` : '';
        return `${item.canonicalTerm || ''}${variants}`;
    }).filter(Boolean).join(', ') : '';

    const isAuto = danceStyle.toLowerCase() === 'auto';
    const styleName = isAuto ? 'dance' : danceStyle;
    const glossaryContext = compressedGlossary ? `\n\n${styleName} Glossary for reference:\n${compressedGlossary}` : '';

    const combinedTranscripts = transcripts.map((t, i) => `--- Clip ${i + 1} Transcription ---\n${t}`).join('\n\n');

    const targetLanguageName = appLanguage === 'es' ? 'Spanish' : 'English';

    const prompt = `You are a world-class ${styleName} head instructor. 
Below are multiple transcriptions from various moments of a single ${styleName} lesson.
Your task is to provide a single, cohesive, "Consolidated Session Report" that synthesizes ALL the technical information while ELIMINATING redundancies.

CRITICAL: 
- If multiple clips discuss the same concept (e.g. "Frame", "Lateral step"), do NOT mention it multiple times.
- Summarize the repetitive information into the most complete and clear technical description possible.
- Write text content in ${targetLanguageName}. Do not translate JSON keys (keep them exactly as "strictSummary", "expandedInsights", "drills", "homework", "technicalExpansion", "emotionalNotes", "tags"${isAuto ? ', "detectedStyle"' : ''}).

Perform these tasks and return the result EXACTLY as a JSON object:

1. strictSummary: Extract atomic technical notes (one concise, complete idea per bullet).
2. expandedInsights: Infer drills, homework, technical expansions, and emotional notes.
3. tags: Extract 1-4 concise topic labels for key dance concepts taught in this lesson in ${targetLanguageName} (keep standard dance terms in their native language e.g. Viradinha, Dile que no, Plié).
${isAuto ? '4. detectedStyle: Detect the specific dance style of this lesson (e.g., Brazilian Zouk, Salsa, Bachata, Kizomba, West Coast Swing, etc.) based on the transcription contents.' : ''}

${glossaryContext}

--- SESSION TRANSCRIPTIONS BEGIN ---
${combinedTranscripts}
--- SESSION TRANSCRIPTIONS END ---

Return ONLY valid JSON matching this schema:
{
  "strictSummary": ["note 1", "note 2"],
  "expandedInsights": {
    "drills": ["drill 1"],
    "homework": [],
    "technicalExpansion": [],
    "emotionalNotes": []
  },
  "tags": ["topic 1", "topic 2"]${isAuto ? ',\n  "detectedStyle": "detected dance style name"' : ''}
}`;

    const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
            temperature: 0.2,
            responseMimeType: 'application/json'
        },
        contents: [{ parts: [{ text: prompt }] }]
    });

    console.log(`[Gemini Consolidation Usage] Prompt: ${result.usageMetadata?.promptTokenCount || 0} tokens`);
    console.log(`[Gemini Consolidation Usage] Response: ${result.usageMetadata?.candidatesTokenCount || 0} tokens`);

    try {
        const cleanText = (result.text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        return JSON.parse(cleanText || '{}');
    } catch (e) {
        console.error('Failed to parse consolidated JSON from Gemini:', e, 'Raw output:', result.text);
        return { strictSummary: [], expandedInsights: { drills: [], homework: [], technicalExpansion: [], emotionalNotes: [] }, tags: [] };
    }
}


// Gemini Process Single Audio Route
app.post('/api/gemini/process-single-audio', async (req, res) => {
    try {
        console.log('[/api/gemini/process-single-audio] Request received');

        const { sessionId, language, filename, base64Audio, mimeType, glossary, danceStyle, availableGlossaries, mockMode, durationSeconds } = req.body;
        const authHeader = req.headers.authorization;
        const devOverride = req.headers['x-dev-override'] as string || (req.body.devState ? JSON.stringify(req.body.devState) : undefined);

        // 1. Gatekeeper: Enforce 3-minute hard cap and user tier quotas
        const gate = await checkGatekeeper(authHeader, 'single_clip', durationSeconds, devOverride);
        if (!gate.allowed) {
            console.warn(`[/api/gemini/process-single-audio] Gatekeeper rejected: ${gate.code} - ${gate.error}`);
            return res.status(gate.statusCode || 403).json(gate);
        }

        // 2. Mock Mode: return simulated transcription to save Gemini tokens during testing
        if (mockMode) {
            console.log('[/api/gemini/process-single-audio] Gemini Mock Mode active. Simulating AI output (0 tokens used).');
            await new Promise(resolve => setTimeout(resolve, 1500));
            const style = (!danceStyle || danceStyle.toLowerCase() === 'auto') ? 'Brazilian Zouk' : danceStyle;
            return res.json({
                status: 'success',
                processedAt: new Date().toISOString(),
                strictSummary: [
                    "Maintain soft, elastic connection in closed frame.",
                    "Transfer weight through the balls of the feet on counts 1 and 2."
                ],
                expandedInsights: {
                    drills: ["Basic step practice with eyes closed to internalize rhythm"],
                    homework: ["5-minute daily balance and footwork routine"],
                    technicalExpansion: ["Lead turn from torso rotation rather than arm pushing"],
                    emotionalNotes: ["Great focus on rhythm and partnership breathing!"]
                },
                transcript: `Simulated lesson transcript (Mock Mode active): Focus on soft frame connection, weight transfer through the balls of the feet, and fluid timing during the basic ${style} lateral movement.`,
                detectedStyle: style,
                mockData: true,
                tier: gate.tier,
                usage: gate.usage,
                limits: gate.limits
            });
        }

        const now = Date.now();
        while (audioRequestTimestamps.length > 0 && audioRequestTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
            audioRequestTimestamps.shift();
        }
        if (audioRequestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
            console.warn(`[/api/gemini/process-single-audio] Rate limit exceeded. Current count: ${audioRequestTimestamps.length}`);
            return res.status(429).json({ error: 'Too many audio requests. Maximum 10 per minute allowed.' });
        }
        audioRequestTimestamps.push(now);

        if (!sessionId || !base64Audio) {
            console.error('[/api/gemini/process-single-audio] Missing required fields:', {
                hasSessionId: !!sessionId,
                hasBase64Audio: !!base64Audio
            });
            return res.status(400).json({ error: 'Invalid payload: sessionId and base64Audio are required' });
        }

        if (!GEMINI_API_KEY) {
            console.error('[/api/gemini/process-single-audio] GEMINI_API_KEY is not configured');
            return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
        }

        let activeGlossary = glossary;
        let activeStyle = danceStyle || 'Auto';

        const resolvedMimeType = mimeType || 'audio/webm';
        console.log(`[/api/gemini/process-single-audio] Processing audio for session=${sessionId}, style=${activeStyle}`);

        let result;
        try {
            result = await processAudioWithGemini(base64Audio, resolvedMimeType, language || 'Auto', activeGlossary, activeStyle, availableGlossaries);
        } catch (geminiError: any) {
            const status = geminiError?.status || geminiError?.code;
            const isQuotaError = status === 429 || (geminiError?.message || '').toLowerCase().includes('quota');
            console.error('[/api/gemini/process-single-audio] Gemini SDK call failed:', {
                message: geminiError?.message,
                status,
                stack: geminiError?.stack
            });
            if (isQuotaError) {
                const retryDelay = geminiError?.retryDelay || geminiError?.details?.[0]?.retryDelay;
                return res.status(429).json({
                    error: 'Gemini API quota exceeded. Please wait a moment and try again.',
                    details: geminiError?.message || String(geminiError),
                    retryAfter: retryDelay
                });
            }
            return res.status(500).json({
                error: 'Gemini API call failed',
                details: geminiError?.message || String(geminiError)
            });
        }

        // Record database increment on success
        await recordUsageIncrement(authHeader, 'single_clip');

        const emptyResult = {
            strictSummary: [] as string[],
            expandedInsights: { drills: [], homework: [], technicalExpansion: [], emotionalNotes: [] },
            transcript: ''
        };

        return res.json({
            status: 'success',
            processedAt: new Date().toISOString(),
            ...emptyResult,
            ...result,
            mockData: false,
            tier: gate.tier,
            usage: gate.usage,
            limits: gate.limits
        });

    } catch (error: any) {
        console.error('[/api/gemini/process-single-audio] Unhandled error:', {
            message: error?.message,
            stack: error?.stack
        });
        return res.status(500).json({
            error: 'Internal server error',
            details: error?.message || String(error)
        });
    }
});

// Gemini Process Audio Route (bulk — used by Consolidate button)
app.post('/api/gemini/process-audio', async (req, res) => {
    try {
        console.log('[/api/gemini/process-audio] Request received');

        const { sessionId, audios, glossary, danceStyle, availableGlossaries, appLanguage, mockMode, maxAudioDuration } = req.body;
        const authHeader = req.headers.authorization;
        const devOverride = req.headers['x-dev-override'] as string || (req.body.devState ? JSON.stringify(req.body.devState) : undefined);

        // 1. Gatekeeper: Enforce 3-minute hard cap and user tier quotas
        const gate = await checkGatekeeper(authHeader, 'consolidation', maxAudioDuration, devOverride);
        if (!gate.allowed) {
            console.warn(`[/api/gemini/process-audio] Gatekeeper rejected: ${gate.code} - ${gate.error}`);
            return res.status(gate.statusCode || 403).json(gate);
        }

        // 2. Mock Mode: return simulated consolidated report to save Gemini tokens during testing
        if (mockMode) {
            console.log('[/api/gemini/process-audio] Gemini Mock Mode active. Simulating consolidated report (0 tokens used).');
            await new Promise(resolve => setTimeout(resolve, 1800));
            const newTranscriptsRecord: Record<string, string> = {};
            if (Array.isArray(audios)) {
                for (let i = 0; i < audios.length; i++) {
                    const audioId = audios[i]?.audioId || `audio-${i}`;
                    if (!audios[i]?.transcript) {
                        newTranscriptsRecord[audioId] = `Simulated transcript for clip ${i + 1} (Mock Mode active): Key technical concepts and movement timing.`;
                    }
                }
            }
            const style = (!danceStyle || danceStyle.toLowerCase() === 'auto') ? 'Brazilian Zouk' : danceStyle;
            const mockTags = appLanguage === 'es'
                ? ["Conexión", "Transferencia de peso", "Giros", "Musicalidad"]
                : ["Connection", "Weight Transfer", "Turns", "Musicality"];
            return res.json({
                report: {
                    strictSummary: appLanguage === 'es' ? [
                        "Mantener una conexión suave y elástica en marco cerrado sin tensión en los hombros.",
                        "Iniciar los pasos laterales transfiriendo el peso corporal suavemente en los tiempos 1 y 2.",
                        "Usar la rotación del torso en lugar de empujar con los brazos para indicar cambios de dirección."
                    ] : [
                        "Maintain soft, elastic connection in closed frame without tension in the shoulders.",
                        "Initiate lateral steps by shifting body weight smoothly on counts 1 and 2.",
                        "Use torso rotation rather than arm pushing to indicate direction changes."
                    ],
                    expandedInsights: {
                        drills: appLanguage === 'es' ? [
                            "Practicar 8 tiempos del paso básico en el lugar con ojos cerrados para desarrollar equilibrio.",
                            "Ejercicio de resistencia líder-seguidor con una pelota pequeña entre los torsos."
                        ] : [
                            "Practice 8 counts of basic step in place with eyes closed to build balance and weight sensation.",
                            "Lead-and-follow resistance drill with a small ball between torsos."
                        ],
                        homework: appLanguage === 'es' ? [
                            "Ejercicio diario de 5 minutos de trabajo de pies manteniendo contacto constante con el suelo."
                        ] : [
                            "Daily 5-minute footwork drill maintaining constant ground contact."
                        ],
                        technicalExpansion: appLanguage === 'es' ? [
                            "Asegurar que la caja torácica guíe el giro antes de que los pies pisen."
                        ] : [
                            "Ensure ribcage leads the turn before the feet step to prevent balance breakdown."
                        ],
                        emotionalNotes: appLanguage === 'es' ? [
                            "Gran musicalidad en las secciones lentas; enfocarse en respirar juntos en las transiciones."
                        ] : [
                            "Great musicality on the slow sections; focus on breathing together through the transitions."
                        ]
                    },
                    tags: mockTags
                },
                tags: mockTags,
                newTranscripts: newTranscriptsRecord,
                detectedStyle: style,
                mockData: true,
                tier: gate.tier,
                usage: gate.usage,
                limits: gate.limits
            });
        }

        const now = Date.now();
        while (audioRequestTimestamps.length > 0 && audioRequestTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
            audioRequestTimestamps.shift();
        }
        if (audioRequestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
            console.warn(`[/api/gemini/process-audio] Rate limit exceeded. Current count: ${audioRequestTimestamps.length}`);
            return res.status(429).json({ error: 'Too many audio requests. Maximum 10 per minute allowed.' });
        }
        audioRequestTimestamps.push(now);

        if (!sessionId || !audios || !Array.isArray(audios)) {
            console.error('[/api/gemini/process-audio] Invalid payload:', { sessionId, audiosType: typeof audios });
            return res.status(400).json({ error: 'Invalid payload: sessionId and audios array are required' });
        }

        if (!GEMINI_API_KEY) {
            console.error('[/api/gemini/process-audio] GEMINI_API_KEY is not configured');
            return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
        }

        let activeGlossary = glossary;
        let activeStyle = danceStyle || 'Auto';
        const isAutoStyle = activeStyle.toLowerCase() === 'auto';

        const allTranscripts: string[] = [];
        const newTranscriptsRecord: Record<string, string> = {};
        let detectedStyleName: string | undefined = undefined;

        for (let i = 0; i < audios.length; i++) {
            const audio = audios[i];
            const audioId = audio.audioId || `audio-${i}`;

            // 1. Check if we already have the transcript in the request
            if (audio.transcript) {
                console.log(`[/api/gemini/process-audio] Using existing transcript for id=${audioId}`);
                allTranscripts.push(audio.transcript);
                continue;
            }

            // 2. Otherwise transcribe now
            if (!audio.base64) {
                console.warn(`[/api/gemini/process-audio] Missing both transcript and base64 for id=${audioId}`);
                continue;
            }

            const language = audio.language || 'Auto';
            const resolvedMimeType = audio.mimeType || 'audio/webm';

            console.log(`[/api/gemini/process-audio] Transcribing audio ${i + 1}/${audios.length}, id=${audioId}`);

            try {
                const result = await processAudioWithGemini(audio.base64, resolvedMimeType, language, activeGlossary, activeStyle, availableGlossaries);
                if (result.transcript) {
                    allTranscripts.push(result.transcript);
                    newTranscriptsRecord[audioId] = result.transcript;
                }
            } catch (err: any) {
                console.error(`[/api/gemini/process-audio] Gemini SDK Error for audio id=${audioId}:`, err?.message);
                // Continue with others
            }
        }

        console.log(`[/api/gemini/process-audio] Total transcripts gathered: ${allTranscripts.length}. Synthesizing...`);

        // 3. Synthesize the final consolidated report
        const reportResult = await consolidateTranscriptsWithGemini(allTranscripts, activeGlossary, activeStyle, appLanguage);

        // Record database increment on success
        await recordUsageIncrement(authHeader, 'consolidation');

        let finalDetectedStyle = detectedStyleName;
        if (reportResult && reportResult.detectedStyle) {
            finalDetectedStyle = reportResult.detectedStyle;
            delete reportResult.detectedStyle;
        }

        const tags = Array.isArray(reportResult?.tags) ? reportResult.tags : [];

        return res.json({
            report: reportResult,
            tags,
            newTranscripts: newTranscriptsRecord,
            detectedStyle: finalDetectedStyle,
            tier: gate.tier,
            usage: gate.usage,
            limits: gate.limits
        });

    } catch (error: any) {
        console.error('[/api/gemini/process-audio] Unhandled error:', {
            message: error?.message,
            stack: error?.stack
        });
        return res.status(500).json({
            error: 'Internal server error',
            details: error?.message || String(error)
        });
    }
});

// Route to generate a new dance style glossary dynamically
app.post('/api/gemini/generate-glossary', async (req, res) => {
    try {
        const { styleName } = req.body;
        if (!styleName) {
            return res.status(400).json({ error: 'styleName is required' });
        }
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
        }

        console.log(`[/api/gemini/generate-glossary] Generating vocabulary for "${styleName}"`);

        const prompt = `You are a world-class dance historian and head instructor.
Generate a comprehensive glossary of vocabulary, technical movements, and terminology for the dance style: "${styleName}".
Generate exactly 10 to 18 of the most common, distinct, and important moves, concepts, mechanical terms, or styling terms specific to this dance style.

Return ONLY a valid JSON array matching this schema:
[
  {
    "canonicalTerm": "Canonical Term Name (e.g. Cross Body Lead)",
    "variants": ["variant 1", "variant 2"],
    "category": "foundation | turns | mechanics | head | body | styling | advanced"
  }
]`;

        const result = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                temperature: 0.3,
                responseMimeType: 'application/json'
            },
            contents: [{ parts: [{ text: prompt }] }]
        });

        const cleanText = (result.text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        const terms = JSON.parse(cleanText || '[]');
        return res.json({ terms });

    } catch (error: any) {
        console.error('[/api/gemini/generate-glossary] Glossary generation failed:', error);
        return res.status(500).json({ error: 'Failed to generate glossary', details: error.message });
    }
});

// Stripe Subscription Status Route
app.get('/api/stripe/subscription-status', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const result = await getSubscriptionStatus(authHeader);
        return res.json(result);
    } catch (error: any) {
        console.error('[/api/stripe/subscription-status] Error:', error);
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.error || error.message });
    }
});

// Stripe Reactivate Subscription Route
app.post('/api/stripe/reactivate-subscription', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const result = await reactivateSubscription(authHeader);
        return res.json(result);
    } catch (error: any) {
        console.error('[/api/stripe/reactivate-subscription] Error:', error);
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.error || error.message });
    }
});

// Stripe Update Subscription Route (Downgrade/Upgrade API)
app.post('/api/stripe/update-subscription', async (req, res) => {
    try {
        console.log('[/api/stripe/update-subscription] Request received');
        const { targetTier } = req.body;
        const authHeader = req.headers.authorization;
        const result = await updateSubscription(targetTier, authHeader);
        return res.json(result);
    } catch (error: any) {
        console.error('[/api/stripe/update-subscription] Error:', error);
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.error || error.message });
    }
});

// Stripe Cancel Subscription Route
app.post('/api/stripe/cancel-subscription', async (req, res) => {
    try {
        console.log('[/api/stripe/cancel-subscription] Request received');
        const authHeader = req.headers.authorization;
        const result = await cancelSubscription(authHeader);
        return res.json(result);
    } catch (error: any) {
        console.error('[/api/stripe/cancel-subscription] Error:', error);
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.error || error.message });
    }
});

// Stripe Cancel Downgrade Route (Keep Teacher Plan)
app.post('/api/stripe/cancel-downgrade', async (req, res) => {
    try {
        console.log('[/api/stripe/cancel-downgrade] Request received');
        const authHeader = req.headers.authorization;
        const result = await cancelDowngrade(authHeader);
        return res.json(result);
    } catch (error: any) {
        console.error('[/api/stripe/cancel-downgrade] Error:', error);
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.error || error.message });
    }
});

// Stripe Reactivate Subscription Route
app.post('/api/stripe/reactivate-subscription', async (req, res) => {
    try {
        console.log('[/api/stripe/reactivate-subscription] Request received');
        const authHeader = req.headers.authorization;
        const result = await reactivateSubscription(authHeader);
        return res.json(result);
    } catch (error: any) {
        console.error('[/api/stripe/reactivate-subscription] Error:', error);
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.error || error.message });
    }
});

// Stripe Create Checkout Session Route
app.post('/api/stripe/create-checkout-session', async (req, res) => {
    try {
        console.log('[/api/stripe/create-checkout-session] Request received');
        const { targetTier, referralCode, successUrl, cancelUrl } = req.body;
        const authHeader = req.headers.authorization;
        const devOverride = (req.headers['x-dev-override'] as string) || (req.body.devState ? JSON.stringify(req.body.devState) : undefined);

        if (!targetTier || (targetTier !== 'student' && targetTier !== 'teacher')) {
            return res.status(400).json({ error: 'Invalid targetTier: "student" or "teacher" is required.' });
        }

        const host = req.get('host') || 'localhost:8181';
        const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const baseUrl = `${protocol}://${host}`;

        const result = await createCheckoutSession({
            targetTier,
            referralCode,
            successUrl,
            cancelUrl,
            baseUrl,
            authHeader,
            devOverride,
        });

        return res.json(result);
    } catch (error: any) {
        console.error('[/api/stripe/create-checkout-session] Error:', error);
        const statusCode = error?.statusCode || 500;
        return res.status(statusCode).json({
            error: error?.error || error?.message || 'Failed to create checkout session',
            details: error?.details || String(error),
        });
    }
});

// Stripe Confirm Checkout Session Route (Client-side sync on return)
app.post('/api/stripe/confirm-session', async (req, res) => {
    try {
        const { sessionId, tier } = req.body;
        const authHeader = req.headers.authorization;
        const result = await confirmCheckoutSession({
            sessionId,
            targetTier: tier,
            authHeader,
        });
        return res.json(result);
    } catch (error: any) {
        console.error('[/api/stripe/confirm-session] Error:', error);
        return res.status(500).json({ error: error?.message || 'Failed to confirm session' });
    }
});

// Stripe Create One-Time Top-Up Checkout Route (+10 Sessions, +100 Clips for €3.99)
app.post('/api/stripe/create-topup-checkout', async (req, res) => {
    try {
        console.log('[/api/stripe/create-topup-checkout] Request received');
        const { successUrl, cancelUrl } = req.body;
        const authHeader = req.headers.authorization;
        const devOverride = (req.headers['x-dev-override'] as string) || (req.body.devState ? JSON.stringify(req.body.devState) : undefined);

        const host = req.get('host') || 'localhost:8181';
        const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const baseUrl = `${protocol}://${host}`;

        const result = await createTopupCheckoutSession({
            successUrl,
            cancelUrl,
            baseUrl,
            authHeader,
            devOverride,
        });

        return res.json(result);
    } catch (error: any) {
        console.error('[/api/stripe/create-topup-checkout] Error:', error);
        const statusCode = error?.statusCode || 500;
        return res.status(statusCode).json({
            error: error?.error || error?.message || 'Failed to create top-up checkout session',
            details: error?.details || String(error),
        });
    }
});

// Stripe Create Customer Portal Session Route
app.post('/api/stripe/create-portal-session', async (req, res) => {
    try {
        console.log('[/api/stripe/create-portal-session] Request received');
        const { returnUrl } = req.body;
        const authHeader = req.headers.authorization;

        const host = req.get('host') || 'localhost:8181';
        const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const baseUrl = `${protocol}://${host}`;

        const result = await createPortalSession({
            authHeader,
            baseUrl,
            returnUrl,
        });

        return res.json(result);
    } catch (error: any) {
        console.error('[/api/stripe/create-portal-session] Error:', error);
        const statusCode = error?.statusCode || 500;
        return res.status(statusCode).json({
            error: error?.error || error?.message || 'Failed to create billing portal session',
            details: error?.details || String(error),
        });
    }
});

// Referral Redeem Route
app.post('/api/referrals/redeem', async (req, res) => {
    try {
        const { referralCode } = req.body;
        const authHeader = req.headers.authorization;
        const user = await getAuthenticatedUser(authHeader);

        if (!user) {
            return res.status(401).json({ error: 'Authentication required to redeem referral code.' });
        }

        const result = await redeemReferralCode(user.id, referralCode);
        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (error: any) {
        console.error('[/api/referrals/redeem] Error:', error);
        return res.status(500).json({ error: error?.message || 'Failed to redeem referral code' });
    }
});

// Referral Stats Route
app.get('/api/referrals/stats', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const user = await getAuthenticatedUser(authHeader);

        if (!user) {
            return res.status(401).json({ error: 'Authentication required to fetch referral stats.' });
        }

        const stats = await getReferralStats(user.id);
        return res.json(stats);
    } catch (error: any) {
        console.error('[/api/referrals/stats] Error:', error);
        return res.status(500).json({ error: error?.message || 'Failed to fetch referral stats' });
    }
});

// Fetch shared session by share code (includes topic tags, report, clips, media)
app.get('/api/sessions/shared/:shareCode', async (req, res) => {
    try {
        const shareCode = (req.params.shareCode || '').trim().toUpperCase();
        if (!shareCode || shareCode.length !== 6) {
            return res.status(400).json({ error: 'Invalid share code' });
        }

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
        if (!supabaseUrl || !serviceKey) {
            return res.status(500).json({ error: 'Supabase server configuration is missing.' });
        }

        const adminSupabase = createClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: session, error: sessionErr } = await adminSupabase
            .from('sessions')
            .select('*')
            .eq('shareId', shareCode)
            .eq('deleted', false)
            .maybeSingle();

        if (sessionErr || !session) {
            return res.status(404).json({ error: 'Shared session not found' });
        }

        const result: any = {
            title: session.title,
            subtitle: session.subtitle,
            date: session.date,
        };

        const sharedContent = session.sharedContent || {};

        if (sharedContent.topics === undefined || sharedContent.topics === true) {
            if (Array.isArray(session.tags) && session.tags.length > 0) {
                result.tags = session.tags;
            }
        }

        if (sharedContent.notes) {
            result.notes = session.notes;
        }

        if (sharedContent.report) {
            const { data: report } = await adminSupabase
                .from('finalreports')
                .select('*')
                .eq('sessionId', session.id)
                .eq('deleted', false)
                .maybeSingle();
            if (report) {
                result.report = report.report;
                result.reportTimestamp = report.timestamp;
            }
        }

        if (sharedContent.transcripts || sharedContent.media) {
            const { data: audios } = await adminSupabase
                .from('audios')
                .select('*')
                .eq('sessionId', session.id)
                .eq('deleted', false);

            if (audios && audios.length > 0) {
                result.transcripts = audios.map((a: any) => ({
                    filename: a.filename,
                    timestamp: a.timestamp,
                    transcript: sharedContent.transcripts ? a.transcript : null,
                    strictSummary: sharedContent.transcripts ? a.strictSummary : null,
                    expandedInsights: sharedContent.transcripts ? a.expandedInsights : null,
                    audio_storage_path: sharedContent.media ? a.audio_storage_path : null
                }));
            }
        }

        if (sharedContent.media) {
            const { data: media } = await adminSupabase
                .from('sessionmedia')
                .select('*')
                .eq('sessionId', session.id)
                .eq('deleted', false);

            if (media && media.length > 0) {
                result.mediaItems = media.map((m: any) => ({
                    filename: m.filename,
                    mimeType: m.mimeType,
                    timestamp: m.timestamp,
                    media_storage_path: m.media_storage_path,
                    isLessonVideo: m.isLessonVideo
                }));
            }
        }

        return res.json(result);
    } catch (err: any) {
        console.error('[/api/sessions/shared/:shareCode] Error:', err);
        return res.status(500).json({ error: err?.message || 'Failed to fetch shared session' });
    }
});

// Delete User Account Route
app.post('/api/user/delete-account', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const user = await getAuthenticatedUser(authHeader);

        if (!user) {
            return res.status(401).json({ error: 'Authentication required to delete account.' });
        }

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

        if (!supabaseUrl || !serviceKey) {
            return res.status(500).json({ error: 'Supabase server configuration is missing.' });
        }

        const adminSupabase = createClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        console.log(`[delete-account] Permanently deleting all data and auth identity for user ${user.id}...`);

        // 1. Delete rows from all user tables to ensure no FK or orphaned data remains
        await Promise.allSettled([
            adminSupabase.from('sessions').delete().eq('user_id', user.id),
            adminSupabase.from('audios').delete().eq('user_id', user.id),
            adminSupabase.from('finalReports').delete().eq('user_id', user.id),
            adminSupabase.from('sessionGroups').delete().eq('user_id', user.id),
            adminSupabase.from('sessionMedia').delete().eq('user_id', user.id),
            adminSupabase.from('usage_tracking').delete().eq('user_id', user.id),
            adminSupabase.from('profiles').delete().eq('id', user.id),
        ]);

        // 2. Delete user identity from Supabase Auth
        const { error: deleteAuthErr } = await adminSupabase.auth.admin.deleteUser(user.id);
        if (deleteAuthErr) {
            console.error('[delete-account] Failed to delete from auth.users:', deleteAuthErr);
            return res.status(500).json({ error: deleteAuthErr.message });
        }

        console.log(`[delete-account] User ${user.id} successfully wiped from Supabase Auth and all tables.`);
        return res.json({ success: true });
    } catch (error: any) {
        console.error('[delete-account] Unexpected error:', error);
        return res.status(500).json({ error: error?.message || 'Failed to delete account' });
    }
});

// Backfill missing referral codes for existing users in background
backfillMissingReferralCodes().catch(err => console.warn('[server] Referral code backfill error:', err));

// Serve frontend assets (Development mode)
if (process.env.NODE_ENV !== 'production') {
    console.log('[server] Mounting Vite dev middleware...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
    });
    app.use(vite.middlewares);
}

// Fallback route: in production, all non-API routes return dist/index.html
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        if (req.path.startsWith('/src/') || req.path.endsWith('.tsx') || req.path.endsWith('.ts')) {
            return res.status(404).type('text/plain').send('Not found');
        }
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(path.join(__dirname, '../dist/index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`[server] Running on port ${PORT}`);
    console.log(`[server] GEMINI_API_KEY present: ${!!GEMINI_API_KEY}`);
});
