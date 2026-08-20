import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

export type UserTier = 'free' | 'student' | 'teacher';

export interface GatekeeperResult {
  allowed: boolean;
  error?: string;
  code?: 'QUOTA_EXCEEDED' | 'AUDIO_DURATION_EXCEEDED' | 'UNAUTHORIZED' | 'SERVER_ERROR';
  statusCode?: number;
  tier?: UserTier;
  limits?: {
    sessions?: number;
    clips?: number;
  };
  usage?: {
    lifetime_sessions?: number;
    lifetime_clips?: number;
    period_sessions?: number;
    period_clips?: number;
  };
  canBoost?: boolean;
  userId?: string;
}

export const TIER_CONFIG = {
  free: {
    lifetime_sessions: 3,
    lifetime_clips: 15,
  },
  student: {
    monthly_sessions: 20,
    monthly_clips: 200,
  },
  teacher: {
    monthly_sessions: 100,
    monthly_clips: Infinity,
  },
  boost: {
    extra_sessions: 2,
    extra_clips: 10,
    duration_days: 10,
  },
  max_audio_duration_seconds: 180, // 3 minutes hard cap
};

/**
 * Validates request against audio duration and user tier quotas.
 */
export async function checkGatekeeper(
  authHeader: string | undefined,
  type: 'single_clip' | 'consolidation',
  durationSeconds?: number,
  devOverrideJson?: string
): Promise<GatekeeperResult> {
  // 1. Enforce 3-minute hard duration cap
  if (durationSeconds && durationSeconds > TIER_CONFIG.max_audio_duration_seconds) {
    return {
      allowed: false,
      statusCode: 400,
      code: 'AUDIO_DURATION_EXCEEDED',
      error: `Audio duration (${Math.round(durationSeconds)}s) exceeds the maximum allowed limit of ${TIER_CONFIG.max_audio_duration_seconds}s (3 minutes).`,
    };
  }

  // 2. Check for Dev Lab Override Header (used in local developer testing)
  if (devOverrideJson) {
    try {
      const dev = JSON.parse(devOverrideJson);
      let tier: UserTier = dev.tier || 'free';
      const subscriptionStatus: string | undefined = dev.subscription_status;

      // If user has a paid tier but payment failed, unpaid, or canceled, enforce free limits
      if (tier !== 'free' && subscriptionStatus && ['past_due', 'unpaid', 'canceled'].includes(subscriptionStatus)) {
        tier = 'free';
      }

      const periodSessions = Number(dev.period_sessions) || 0;
      const periodClips = Number(dev.period_clips) || 0;
      const lifetimeSessions = Math.max(Number(dev.lifetime_sessions) || 0, periodSessions);
      const lifetimeClips = Math.max(Number(dev.lifetime_clips) || 0, periodClips);

      const isBoostActive =
        Boolean(dev.referral_boost_active) &&
        Boolean(dev.referral_boost_expires_at) &&
        new Date(dev.referral_boost_expires_at).getTime() > Date.now();

      const topupSessions = Number(dev.topup_extra_sessions) || 0;
      const topupClips = Number(dev.topup_extra_clips) || 0;

      const maxSessions =
        tier === 'free'
          ? TIER_CONFIG.free.lifetime_sessions + (isBoostActive ? (Number(dev.referral_boost_extra_sessions) || TIER_CONFIG.boost.extra_sessions) : 0) + topupSessions
          : tier === 'student'
          ? TIER_CONFIG.student.monthly_sessions + topupSessions
          : TIER_CONFIG.teacher.monthly_sessions + topupSessions;

      const maxClips =
        tier === 'free'
          ? TIER_CONFIG.free.lifetime_clips + (isBoostActive ? (Number(dev.referral_boost_extra_clips) || TIER_CONFIG.boost.extra_clips) : 0) + topupClips
          : tier === 'student'
          ? TIER_CONFIG.student.monthly_clips + topupClips
          : Infinity;

      if (tier === 'free') {
        if (type === 'consolidation' && lifetimeSessions >= maxSessions) {
          return {
            allowed: false,
            statusCode: 403,
            code: 'QUOTA_EXCEEDED',
            tier: 'free',
            canBoost: !isBoostActive,
            limits: { sessions: maxSessions, clips: maxClips },
            usage: { lifetime_sessions: lifetimeSessions, lifetime_clips: lifetimeClips },
            error: 'You have reached your lifetime limit of free AI session consolidations.',
          };
        }
        if (type === 'single_clip' && lifetimeClips >= maxClips) {
          return {
            allowed: false,
            statusCode: 403,
            code: 'QUOTA_EXCEEDED',
            tier: 'free',
            canBoost: !isBoostActive,
            limits: { sessions: maxSessions, clips: maxClips },
            usage: { lifetime_sessions: lifetimeSessions, lifetime_clips: lifetimeClips },
            error: 'You have reached your lifetime limit of free AI clip transcriptions.',
          };
        }
      } else if (tier === 'student') {
        if (type === 'consolidation' && periodSessions >= maxSessions) {
          return {
            allowed: false,
            statusCode: 403,
            code: 'QUOTA_EXCEEDED',
            tier: 'student',
            limits: { sessions: maxSessions, clips: maxClips },
            usage: { period_sessions: periodSessions, period_clips: periodClips },
            error: 'You have reached your monthly Student plan AI limit.',
          };
        }
        if (type === 'single_clip' && periodClips >= maxClips) {
          return {
            allowed: false,
            statusCode: 403,
            code: 'QUOTA_EXCEEDED',
            tier: 'student',
            limits: { sessions: maxSessions, clips: maxClips },
            usage: { period_sessions: periodSessions, period_clips: periodClips },
            error: 'You have reached your monthly Student plan AI limit.',
          };
        }
      } else if (tier === 'teacher') {
        if (type === 'consolidation' && periodSessions >= maxSessions) {
          return {
            allowed: false,
            statusCode: 403,
            code: 'QUOTA_EXCEEDED',
            tier: 'teacher',
            limits: { sessions: maxSessions, clips: Infinity },
            usage: { period_sessions: periodSessions },
            error: 'You have reached your monthly Teacher plan AI limit.',
          };
        }
      }

      return {
        allowed: true,
        tier,
        usage: { lifetime_sessions: lifetimeSessions, lifetime_clips: lifetimeClips, period_sessions: periodSessions, period_clips: periodClips },
        limits: { sessions: maxSessions, clips: maxClips },
      };
    } catch (e) {
      console.warn('[Gatekeeper] Failed to parse dev override header:', e);
    }
  }

  // 3. Authenticated User Flow via Supabase
  if (authHeader && authHeader.startsWith('Bearer ') && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const token = authHeader.replace('Bearer ', '').trim();
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        console.warn('[Gatekeeper] Invalid user token:', userError?.message);
        return { allowed: true, tier: 'free' }; // fallback gracefully
      }

      const userId = userData.user.id;

      // Fetch profile & usage from DB
      const [{ data: profile }, { data: usage }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('usage_tracking').select('*').eq('user_id', userId).single(),
      ]);

      let tier: UserTier = profile?.tier || 'free';
      const subscriptionStatus = profile?.subscription_status;

      // If user has a paid tier but payment failed, unpaid, or canceled, enforce free limits
      if (tier !== 'free' && subscriptionStatus && ['past_due', 'unpaid', 'canceled'].includes(subscriptionStatus)) {
        tier = 'free';
      }

      const periodSessions = usage?.period_sessions || 0;
      const periodClips = usage?.period_clips || 0;
      const lifetimeSessions = Math.max(usage?.lifetime_sessions || 0, periodSessions);
      const lifetimeClips = Math.max(usage?.lifetime_clips || 0, periodClips);

      const isBoostActive =
        Boolean(profile?.referral_boost_active) &&
        Boolean(profile?.referral_boost_expires_at) &&
        new Date(profile.referral_boost_expires_at).getTime() > Date.now();

      const extraSessions = isBoostActive ? (profile?.referral_boost_extra_sessions || TIER_CONFIG.boost.extra_sessions) : 0;
      const extraClips = isBoostActive ? (profile?.referral_boost_extra_clips || TIER_CONFIG.boost.extra_clips) : 0;

      const topupSessions = Number(profile?.topup_extra_sessions) || 0;
      const topupClips = Number(profile?.topup_extra_clips) || 0;

      const maxSessions =
        tier === 'free'
          ? TIER_CONFIG.free.lifetime_sessions + extraSessions + topupSessions
          : tier === 'student'
          ? TIER_CONFIG.student.monthly_sessions + topupSessions
          : TIER_CONFIG.teacher.monthly_sessions + topupSessions;

      const maxClips =
        tier === 'free'
          ? TIER_CONFIG.free.lifetime_clips + extraClips + topupClips
          : tier === 'student'
          ? TIER_CONFIG.student.monthly_clips + topupClips
          : Infinity;

      if (tier === 'free') {
        if (type === 'consolidation' && lifetimeSessions >= maxSessions) {
          return {
            allowed: false,
            statusCode: 403,
            code: 'QUOTA_EXCEEDED',
            tier: 'free',
            canBoost: !isBoostActive,
            limits: { sessions: maxSessions, clips: maxClips },
            usage: { lifetime_sessions: lifetimeSessions, lifetime_clips: lifetimeClips },
            error: 'You have reached your lifetime limit of free AI session consolidations.',
            userId,
          };
        }
        if (type === 'single_clip' && lifetimeClips >= maxClips) {
          return {
            allowed: false,
            statusCode: 403,
            code: 'QUOTA_EXCEEDED',
            tier: 'free',
            canBoost: !isBoostActive,
            limits: { sessions: maxSessions, clips: maxClips },
            usage: { lifetime_sessions: lifetimeSessions, lifetime_clips: lifetimeClips },
            error: 'You have reached your lifetime limit of free AI clip transcriptions.',
            userId,
          };
        }
      } else if (tier === 'student') {
        if (type === 'consolidation' && periodSessions >= maxSessions) {
          return {
            allowed: false,
            statusCode: 403,
            code: 'QUOTA_EXCEEDED',
            tier: 'student',
            limits: { sessions: maxSessions, clips: maxClips },
            usage: { period_sessions: periodSessions, period_clips: periodClips },
            error: 'You have reached your monthly Student plan AI limit.',
            userId,
          };
        }
        if (type === 'single_clip' && periodClips >= maxClips) {
          return {
            allowed: false,
            statusCode: 403,
            code: 'QUOTA_EXCEEDED',
            tier: 'student',
            limits: { sessions: maxSessions, clips: maxClips },
            usage: { period_sessions: periodSessions, period_clips: periodClips },
            error: 'You have reached your monthly Student plan AI limit.',
            userId,
          };
        }
      } else if (tier === 'teacher' && type === 'consolidation' && periodSessions >= maxSessions) {
        return {
          allowed: false,
          statusCode: 403,
          code: 'QUOTA_EXCEEDED',
          tier: 'teacher',
          limits: { sessions: maxSessions, clips: Infinity },
          usage: { period_sessions: periodSessions },
          error: 'You have reached your monthly Teacher plan AI limit.',
          userId,
        };
      }

      return {
        allowed: true,
        userId,
        tier,
        usage: { lifetime_sessions: lifetimeSessions, lifetime_clips: lifetimeClips, period_sessions: periodSessions },
        limits: { sessions: maxSessions, clips: maxClips },
      };
    } catch (dbErr: any) {
      console.error('[Gatekeeper] Database lookup error:', dbErr?.message);
      return { allowed: true, tier: 'free' };
    }
  }

  // Default: Guest or unauthenticated local usage
  return { 
    allowed: false, 
    statusCode: 401, 
    code: 'UNAUTHORIZED', 
    error: 'Authentication is required to use AI features.' 
  };
}

/**
 * Increments the database usage tracking counters on successful AI operation and decrements topup if in overage.
 */
export async function recordUsageIncrement(
  authHeader: string | undefined,
  type: 'single_clip' | 'consolidation'
): Promise<void> {
  if (!authHeader || !authHeader.startsWith('Bearer ') || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return;
  }

  try {
    const token = authHeader.replace('Bearer ', '').trim();
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) return;

    const userId = userData.user.id;

    if (type === 'single_clip') {
      await supabase.rpc('increment_usage_clip', { target_user_id: userId });
    } else if (type === 'consolidation') {
      await supabase.rpc('increment_usage_session', { target_user_id: userId });
    }

    // Check if user has topup balance and is currently exceeding base plan quota
    const [{ data: profile }, { data: usage }] = await Promise.all([
      supabase.from('profiles').select('tier, topup_extra_sessions, topup_extra_clips').eq('id', userId).single(),
      supabase.from('usage_tracking').select('period_sessions, period_clips').eq('user_id', userId).single(),
    ]);

    if (profile) {
      if (type === 'consolidation' && (profile.topup_extra_sessions || 0) > 0) {
        const baseLimit = profile.tier === 'teacher' ? TIER_CONFIG.teacher.monthly_sessions : profile.tier === 'student' ? TIER_CONFIG.student.monthly_sessions : TIER_CONFIG.free.lifetime_sessions;
        const currentUsage = usage?.period_sessions || 0;
        if (currentUsage > baseLimit) {
          const newTopup = Math.max(0, profile.topup_extra_sessions - 1);
          await supabase.from('profiles').update({ topup_extra_sessions: newTopup, updated_at: new Date().toISOString() }).eq('id', userId);
          console.log(`[Gatekeeper] Consumed 1 topup session for user=${userId}. Remaining topup: ${newTopup}`);
        }
      } else if (type === 'single_clip' && (profile.topup_extra_clips || 0) > 0) {
        const baseClipLimit = profile.tier === 'student' ? TIER_CONFIG.student.monthly_clips : TIER_CONFIG.free.lifetime_clips;
        const currentClips = usage?.period_clips || 0;
        if (currentClips > baseClipLimit) {
          const newTopupClips = Math.max(0, profile.topup_extra_clips - 1);
          await supabase.from('profiles').update({ topup_extra_clips: newTopupClips, updated_at: new Date().toISOString() }).eq('id', userId);
          console.log(`[Gatekeeper] Consumed 1 topup clip for user=${userId}. Remaining topup clips: ${newTopupClips}`);
        }
      }
    }
  } catch (err: any) {
    console.warn('[Gatekeeper] Failed to record usage increment in Supabase:', err?.message);
  }
}
