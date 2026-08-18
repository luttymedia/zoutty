import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Zap,
  GraduationCap,
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
  onCheckoutSuccess?: (targetTier: 'student' | 'teacher', isMock: boolean) => void;
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
  const [isRedirecting, setIsRedirecting] = useState<'student' | 'teacher' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isStudent = currentTier === 'student';
  const isTeacher = currentTier === 'teacher';

  const handleSelectPlan = async (tier: 'student' | 'teacher') => {
    setIsRedirecting(tier);
    setErrorMessage(null);

    const result = await startStripeCheckout(tier);

    if (!result.success) {
      setIsRedirecting(null);
      setErrorMessage(result.error || t('billing.plans.checkoutError'));
      return;
    }

    if (result.mock) {
      setIsRedirecting(null);
      onClose();
      if (onCheckoutSuccess) {
        onCheckoutSuccess(tier, true);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-[80] p-4 sm:p-6 overflow-y-auto">
      <div
        className="glass border border-white/15 p-6 sm:p-8 max-w-2xl w-full rounded-3xl shadow-2xl relative animate-in zoom-in-95 flex flex-col my-auto max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isRedirecting !== null}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6 space-y-1">
          <h3 className="text-2xl font-extrabold text-white tracking-tight">
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

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Student Plan Card */}
          <div
            className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
              isStudent
                ? 'border-amber-400/80 bg-amber-500/15 ring-2 ring-amber-400/40 shadow-lg shadow-amber-500/10'
                : 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">
                      {t('billing.plans.studentName')}
                    </h4>
                    <span className="text-[11px] font-bold text-amber-300 font-mono">
                      {t('billing.plans.studentPrice')}
                    </span>
                  </div>
                </div>
                {isStudent && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 uppercase font-mono font-bold">
                    {t('billing.plans.currentPlanBadge')}
                  </span>
                )}
              </div>

              {/* Feature Highlights */}
              <div className="space-y-2.5 my-4 text-xs text-white/80">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{t('billing.limits.featureStudentSessions')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{t('billing.limits.featureSmartOrganization')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{t('billing.limits.featureReferralDiscount')}</span>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <button
              disabled={isStudent || isRedirecting !== null}
              onClick={() => handleSelectPlan('student')}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 mt-2 cursor-pointer ${
                isStudent
                  ? 'bg-amber-500/20 text-amber-300 cursor-default opacity-80'
                  : isRedirecting === 'student'
                  ? 'bg-amber-500/50 text-zinc-950 cursor-wait'
                  : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md shadow-amber-500/20'
              }`}
            >
              {isStudent ? (
                <span>{t('billing.plans.currentPlan')}</span>
              ) : isRedirecting === 'student' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('billing.plans.redirectingToStripe')}</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-zinc-950" />
                  <span>{t('billing.plans.selectPlan', { plan: t('billing.plans.studentName') })}</span>
                </>
              )}
            </button>
          </div>

          {/* Teacher Plan Card */}
          <div
            className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
              isTeacher
                ? 'border-sky-400/80 bg-sky-500/15 ring-2 ring-sky-400/40 shadow-lg shadow-sky-500/10'
                : 'border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/10 hover:border-sky-500/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400">
                    <Sparkle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">
                      {t('billing.plans.teacherName')}
                    </h4>
                    <span className="text-[11px] font-bold text-sky-300 font-mono">
                      {t('billing.plans.teacherPrice')}
                    </span>
                  </div>
                </div>
                {isTeacher && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/30 text-sky-200 uppercase font-mono font-bold">
                    {t('billing.plans.currentPlanBadge')}
                  </span>
                )}
              </div>

              {/* Feature Highlights */}
              <div className="space-y-2.5 my-4 text-xs text-white/80">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>{t('billing.limits.featureTeacherSessions')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>{t('billing.limits.featureSmartOrganization')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>{t('billing.limits.featureTeacherReferralDiscount')}</span>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <button
              disabled={isTeacher || isRedirecting !== null}
              onClick={() => handleSelectPlan('teacher')}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 mt-2 cursor-pointer ${
                isTeacher
                  ? 'bg-sky-500/20 text-sky-300 cursor-default opacity-80'
                  : isRedirecting === 'teacher'
                  ? 'bg-sky-500/50 text-zinc-950 cursor-wait'
                  : 'bg-sky-500 hover:bg-sky-400 text-zinc-950 shadow-md shadow-sky-500/20'
              }`}
            >
              {isTeacher ? (
                <span>{t('billing.plans.currentPlan')}</span>
              ) : isRedirecting === 'teacher' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('billing.plans.redirectingToStripe')}</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-zinc-950" />
                  <span>{t('billing.plans.selectPlan', { plan: t('billing.plans.teacherName') })}</span>
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
              <span className="font-bold text-white">{t('billing.referrals.title')}</span>
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
            className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-xs font-bold transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
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
