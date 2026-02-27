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
            } catch (e) {
                console.warn('[/api/gemini/process-single-audio] Failed to parse zoukGlossary.json:', e);
            }
        }

        const resolvedMimeType = mimeType || 'audio/webm';
        console.log(`[/api/gemini/process-single-audio] Processing audio for session=${sessionId}, mimeType=${resolvedMimeType}, base64Length=${base64Audio.length}`);

        const prompt = `You are an expert Brazilian Zouk instructor. Transcribe and analyze this Brazilian Zouk lesson audio. 
The student's language preference is: ${language || 'Auto'}. 
Here is a glossary of terms you should use if relevant: ${JSON.stringify(zoukGlossary)}.
Return ONLY valid JSON with keys: 
- transcript (string)
- summary (string)
- concepts (array of strings)
- drills (array of strings)
- homework (array of strings)
- mechanics (array of strings)
- emotionalNotes (array of strings)
Do not use markdown formatting like \`\`\`json.`;

        let response;
        try {
            response = await genAI.models.generateContent({
                model: 'gemini-1.5-flash-001',
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
                ],
                config: {
                    responseMimeType: 'application/json'
                }
            });
        } catch (geminiError: any) {
            console.error('[/api/gemini/process-single-audio] Gemini SDK call failed:', {
                message: geminiError?.message,
                status: geminiError?.status,
                stack: geminiError?.stack
            });
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

        console.log(`[/api/gemini/process-single-audio] Gemini response received, length=${textResult.length}`);

        try {
            const resultJson = JSON.parse(textResult);
            return res.json({
                status: 'success',
                processedAt: new Date().toISOString(),
                ...resultJson,
                mockData: false
            });
        } catch (parseError: any) {
            console.error('[/api/gemini/process-single-audio] Failed to parse Gemini JSON response:', {
                message: parseError?.message,
                rawText: textResult.substring(0, 500)
            });
            return res.status(500).json({
                error: 'Failed to parse Gemini response as JSON',
                details: parseError?.message,
                rawText: textResult.substring(0, 500)
            });
        }

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
            } catch (e) {
                console.warn('[/api/gemini/process-audio] Failed to parse zoukGlossary.json:', e);
            }
        }

        const transcripts: { audioId: string; text: string }[] = [];
        let summaries: string[] = [];

        for (let i = 0; i < audios.length; i++) {
            const audio = audios[i];
            const audioId = audio.audioId || `audio-${i}`;
            const language = audio.language || 'Auto';
            const resolvedMimeType = audio.mimeType || 'audio/webm';

            console.log(`[/api/gemini/process-audio] Processing audio ${i + 1}/${audios.length}, id=${audioId}, mimeType=${resolvedMimeType}`);

            const prompt = `You are an expert Brazilian Zouk instructor. Transcribe and analyze this Brazilian Zouk lesson audio.
The student's language preference is: ${language}.
Here is a glossary of terms you should use if relevant: ${JSON.stringify(zoukGlossary)}.
Return ONLY valid JSON with exactly these keys:
- transcript (string): The transcript of the audio in its original language.
- summary (array of strings): Key points and optional "homework/technique" highlights in concise bullet points.
Do not use markdown formatting like \`\`\`json.`;

            try {
                const response = await genAI.models.generateContent({
                    model: 'gemini-1.5-flash-001',
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
                    ],
                    config: {
                        responseMimeType: 'application/json'
                    }
                });

                const textResult = response.text;
                if (textResult) {
                    const parsed = JSON.parse(textResult);
                    transcripts.push({
                        audioId: audioId,
                        text: parsed.transcript || ''
                    });
                    if (parsed.summary && Array.isArray(parsed.summary)) {
                        summaries = summaries.concat(parsed.summary);
                    }
                }
            } catch (err: any) {
                console.error(`[/api/gemini/process-audio] Gemini SDK Error for audio id=${audioId}:`, {
                    message: err?.message,
                    status: err?.status,
                    stack: err?.stack
                });
                // Continue processing remaining audios even if one fails
            }
        }

        const finalSummary = summaries.map(s => ({ bullet: s }));

        console.log(`[/api/gemini/process-audio] Done. transcripts=${transcripts.length}, bullets=${finalSummary.length}`);

        return res.json({
            transcripts,
            summary: finalSummary
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

// Fallback route: all non-API routes return dist/index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`[server] Running on port ${PORT}`);
    console.log(`[server] GEMINI_API_KEY present: ${!!GEMINI_API_KEY}`);
});
