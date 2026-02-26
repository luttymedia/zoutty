import { GoogleGenAI, Type } from "@google/genai";
import { AudioEntry, Language, Session } from "../types";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function transcribeAudio(blob: Blob, language: Language): Promise<{ transcript: string; bulletPoints: string[] }> {
  const model = genAI.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: blob.type,
              data: await blobToBase64(blob)
            }
          },
          {
            text: `Transcribe this Zouk dance lesson audio. 
            Language: ${language === 'auto' ? 'Detect automatically' : language}.
            Output the full transcript and a list of key technical points as bullet points.
            Format the response as JSON with "transcript" and "bulletPoints" (array of strings) fields.`
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          transcript: { type: Type.STRING },
          bulletPoints: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["transcript", "bulletPoints"]
      }
    }
  });

  const response = await model;
  return JSON.parse(response.text || "{}");
}

export async function consolidateSession(
  session: Session, 
  entries: AudioEntry[], 
  previousSummary?: string
): Promise<string> {
  const allBulletPoints = entries.flatMap(e => e.bulletPoints || []).join("\n- ");
  
  const prompt = `
    Consolidate the following Zouk lesson notes into a final summary report.
    
    Current Session Title: ${session.title}
    Current Session Points:
    - ${allBulletPoints}
    
    ${previousSummary ? `Previous Session Summary for Context:\n${previousSummary}` : "No previous session context available."}
    
    Provide a structured summary that highlights:
    1. Main concepts covered today.
    2. Specific technical corrections or improvements.
    3. How this builds on the previous lesson (if context provided).
    4. Focus areas for practice.
    
    Use a clean, professional tone. Output in Markdown.
  `;

  const model = genAI.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt
  });

  const response = await model;
  return response.text || "Failed to generate summary.";
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
