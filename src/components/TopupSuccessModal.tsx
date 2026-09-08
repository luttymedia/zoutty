import React from 'react';
import {
  CheckCircle2,
  Zap,
  AudioLines,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';

interface TopupSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TopupSuccessModal: React.FC<TopupSuccessModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-[90] p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="glass border border-emerald-500/40 p-6 sm:p-8 max-w-md w-full rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-300 flex flex-col my-auto text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glowing Ambient Halo */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Celebration Header Icon */}
        <div className="relative mx-auto mb-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shadow-lg shadow-emerald-500/10 mx-auto">
            <Zap className="w-8 h-8 text-emerald-400 fill-emerald-400" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-zinc-900 flex items-center justify-center text-white">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1 mb-6">
          <span className="inline-block text-[11px] px-3 py-0.5 rounded-full font-mono uppercase border bg-emerald-500/20 text-emerald-300 border-emerald-500/30 mb-1">
            {t('billing.topup.successModalBadge')}
          </span>
          <h3 className="text-2xl text-white tracking-tight">
            {t('billing.topup.successModalTitle')}
          </h3>
          <p className="text-xs sm:text-sm text-white/70 max-w-xs mx-auto">
            {t('billing.topup.successModalSubtitle')}
          </p>
        </div>

        {/* Allowance Highlights */}
        <div className="space-y-2.5 mb-6 text-left">
          {/* Extra Sessions */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Zap className="w-5 h-5 fill-emerald-400 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs text-white">
                {t('billing.topup.successFeatureSessions')}
              </div>
              <div className="text-[11px] text-white/50">
                {t('billing.topup.successFeatureSessionsDesc')}
              </div>
            </div>
          </div>

          {/* Extra Clips */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
              <AudioLines className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-white">
                {t('billing.topup.successFeatureClips')}
              </div>
              <div className="text-[11px] text-white/50">
                {t('billing.topup.successFeatureClipsDesc')}
              </div>
            </div>
          </div>

          {/* Rollover Guarantee */}
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-emerald-300">
                {t('billing.topup.successFeatureRollover')}
              </div>
              <div className="text-[11px] text-emerald-400/80">
                {t('billing.topup.successFeatureRolloverDesc')}
              </div>
            </div>
          </div>
        </div>

        {/* Continue Action */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>{t('billing.topup.continueBtn')}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default TopupSuccessModal;
