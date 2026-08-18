import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Bot,
  Zap,
  RotateCcw,
  Check,
  X,
  Gift,
  Clock,
  CreditCard,
  Sparkles,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';
import { UserTier, SubscriptionStatus, TIER_LIMITS } from '../types';
import {
  DevState,
  getDevState,
  saveDevState,
  resetDevState,
  inject10DayBoost,
  expireBoostNow,
} from '../lib/devLab';

interface TestLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStateApplied?: (state: DevState) => void;
}

export const TestLabModal: React.FC<TestLabModalProps> = ({
  isOpen,
  onClose,
  onStateApplied,
}) => {
  const { t } = useTranslation();
  const [devState, setDevState] = useState<DevState>(getDevState());
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDevState(getDevState());
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const updated = saveDevState(devState);
    setSavedSuccess(true);
    if (onStateApplied) {
      onStateApplied(updated);
    }
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2500);
  };

  const handleReset = () => {
    const reset = resetDevState();
    setDevState(reset);
    setSavedSuccess(true);
    if (onStateApplied) {
      onStateApplied(reset);
    }
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2500);
  };

  const applyPreset = (preset: Partial<DevState>) => {
    const next = { ...devState, ...preset };
    setDevState(next);
    saveDevState(next);
    setSavedSuccess(true);
    if (onStateApplied) {
      onStateApplied(next);
    }
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const isBoostActive =
    devState.referral_boost_active &&
    devState.referral_boost_expires_at &&
    new Date(devState.referral_boost_expires_at).getTime() > Date.now();

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center z-[70] p-4 sm:p-6 overflow-y-auto">
      <div
        className="glass border border-brand/30 p-6 sm:p-8 max-w-xl w-full rounded-2xl shadow-2xl relative max-h-[90vh] flex flex-col custom-scrollbar animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shadow-inner">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {t('billing.dev.panelTitle')}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand/20 text-brand border border-brand/30 uppercase tracking-widest font-mono">
                  Sandbox
                </span>
              </h3>
              <p className="text-xs text-white/50">
                Override tiers, simulate billing events, and test limits safely.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-6 py-5 pr-1 custom-scrollbar">
          {/* 1. Gemini Mock Mode / Token Saver */}
          <div className="p-4 rounded-xl bg-zinc-900/90 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Bot
                  className={`w-5 h-5 ${devState.mockGemini ? 'text-brand animate-pulse' : 'text-zinc-400'}`}
                />
                <div>
                  <div className="text-sm font-bold text-white">
                    {t('billing.dev.geminiMockToggle')}
                  </div>
                  <div className="text-[11px] text-white/60">
                    {t('billing.dev.geminiMockDesc')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDevState((prev) => ({
                    ...prev,
                    mockGemini: !prev.mockGemini,
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  devState.mockGemini ? 'bg-brand' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    devState.mockGemini ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-white/5 text-[11px]">
              <span className="text-white/40">Status:</span>
              {devState.mockGemini ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  ● {t('billing.dev.mockActiveBadge')}
                </span>
              ) : (
                <span className="text-amber-400/80 font-medium flex items-center gap-1">
                  ○ {t('billing.dev.mockInactiveBadge')}
                </span>
              )}
            </div>
          </div>

          {/* 2. Quick Presets */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              {t('billing.dev.presetsHeading')}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  applyPreset({
                    tier: 'free',
                    subscription_status: 'none',
                    lifetime_sessions: 0,
                    lifetime_clips: 0,
                    referral_boost_active: false,
                  })
                }
                className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-left transition-all text-xs font-semibold text-white/90 hover:border-brand/40"
              >
                {t('billing.dev.presetCleanFree')}
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPreset({
                    tier: 'free',
                    subscription_status: 'none',
                    lifetime_sessions: 2,
                    lifetime_clips: 14,
                    referral_boost_active: false,
                  })
                }
                className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15 text-left transition-all text-xs font-semibold text-amber-300"
              >
                {t('billing.dev.presetNearLimit')}
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPreset({
                    tier: 'free',
                    subscription_status: 'none',
                    lifetime_sessions: 3,
                    lifetime_clips: 15,
                    referral_boost_active: false,
                  })
                }
                className="p-2.5 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 text-left transition-all text-xs font-semibold text-red-300"
              >
                {t('billing.dev.presetLimitHit')}
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPreset({
                    tier: 'student',
                    subscription_status: 'active',
                    period_sessions: 5,
                  })
                }
                className="p-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/15 text-left transition-all text-xs font-semibold text-cyan-300"
              >
                {t('billing.dev.presetStudent')}
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPreset({
                    tier: 'teacher',
                    subscription_status: 'active',
                    period_sessions: 15,
                  })
                }
                className="p-2.5 rounded-xl border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/15 text-left transition-all text-xs font-semibold text-purple-300"
              >
                {t('billing.dev.presetTeacher')}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-left transition-all text-xs font-semibold text-white/50 hover:text-white"
              >
                {t('billing.dev.resetAll')}
              </button>
            </div>
          </div>

          {/* 3. Tier & Subscription Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-brand" />
                {t('billing.dev.tierSelect')}
              </label>
              <select
                value={devState.tier}
                onChange={(e) =>
                  setDevState((prev) => ({
                    ...prev,
                    tier: e.target.value as UserTier,
                  }))
                }
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-brand"
              >
                <option value="free">Free (Lifetime Capped)</option>
                <option value="student">Student (€2.99 / mo - 20 sessions)</option>
                <option value="teacher">Teacher (€12.99 / mo - 100 sessions)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-brand" />
                {t('billing.dev.simSubscriptionStatus')}
              </label>
              <select
                value={devState.subscription_status}
                onChange={(e) =>
                  setDevState((prev) => ({
                    ...prev,
                    subscription_status: e.target.value as SubscriptionStatus,
                  }))
                }
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-brand"
              >
                <option value="none">None (Free)</option>
                <option value="active">Active (Paid)</option>
                <option value="trialing">Trialing</option>
                <option value="past_due">Past Due (Payment Failed)</option>
                <option value="canceled">Canceled (Grace Period)</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
          </div>

          {/* 4. Usage Counters Manipulation */}
          <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-brand" />
                {t('billing.dev.setCounters')}
              </span>
              <button
                type="button"
                onClick={() =>
                  setDevState((prev) => ({
                    ...prev,
                    lifetime_sessions: 0,
                    lifetime_clips: 0,
                    period_sessions: 0,
                  }))
                }
                className="text-[11px] text-brand hover:underline font-medium"
              >
                {t('billing.dev.resetCounters')}
              </button>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Lifetime Sessions */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-white/70 block font-medium">
                  {t('billing.dev.lifetimeSessions')} (Max: {TIER_LIMITS.free.lifetime_sessions})
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={devState.lifetime_sessions}
                  onChange={(e) =>
                    setDevState((prev) => ({
                      ...prev,
                      lifetime_sessions: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              {/* Lifetime Clips */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-white/70 block font-medium">
                  {t('billing.dev.lifetimeClips')} (Max: {TIER_LIMITS.free.lifetime_clips})
                </label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={devState.lifetime_clips}
                  onChange={(e) =>
                    setDevState((prev) => ({
                      ...prev,
                      lifetime_clips: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              {/* Period Sessions */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-white/70 block font-medium">
                  {t('billing.dev.periodSessions')} (Monthly)
                </label>
                <input
                  type="number"
                  min="0"
                  max="200"
                  value={devState.period_sessions}
                  onChange={(e) =>
                    setDevState((prev) => ({
                      ...prev,
                      period_sessions: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* 5. Referral Boost & Referral Credits */}
          <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5 text-brand" />
              Referral Boost & Discount Credits
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 10-Day Boost Injector */}
              <div className="space-y-2">
                <div className="text-[11px] text-white/70 font-medium">
                  Free User 10-Day Boost
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = inject10DayBoost();
                      setDevState(updated);
                    }}
                    className="flex-1 px-3 py-2 rounded-lg bg-brand/10 border border-brand/30 hover:bg-brand/20 text-brand text-xs font-bold transition-all"
                  >
                    {t('billing.dev.injectBoost')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = expireBoostNow();
                      setDevState(updated);
                    }}
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white text-xs font-bold transition-all"
                  >
                    {t('billing.dev.expireBoost')}
                  </button>
                </div>
                <div className="text-[10px] text-white/40">
                  {isBoostActive
                    ? t('billing.dev.boostStatusActive', {
                        date: new Date(
                          devState.referral_boost_expires_at!
                        ).toLocaleDateString(),
                      })
                    : t('billing.dev.boostStatusInactive')}
                </div>
              </div>

              {/* Referral Credit Units (€) */}
              <div className="space-y-2">
                <div className="text-[11px] text-white/70 font-medium">
                  {t('billing.dev.creditsLabel')} (€)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDevState((prev) => ({
                        ...prev,
                        referral_credits_balance: Math.max(
                          0,
                          prev.referral_credits_balance - 1
                        ),
                      }))
                    }
                    className="w-9 h-9 rounded-lg bg-zinc-900 border border-white/10 text-white font-bold hover:bg-white/10"
                  >
                    -
                  </button>
                  <div className="flex-1 text-center font-mono font-bold text-base text-brand">
                    €{devState.referral_credits_balance}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDevState((prev) => ({
                        ...prev,
                        referral_credits_balance:
                          prev.referral_credits_balance + 1,
                      }))
                    }
                    className="w-9 h-9 rounded-lg bg-zinc-900 border border-white/10 text-white font-bold hover:bg-white/10"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-white/10 pt-4 flex items-end justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold transition-all cursor-pointer"
          >
            {t('billing.dev.close')}
          </button>

          <div className="flex flex-col items-end gap-1.5">
            {savedSuccess && (
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold animate-in fade-in duration-200">
                <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span>{t('billing.dev.overridesApplied')}</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand/90 text-zinc-950 text-xs font-bold shadow-lg shadow-brand/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {t('billing.dev.applyOverrides')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestLabModal;
