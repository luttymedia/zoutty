import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Zap,
  Sparkle,
  Gift,
  ArrowRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';
import { UserTier } from '../types';
import { startStripeCheckout } from '../lib/stripe';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: UserTier;
  onCheckoutSuccess?: (targetTier: 'plus', isMock: boolean) => void;
  onOpenReferrals: () => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  currentTier,
  onCheckoutSuccess,
  onOpenReferrals,
}) => {
  const { t } = useTranslation();
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isPlus = currentTier === 'plus';

  const handleSelectPlan = async () => {
    setIsRedirecting(true);
    setErrorMessage(null);

    const result = await startStripeCheckout('plus');

    if (!result.success) {
      setIsRedirecting(false);
      setErrorMessage(result.error || t('billing.plans.checkoutError'));
      return;
    }

    if (result.mock) {
      setIsRedirecting(false);
      onClose();
      if (onCheckoutSuccess) {
        onCheckoutSuccess('plus', true);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-[80] p-4 sm:p-6 overflow-y-auto">
      <div
        className="glass border border-white/15 p-6 sm:p-8 max-w-lg w-full rounded-3xl shadow-2xl relative animate-in zoom-in-95 flex flex-col my-auto max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isRedirecting}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6 space-y-1">
          <h3 className="text-2xl text-white tracking-tight">
            {t('billing.plans.choosePlanTitle')}
          </h3>
          <p className="text-xs sm:text-sm text-white/60 max-w-md mx-auto">
            {t('billing.plans.choosePlanSubtitle')}
          </p>
        </div>

        {/* Error Alert if any */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Plan Card */}
        <div className="mb-6">
          <div
            className={`p-6 rounded-2xl border flex flex-col justify-between transition-all ${
              isPlus
                ? 'border-amber-400/80 bg-amber-500/15 ring-2 ring-amber-400/40 shadow-lg shadow-amber-500/10'
                : 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <Sparkle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-lg text-white font-medium">
                      {t('billing.plans.plusName')}
                    </h4>
                    <span className="text-xs text-amber-300 font-mono">
                      {t('billing.plans.plusPrice')}
                    </span>
                  </div>
                </div>
                {isPlus && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/30 text-amber-200 uppercase font-mono tracking-wider">
                    {t('billing.plans.currentPlanBadge')}
                  </span>
                )}
              </div>

              {/* Feature Highlights */}
              <div className="space-y-3 my-5 text-xs text-white/80">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{t('billing.limits.featurePlusSessions')}</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{t('billing.limits.featureSmartOrganization')}</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{t('billing.limits.featureReferralDiscount')}</span>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <button
              disabled={isPlus || isRedirecting}
              onClick={handleSelectPlan}
              className={`w-full py-3.5 px-4 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer ${
                isPlus
                  ? 'bg-amber-500/20 text-amber-300 cursor-default opacity-80'
                  : isRedirecting
                  ? 'bg-amber-500/50 text-zinc-950 cursor-wait'
                  : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md shadow-amber-500/20 active:scale-[0.99]'
              }`}
            >
              {isPlus ? (
                <span>{t('billing.plans.currentPlan')}</span>
              ) : isRedirecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('billing.plans.redirectingToStripe')}</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-zinc-950" />
                  <span>{t('billing.plans.selectPlan', { plan: t('billing.plans.plusName') })}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Referral Banner */}
        <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2.5">
            <Gift className="w-5 h-5 text-purple-400 shrink-0" />
            <div className="text-xs">
              <span className="text-white font-medium">{t('billing.referrals.title')}</span>
              <p className="text-white/60 text-[11px]">
                {t('billing.referrals.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              onOpenReferrals();
            }}
            className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
          >
            <span>{t('billing.referrals.shareAction')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
