import { getDevState, saveDevState } from './devLab';
import { supabase } from './supabase';

const blobToBase64 = (blob?: Blob): Promise<string> => {
    return new Promise((resolve) => {
        if (!blob || !(blob instanceof Blob)) {
            resolve('');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result) {
                const b64 = (reader.result as string).split(',')[1] || '';
                resolve(b64);
            } else {
                resolve('');
            }
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
    });
};

export const callZoukAudioProcessor = async (payload: {
    audio: Blob;
    language: string;
    sessionId: string;
    filename?: string;
    glossary?: any[];
    danceStyle?: string;
    signal?: AbortSignal;
}) => {
    const base64Audio = await blobToBase64(payload.audio);
    if (payload.signal?.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
    }
    const mimeType = payload.audio.type || 'audio/webm';
    console.log('[mcp] MIME type:', mimeType);
    console.log('[mcp] Base64 length:', base64Audio.length);
    console.log('[mcp] Base64 head:', base64Audio.slice(0, 40));

    const dev = getDevState();
    const isMock = dev.mockGemini;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-dev-override': JSON.stringify(dev),
    };

    try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
            headers['Authorization'] = `Bearer ${sessionData.session.access_token}`;
        }
    } catch (_) {}

    const response = await fetch('/api/gemini/process-single-audio', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            sessionId: payload.sessionId,
            language: payload.language,
            filename: payload.filename,
            base64Audio,
            mimeType,
            glossary: payload.glossary,
            danceStyle: payload.danceStyle,
            mockMode: isMock
        }),
        signal: payload.signal
    });

    if (!response.ok) {
        let errorMessage = `Backend error: ${response.statusText}`;
        let isQuota = response.status === 403;
        try {
            const errorBody = await response.json();
            if (errorBody.code === 'QUOTA_EXCEEDED' || response.status === 403) {
                isQuota = true;
            }
            if (errorBody.error) {
                errorMessage = errorBody.error;
                if (errorBody.details) {
                    errorMessage += `: ${errorBody.details}`;
                }
                if (errorBody.retryAfter) {
                    errorMessage += ` (retry after ${errorBody.retryAfter})`;
                }
            }
        } catch (_) {
            // ignore parse errors, keep default message
        }
        const err: any = new Error(errorMessage);
        err.isQuota = isQuota;
        throw err;
    }

    const data = await response.json();

    if (isMock) {
        const isFree = dev.tier === 'free';
        const isStudent = dev.tier === 'student';
        const baseClipLimit = isStudent ? 200 : 15;
        const isBeyondBaseClips = !isFree && (dev.period_clips || 0) >= baseClipLimit;
        const hasTopupClips = (dev.topup_extra_clips || 0) > 0;

        if (isBeyondBaseClips && hasTopupClips) {
            saveDevState({
                topup_extra_clips: Math.max(0, dev.topup_extra_clips - 1),
                lifetime_clips: dev.lifetime_clips + 1,
            });
        } else {
            saveDevState({
                lifetime_clips: dev.lifetime_clips + 1,
                period_clips: (dev.period_clips || 0) + 1,
            });
        }
    }

    return data;
};


