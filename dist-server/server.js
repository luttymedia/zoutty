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
const audioRequestTimestamps = [];
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 10;
// Resolve __dirname since we are in an ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Body parsing — MUST come before routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Serve the built React frontend from the dist folder
app.use(express.static(path.join(__dirname, '../dist')));
// Basic health route
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        geminiKeyPresent: !!GEMINI_API_KEY,
        timestamp: new Date().toISOString()
    });
});
async function processAudioWithGemini(base64Audio, mimeType, language, zoukGlossary) {
    let totalPromptTokens = 0;
    let totalResponseTokens = 0;
    // Flatten the glossary JSON into a dense, comma-separated string to save tokens
    const compressedGlossary = Array.isArray(zoukGlossary) ? zoukGlossary.map((item) => {
        const variants = item.variants && item.variants.length > 0 ? ` (${item.variants.join(', ')})` : '';
        return `${item.canonicalTerm || ''}${variants}`;
    }).filter(Boolean).join(', ') : '';
    const glossaryContext = compressedGlossary ? `\n\nKnown Brazilian Zouk terminology to listen for:\n${compressedGlossary}` : '';
    const prompt = `You are an expert Brazilian Zouk instructor processing a lesson audio (Language: ${language || 'Auto'}).
Provide a clean transcription of the audio.
- Remove speech disfluencies and false starts.
- Preserve exact technical meaning and terminology.
- Output ONLY the raw transcription text. No JSON, no markdown.

${glossaryContext}`;
    const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash', // Fast and accurate for transcribing
        config: {
            temperature: 0.1, // Very low temp for stable transcription
            maxOutputTokens: 2000,
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
    return {
        transcript: (result.text || '').trim()
    };
}
async function consolidateTranscriptsWithGemini(transcripts, zoukGlossary) {
    if (!transcripts || transcripts.length === 0)
        return null;
    // Flatten the glossary
    const compressedGlossary = Array.isArray(zoukGlossary) ? zoukGlossary.map((item) => {
        const variants = item.variants && item.variants.length > 0 ? ` (${item.variants.join(', ')})` : '';
        return `${item.canonicalTerm || ''}${variants}`;
    }).filter(Boolean).join(', ') : '';
    const glossaryContext = compressedGlossary ? `\n\nBrazilian Zouk Glossary for reference:\n${compressedGlossary}` : '';
    const combinedTranscripts = transcripts.map((t, i) => `--- Clip ${i + 1} Transcription ---\n${t}`).join('\n\n');
    const prompt = `You are a world-class Brazilian Zouk head instructor. 
Below are multiple transcriptions from various moments of a single Zouk lesson.
Your task is to provide a single, cohesive, "Consolidated Session Report" that synthesizes ALL the technical information while ELIMINATING redundancies.

CRITICAL: 
- If multiple clips discuss the same concept (e.g. "Frame", "Lateral step"), do NOT mention it multiple times.
- Summarize the repetitive information into the most complete and clear technical description possible.
- The goal is to provide a unified summary of what was taught across the whole session.

Perform these tasks and return the result EXACTLY as a JSON object:

1. strictSummary: Extract atomic technical notes. Each bullet must be self-contained (ONE complete technical idea). Use concise, dense technical phrasing. 
2. expandedInsights: Infer drills, homework, technical expansions, and emotional notes based on the combined information.

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
  }
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
        const now = Date.now();
        while (audioRequestTimestamps.length > 0 && audioRequestTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
            audioRequestTimestamps.shift();
        }
        if (audioRequestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
            console.warn(`[/api/gemini/process-single-audio] Rate limit exceeded. Current count: ${audioRequestTimestamps.length}`);
            return res.status(429).json({ error: 'Too many audio requests. Maximum 10 per minute allowed.' });
        }
        audioRequestTimestamps.push(now);
        const { sessionId, language, filename, base64Audio, mimeType } = req.body;
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
        const glossaryPath = path.resolve(process.cwd(), 'zoukGlossary.json');
        let zoukGlossary = {};
        if (fs.existsSync(glossaryPath)) {
            try {
                zoukGlossary = JSON.parse(fs.readFileSync(glossaryPath, 'utf-8'));
            }
            catch (e) {
                console.warn('[/api/gemini/process-single-audio] Failed to parse zoukGlossary.json:', e);
            }
        }
        const resolvedMimeType = mimeType || 'audio/webm';
        console.log(`[/api/gemini/process-single-audio] Processing audio for session=${sessionId}`);
        console.log('MIME:', resolvedMimeType);
        console.log('Base64 length:', base64Audio.length);
        console.log('Base64 head:', base64Audio.slice(0, 40));
        let result;
        try {
            result = await processAudioWithGemini(base64Audio, resolvedMimeType, language || 'Auto', zoukGlossary);
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
            mockData: false
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
        const now = Date.now();
        while (audioRequestTimestamps.length > 0 && audioRequestTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
            audioRequestTimestamps.shift();
        }
        if (audioRequestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
            console.warn(`[/api/gemini/process-audio] Rate limit exceeded. Current count: ${audioRequestTimestamps.length}`);
            return res.status(429).json({ error: 'Too many audio requests. Maximum 10 per minute allowed.' });
        }
        audioRequestTimestamps.push(now);
        const { sessionId, audios } = req.body;
        if (!sessionId || !audios || !Array.isArray(audios)) {
            console.error('[/api/gemini/process-audio] Invalid payload:', { sessionId, audiosType: typeof audios });
            return res.status(400).json({ error: 'Invalid payload: sessionId and audios array are required' });
        }
        if (!GEMINI_API_KEY) {
            console.error('[/api/gemini/process-audio] GEMINI_API_KEY is not configured');
            return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
        }
        const glossaryPath = path.resolve(process.cwd(), 'zoukGlossary.json');
        let zoukGlossary = {};
        if (fs.existsSync(glossaryPath)) {
            try {
                zoukGlossary = JSON.parse(fs.readFileSync(glossaryPath, 'utf-8'));
            }
            catch (e) {
                console.warn('[/api/gemini/process-audio] Failed to parse zoukGlossary.json:', e);
            }
        }
        const allTranscripts = [];
        const newTranscriptsRecord = {};
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
                const result = await processAudioWithGemini(audio.base64, resolvedMimeType, language, zoukGlossary);
                if (result.transcript) {
                    allTranscripts.push(result.transcript);
                    newTranscriptsRecord[audioId] = result.transcript;
                }
            }
            catch (err) {
                console.error(`[/api/gemini/process-audio] Gemini SDK Error for audio id=${audioId}:`, err?.message);
                // Continue with others
            }
        }
        console.log(`[/api/gemini/process-audio] Total transcripts gathered: ${allTranscripts.length}. Synthesizing...`);
        // 3. Synthesize the final consolidated report
        const report = await consolidateTranscriptsWithGemini(allTranscripts, zoukGlossary);
        return res.json({
            report,
            newTranscripts: newTranscriptsRecord
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
// Fallback route: all non-API routes return dist/index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});
app.listen(PORT, () => {
    console.log(`[server] Running on port ${PORT}`);
    console.log(`[server] GEMINI_API_KEY present: ${!!GEMINI_API_KEY}`);
});
