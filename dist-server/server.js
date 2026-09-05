import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { checkGatekeeper, recordUsageIncrement } from './server/gatekeeper.js';
import { createCheckoutSession, createTopupCheckoutSession, createPortalSession, handleStripeWebhook, getAuthenticatedUser, confirmCheckoutSession, updateSubscription, cancelSubscription, getSubscriptionStatus, reactivateSubscription } from './server/stripe.js';
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
const audioRequestTimestamps = [];
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
// Serve frontend assets (Production only)
if (process.env.NODE_ENV === 'production') {
    console.log('[server] Running in production mode. Serving static files from dist...');
    app.use(express.static(path.join(__dirname, '../dist')));
}
// Basic health route
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        geminiKeyPresent: !!GEMINI_API_KEY,
        timestamp: new Date().toISOString()
    });
});
async function translateText(text, targetLanguage) {
    if (!text || !targetLanguage || targetLanguage === 'Auto-Detect')
        return text;
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
    }
    catch (e) {
        console.error('[translateText] Failed to translate transcript:', e);
        return text;
    }
}
async function processAudioWithGemini(base64Audio, mimeType, language, danceGlossary, danceStyle = 'Auto', availableGlossaries = []) {
    let totalPromptTokens = 0;
    let totalResponseTokens = 0;
    const languageNames = {
        'pt-br': 'Portuguese',
        'es': 'Spanish',
        'en': 'English',
        'auto': 'Auto-Detect'
    };
    const targetLanguage = languageNames[language.toLowerCase()] || 'Auto-Detect';
    const isAuto = danceStyle.toLowerCase() === 'auto';
    const availableStyleNames = Array.isArray(availableGlossaries)
        ? availableGlossaries.map((g) => typeof g === 'string' ? g : g.name).filter(Boolean)
        : [];
    // If in auto mode without a specific glossary, combine terms across all active styles the user selected
    const effectiveGlossary = (isAuto && (!danceGlossary || (Array.isArray(danceGlossary) && danceGlossary.length === 0)) && Array.isArray(availableGlossaries))
        ? availableGlossaries.flatMap((g) => Array.isArray(g.terms) ? g.terms : [])
        : danceGlossary;
    // Flatten the glossary JSON into a dense, comma-separated string to save tokens
    const compressedGlossary = Array.isArray(effectiveGlossary) ? effectiveGlossary.map((item) => {
        const variants = item.variants && item.variants.length > 0 ? ` (${item.variants.join(', ')})` : '';
        return `${item.canonicalTerm || ''}${variants}`;
    }).filter(Boolean).join(', ') : '';
    const glossaryContext = compressedGlossary ? `\n\nKnown dance terminology to listen for (preserve original spelling):\n${compressedGlossary}` : '';
    let prompt = '';
    const isTranslate = targetLanguage !== 'Auto-Detect';
    if (isAuto) {
        const stylesList = availableStyleNames.length > 0 ? availableStyleNames.join(', ') : 'Brazilian Zouk, Salsa, Bachata, Kizomba, West Coast Swing, or another style';
        prompt = `You are an expert dance instructor processing a lesson audio.
Dancers frequently mix languages (e.g. Portuguese terms in Brazilian Zouk, Spanish in Salsa/Bachata, French in Ballet, etc.). If foreign technical dance terms are mixed into the spoken language, preserve their exact technical spelling and original language rather than phonetically transcribing or mistranslating them.

Provide:
1. A clean transcription of the audio in the language it is spoken. Remove speech disfluencies and false starts.
2. The detected dance style of this lesson (must be one of: ${stylesList}).

Return ONLY valid JSON matching this schema:
{
  "transcript": "raw transcription text in the spoken language",
  "detectedStyle": "detected dance style name"
}

${glossaryContext}`;
    }
    else {
        prompt = `You are an expert ${danceStyle} instructor processing a lesson audio.
Provide a clean transcription of the audio in the language it is spoken.
- Remove speech disfluencies and false starts.
- Preserve exact technical meaning and terminology.
- Output ONLY the raw transcription text in the spoken language. No JSON, no markdown.

${glossaryContext}`;
    }
    const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash', // Fast and accurate for transcribing
        config: {
            temperature: 0.1, // Very low temp for stable transcription
            maxOutputTokens: 2000,
            responseMimeType: isAuto ? 'application/json' : 'text/plain'
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
    if (isAuto) {
        try {
            const cleanText = (result.text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
            const parsed = JSON.parse(cleanText || '{}');
            let transcript = (parsed.transcript || '').trim();
            const detectedStyle = (parsed.detectedStyle || '').trim();
            if (isTranslate && transcript) {
                transcript = await translateText(transcript, targetLanguage);
            }
            return {
                transcript,
                detectedStyle
            };
        }
        catch (e) {
            console.error('Failed to parse detected JSON from Gemini, fallback to raw text:', e);
            let fallbackTranscript = (result.text || '').trim();
            if (isTranslate && fallbackTranscript) {
                fallbackTranscript = await translateText(fallbackTranscript, targetLanguage);
            }
            return {
                transcript: fallbackTranscript,
                detectedStyle: undefined
            };
        }
    }
    let transcript = (result.text || '').trim();
    if (isTranslate && transcript) {
        transcript = await translateText(transcript, targetLanguage);
    }
    return {
        transcript
    };
}
async function consolidateTranscriptsWithGemini(transcripts, danceGlossary, danceStyle = 'Auto', appLanguage = 'en') {
    if (!transcripts || transcripts.length === 0)
        return null;
    // Flatten the glossary
    const compressedGlossary = Array.isArray(danceGlossary) ? danceGlossary.map((item) => {
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
- The goal is to provide a unified summary of what was taught across the whole session.
- Write the text content/values of all array elements in the JSON (i.e. all items inside strictSummary, drills, homework, technicalExpansion, and emotionalNotes) in ${targetLanguageName}. Do not translate the JSON keys (keep them exactly as "strictSummary", "expandedInsights", "drills", "homework", "technicalExpansion", "emotionalNotes"${isAuto ? ', "detectedStyle"' : ''}).

Perform these tasks and return the result EXACTLY as a JSON object:

1. strictSummary: Extract atomic technical notes. Each bullet must be self-contained (ONE complete technical idea). Use concise, dense technical phrasing. 
2. expandedInsights: Infer drills, homework, technical expansions, and emotional notes based on the combined information.
${isAuto ? '3. detectedStyle: Detect the specific dance style of this lesson (e.g., Brazilian Zouk, Salsa, Bachata, Kizomba, West Coast Swing, etc.) based on the transcription contents.' : ''}

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
  }${isAuto ? ',\n  "detectedStyle": "detected dance style name"' : ''}
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
    }
    catch (e) {
        console.error('Failed to parse consolidated JSON from Gemini:', e, 'Raw output:', result.text);
        return { strictSummary: [], expandedInsights: { drills: [], homework: [], technicalExpansion: [], emotionalNotes: [] } };
    }
}
// Gemini Process Single Audio Route
app.post('/api/gemini/process-single-audio', async (req, res) => {
    try {
        console.log('[/api/gemini/process-single-audio] Request received');
        const { sessionId, language, filename, base64Audio, mimeType, glossary, danceStyle, availableGlossaries, mockMode, durationSeconds } = req.body;
        const authHeader = req.headers.authorization;
        const devOverride = req.headers['x-dev-override'] || (req.body.devState ? JSON.stringify(req.body.devState) : undefined);
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
        }
        catch (geminiError) {
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
            strictSummary: [],
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
    }
    catch (error) {
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
        const devOverride = req.headers['x-dev-override'] || (req.body.devState ? JSON.stringify(req.body.devState) : undefined);
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
            const newTranscriptsRecord = {};
            if (Array.isArray(audios)) {
                for (let i = 0; i < audios.length; i++) {
                    const audioId = audios[i]?.audioId || `audio-${i}`;
                    if (!audios[i]?.transcript) {
                        newTranscriptsRecord[audioId] = `Simulated transcript for clip ${i + 1} (Mock Mode active): Key technical concepts and movement timing.`;
                    }
                }
            }
            const style = (!danceStyle || danceStyle.toLowerCase() === 'auto') ? 'Brazilian Zouk' : danceStyle;
            return res.json({
                report: {
                    strictSummary: [
                        "Maintain soft, elastic connection in closed frame without tension in the shoulders.",
                        "Initiate lateral steps by shifting body weight smoothly on counts 1 and 2.",
                        "Use torso rotation rather than arm pushing to indicate direction changes."
                    ],
                    expandedInsights: {
                        drills: [
                            "Practice 8 counts of basic step in place with eyes closed to build balance and weight sensation.",
                            "Lead-and-follow resistance drill with a small ball between torsos."
                        ],
                        homework: [
                            "Daily 5-minute footwork drill maintaining constant ground contact."
                        ],
                        technicalExpansion: [
                            "Ensure ribcage leads the turn before the feet step to prevent balance breakdown."
                        ],
                        emotionalNotes: [
                            "Great musicality on the slow sections; focus on breathing together through the transitions."
                        ]
                    }
                },
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
        const allTranscripts = [];
        const newTranscriptsRecord = {};
        let detectedStyleName = undefined;
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
                // If we are in Auto mode and haven't matched a glossary yet, check if this transcription detected a style
                if (isAutoStyle && !detectedStyleName && result.detectedStyle && Array.isArray(availableGlossaries)) {
                    const matched = availableGlossaries.find((g) => g.name.toLowerCase() === result.detectedStyle.toLowerCase());
                    if (matched) {
                        detectedStyleName = matched.name;
                        activeStyle = matched.name;
                        activeGlossary = matched.terms;
                        console.log(`[/api/gemini/process-audio] Dynamically detected style: ${detectedStyleName}. Switched to its glossary.`);
                    }
                }
            }
            catch (err) {
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
        return res.json({
            report: reportResult,
            newTranscripts: newTranscriptsRecord,
            detectedStyle: finalDetectedStyle,
            tier: gate.tier,
            usage: gate.usage,
            limits: gate.limits
        });
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('[/api/stripe/cancel-subscription] Error:', error);
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
        const devOverride = req.headers['x-dev-override'] || (req.body.devState ? JSON.stringify(req.body.devState) : undefined);
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
    }
    catch (error) {
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
    }
    catch (error) {
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
        const devOverride = req.headers['x-dev-override'] || (req.body.devState ? JSON.stringify(req.body.devState) : undefined);
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
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('[/api/referrals/stats] Error:', error);
        return res.status(500).json({ error: error?.message || 'Failed to fetch referral stats' });
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
        res.sendFile(path.join(__dirname, '../dist/index.html'));
    });
}
app.listen(PORT, () => {
    console.log(`[server] Running on port ${PORT}`);
    console.log(`[server] GEMINI_API_KEY present: ${!!GEMINI_API_KEY}`);
});
