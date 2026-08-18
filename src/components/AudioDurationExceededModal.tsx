import React from 'react';
import { Clock, AlertTriangle, X, Check } from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';
import { TIER_LIMITS } from '../types';

interface AudioDurationExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  durationSeconds: number;
  filename?: string;
}

export const AudioDurationExceededModal: React.FC<AudioDurationExceededModalProps> = ({
  isOpen,
  onClose,
  durationSeconds,
  filename,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-[80] p-4 sm:p-6 overflow-y-auto">
      <div
        className="glass border border-amber-500/40 p-6 sm:p-8 max-w-md w-full rounded-3xl shadow-2xl relative animate-in zoom-in-95 flex flex-col text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-lg mb-4">
          <Clock className="w-8 h-8" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white tracking-tight mb-2">
          {t('billing.limits.uploadTooLongTitle')}
        </h3>

        {/* Description */}
        <p className="text-sm text-white/70 leading-relaxed mb-5">
          {t('billing.limits.uploadTooLongDesc')}
        </p>

        {/* File Duration Details Card */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-2 mb-6">
          {filename && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">{t('billing.limits.fileLabel')}:</span>
              <span className="text-white font-medium truncate max-w-[200px]" title={filename}>
                {filename}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">{t('billing.limits.detectedDuration')}:</span>
            <span className="text-amber-400 font-mono font-bold">
              {formatDuration(durationSeconds)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">{t('billing.limits.allowedLimit')}:</span>
            <span className="text-white/80 font-mono font-medium">
              {formatDuration(TIER_LIMITS.MAX_CLIP_DURATION_SECONDS)} (3 mins)
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-3.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          <span>{t('billing.limits.audioDurationUnderstood')}</span>
        </button>
      </div>
    </div>
  );
};

export default AudioDurationExceededModal;
