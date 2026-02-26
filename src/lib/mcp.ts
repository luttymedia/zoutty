import zoukGlossary from '../../zoukGlossary.json';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result) {
                const b64 = (reader.result as string).split(',')[1];
                resolve(b64);
            } else {
                reject(new Error("Failed to convert blob to base64"));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const callZoukAudioProcessor = async (payload: {
    audio: Blob;
    language: string;
    sessionId: string;
    filename?: string;
}) => {
    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured.");
    }

    const base64Audio = await blobToBase64(payload.audio);
    const mimeType = payload.audio.type || 'audio/webm';

    const prompt = `You are an expert Brazilian Zouk instructor. Transcribe and analyze this Brazilian Zouk lesson audio. 
The student's language preference is: ${payload.language}. 
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

    const requestBody = {
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
        ],
        generationConfig: {
            responseMimeType: "application/json"
        }
    };

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) {
        throw new Error("Invalid response format from Gemini API");
    }

    try {
        const resultJson = JSON.parse(textResult);
        return {
            status: 'success',
            processedAt: new Date().toISOString(),
            ...resultJson,
            mockData: false
        };
    } catch (e) {
        console.error("Failed to parse Gemini response", textResult);
        throw new Error("Failed to parse Gemini response as JSON");
    }
};

export const callZoukSessionConsolidator = async (payload: {
    sessionId: string;
    audios: any[];
    previousReport: any;
}) => {
    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured.");
    }

    const prompt = `You are an expert Brazilian Zouk instructor. Consolidate these Brazilian Zouk lesson audio analyses into a final session report.
Current session audios: ${JSON.stringify(payload.audios, (k, v) => k === 'audioBlob' ? undefined : v)}
Previous session report: ${JSON.stringify(payload.previousReport || null)}
Return ONLY valid JSON with keys: 
- summary (string or array of strings)
- homework (array of strings)
- drills (array of strings)
- coreConcepts (array of strings)
- emotionalThemes (array of strings)
- crossSessionPatterns (array of strings)
- prioritiesNextLesson (array of strings)
Do not use markdown formatting like \`\`\`json.`;

    const requestBody = {
        contents: [
            {
                parts: [
                    { text: prompt }
                ]
            }
        ],
        generationConfig: {
            responseMimeType: "application/json"
        }
    };

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) {
        throw new Error("Invalid response format from Gemini API");
    }

    try {
        return JSON.parse(textResult);
    } catch (e) {
        console.error("Failed to parse Gemini response", textResult);
        throw new Error("Failed to parse Gemini response as JSON");
    }
};
