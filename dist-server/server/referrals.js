import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://jhyxekawqndpypvszubz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
export function getSupabaseAdmin() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY is not set in .env! Backend DB writes will fail due to RLS.');
    }
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false },
    });
}
/**
 * Generates a clean, friendly referral code (e.g. ZOU-9X2K4A)
 */
export function generateRandomCode(length = 6) {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
/**
 * Ensures user has a valid referral code in Supabase
 */
export async function getOrCreateReferralCode(userId) {
    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', userId)
        .maybeSingle();
    if (profile?.referral_code) {
        return profile.referral_code;
    }
    // Generate new code and save
    let newCode = generateRandomCode();
    let attempts = 0;
    while (attempts < 5) {
        if (!profile) {
            const { error } = await supabase
                .from('profiles')
                .upsert({
                id: userId,
                tier: 'free',
                subscription_status: 'none',
                referral_code: newCode,
                updated_at: new Date().toISOString(),
            });
            if (!error) {
                return newCode;
            }
        }
        else {
            const { error } = await supabase
                .from('profiles')
                .update({ referral_code: newCode, updated_at: new Date().toISOString() })
                .eq('id', userId);
            if (!error) {
                return newCode;
            }
        }
        newCode = generateRandomCode();
        attempts++;
    }
    return newCode;
}
/**
 * Backfills missing referral codes for all users in profiles table and auth users
 */
export async function backfillMissingReferralCodes() {
    const supabase = getSupabaseAdmin();
    try {
        let count = 0;
        // 1. Check all auth users to make sure they have profiles
        const { data: authData } = await supabase.auth.admin.listUsers();
        if (authData?.users) {
            for (const u of authData.users) {
                const { data: p } = await supabase
                    .from('profiles')
                    .select('id, referral_code')
                    .eq('id', u.id)
                    .maybeSingle();
                if (!p) {
                    const code = generateRandomCode();
                    await supabase.from('profiles').insert({
                        id: u.id,
                        tier: 'free',
                        subscription_status: 'none',
                        referral_code: code,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });
                    count++;
                }
                else if (!p.referral_code || p.referral_code.trim() === '') {
                    const code = generateRandomCode();
                    await supabase
                        .from('profiles')
                        .update({ referral_code: code, updated_at: new Date().toISOString() })
                        .eq('id', p.id);
                    count++;
                }
            }
        }
        if (count > 0) {
            console.log(`[referrals] Backfilled referral codes for ${count} profiles.`);
        }
        return count;
    }
    catch (err) {
        console.warn('[referrals] Error during backfillMissingReferralCodes:', err);
        return 0;
    }
}
/**
 * Redeems a referral code when a new user signs up.
 * RULE: The new user DOES NOT get a boost or credit.
 * RULE: The referrer does NOT get an immediate reward on signup;
 *       a pending referral log is created until the user subscribes and passes the 14-day refund period.
 */
const activeRedeems = new Set();
export async function redeemReferralCode(userId, inputCode) {
    const supabase = getSupabaseAdmin();
    const cleanCode = (inputCode || '').trim().toUpperCase();
    if (!cleanCode) {
        return { success: false, error: 'Invalid referral code.' };
    }
    if (activeRedeems.has(userId)) {
        return { success: false, error: 'Redeem in progress.' };
    }
    activeRedeems.add(userId);
    try {
        // 1. Fetch redeeming user profile (ensure profile exists)
        let { data: userProfile } = await supabase
            .from('profiles')
            .select('id, tier, referred_by')
            .eq('id', userId)
            .maybeSingle();
        if (!userProfile) {
            await getOrCreateReferralCode(userId);
            const { data: refreshed } = await supabase
                .from('profiles')
                .select('id, tier, referred_by')
                .eq('id', userId)
                .maybeSingle();
            userProfile = refreshed;
        }
        if (!userProfile) {
            return { success: false, error: 'User profile not found.' };
        }
        if (userProfile.referred_by) {
            return { success: false, error: 'You have already redeemed a referral code.' };
        }
        // 2. Fetch referrer profile
        const { data: referrer } = await supabase
            .from('profiles')
            .select('id, tier, referral_code')
            .ilike('referral_code', cleanCode)
            .maybeSingle();
        if (!referrer) {
            return { success: false, error: 'Referral code not found.' };
        }
        if (referrer.id === userId) {
            return { success: false, error: 'You cannot use your own referral code.' };
        }
        // 3. Update redeeming user: link to referrer only (no boost for new user)
        const { error: userUpdateErr } = await supabase
            .from('profiles')
            .update({
            referred_by: referrer.id,
            updated_at: new Date().toISOString(),
        })
            .eq('id', userId);
        if (userUpdateErr) {
            console.error('[referrals] Failed to update redeeming user profile:', userUpdateErr);
            return { success: false, error: 'Could not link referral code.' };
        }
        // 4. Log the referral entry as 'pending' (avoid duplicate insert if already exists)
        try {
            const { data: existingLog } = await supabase
                .from('referral_logs')
                .select('id')
                .eq('referred_user_id', userId)
                .maybeSingle();
            if (!existingLog) {
                const rewardType = referrer.tier === 'teacher'
                    ? 'teacher_credit'
                    : referrer.tier === 'student'
                        ? 'student_credit'
                        : 'free_boost';
                await supabase.from('referral_logs').insert({
                    referrer_id: referrer.id,
                    referred_user_id: userId,
                    reward_type: rewardType,
                    reward_value: 0,
                    status: 'pending',
                    created_at: new Date().toISOString(),
                });
            }
        }
        catch (logErr) {
            console.warn('[referrals] Could not insert referral log:', logErr);
        }
        return {
            success: true,
            message: 'Referral code linked successfully.',
            referrerName: 'A friend',
        };
    }
    finally {
        activeRedeems.delete(userId);
    }
}
/**
 * Checks and activates referral rewards that have successfully passed the 14-day refund window.
 * RULE:
 * - Free Tier Referrer: Gets 10-day boost with +2 AI sessions and +10 clips.
 *   Non-stackable in time: multiple referrals during active window add capacity (+2 / +10), but DO NOT extend the 10-day window.
 * - Student Tier Referrer: Gets €1 discount credit (accumulates).
 * - Teacher Tier Referrer: Gets €2 discount credit (accumulates).
 */
export async function processMaturedReferrals(userId) {
    const supabase = getSupabaseAdmin();
    const REFUND_WINDOW_DAYS = 14;
    const now = Date.now();
    const cutoffIso = new Date(now - REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    try {
        // Find all referral logs for this referrer that are in pending_refund_period and paid before cutoff
        const { data: maturedLogs, error } = await supabase
            .from('referral_logs')
            .select('id, referred_user_id, reward_type, paid_at, status')
            .eq('referrer_id', userId)
            .eq('status', 'pending_refund_period')
            .lte('paid_at', cutoffIso);
        if (error || !maturedLogs || maturedLogs.length === 0) {
            return 0;
        }
        console.log(`[referrals] Found ${maturedLogs.length} matured referrals for user=${userId}`);
        // Fetch current referrer profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, tier, referral_boost_expires_at, referral_boost_extra_sessions, referral_boost_extra_clips, referral_credits_balance')
            .eq('id', userId)
            .maybeSingle();
        if (!profile)
            return 0;
        let currentCredits = profile.referral_credits_balance || 0;
        let currentExtraSessions = profile.referral_boost_extra_sessions || 0;
        let currentExtraClips = profile.referral_boost_extra_clips || 0;
        let currentExpiry = profile.referral_boost_expires_at ? new Date(profile.referral_boost_expires_at).getTime() : 0;
        for (const log of maturedLogs) {
            if (profile.tier === 'free') {
                const BOOST_DURATION_MS = 10 * 24 * 60 * 60 * 1000;
                // Capacity stacks (+2 sessions, +10 clips)
                currentExtraSessions += 2;
                currentExtraClips += 10;
                // If no active boost or boost expired, start a new 10-day window
                if (!currentExpiry || currentExpiry < now) {
                    currentExpiry = now + BOOST_DURATION_MS;
                }
                // If boost is already active (currentExpiry > now), DO NOT extend the 10-day window
                await supabase
                    .from('referral_logs')
                    .update({
                    status: 'active',
                    reward_type: 'free_boost',
                    reward_value: 2,
                    activated_at: new Date().toISOString(),
                })
                    .eq('id', log.id);
            }
            else if (profile.tier === 'student') {
                // Student gets €1 discount credit per paid referral
                currentCredits += 1;
                await supabase
                    .from('referral_logs')
                    .update({
                    status: 'active',
                    reward_type: 'student_credit',
                    reward_value: 1,
                    activated_at: new Date().toISOString(),
                })
                    .eq('id', log.id);
            }
            else if (profile.tier === 'teacher') {
                // Teacher gets €2 discount credit per paid referral
                currentCredits += 2;
                await supabase
                    .from('referral_logs')
                    .update({
                    status: 'active',
                    reward_type: 'teacher_credit',
                    reward_value: 2,
                    activated_at: new Date().toISOString(),
                })
                    .eq('id', log.id);
            }
        }
        // Save updated profile state
        await supabase
            .from('profiles')
            .update({
            referral_credits_balance: currentCredits,
            referral_boost_extra_sessions: currentExtraSessions,
            referral_boost_extra_clips: currentExtraClips,
            referral_boost_expires_at: currentExpiry ? new Date(currentExpiry).toISOString() : null,
            updated_at: new Date().toISOString(),
        })
            .eq('id', userId);
        return maturedLogs.length;
    }
    catch (err) {
        console.error('[referrals] Error processing matured referrals:', err);
        return 0;
    }
}
/**
 * Returns complete referral statistics for a user, processing any matured 14-day rewards lazily.
 */
export async function getReferralStats(userId) {
    const supabase = getSupabaseAdmin();
    // 1. Process any matured rewards first (lazy evaluation)
    await processMaturedReferrals(userId);
    // 2. Get updated user profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, tier, referral_code, referral_credits_balance, referral_boost_expires_at, referral_boost_extra_sessions, referral_boost_extra_clips')
        .eq('id', userId)
        .maybeSingle();
    const code = profile?.referral_code || await getOrCreateReferralCode(userId);
    // 3. Get referral logs
    const { data: logs } = await supabase
        .from('referral_logs')
        .select('id, reward_type, reward_value, status, created_at, paid_at, activated_at')
        .eq('referrer_id', userId);
    const totalReferrals = logs ? logs.length : 0;
    const pendingRefundCount = logs ? logs.filter((l) => l.status === 'pending_refund_period').length : 0;
    const activeBoostsCount = logs ? logs.filter((l) => l.status === 'active' && l.reward_type === 'free_boost').length : 0;
    const paidConversionsCount = logs ? logs.filter((l) => l.status === 'active' && (l.reward_type === 'student_credit' || l.reward_type === 'teacher_credit')).length : 0;
    const isBoostActive = Boolean(profile?.referral_boost_expires_at &&
        new Date(profile.referral_boost_expires_at).getTime() > Date.now());
    return {
        referralCode: code,
        totalReferrals,
        pendingRefundCount,
        activeBoostsCount,
        paidConversionsCount,
        creditsBalance: profile?.referral_credits_balance || 0,
        boostActive: isBoostActive,
        boostExpiresAt: profile?.referral_boost_expires_at || null,
        boostExtraSessions: profile?.referral_boost_extra_sessions || 0,
        boostExtraClips: profile?.referral_boost_extra_clips || 0,
        tier: profile?.tier || 'free',
    };
}
