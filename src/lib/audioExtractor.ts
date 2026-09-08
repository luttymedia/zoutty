/**
 * Audio extraction utility for media files.
 * Extracts and downmixes the audio stream from video files (mp4, mov, webm, etc.)
 * into a lightweight 16kHz 16-bit mono WAV blob.
 *
 * Why 16kHz Mono WAV:
 * 1. Immediate offline rendering via OfflineAudioContext (takes ~0.5-1s for a 3-minute clip,
 *    faster than real-time playback needed by MediaRecorder).
 * 2. Downsampling from 44.1/48kHz stereo to 16kHz mono reduces raw PCM size by ~83%,
 *    producing ~1.9 MB per minute.
 * 3. 16kHz mono is the optimal native sampling rate for speech models like Gemini.
 * 4. 100% cross-browser compatible (iOS Safari, Android Chrome, Desktop).
 */

const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'm4v',
  'mov',
  'webm',
  'mkv',
  'avi',
  '3gp',
  '3gpp',
  'ts',
  'mts',
  'flv',
  'wmv'
]);

/**
 * Checks if a given file or blob is a video file by MIME type or file extension.
 */
export const isVideoFile = (file: File | Blob): boolean => {
  if (file.type && file.type.startsWith('video/')) {
    return true;
  }
  if (file instanceof File && file.name) {
    const parts = file.name.split('.');
    if (parts.length > 1) {
      const ext = parts.pop()?.toLowerCase() || '';
      return VIDEO_EXTENSIONS.has(ext);
    }
  }
  return false;
};

/**
 * Encodes an AudioBuffer into standard 16-bit PCM mono WAV format.
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = 1; // mono
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const channelData = buffer.getChannelData(0);
  const dataByteLength = channelData.length * bytesPerSample;
  const headerByteLength = 44;
  const totalByteLength = headerByteLength + dataByteLength;

  const arrayBuffer = new ArrayBuffer(totalByteLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF identifier
  writeString(0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + dataByteLength, true);
  // RIFF type
  writeString(8, 'WAVE');
  // format chunk identifier
  writeString(12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, format, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * blockAlign)
  view.setUint32(28, sampleRate * blockAlign, true);
  // block align
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(36, 'data');
  // data chunk length
  view.setUint32(40, dataByteLength, true);

  // Write 16-bit PCM samples with clipping protection
  let offset = 44;
  for (let i = 0; i < channelData.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

export interface ExtractedAudioResult {
  blob: Blob;
  duration: number;
  filename: string;
}

/**
 * Extracts the audio track from a video file, downmixing to 16kHz mono WAV.
 * This runs fast offline in background (typically under 1s for short clips).
 */
export async function extractAudioFromVideo(file: File): Promise<ExtractedAudioResult> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API is not supported in this browser.');
  }

  const audioCtx = new AudioContextClass();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const duration = decodedBuffer.duration;
    if (!duration || duration <= 0 || decodedBuffer.length === 0) {
      throw new Error('No audio track or empty audio found in video.');
    }

    // Downsample to 16,000 Hz mono using OfflineAudioContext (speech recognition optimal)
    const TARGET_SAMPLE_RATE = 16000;
    const targetLength = Math.max(1, Math.round(duration * TARGET_SAMPLE_RATE));

    const OfflineAudioCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    let resampledBuffer: AudioBuffer;

    if (OfflineAudioCtxClass) {
      const offlineCtx = new OfflineAudioCtxClass(1, targetLength, TARGET_SAMPLE_RATE);
      const source = offlineCtx.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);
      resampledBuffer = await offlineCtx.startRendering();
    } else {
      // Fallback: use decodedBuffer directly if OfflineAudioContext is missing
      resampledBuffer = decodedBuffer;
    }

    const wavBlob = audioBufferToWav(resampledBuffer);

    // Generate clean audio filename (e.g. "Lesson recap.mov" -> "Lesson recap.wav")
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const filename = `${baseName}.wav`;

    return {
      blob: wavBlob,
      duration,
      filename
    };
  } finally {
    try {
      if (audioCtx.state !== 'closed') {
        await audioCtx.close();
      }
    } catch (_) {}
  }
}
