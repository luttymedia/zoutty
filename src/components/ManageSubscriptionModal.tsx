import React, { useState } from 'react';
import {
  X,
  Zap,
  GraduationCap,
  Sparkle,
  Calendar,
  CreditCard,
  ExternalLink,
  AlertTriangle,
  ShieldAlert,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';
import { TIER_LIMITS } from '../types';

interface ManageSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: 'student' | 'teacher';
  renewalDate?: string;
  onUpgrade: () => void;
  onDowngrade: () => void;
  onCancelDowngrade?: () => void;
  isCancelingDowngrade?: boolean;
  onCancelSubscription: () => void;
  onOpenCustomerPortal: () => void;
  isPortalLoading?: boolean;
  pendingDowngrade?: string | null;
  isCanceling?: boolean;
  onReactivate?: () => void;
  initialView?: ModalView;
}

export type ModalView = 'overview' | 'downgrade_confirm' | 'cancel_confirm' | 'upgrade_confirm';

export const ManageSubscriptionModal: React.FC<ManageSubscriptionModalProps> = ({
  isOpen,
  onClose,
  currentTier,
  renewalDate,
  onUpgrade,
  onDowngrade,
  onCancelDowngrade,
  isCancelingDowngrade = false,
  onCancelSubscription,
  onOpenCustomerPortal,
  isPortalLoading = false,
  pendingDowngrade,
  isCanceling = false,
  onReactivate,
  initialView = 'overview',
}) => {
  const { t } = useTranslation();
  const [view, setView] = useState<ModalView>(initialView);
  const [isUpgrading, setIsUpgrading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setView(initialView);
    }
  }, [isOpen, initialView]);

  if (!isOpen) return null;

  const isTeacher = currentTier === 'teacher';
  const isStudent = currentTier === 'student';

  const defaultRenewalDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  })();

  const effectiveRenewalDate = renewalDate || defaultRenewalDate;

  const currentPlanName = isTeacher
    ? t('billing.plans.teacherName')
    : t('billing.plans.studentName');

  const currentPrice = isTeacher
    ? t('billing.plans.teacherPrice')
    : t('billing.plans.studentPrice');

  const alternativePlanName = isTeacher
    ? t('billing.plans.studentName')
    : t('billing.plans.teacherName');

  const alternativePrice = isTeacher
    ? t('billing.plans.studentPrice')
    : t('billing.plans.teacherPrice');

  const handleClose = () => {
    setView('overview');
    onClose();
  };

  const handleUpgradeClick = async () => {
    setView('upgrade_confirm');
  };

  const executeUpgrade = async () => {
    setIsUpgrading(true);
    try {
      await onUpgrade();
    } finally {
      setIsUpgrading(false);
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== 'overview' && (
              <button
                onClick={() => setView('overview')}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer mr-1"
                title={t('billing.manage.backToOverview')}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-10 h-10 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                {t('billing.manage.modalTitle')}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {t('billing.manage.activePlanBadge')}
                </span>
                <span className="text-[11px] text-white/50">
                  {isCanceling
                    ? t('billing.manage.cancelsOn', { date: effectiveRenewalDate })
                    : pendingDowngrade
                      ? t('billing.usage.downgradesOn', { date: effectiveRenewalDate })
                      : t('billing.manage.renewsOn', { date: effectiveRenewalDate })}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* VIEW: OVERVIEW */}
          {view === 'overview' && (
            <>
              {/* Active Plan Card */}
              <div
                className={`p-5 rounded-2xl border transition-all ${
                  isTeacher
                    ? 'border-sky-400/40 bg-sky-500/10'
                    : 'border-amber-400/40 bg-amber-500/10'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isTeacher
                          ? 'bg-sky-500/20 text-sky-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {isTeacher ? <Sparkle className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
                        {t('billing.manage.currentPlanTitle')}
                      </div>
                      <h4 className="text-base font-bold text-white">{currentPlanName}</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white font-mono">{currentPrice}</div>
                    <div className="text-[11px] text-white/50 flex items-center gap-1 justify-end mt-0.5">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {isCanceling
                          ? t('billing.manage.cancelsOn', { date: effectiveRenewalDate })
                          : pendingDowngrade
                            ? t('billing.usage.downgradesOn', { date: effectiveRenewalDate })
                            : t('billing.manage.renewsOn', { date: effectiveRenewalDate })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs text-white/80">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>
                      <strong>{isTeacher ? TIER_LIMITS.teacher.monthly_sessions : TIER_LIMITS.student.monthly_sessions}</strong>{' '}
                      {t('billing.plans.monthlySessionsPerk')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>
                      <strong>{isTeacher ? t('billing.usage.infiniteUppercase') : TIER_LIMITS.student.monthly_clips}</strong>{' '}
                      {t('billing.plans.monthlyClipsPerk')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>
                      {isTeacher ? t('billing.limits.featureTeacherReferralDiscount') : t('billing.limits.featureReferralDiscount')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Plan Switch Section */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                {isCanceling ? (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {t('billing.manage.reactivateTitle')}
                        </h4>
                        <p className="text-xs text-white/60 mt-0.5 leading-relaxed">
                          {t('billing.manage.reactivateDesc')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={onReactivate}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20"
                    >
                      <Zap className="w-4 h-4 fill-zinc-950" />
                      <span>{t('billing.manage.reactivateBtn')}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {isStudent
                            ? t('billing.manage.upgradeToTeacherTitle')
                            : pendingDowngrade
                              ? t('billing.manage.pendingDowngradeTitle')
                              : t('billing.manage.downgradeToStudentTitle')}
                        </h4>
                        <p className="text-xs text-white/60 mt-0.5 leading-relaxed">
                          {isStudent
                            ? t('billing.manage.upgradeToTeacherDesc')
                            : pendingDowngrade
                              ? t('billing.manage.pendingDowngradeSectionDesc', { date: effectiveRenewalDate })
                              : t('billing.manage.downgradeToStudentDesc')}
                        </p>
                      </div>
                    </div>

                    {isStudent ? (
                      <button
                        disabled={isUpgrading}
                        onClick={handleUpgradeClick}
                        className="w-full py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-sky-500/20 disabled:opacity-60"
                      >
                        {isUpgrading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{t('billing.plans.redirectingToStripe')}</span>
                          </>
                        ) : (
                          <>
                            <Sparkle className="w-4 h-4 fill-zinc-950" />
                            <span>{t('billing.manage.upgradeToTeacherBtn', { price: alternativePrice })}</span>
                          </>
                        )}
                      </button>
                    ) : (
                      pendingDowngrade ? (
                        <div className="space-y-3">
                          <div className="w-full py-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs font-medium text-center">
                            {t('billing.manage.pendingDowngradeText')}
                          </div>
                          {onCancelDowngrade && (
                            <button
                              disabled={isCancelingDowngrade}
                              onClick={onCancelDowngrade}
                              className="w-full py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-sky-500/20 disabled:opacity-60"
                            >
                              {isCancelingDowngrade ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>{t('billing.manage.processingCancelDowngrade')}</span>
                                </>
                              ) : (
                                <>
                                  <Sparkle className="w-4 h-4 fill-zinc-950" />
                                  <span>{t('billing.manage.keepTeacherPlanBtn')}</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => setView('downgrade_confirm')}
                          className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/10"
                        >
                          <GraduationCap className="w-4 h-4 text-amber-400" />
                          <span>{t('billing.manage.downgradeToStudentBtn', { price: alternativePrice })}</span>
                        </button>
                      )
                    )}
                  </>
                )}
              </div>

              {/* Billing & Invoices Section (Stripe Portal) */}
              <div className="p-4 rounded-2xl bg-brand/5 border border-brand/20 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand border border-brand/20 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {t('billing.manage.billingPortalTitle')}
                    </h4>
                    <p className="text-xs text-white/60 mt-0.5 leading-relaxed">
                      {t('billing.manage.billingPortalDesc')}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] text-brand/80 mt-1 font-medium">
                      {t('billing.manage.billingPortalRedirectNotice')}
                    </span>
                  </div>
                </div>

                <button
                  disabled={isPortalLoading}
                  onClick={onOpenCustomerPortal}
                  className="w-full py-2.5 px-4 rounded-xl bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-brand/10"
                >
                  {isPortalLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('billing.plans.portalRedirecting')}</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      <span>{t('billing.manage.billingPortalBtn')}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Cancel Subscription Trigger */}
              <div className="pt-2 text-center">
                <button
                  onClick={() => setView('cancel_confirm')}
                  className="text-xs text-rose-400/70 hover:text-rose-400 transition-colors underline underline-offset-4 cursor-pointer"
                >
                  {t('billing.manage.cancelSubBtn')}
                </button>
              </div>
            </>
          )}

          {/* VIEW: DOWNGRADE CONFIRMATION (RESISTANCE STEP) */}
          {view === 'downgrade_confirm' && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-200">
                    {t('billing.manage.downgradeConfirmTitle')}
                  </h4>
                  <p className="text-xs text-amber-200/70 mt-1 leading-relaxed">
                    {t('billing.manage.downgradeConfirmDesc', {
                      currentPlan: currentPlanName,
                      targetPlan: alternativePlanName,
                    })}
                  </p>
                </div>
              </div>

              {/* What you're giving up */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
                  {t('billing.manage.currentFeaturesTitle')}
                </div>
                <div className="space-y-2.5 text-xs text-white/90">
                  <div className="flex items-start gap-2.5 text-rose-300">
                    <XCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>{t('billing.manage.downgradeLossSessions')}</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-rose-300">
                    <XCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>{t('billing.manage.downgradeLossClips')}</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-rose-300">
                    <XCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>{t('billing.manage.downgradeLossReferral')}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => setView('overview')}
                  className="w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand/90 text-zinc-950 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand/20"
                >
                  <Sparkle className="w-4 h-4 fill-zinc-950" />
                  <span>{t('billing.manage.keepPlanBtn', { plan: currentPlanName })}</span>
                </button>
                <button
                  onClick={() => {
                    onDowngrade();
                    handleClose();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium transition-all cursor-pointer"
                >
                  {t('billing.manage.confirmDowngradeBtn', { targetPlan: alternativePlanName })}
                </button>
              </div>
            </div>
          )}

          {/* VIEW: CANCELLATION CONFIRMATION (RESISTANCE STEP) */}
          {view === 'cancel_confirm' && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-200">
                    {t('billing.manage.cancelConfirmTitle')}
                  </h4>
                  <p className="text-xs text-rose-200/70 mt-1 leading-relaxed">
                    {t('billing.manage.cancelConfirmDesc')}
                  </p>
                </div>
              </div>

              {/* What happens upon cancellation */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="space-y-2.5 text-xs text-white/90">
                  <div className="flex items-start gap-2.5 text-amber-200">
                    <Calendar className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <span>
                      {t('billing.manage.cancelConsequenceKeepUntil', {
                        plan: currentPlanName,
                        date: effectiveRenewalDate,
                      })}
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5 text-rose-300">
                    <XCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>
                      {t('billing.manage.cancelConsequenceRevertFree', {
                        date: effectiveRenewalDate,
                      })}
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5 text-rose-300">
                    <XCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>{t('billing.manage.cancelConsequenceNoResets')}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => setView('overview')}
                  className="w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand/90 text-zinc-950 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand/20"
                >
                  <Zap className="w-4 h-4 fill-zinc-950" />
                  <span>{t('billing.manage.keepSubscriptionBtn')}</span>
                </button>
                <button
                  onClick={() => {
                    onCancelSubscription();
                    handleClose();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all cursor-pointer"
                >
                  {t('billing.manage.confirmCancelBtn')}
                </button>
              </div>
            </div>
          )}

          {/* VIEW: UPGRADE CONFIRMATION */}
          {view === 'upgrade_confirm' && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-2xl bg-brand/10 border border-brand/30 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand/20 text-brand flex items-center justify-center shrink-0">
                  <Sparkle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-brand">
                    {t('billing.manage.upgradeConfirmTitle')}
                  </h4>
                  <p className="text-xs text-brand/70 mt-1 leading-relaxed">
                    {t('billing.manage.upgradeConfirmDesc', { targetPlan: alternativePlanName })}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button
                  disabled={isUpgrading}
                  onClick={executeUpgrade}
                  className="w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand/90 text-zinc-950 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand/20 disabled:opacity-70"
                >
                  {isUpgrading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('billing.manage.processingUpgrade')}</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-zinc-950" />
                      <span>{t('billing.manage.confirmPayBtn')}</span>
                    </>
                  )}
                </button>
                <button
                  disabled={isUpgrading}
                  onClick={() => setView('overview')}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
