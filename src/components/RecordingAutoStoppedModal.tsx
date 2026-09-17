import React from 'react';
import { Clock, CheckCircle2, X } from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';
import { TIER_LIMITS } from '../types';
import { BottomSheet } from './BottomSheet';

interface RecordingAutoStoppedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RecordingAutoStoppedModal: React.FC<RecordingAutoStoppedModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxWidthClass="max-w-md" className="border-brand/40 text-center">
      {/* Header Icon */}
      <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand mx-auto shadow-lg mb-4 shrink-0">
        <Clock className="w-8 h-8" />
      </div>

      {/* Title */}
      <h3 className="text-xl text-white tracking-tight mb-2">
        {t('billing.limits.recordingAutoStoppedTitle')}
      </h3>

      {/* Description */}
      <p className="text-sm text-white/70 leading-relaxed mb-6">
        {t('billing.limits.recordingAutoStoppedDesc')}
      </p>

      {/* Clip Saved Badge */}
      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs mb-6 flex items-center justify-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>Audio clip saved successfully ({TIER_LIMITS.MAX_CLIP_DURATION_SECONDS / 60} min max)</span>
      </div>

      {/* Action Button */}
      <button
        onClick={onClose}
        className="w-full h-9 px-4.5 rounded-full bg-brand hover:bg-brand/90 text-zinc-950 text-xs sm:text-sm font-semibold shadow-lg shadow-brand/25 transition-all flex items-center justify-center gap-2 cursor-pointer mt-auto shrink-0 active:scale-95"
      >
        <span>{t('billing.limits.audioDurationUnderstood')}</span>
      </button>
    </BottomSheet>
  );
};

export default RecordingAutoStoppedModal;
