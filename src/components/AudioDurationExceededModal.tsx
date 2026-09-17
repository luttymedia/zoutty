import React from 'react';
import { X, Clock, AlertTriangle, Check } from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';
import { BottomSheet } from './BottomSheet';
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
    <BottomSheet isOpen={true} onClose={onClose} maxWidthClass="max-w-md" className="border-amber-500/40 text-center">
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
          className="w-full h-9 px-4.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer mt-4 shrink-0 active:scale-95"
        >
          <Check className="w-4 h-4" />
          <span>{t('billing.limits.audioDurationUnderstood')}</span>
        </button>
    </BottomSheet>
  );
};

export default AudioDurationExceededModal;
