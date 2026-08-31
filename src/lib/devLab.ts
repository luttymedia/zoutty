import { UserTier, SubscriptionStatus, TIER_LIMITS } from '../types';

export interface DevState {
  mockGemini: boolean;
  tier: UserTier;
  subscription_status: SubscriptionStatus;
  lifetime_sessions: number;
  lifetime_clips: number;
  period_sessions: number;
  period_clips: number;
  referral_boost_active: boolean;
  referral_boost_expires_at: string | null;
  referral_boost_extra_sessions: number;
  referral_boost_extra_clips: number;
  referral_credits_balance: number;
  topup_extra_sessions: number;
  topup_extra_clips: number;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  pending_downgrade?: UserTier | null;
}

const STORAGE_KEY = 'zoutty_dev_state';

export const DEFAULT_DEV_STATE: DevState = {
  mockGemini: false,
  tier: 'free',
  subscription_status: 'none',
  lifetime_sessions: 0,
  lifetime_clips: 0,
  period_sessions: 0,
  period_clips: 0,
  referral_boost_active: false,
  referral_boost_expires_at: null,
  referral_boost_extra_sessions: 0,
  referral_boost_extra_clips: 0,
  referral_credits_balance: 0,
  topup_extra_sessions: 0,
  topup_extra_clips: 0,
};

export const getDevState = (): DevState => {
  if (typeof window === 'undefined') return DEFAULT_DEV_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DEV_STATE;
    return { ...DEFAULT_DEV_STATE, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('[DevLab] Failed to parse dev state, using defaults:', e);
    return DEFAULT_DEV_STATE;
  }
};

export const saveDevState = (updates: Partial<DevState>): DevState => {
  const current = getDevState();
  const next = { ...current, ...updates };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('zoutty-dev-state-changed', { detail: next }));
  } catch (e) {
    console.error('[DevLab] Failed to save dev state:', e);
  }
  return next;
};

export const resetDevState = (): DevState => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DEV_STATE));
    window.dispatchEvent(new CustomEvent('zoutty-dev-state-changed', { detail: DEFAULT_DEV_STATE }));
  } catch (e) {
    console.error('[DevLab] Failed to reset dev state:', e);
  }
  return DEFAULT_DEV_STATE;
};

export const syncWithCloudProfile = (profile: any, usage: any): DevState => {
  const current = getDevState();
  return saveDevState({
    ...current,
    tier: profile?.tier || 'free',
    subscription_status: profile?.subscription_status || 'none',
    lifetime_sessions: usage?.lifetime_sessions || 0,
    lifetime_clips: usage?.lifetime_clips || 0,
    period_sessions: usage?.period_sessions || 0,
    period_clips: usage?.period_clips || 0,
    referral_boost_active: Boolean(profile?.referral_boost_active),
    referral_boost_expires_at: profile?.referral_boost_expires_at || null,
    referral_boost_extra_sessions: profile?.referral_boost_extra_sessions || 0,
    referral_boost_extra_clips: profile?.referral_boost_extra_clips || 0,
    referral_credits_balance: profile?.referral_credits_balance || 0,
    topup_extra_sessions: profile?.topup_extra_sessions || 0,
    topup_extra_clips: profile?.topup_extra_clips || 0,
    current_period_end: profile?.current_period_end || null,
    cancel_at_period_end: profile?.cancel_at_period_end || false,
    pending_downgrade: profile?.pending_downgrade || null,
  });
};

export const inject10DayBoost = (): DevState => {
  const current = getDevState();
  const now = Date.now();
  const hasActiveBoost = Boolean(
    current.referral_boost_active &&
    current.referral_boost_expires_at &&
    new Date(current.referral_boost_expires_at).getTime() > now
  );

  // If already active, stack capacity (+2 / +10) but KEEP existing expiry (Non-stackable in time)
  const expires = hasActiveBoost
    ? current.referral_boost_expires_at!
    : new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString();

  const extraSessions = (hasActiveBoost ? (current.referral_boost_extra_sessions || 0) : 0) + TIER_LIMITS.referral_boost.extra_sessions;
  const extraClips = (hasActiveBoost ? (current.referral_boost_extra_clips || 0) : 0) + TIER_LIMITS.referral_boost.extra_clips;

  return saveDevState({
    referral_boost_active: true,
    referral_boost_expires_at: expires,
    referral_boost_extra_sessions: extraSessions,
    referral_boost_extra_clips: extraClips,
  });
};

export const expireBoostNow = (): DevState => {
  const past = new Date(Date.now() - 60 * 1000).toISOString();
  return saveDevState({
    referral_boost_active: false,
    referral_boost_expires_at: past,
    referral_boost_extra_sessions: 0,
    referral_boost_extra_clips: 0,
  });
};
