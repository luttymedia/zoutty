import React from 'react';
import { Clock, CheckCircle2, X } from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';
import { TIER_LIMITS } from '../types';

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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-[80] p-4 sm:p-6 overflow-y-auto">
      <div
        className="glass border border-brand/40 p-6 sm:p-8 max-w-md w-full rounded-3xl shadow-2xl relative animate-in zoom-in-95 flex flex-col text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand mx-auto shadow-lg mb-4">
          <Clock className="w-8 h-8" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white tracking-tight mb-2">
          {t('billing.limits.recordingAutoStoppedTitle')}
        </h3>

        {/* Description */}
        <p className="text-sm text-white/70 leading-relaxed mb-6">
          {t('billing.limits.recordingAutoStoppedDesc')}
        </p>

        {/* Clip Saved Badge */}
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-6 flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Audio clip saved successfully ({TIER_LIMITS.MAX_CLIP_DURATION_SECONDS / 60} min max)</span>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-3.5 px-4 rounded-xl bg-brand hover:bg-brand/90 text-zinc-950 text-sm font-bold shadow-lg shadow-brand/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>{t('billing.limits.audioDurationUnderstood')}</span>
        </button>
      </div>
    </div>
  );
};

export default RecordingAutoStoppedModal;
