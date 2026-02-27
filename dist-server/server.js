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
// Gemini Process Single Audio Route
app.post('/api/gemini/process-single-audio', async (req, res) => {
    try {
        console.log('[/api/gemini/process-single-audio] Request received');
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
        const prompt = `You are an expert Brazilian Zouk instructor. Transcribe and analyze this Brazilian Zouk lesson audio.
The student's language preference is: ${language || 'Auto'}.
Here is a glossary of terms you should use if relevant: ${JSON.stringify(zoukGlossary)}.

You are extracting atomic technical notes from a dance lesson.

Clean the transcription lightly while preserving the speaker’s exact meaning and structure.

Apply only the following cleanup rules:
- Remove filler words such as “uh”, “eh”, “ah”, and similar vocal fillers.
- Remove duplicated fragments caused by self-correction (e.g., “de de de” → “de”).
- Fix obvious mid-sentence restarts (e.g., “no no tempo” → “no tempo”).
- Preserve the original wording and terminology.
- Do NOT rephrase for style.
- Do NOT summarize.
- Do NOT improve clarity beyond removing speech disfluencies.
- Do NOT add new content.

The result should read like a clean spoken explanation, not a rewritten text.

STRICT SUMMARY RULES:

- Return ONLY a JSON object.
- strictSummary must be an array of bullet points.
- Each bullet must express ONE complete idea.
- Each bullet must be self-contained and make sense alone.
- Use concise technical phrasing.
- Do NOT copy transcript sentences verbatim.
- Do NOT invent drills, homework, or theory.
- Do NOT expand beyond what was explicitly stated.
- Do NOT categorize.
- Do NOT use headers.
- Do NOT write paragraphs.
- Keep bullets short but semantically complete.
- Prefer compressed technical wording over conversational phrasing.

EXPANDED INSIGHTS RULES:
- This is a separate section from strictSummary.
- You MAY infer and generate drills, homework, technical expansions, and emotional notes here based on the transcript.
- Must always be present in JSON even if all arrays are empty.

Good example:
Transcript: 'Stay low in plié for control; rise only for speed.'
Output:
{
  "strictSummary": [
    "Soltinho right turn uses plié",
    "Stay low for control",
    "Rise only to increase speed"
  ],
  "expandedInsights": {
    "drills": [],
    "homework": [],
    "technicalExpansion": [],
    "emotionalNotes": []
  },
  "transcript": "Stay low in plié for control; rise only for speed."
}

Bad example of strictSummary array (forbidden conversational style):
[
  "In Soltinho, when the leader turns right, do a plié and stay low for more control."
]

Return format:

{
  "strictSummary": ["..."],
  "expandedInsights": {
    "drills": [],
    "homework": [],
    "technicalExpansion": [],
    "emotionalNotes": []
  },
  "transcript": "..."
}`;
        let response;
        try {
            response = await genAI.models.generateContent({
                model: 'gemini-2.5-flash',
                config: {
                    responseMimeType: 'application/json'
                },
                contents: [
                    {
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: resolvedMimeType,
                                    data: base64Audio
                                }
                            }
                        ]
                    }
                ]
            });
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
        const textResult = response.text;
        if (!textResult) {
            console.error('[/api/gemini/process-single-audio] Gemini returned empty response text');
            return res.status(500).json({ error: 'Gemini returned an empty response' });
        }
        console.log('[Gemini] Raw response length:', textResult.length);
        console.log('[Gemini] Raw response head:', textResult.slice(0, 200));
        // Strip markdown fences if present (e.g. ```json ... ```)
        const cleanText = textResult
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim();
        const emptyResult = {
            strictSummary: [],
            expandedInsights: { drills: [], homework: [], technicalExpansion: [], emotionalNotes: [] },
            transcript: ''
        };
        try {
            const resultJson = JSON.parse(cleanText);
            return res.json({
                status: 'success',
                processedAt: new Date().toISOString(),
                ...emptyResult,
                ...resultJson,
                mockData: false
            });
        }
        catch (parseError) {
            console.error('[/api/gemini/process-single-audio] Failed to parse Gemini JSON response:', {
                message: parseError?.message,
                rawText: textResult.substring(0, 500)
            });
            return res.json({
                status: 'success',
                processedAt: new Date().toISOString(),
                ...emptyResult,
                transcript: cleanText,
                mockData: false
            });
        }
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
            const prompt = `You are an expert Brazilian Zouk instructor. Transcribe and analyze this Brazilian Zouk lesson audio.
The student's language preference is: ${language}.
Here is a glossary of terms you should use if relevant: ${JSON.stringify(zoukGlossary)}.

You are extracting atomic technical notes from a dance lesson.

Clean the transcription lightly while preserving the speaker’s exact meaning and structure.

Apply only the following cleanup rules:
- Remove filler words such as “uh”, “eh”, “ah”, and similar vocal fillers.
- Remove duplicated fragments caused by self-correction (e.g., “de de de” → “de”).
- Fix obvious mid-sentence restarts (e.g., “no no tempo” → “no tempo”).
- Preserve the original wording and terminology.
- Do NOT rephrase for style.
- Do NOT summarize.
- Do NOT improve clarity beyond removing speech disfluencies.
- Do NOT add new content.

The result should read like a clean spoken explanation, not a rewritten text.

STRICT SUMMARY RULES:

- Return ONLY a JSON object.
- strictSummary must be an array of bullet points.
- Each bullet must express ONE complete idea.
- Each bullet must be self-contained and make sense alone.
- Use concise technical phrasing.
- Do NOT copy transcript sentences verbatim.
- Do NOT invent drills, homework, or theory.
- Do NOT expand beyond what was explicitly stated.
- Do NOT categorize.
- Do NOT use headers.
- Do NOT write paragraphs.
- Keep bullets short but semantically complete.
- Prefer compressed technical wording over conversational phrasing.

EXPANDED INSIGHTS RULES:
- This is a separate section from strictSummary.
- You MAY infer and generate drills, homework, technical expansions, and emotional notes here based on the transcript.
- Must always be present in JSON even if all arrays are empty.

Good example:
Transcript: 'Stay low in plié for control; rise only for speed.'
Output:
{
  "strictSummary": [
    "Soltinho right turn uses plié",
    "Stay low for control",
    "Rise only to increase speed"
  ],
  "expandedInsights": {
    "drills": [],
    "homework": [],
    "technicalExpansion": [],
    "emotionalNotes": []
  },
  "transcript": "Stay low in plié for control; rise only for speed."
}

Bad example of strictSummary array (forbidden conversational style):
[
  "In Soltinho, when the leader turns right, do a plié and stay low for more control."
]

Return format:

{
  "strictSummary": ["..."],
  "expandedInsights": {
    "drills": [],
    "homework": [],
    "technicalExpansion": [],
    "emotionalNotes": []
  },
  "transcript": "..."
}`;
            try {
                const response = await genAI.models.generateContent({
                    model: 'gemini-2.5-flash',
                    config: {
                        responseMimeType: 'application/json'
                    },
                    contents: [
                        {
                            parts: [
                                { text: prompt },
                                {
                                    inlineData: {
                                        mimeType: resolvedMimeType,
                                        data: audio.base64
                                    }
                                }
                            ]
                        }
                    ]
                });
                const textResult = response.text;
                if (textResult) {
                    console.log('[Gemini bulk] Raw response head:', textResult.slice(0, 200));
                    const cleanText = textResult
                        .replace(/^```(?:json)?\s*/i, '')
                        .replace(/```\s*$/i, '')
                        .trim();
                    try {
                        const parsed = JSON.parse(cleanText);
                        transcripts.push({
                            audioId: audioId,
                            text: parsed.transcript || ''
                        });
                        // Accumulate strictSummary (flat array)
                        if (Array.isArray(parsed.strictSummary)) {
                            strictSummaryAccum.push(...parsed.strictSummary);
                        }
                        // Accumulate expandedInsights arrays
                        if (parsed.expandedInsights) {
                            const ei = parsed.expandedInsights;
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
                    catch (parseErr) {
                        console.error(`[/api/gemini/process-audio] JSON parse failed for audio ${audioId}:`, parseErr);
                        // Fallback: treat whole response as transcript
                        transcripts.push({ audioId: audioId, text: cleanText });
                    }
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
