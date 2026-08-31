import React from 'react';
import {
  Zap,
  ArrowRight,
  ShieldCheck,
  AudioLines,
  X
} from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';

interface TopupConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const TopupConfirmModal: React.FC<TopupConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-[90] p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="glass border border-emerald-500/40 p-6 sm:p-8 max-w-md w-full rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-300 flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Glowing Ambient Halo */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative mx-auto mb-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shadow-lg shadow-emerald-500/10 mx-auto">
            <Zap className="w-8 h-8 text-emerald-400 fill-emerald-400" />
          </div>
        </div>

        <div className="space-y-1 mb-6 text-center">
          <h3 className="text-2xl font-black text-white tracking-tight">
            {t('billing.topup.confirmModalTitle', { fallback: 'Confirm Top-Up' })}
          </h3>
          <p className="text-xs sm:text-sm text-white/70 max-w-xs mx-auto">
            {t('billing.topup.confirmModalSubtitle', { fallback: 'You are about to purchase a one-time Top-Up Pack.' })}
          </p>
        </div>

        <div className="space-y-2.5 mb-6 text-left">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Zap className="w-5 h-5 fill-emerald-400 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                {t('billing.topup.successFeatureSessions')}
              </div>
              <div className="text-[11px] text-white/50">
                {t('billing.topup.successFeatureSessionsDesc')}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
              <AudioLines className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                {t('billing.topup.successFeatureClips')}
              </div>
              <div className="text-[11px] text-white/50">
                {t('billing.topup.successFeatureClipsDesc')}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-300">
                {t('billing.topup.successFeatureRollover')}
              </div>
              <div className="text-[11px] text-emerald-400/80">
                {t('billing.topup.successFeatureRolloverDesc')}
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-sm font-bold shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
              {t('billing.manage.processingUpgrade', { fallback: 'Processing...' })}
            </span>
          ) : (
            <>
              <span>{t('billing.topup.confirmBtn', { fallback: 'Proceed to Checkout (€5.00)' })}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
