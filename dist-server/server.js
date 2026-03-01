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
Perform the following three tasks based on the audio and return the result EXACTLY as a single JSON object.

1. transcript: Provide a clean transcription. Remove speech disfluencies and false starts, but preserve exact meaning and terminology.
2. strictSummary: Extract atomic technical notes from the lesson. Each bullet must be self-contained (ONE complete technical idea). Use concise, compressed technical phrasing (no conversational filler).
3. expandedInsights: Infer drills, homework, technical expansions, and emotional notes based ONLY on the audio. Leave arrays empty if inapplicable.
${glossaryContext}

Do not include any markdown formatting like \`\`\`json. Return ONLY valid JSON matching this schema:
{
  "transcript": "Full clean transcription here...",
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
            temperature: 0.2, // Low temp for more accurate transcription
            maxOutputTokens: 2500, // Enough room for long transcripts + JSON structure
            responseMimeType: 'application/json'
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
    let transcript = '';
    let strictSummary = [];
    let expandedInsights = { drills: [], homework: [], technicalExpansion: [], emotionalNotes: [] };
    try {
        const cleanText = (result.text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleanText || '{}');
        transcript = parsed.transcript || '';
        strictSummary = Array.isArray(parsed.strictSummary) ? parsed.strictSummary : [];
        if (parsed.expandedInsights) {
            expandedInsights = { ...expandedInsights, ...parsed.expandedInsights };
        }
    }
    catch (e) {
        console.error('Failed to parse combined JSON from Gemini:', e, 'Raw output:', result.text);
    }
    console.log(`[Gemini Usage] Prompt: ${totalPromptTokens} tokens`);
    console.log(`[Gemini Usage] Response: ${totalResponseTokens} tokens`);
    console.log(`[Gemini Usage] Total: ${totalTokens} tokens`);
    return {
        transcript,
        strictSummary,
        expandedInsights
    };
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
        const transcripts = [];
        const strictSummaryAccum = [];
        const expandedInsightsAccum = { drills: [], homework: [], technicalExpansion: [], emotionalNotes: [] };
        for (let i = 0; i < audios.length; i++) {
            const audio = audios[i];
            const audioId = audio.audioId || `audio-${i}`;
            const language = audio.language || 'Auto';
            const resolvedMimeType = audio.mimeType || 'audio/webm';
            console.log(`[/api/gemini/process-audio] Processing audio ${i + 1}/${audios.length}, id=${audioId}`);
            console.log('MIME:', resolvedMimeType);
            console.log('Base64 length:', audio.base64?.length || 0);
            console.log('Base64 head:', (audio.base64 || '').slice(0, 40));
            try {
                const result = await processAudioWithGemini(audio.base64, resolvedMimeType, language, zoukGlossary);
                transcripts.push({
                    audioId: audioId,
                    text: result.transcript || ''
                });
                if (Array.isArray(result.strictSummary)) {
                    strictSummaryAccum.push(...result.strictSummary);
                }
                if (result.expandedInsights) {
                    const ei = result.expandedInsights;
                    if (Array.isArray(ei.drills))
                        expandedInsightsAccum.drills.push(...ei.drills);
                    if (Array.isArray(ei.homework))
                        expandedInsightsAccum.homework.push(...ei.homework);
                    if (Array.isArray(ei.technicalExpansion))
                        expandedInsightsAccum.technicalExpansion.push(...ei.technicalExpansion);
                    if (Array.isArray(ei.emotionalNotes))
                        expandedInsightsAccum.emotionalNotes.push(...ei.emotionalNotes);
                }
            }
            catch (err) {
                const errStatus = err?.status || err?.code;
                const isQuotaErr = errStatus === 429 || (err?.message || '').toLowerCase().includes('quota');
                console.error(`[/api/gemini/process-audio] Gemini SDK Error for audio id=${audioId}:`, {
                    message: err?.message,
                    status: errStatus,
                    stack: err?.stack
                });
                if (isQuotaErr) {
                    const retryDelay = err?.retryDelay || err?.details?.[0]?.retryDelay;
                    // Stop processing further — quota is exhausted
                    return res.status(429).json({
                        error: 'Gemini API quota exceeded. Please wait a moment and try again.',
                        details: err?.message || String(err),
                        retryAfter: retryDelay
                    });
                }
                // Continue processing remaining audios even if one fails
            }
        }
        console.log(`[/api/gemini/process-audio] Done. transcripts=${transcripts.length}`);
        return res.json({
            transcripts,
            strictSummary: strictSummaryAccum,
            expandedInsights: expandedInsightsAccum
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
