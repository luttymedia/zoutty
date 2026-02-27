import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve __dirname since we are in an ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve the built React frontend from the dist folder
app.use(express.static(path.join(__dirname, '../dist')));
app.use(express.json({ limit: '50mb' }));

// Basic health route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Gemini Process Audio Route
app.post('/api/gemini/process-audio', async (req, res) => {
    try {
        const { sessionId, audios } = req.body;
        if (!sessionId || !audios || !Array.isArray(audios)) {
            return res.status(400).json({ error: 'Invalid payload' });
        }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
        }

        const glossaryPath = path.resolve(process.cwd(), 'zoukGlossary.json');
        let zoukGlossary = {};
        if (fs.existsSync(glossaryPath)) {
            zoukGlossary = JSON.parse(fs.readFileSync(glossaryPath, 'utf-8'));
        }

        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        let transcripts: { audioId: string, text: string }[] = [];
        let summaries: string[] = [];

        for (let i = 0; i < audios.length; i++) {
            const audio = audios[i];
            const audioId = audio.audioId || `audio-${i}`;
            const language = audio.language || 'Auto';
            const mimeType = audio.mimeType || 'audio/webm';

            const prompt = `You are an expert Brazilian Zouk instructor. Transcribe and analyze this Brazilian Zouk lesson audio.
The student's language preference is: ${language}.
Here is a glossary of terms you should use if relevant: ${JSON.stringify(zoukGlossary)}.
Return ONLY valid JSON with exactly these keys:
- transcript (string): The transcript of the audio in its original language.
- summary (array of strings): Key points and optional "homework/technique" highlights in concise bullet points.
Do not use markdown formatting like \`\`\`json.`;

            const requestBody = {
                contents: [
                    {
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: audio.base64
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            };

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                console.error('Gemini API Error for audio:', response.statusText);
                continue;
            }

            const data = await response.json();
            const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textResult) {
                try {
                    const parsed = JSON.parse(textResult);
                    transcripts.push({
                        audioId: audioId,
                        text: parsed.transcript || ''
                    });
                    if (parsed.summary && Array.isArray(parsed.summary)) {
                        summaries = summaries.concat(parsed.summary);
                    }
                } catch (e) {
                    console.error('JSON parse error from Gemini', e, textResult);
                }
            }
        }

        const finalSummary = summaries.map(s => ({ bullet: s }));

        res.json({
            transcripts: transcripts,
            summary: finalSummary
        });

    } catch (error) {
        console.error('Error processing audio route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fallback route: all non-API routes return dist/index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
