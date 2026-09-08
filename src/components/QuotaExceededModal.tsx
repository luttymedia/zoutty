import React from 'react';
import {
  Sparkles,
  Zap,
  Gift,
  X,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Sparkle,
  Calendar,
  AlertTriangle,
  CreditCard,
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
  onUpgradeClick: (targetTier?: 'student' | 'teacher') => void;
  onReferralClick: () => void;
  onTopupClick?: () => void;
  onOpenBillingPortal?: () => void;
  onStudentUpgradeClick?: () => void;
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
  onStudentUpgradeClick,
}) => {
  const { t, uiLanguage } = useTranslation();

  const isPaymentIssue = subscriptionStatus === 'past_due' || subscriptionStatus === 'unpaid';
  const isFree = tier === 'free' && !isPaymentIssue;
  const isStudent = tier === 'student' && !isPaymentIssue;

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

        {/* Header Icon */}
        {isPaymentIssue ? (
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto shadow-lg shadow-red-500/20 mb-4 animate-bounce duration-1000">
            <AlertTriangle className="w-8 h-8" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand/20 to-brand/40 border border-brand/50 flex items-center justify-center text-brand mx-auto shadow-lg shadow-brand/10 mb-4 animate-bounce duration-1000">
            <Sparkles className="w-8 h-8" />
          </div>
        )}

        {/* Title & Badge */}
        <div className="space-y-1 mb-3">
          <span className={`text-[10px] px-3 py-1 rounded-full uppercase tracking-widest font-mono border ${
            isPaymentIssue
              ? 'bg-red-500/20 text-red-300 border-red-500/40'
              : isFree
              ? 'bg-brand/20 text-brand border-brand/30'
              : 'bg-brand/20 text-brand border-brand/30'
          }`}>
            {isPaymentIssue
              ? t('billing.limits.paymentIssueBadge')
              : isFree
              ? t('billing.limits.freeLimitBadge')
              : t('billing.limits.monthlyLimitBadge')}
          </span>
          <h3 className="text-xl text-white tracking-tight mt-2">
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
          <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-200 text-xs mb-5 flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4 text-sky-400 shrink-0" />
            <span>{t('billing.usage.resetDate', { date: formattedResetDate })}</span>
          </div>
        )}

        {/* Subscription Plan Options for Free Tier (Non-Payment Issue) */}
        {isFree ? (
          <div className="space-y-2.5 mb-5 text-left">
            {/* Student Plan Card / Button (Warm Amber) */}
            <button
              onClick={() => {
                onClose();
                onUpgradeClick('student');
              }}
              className="w-full p-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white group-hover:text-amber-300 transition-colors">
                      {t('billing.plans.studentName')}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase font-mono">
                      {t('billing.plans.studentPrice')}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/60 mt-0.5">
                    {t('billing.limits.studentFeature')}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
            </button>

            {/* Teacher Plan Card / Button (Styled in Sky/Cyan) */}
            <button
              onClick={() => {
                onClose();
                onUpgradeClick('teacher');
              }}
              className="w-full p-3.5 rounded-2xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                  <Sparkle className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white group-hover:text-sky-300 transition-colors">
                      {t('billing.plans.teacherName')}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase font-mono">
                      {t('billing.plans.teacherPrice')}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/60 mt-0.5">
                    {t('billing.limits.teacherFeature')}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-sky-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
            </button>
          </div>
        ) : !isPaymentIssue ? (
          /* Plan Highlights for Active Paid Users */
          isStudent ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onStudentUpgradeClick) {
                  onStudentUpgradeClick();
                } else {
                  onUpgradeClick('teacher');
                }
              }}
              className="w-full p-4 rounded-2xl bg-sky-500/10 hover:bg-sky-500/15 border border-sky-500/30 hover:border-sky-500/50 text-left space-y-2.5 mb-5 transition-all group cursor-pointer block"
            >
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider text-sky-400 group-hover:text-sky-300 transition-colors flex items-center gap-1.5">
                  <Sparkle className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>{t('billing.limits.unlockTeacherHeading', { price: t('billing.plans.teacherPrice') })}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-sky-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
              </div>
              <div className="flex items-center gap-2 text-xs text-white/90">
                <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
                <span>{t('billing.limits.featureTeacherSessions')}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/90">
                <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
                <span>{t('billing.limits.featureSmartOrganization')}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/90">
                <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
                <span>{t('billing.limits.featureTeacherReferralDiscount')}</span>
              </div>
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-2.5 mb-5">
              <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">
                {t('billing.usage.unlimitedStorage')}
              </div>
              <div className="flex items-center gap-2 text-xs text-white/90">
                <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
                <span>{t('billing.usage.unlimitedStorage')}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/90">
                <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
                <span>{t('billing.limits.featureSmartOrganization')}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/90">
                <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
                <span>{t('billing.limits.featureTeacherReferralDiscount')}</span>
              </div>
            </div>
          )
        ) : null}

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

          {/* For Paid Users (Student & Teacher), offer one-time Top-Up Pack */}
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

          {/* Referral Button (shown for active free/paid plans) */}
          {!isPaymentIssue && (
            <button
              onClick={() => {
                onClose();
                onReferralClick();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Gift className="w-4 h-4 text-purple-400" />
              <span>
                {isFree
                  ? t('billing.limits.referralAction')
                  : t('billing.limits.referralActionPaid')}
              </span>
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
