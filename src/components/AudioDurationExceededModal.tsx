import React from 'react';
import { Clock, X, Check } from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';
import { TIER_LIMITS } from '../types';

export interface ExceededAudioFile {
  name?: string;
  duration: number;
}

interface AudioDurationExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  files?: ExceededAudioFile[];
  durationSeconds?: number;
  filename?: string;
}

export const AudioDurationExceededModal: React.FC<AudioDurationExceededModalProps> = ({
  isOpen,
  onClose,
  files,
  durationSeconds,
  filename,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const exceededList: ExceededAudioFile[] =
    files && files.length > 0
      ? files
      : durationSeconds !== undefined
      ? [{ name: filename, duration: durationSeconds }]
      : [];

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isMultiple = exceededList.length > 1;

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
        <h3 className="text-xl text-white tracking-tight mb-2">
          {isMultiple
            ? t('billing.limits.uploadTooLongTitleMultiple')
            : t('billing.limits.uploadTooLongTitle')}
        </h3>

        {/* Description */}
        <p className="text-sm text-white/70 leading-relaxed mb-5">
          {isMultiple
            ? t('billing.limits.uploadTooLongDescMultiple', { count: exceededList.length })
            : t('billing.limits.uploadTooLongDesc')}
        </p>

        {/* Details Card */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-3 mb-6">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
            <span className="text-white/40">{t('billing.limits.allowedLimit')}:</span>
            <span className="text-white/80 font-mono">
              {t('billing.limits.allowedLimitValue', {
                duration: formatDuration(TIER_LIMITS.MAX_CLIP_DURATION_SECONDS),
              })}
            </span>
          </div>

          {!isMultiple && exceededList[0] ? (
            <div className="space-y-2 pt-1">
              {exceededList[0].name && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">{t('billing.limits.fileLabel')}:</span>
                  <span className="text-white truncate max-w-[200px]" title={exceededList[0].name}>
                    {exceededList[0].name}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40">{t('billing.limits.detectedDuration')}:</span>
                <span className="text-amber-400 font-mono">
                  {formatDuration(exceededList[0].duration)}
                </span>
              </div>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {exceededList.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-between gap-3 text-xs"
                >
                  <span className="text-white truncate flex-1" title={item.name}>
                    {item.name || `${t('billing.limits.fileLabel')} ${idx + 1}`}
                  </span>
                  <span className="text-amber-400 font-mono shrink-0">
                    {formatDuration(item.duration)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-3.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          <span>{t('billing.limits.audioDurationUnderstood')}</span>
        </button>
      </div>
    </div>
  );
};

export default AudioDurationExceededModal;
