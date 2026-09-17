import React, { useState } from 'react';
import {
  Zap,
  X,
  Calendar,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  PauseCircle,
  Sparkle,
  CreditCard,
  Loader2,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';
import { BottomSheet } from './BottomSheet';
import { TIER_LIMITS, UserTier } from '../types';

interface ManageSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: UserTier;
  renewalDate?: string;
  onCancelSubscription: () => void;
  onOpenCustomerPortal: () => void;
  isPortalLoading?: boolean;
  isCanceling?: boolean;
  onReactivate?: () => void;
  initialView?: ModalView;
}

export type ModalView = 'overview' | 'cancel_confirm';

export const ManageSubscriptionModal: React.FC<ManageSubscriptionModalProps> = ({
  isOpen,
  onClose,
  currentTier = 'plus',
  renewalDate,
  onCancelSubscription,
  onOpenCustomerPortal,
  isPortalLoading = false,
  isCanceling = false,
  onReactivate,
  initialView = 'overview',
}) => {
  const { t } = useTranslation();
  const [view, setView] = useState<ModalView>(initialView);

  React.useEffect(() => {
    if (isOpen) {
      setView(initialView);
    }
  }, [isOpen, initialView]);

  if (!isOpen) return null;

  const defaultRenewalDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  })();

  const effectiveRenewalDate = renewalDate || defaultRenewalDate;

  const currentPlanName = t('billing.plans.plusName');
  const currentPrice = t('billing.plans.plusPrice');

  const handleClose = () => {
    setView('overview');
    onClose();
  };

  return (
    <BottomSheet isOpen={true} onClose={handleClose} maxWidthClass="max-w-lg" zIndexClass="z-50">
      {/* Header */}
      <div className="p-1 pb-4 border-b border-white/5 flex items-center justify-between shrink-0">
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
              <h3 className="text-lg text-white tracking-tight">
                {t('billing.manage.modalTitle')}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {t('billing.manage.activePlanBadge')}
                </span>
                <span className="text-[11px] text-white/50">
                  {isCanceling
                    ? t('billing.manage.cancelsOn', { date: effectiveRenewalDate })
                    : t('billing.manage.renewsOn', { date: effectiveRenewalDate })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* VIEW: OVERVIEW */}
          {view === 'overview' && (
            <>
              {/* Active Plan Card */}
              <div className="p-5 rounded-2xl border border-amber-400/40 bg-amber-500/10 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/20 text-amber-300">
                      <Sparkle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] text-white/50 uppercase tracking-wider">
                        {t('billing.manage.currentPlanTitle')}
                      </div>
                      <h4 className="text-base text-white">{currentPlanName}</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white font-mono">{currentPrice}</div>
                    <div className="text-[11px] text-white/50 flex items-center gap-1 justify-end mt-0.5">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {isCanceling
                          ? t('billing.manage.cancelsOn', { date: effectiveRenewalDate })
                          : t('billing.manage.renewsOn', { date: effectiveRenewalDate })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs text-white/80">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>
                      <strong>{TIER_LIMITS.plus.monthly_sessions}</strong>{' '}
                      {t('billing.plans.monthlySessionsPerk')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>
                      <strong>{TIER_LIMITS.plus.monthly_clips}</strong>{' '}
                      {t('billing.plans.monthlyClipsPerk')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>
                      {t('billing.limits.featureReferralDiscount')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reactivate if canceling */}
              {isCanceling && onReactivate && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <div>
                    <h4 className="text-sm text-white">
                      {t('billing.manage.reactivateTitle')}
                    </h4>
                    <p className="text-xs text-white/60 mt-0.5 leading-relaxed">
                      {t('billing.manage.reactivateDesc')}
                    </p>
                  </div>
                  <button
                    onClick={onReactivate}
                    className="w-full h-9 px-4.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95"
                  >
                    <Zap className="w-4 h-4 fill-zinc-950" />
                    <span>{t('billing.manage.reactivateBtn')}</span>
                  </button>
                </div>
              )}

              {/* Billing & Invoices Section (Stripe Portal) */}
              <div className="p-4 rounded-2xl bg-brand/5 border border-brand/20 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand border border-brand/20 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm text-white">
                      {t('billing.manage.billingPortalTitle')}
                    </h4>
                    <p className="text-xs text-white/60 mt-0.5 leading-relaxed">
                      {t('billing.manage.billingPortalDesc')}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] text-brand/80 mt-1">
                      {t('billing.manage.billingPortalRedirectNotice')}
                    </span>
                  </div>
                </div>

                <button
                  disabled={isPortalLoading}
                  onClick={onOpenCustomerPortal}
                  className="w-full h-9 px-4.5 rounded-full bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-brand/10 active:scale-95"
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
              {!isCanceling && (
                <div className="pt-2 text-center">
                  <button
                    onClick={() => setView('cancel_confirm')}
                    className="text-xs text-rose-400/70 hover:text-rose-400 transition-colors underline underline-offset-4 cursor-pointer"
                  >
                    {t('billing.manage.cancelSubBtn')}
                  </button>
                </div>
              )}
            </>
          )}

          {/* VIEW: CANCELLATION CONFIRMATION (RESISTANCE STEP) */}
          {view === 'cancel_confirm' && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm text-rose-200">
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

              <div className="space-y-2.5 pt-2">
                <button
                  onClick={handleClose}
                  className="w-full h-9 px-4.5 rounded-full bg-brand hover:bg-brand/90 text-zinc-950 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand/20 active:scale-95"
                >
                  <Zap className="w-4 h-4 fill-zinc-950" />
                  <span>{t('billing.manage.keepSubscriptionBtn')}</span>
                </button>
                <button
                  onClick={() => {
                    onCancelSubscription();
                    handleClose();
                  }}
                  className="w-full h-9 px-4.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center cursor-pointer active:scale-95"
                >
                  {t('billing.manage.confirmCancelBtn')}
                </button>
              </div>
            </div>
          )}
        </div>
    </BottomSheet>
  );
};

export default ManageSubscriptionModal;
