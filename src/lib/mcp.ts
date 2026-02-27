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
    const base64Audio = await blobToBase64(payload.audio);
    const mimeType = payload.audio.type || 'audio/webm';
    console.log('[mcp] MIME type:', mimeType);
    console.log('[mcp] Base64 length:', base64Audio.length);
    console.log('[mcp] Base64 head:', base64Audio.slice(0, 40));

    const response = await fetch('/api/gemini/process-single-audio', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            sessionId: payload.sessionId,
            language: payload.language,
            filename: payload.filename,
            base64Audio,
            mimeType
        })
    });

    if (!response.ok) {
        let errorMessage = `Backend error: ${response.statusText}`;
        try {
            const errorBody = await response.json();
            if (errorBody.error) {
                errorMessage = errorBody.error;
                if (errorBody.details) {
                    errorMessage += ` — ${errorBody.details}`;
                }
                if (errorBody.retryAfter) {
                    errorMessage += ` (retry after ${errorBody.retryAfter})`;
                }
            }
        } catch (_) {
            // ignore parse errors, keep default message
        }
        throw new Error(errorMessage);
    }

    return await response.json();
};
