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
        throw new Error(`Backend error: ${response.statusText}`);
    }

    return await response.json();
};
