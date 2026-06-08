import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('[server] CRITICAL: GEMINI_API_KEY environment variable is not set. Gemini routes will fail.');
}

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY || '' });

const app = express();
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

// Body parsing — MUST come before routes
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

async function processAudioWithGemini(base64Audio: string, mimeType: string, language: string, danceGlossary: any, danceStyle = 'Auto') {
    let totalPromptTokens = 0;
    let totalResponseTokens = 0;

    const languageNames: Record<string, string> = {
        'pt-br': 'Portuguese',
        'es': 'Spanish',
        'en': 'English',
        'auto': 'Auto-Detect'
    };
    const targetLanguage = languageNames[language.toLowerCase()] || 'Auto-Detect';

    // Flatten the glossary JSON into a dense, comma-separated string to save tokens
    const compressedGlossary = Array.isArray(danceGlossary) ? danceGlossary.map((item: any) => {
        const variants = item.variants && item.variants.length > 0 ? ` (${item.variants.join(', ')})` : '';
        return `${item.canonicalTerm || ''}${variants}`;
    }).filter(Boolean).join(', ') : '';

    const isAuto = danceStyle.toLowerCase() === 'auto';
    const glossaryContext = compressedGlossary ? `\n\nKnown ${isAuto ? 'dance' : danceStyle} terminology to listen for:\n${compressedGlossary}` : '';

    let prompt = '';
    const isTranslate = targetLanguage !== 'Auto-Detect';

    if (isAuto) {
        prompt = `You are an expert dance instructor processing a lesson audio.
Dancers frequently mix languages (e.g. Portuguese terms in Zouk, Spanish in Salsa, French in Caribbean Zouk, English in Lindy Hop). If foreign dance terms are mixed into the spoken language, preserve their original spelling and meaning instead of phonetically translating them.

Provide:
1. A clean transcription of the audio in the language it is spoken. Remove speech disfluencies and false starts.
2. The detected dance style of this lesson (e.g. Brazilian Zouk, Salsa, Bachata, Kizomba, West Coast Swing, or another style).

Return ONLY valid JSON matching this schema:
{
  "transcript": "raw transcription text in the spoken language",
  "detectedStyle": "detected dance style name"
}

${glossaryContext}`;
    } else {
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
        } catch (e) {
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
    } catch (e) {
        console.error('Failed to parse consolidated JSON from Gemini:', e, 'Raw output:', result.text);
        return { strictSummary: [], expandedInsights: { drills: [], homework: [], technicalExpansion: [], emotionalNotes: [] } };
    }
}


// Gemini Process Single Audio Route
app.post('/api/gemini/process-single-audio', async (req, res) => {
    try {
        console.log('[/api/gemini/process-single-audio] Request received');

        const now = Date.now();
        while (audioRequestTimestamps.length > 0 && audioRequestTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
            audioRequestTimestamps.shift();
        }
        if (audioRequestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
            console.warn(`[/api/gemini/process-single-audio] Rate limit exceeded. Current count: ${audioRequestTimestamps.length}`);
            return res.status(429).json({ error: 'Too many audio requests. Maximum 10 per minute allowed.' });
        }
        audioRequestTimestamps.push(now);

        const { sessionId, language, filename, base64Audio, mimeType, glossary, danceStyle } = req.body;

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
            result = await processAudioWithGemini(base64Audio, resolvedMimeType, language || 'Auto', activeGlossary, activeStyle);
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
            mockData: false
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

        const now = Date.now();
        while (audioRequestTimestamps.length > 0 && audioRequestTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
            audioRequestTimestamps.shift();
        }
        if (audioRequestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
            console.warn(`[/api/gemini/process-audio] Rate limit exceeded. Current count: ${audioRequestTimestamps.length}`);
            return res.status(429).json({ error: 'Too many audio requests. Maximum 10 per minute allowed.' });
        }
        audioRequestTimestamps.push(now);

        const { sessionId, audios, glossary, danceStyle, availableGlossaries, appLanguage } = req.body;
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
                const result = await processAudioWithGemini(audio.base64, resolvedMimeType, language, activeGlossary, activeStyle);
                if (result.transcript) {
                    allTranscripts.push(result.transcript);
                    newTranscriptsRecord[audioId] = result.transcript;
                }
                // If we are in Auto mode and haven't matched a glossary yet, check if this transcription detected a style
                if (isAutoStyle && !detectedStyleName && result.detectedStyle && Array.isArray(availableGlossaries)) {
                    const matched = availableGlossaries.find((g: any) => g.name.toLowerCase() === result.detectedStyle.toLowerCase());
                    if (matched) {
                        detectedStyleName = matched.name;
                        activeStyle = matched.name;
                        activeGlossary = matched.terms;
                        console.log(`[/api/gemini/process-audio] Dynamically detected style: ${detectedStyleName}. Switched to its glossary.`);
                    }
                }
            } catch (err: any) {
                console.error(`[/api/gemini/process-audio] Gemini SDK Error for audio id=${audioId}:`, err?.message);
                // Continue with others
            }
        }

        console.log(`[/api/gemini/process-audio] Total transcripts gathered: ${allTranscripts.length}. Synthesizing...`);

        // 3. Synthesize the final consolidated report
        const reportResult = await consolidateTranscriptsWithGemini(allTranscripts, activeGlossary, activeStyle, appLanguage);

        let finalDetectedStyle = detectedStyleName;
        if (reportResult && reportResult.detectedStyle) {
            finalDetectedStyle = reportResult.detectedStyle;
            delete reportResult.detectedStyle;
        }

        return res.json({
            report: reportResult,
            newTranscripts: newTranscriptsRecord,
            detectedStyle: finalDetectedStyle
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

// Sharing endpoints
const SHARE_DIR = path.resolve(__dirname, '../shared');

// Ensure shared directory exists
if (!fs.existsSync(SHARE_DIR)) {
    fs.mkdirSync(SHARE_DIR, { recursive: true });
}

// Cleanup shared files older than 30 days every hour
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
setInterval(() => {
    try {
        if (!fs.existsSync(SHARE_DIR)) return;
        const now = Date.now();
        const files = fs.readdirSync(SHARE_DIR);
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            const filePath = path.join(SHARE_DIR, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > THIRTY_DAYS_MS) {
                fs.unlinkSync(filePath);
                console.log(`[server] Deleted expired shared session: ${file}`);
            }
        }
    } catch (e) {
        console.error('[server] TTL cleanup failed:', e);
    }
}, 60 * 60 * 1000); // 1 hour

app.post('/api/share', (req, res) => {
    try {
        const contentLength = req.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > 2 * 1024 * 1024) {
            return res.status(413).json({ error: 'Payload too large. Maximum size is 2MB.' });
        }

        const body = req.body;
        const sessionData = body.sessionData || body;
        let shareId = body.shareId;

        if (!sessionData || !sessionData.title) {
            return res.status(400).json({ error: 'Invalid shared session data' });
        }

        // Validate or generate shareId
        if (shareId) {
            if (typeof shareId !== 'string' || !/^[a-zA-Z0-9]{6}$/.test(shareId)) {
                return res.status(400).json({ error: 'Invalid share ID format' });
            }
            shareId = shareId.toUpperCase();
        } else {
            // Generate a random 6-character alphanumeric short code
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            shareId = '';
            for (let i = 0; i < 6; i++) {
                shareId += characters.charAt(Math.floor(Math.random() * characters.length));
            }
        }

        const filePath = path.join(SHARE_DIR, `${shareId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2), 'utf-8');

        console.log(`[server] Session shared successfully with ID: ${shareId}`);
        res.json({ shareId });
    } catch (e: any) {
        console.error('Sharing failed:', e);
        res.status(500).json({ error: 'Failed to share session', details: e.message });
    }
});

app.get('/api/share/:shareId', (req, res) => {
    try {
        let { shareId } = req.params;
        if (shareId) {
            shareId = shareId.toUpperCase();
        }
        const filePath = path.join(SHARE_DIR, `${shareId}.json`);

        // Basic path traversal prevention
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(path.resolve(SHARE_DIR))) {
            return res.status(400).json({ error: 'Invalid share ID' });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Shared session not found' });
        }

        const data = fs.readFileSync(filePath, 'utf-8');
        res.json(JSON.parse(data));
    } catch (e: any) {
        console.error('Retrieving shared session failed:', e);
        res.status(500).json({ error: 'Failed to retrieve shared session', details: e.message });
    }
});

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
        res.sendFile(path.join(__dirname, '../dist/index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`[server] Running on port ${PORT}`);
    console.log(`[server] GEMINI_API_KEY present: ${!!GEMINI_API_KEY}`);
});
