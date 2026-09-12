import React from 'react';
import {
  Sparkles,
  Zap,
  Gift,
  X,
  ArrowRight,
  Sparkle,
  Calendar,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';
import { UserTier, TIER_LIMITS } from '../types';
import { formatSafeDate } from '../lib/dateUtils';

interface QuotaExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: UserTier;
  subscriptionStatus?: string;
  reason?: 'sessions' | 'clips';
  canBoost?: boolean;
  resetDate?: string | null;
  onUpgradeClick: (targetTier?: 'plus') => void;
  onReferralClick: () => void;
  onTopupClick?: () => void;
  onOpenBillingPortal?: () => void;
}

export const QuotaExceededModal: React.FC<QuotaExceededModalProps> = ({
  isOpen,
  onClose,
  tier,
  subscriptionStatus,
  reason = 'sessions',
  canBoost = true,
  resetDate,
  onUpgradeClick,
  onReferralClick,
  onTopupClick,
  onOpenBillingPortal,
}) => {
  const { t, uiLanguage } = useTranslation();

  const isPaymentIssue = subscriptionStatus === 'past_due' || subscriptionStatus === 'unpaid';
  const isFree = tier === 'free' && !isPaymentIssue;

  const formattedResetDate = React.useMemo(() => {
    return formatSafeDate(resetDate, uiLanguage);
  }, [resetDate, uiLanguage]);

  if (!isOpen) return null;

  const freeDescription =
    reason === 'clips'
      ? t('billing.limits.quotaExceededFreeClipsDesc', { limit: TIER_LIMITS.free.lifetime_clips })
      : t('billing.limits.quotaExceededFreeSessionsDesc', { limit: TIER_LIMITS.free.lifetime_sessions });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-[80] p-4 sm:p-6 overflow-y-auto">
      <div
        className={`glass p-6 sm:p-8 max-w-md w-full rounded-3xl shadow-2xl relative animate-in zoom-in-95 flex flex-col text-center border max-h-[90vh] overflow-y-auto custom-scrollbar my-auto ${
          isPaymentIssue ? 'border-red-500/50 shadow-red-950/40' : 'border-brand/40'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon (shown for payment issues or for Plus plan users, hidden for free tier) */}
        {isPaymentIssue ? (
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto shadow-lg shadow-red-500/20 mb-4 animate-bounce duration-1000">
            <AlertTriangle className="w-8 h-8" />
          </div>
        ) : !isFree ? (
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand/20 to-brand/40 border border-brand/50 flex items-center justify-center text-brand mx-auto shadow-lg shadow-brand/10 mb-4 animate-bounce duration-1000">
            <Sparkles className="w-8 h-8" />
          </div>
        ) : null}

        {/* Title & Badge */}
        <div className="space-y-1 mb-3">
          {(isPaymentIssue || !isFree) && (
            <span className={`text-[10px] px-3 py-1 rounded-full uppercase tracking-widest font-mono border ${
              isPaymentIssue
                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                : 'bg-brand/20 text-brand border-brand/30'
            }`}>
              {isPaymentIssue
                ? t('billing.limits.paymentIssueBadge')
                : t('billing.limits.monthlyLimitBadge')}
            </span>
          )}
          <h3 className={`text-xl text-white tracking-tight ${!isFree || isPaymentIssue ? 'mt-2' : ''}`}>
            {isPaymentIssue
              ? t('billing.limits.paymentIssueTitle')
              : t('billing.limits.quotaExceededTitle')}
          </h3>
        </div>

        {/* Body Description */}
        <p className="text-sm text-white/70 leading-relaxed mb-4">
          {isPaymentIssue
            ? t('billing.limits.paymentIssueDesc')
            : isFree
            ? freeDescription
            : t('billing.limits.quotaExceededPaidDesc')}
        </p>

        {/* Reset Date Notice for Active Paid Users */}
        {!isFree && !isPaymentIssue && (
          <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-200 text-xs mb-5 flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4 text-sky-400 shrink-0" />
            <span>{t('billing.usage.resetDate', { date: formattedResetDate })}</span>
          </div>
        )}

        {/* Subscription Plan Option for Free Tier (Non-Payment Issue) */}
        {isFree && (
          <div className="space-y-4 mb-5 text-left">
            {/* Zoutty Plus Plan Card */}
            <div className="p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all flex flex-col justify-between">
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
                onClick={() => {
                  onClose();
                  onUpgradeClick('plus');
                }}
                className="w-full py-3.5 px-4 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md shadow-amber-500/20 active:scale-[0.99]"
              >
                <Zap className="w-4 h-4 fill-zinc-950" />
                <span>{t('billing.plans.selectPlan', { plan: t('billing.plans.plusName') })}</span>
              </button>
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
                  onReferralClick();
                }}
                className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <span>{t('billing.referrals.shareAction')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {/* Payment Failed / Past Due Primary Action Button */}
          {isPaymentIssue && (
            <button
              onClick={() => {
                onClose();
                if (onOpenBillingPortal) onOpenBillingPortal();
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>{t('billing.limits.paymentIssueAction')}</span>
            </button>
          )}

          {/* For Paid Users (Plus), offer one-time Top-Up Pack */}
          {!isFree && !isPaymentIssue && onTopupClick && (
            <button
              onClick={() => {
                onClose();
                onTopupClick();
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-zinc-950 text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-zinc-950/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 fill-zinc-950 text-zinc-950" />
                </div>
                <div className="text-left">
                  <span className="block text-xs">{t('billing.topup.buyBtn')}</span>
                  <span className="block text-[10px] text-zinc-900/80">{t('billing.topup.noExpireNote')}</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-zinc-950/15 text-zinc-950 text-xs font-mono shrink-0 ml-2">
                {t('billing.topup.price')}
              </span>
            </button>
          )}

          {/* Referral Button (shown for active paid plans, since free now has the bottom referral card) */}
          {!isFree && !isPaymentIssue && (
            <button
              onClick={() => {
                onClose();
                onReferralClick();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Gift className="w-4 h-4 text-purple-400" />
              <span>{t('billing.limits.referralActionPaid')}</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-2 text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuotaExceededModal;
