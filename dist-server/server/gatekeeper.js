import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
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
export async function checkGatekeeper(authHeader, type, durationSeconds, devOverrideJson) {
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
            const tier = dev.tier || 'free';
            const lifetimeSessions = Number(dev.lifetime_sessions) || 0;
            const lifetimeClips = Number(dev.lifetime_clips) || 0;
            const periodSessions = Number(dev.period_sessions) || 0;
            const periodClips = Number(dev.period_clips) || 0;
            const isBoostActive = Boolean(dev.referral_boost_active) &&
                Boolean(dev.referral_boost_expires_at) &&
                new Date(dev.referral_boost_expires_at).getTime() > Date.now();
            const maxSessions = tier === 'free'
                ? TIER_CONFIG.free.lifetime_sessions + (isBoostActive ? (Number(dev.referral_boost_extra_sessions) || TIER_CONFIG.boost.extra_sessions) : 0)
                : tier === 'student'
                    ? TIER_CONFIG.student.monthly_sessions
                    : TIER_CONFIG.teacher.monthly_sessions;
            const maxClips = tier === 'free'
                ? TIER_CONFIG.free.lifetime_clips + (isBoostActive ? (Number(dev.referral_boost_extra_clips) || TIER_CONFIG.boost.extra_clips) : 0)
                : tier === 'student'
                    ? TIER_CONFIG.student.monthly_clips
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
            }
            else if (tier === 'student') {
                if (type === 'consolidation' && periodSessions >= TIER_CONFIG.student.monthly_sessions) {
                    return {
                        allowed: false,
                        statusCode: 403,
                        code: 'QUOTA_EXCEEDED',
                        tier: 'student',
                        limits: { sessions: TIER_CONFIG.student.monthly_sessions, clips: TIER_CONFIG.student.monthly_clips },
                        usage: { period_sessions: periodSessions, period_clips: periodClips },
                        error: 'You have reached your monthly Student plan AI limit (20 sessions).',
                    };
                }
                if (type === 'single_clip' && periodClips >= TIER_CONFIG.student.monthly_clips) {
                    return {
                        allowed: false,
                        statusCode: 403,
                        code: 'QUOTA_EXCEEDED',
                        tier: 'student',
                        limits: { sessions: TIER_CONFIG.student.monthly_sessions, clips: TIER_CONFIG.student.monthly_clips },
                        usage: { period_sessions: periodSessions, period_clips: periodClips },
                        error: 'You have reached your monthly Student plan AI limit (200 clips).',
                    };
                }
            }
            else if (tier === 'teacher') {
                if (type === 'consolidation' && periodSessions >= TIER_CONFIG.teacher.monthly_sessions) {
                    return {
                        allowed: false,
                        statusCode: 403,
                        code: 'QUOTA_EXCEEDED',
                        tier: 'teacher',
                        limits: { sessions: TIER_CONFIG.teacher.monthly_sessions, clips: Infinity },
                        usage: { period_sessions: periodSessions },
                        error: 'You have reached your monthly Teacher plan AI limit (100 sessions).',
                    };
                }
            }
            return {
                allowed: true,
                tier,
                usage: { lifetime_sessions: lifetimeSessions, lifetime_clips: lifetimeClips, period_sessions: periodSessions, period_clips: periodClips },
                limits: { sessions: maxSessions, clips: maxClips },
            };
        }
        catch (e) {
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
            const tier = profile?.tier || 'free';
            const lifetimeSessions = usage?.lifetime_sessions || 0;
            const lifetimeClips = usage?.lifetime_clips || 0;
            const periodSessions = usage?.period_sessions || 0;
            const periodClips = usage?.period_clips || 0;
            const isBoostActive = Boolean(profile?.referral_boost_active) &&
                Boolean(profile?.referral_boost_expires_at) &&
                new Date(profile.referral_boost_expires_at).getTime() > Date.now();
            const extraSessions = isBoostActive ? (profile?.referral_boost_extra_sessions || TIER_CONFIG.boost.extra_sessions) : 0;
            const extraClips = isBoostActive ? (profile?.referral_boost_extra_clips || TIER_CONFIG.boost.extra_clips) : 0;
            const maxSessions = tier === 'free' ? TIER_CONFIG.free.lifetime_sessions + extraSessions : tier === 'student' ? TIER_CONFIG.student.monthly_sessions : TIER_CONFIG.teacher.monthly_sessions;
            const maxClips = tier === 'free' ? TIER_CONFIG.free.lifetime_clips + extraClips : tier === 'student' ? TIER_CONFIG.student.monthly_clips : Infinity;
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
            }
            else if (tier === 'student') {
                if (type === 'consolidation' && periodSessions >= TIER_CONFIG.student.monthly_sessions) {
                    return {
                        allowed: false,
                        statusCode: 403,
                        code: 'QUOTA_EXCEEDED',
                        tier: 'student',
                        limits: { sessions: TIER_CONFIG.student.monthly_sessions, clips: TIER_CONFIG.student.monthly_clips },
                        usage: { period_sessions: periodSessions, period_clips: periodClips },
                        error: 'You have reached your monthly Student plan AI limit (20 sessions).',
                        userId,
                    };
                }
                if (type === 'single_clip' && periodClips >= TIER_CONFIG.student.monthly_clips) {
                    return {
                        allowed: false,
                        statusCode: 403,
                        code: 'QUOTA_EXCEEDED',
                        tier: 'student',
                        limits: { sessions: TIER_CONFIG.student.monthly_sessions, clips: TIER_CONFIG.student.monthly_clips },
                        usage: { period_sessions: periodSessions, period_clips: periodClips },
                        error: 'You have reached your monthly Student plan AI limit (200 clips).',
                        userId,
                    };
                }
            }
            else if (tier === 'teacher' && type === 'consolidation' && periodSessions >= TIER_CONFIG.teacher.monthly_sessions) {
                return {
                    allowed: false,
                    statusCode: 403,
                    code: 'QUOTA_EXCEEDED',
                    tier: 'teacher',
                    limits: { sessions: TIER_CONFIG.teacher.monthly_sessions, clips: Infinity },
                    usage: { period_sessions: periodSessions },
                    error: 'You have reached your monthly Teacher plan AI limit (100 sessions).',
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
        }
        catch (dbErr) {
            console.error('[Gatekeeper] Database lookup error:', dbErr?.message);
            return { allowed: true, tier: 'free' };
        }
    }
    // Default: Guest or unauthenticated local usage
    return { allowed: true, tier: 'free' };
}
/**
 * Increments the database usage tracking counters on successful AI operation.
 */
export async function recordUsageIncrement(authHeader, type) {
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
        if (!userData?.user)
            return;
        const userId = userData.user.id;
        if (type === 'single_clip') {
            await supabase.rpc('increment_usage_clip', { target_user_id: userId });
        }
        else if (type === 'consolidation') {
            await supabase.rpc('increment_usage_session', { target_user_id: userId });
        }
    }
    catch (err) {
        console.warn('[Gatekeeper] Failed to record usage increment in Supabase:', err?.message);
    }
}
