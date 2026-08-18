/**
 * Detects the duration of an audio or video file in seconds using the browser's HTML5 Audio API.
 */
export const getMediaDuration = (file: File | Blob): Promise<number> => {
  return new Promise((resolve) => {
    try {
      const isVideo = file.type.startsWith('video');
      const media = document.createElement(isVideo ? 'video' : 'audio');
      media.preload = 'metadata';
      const url = URL.createObjectURL(file);

      const cleanup = () => {
        URL.revokeObjectURL(url);
      };

      media.onloadedmetadata = () => {
        const duration = media.duration;
        cleanup();
        if (duration && !isNaN(duration) && isFinite(duration)) {
          resolve(duration);
        } else {
          resolve(0);
        }
      };

      media.onerror = () => {
        cleanup();
        resolve(0); // If browser cannot parse metadata, allow gracefully
      };

      media.src = url;
    } catch (e) {
      console.warn('[audioDuration] Failed to inspect media duration:', e);
      resolve(0);
    }
  });
};
