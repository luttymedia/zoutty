import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
/**
 * Returns an initialized Stripe instance using current environment secret key
 */
export function getStripe() {
    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    if (!secretKey || secretKey.startsWith('mock_')) {
        return null;
    }
    return new Stripe(secretKey);
}
/**
 * Helper to get authenticated user from Supabase JWT
 */
export async function getAuthenticatedUser(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return null;
    }
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: { persistSession: false },
        });
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user)
            return null;
        return user;
    }
    catch (err) {
        console.error('[stripe] Auth verification error:', err);
        return null;
    }
}
/**
 * Safely extracts current_period_end from a Stripe Subscription object.
 * In newer Stripe API versions, this might not be at the root of the subscription
 * but rather inside items.data[0].current_period_end.
 */
function getPeriodEnd(sub) {
    if (!sub || typeof sub !== 'object')
        return null;
    if (sub.current_period_end)
        return sub.current_period_end;
    if (sub.items && sub.items.data && sub.items.data.length > 0) {
        if (sub.items.data[0].current_period_end) {
            return sub.items.data[0].current_period_end;
        }
    }
    return null;
}
/**
 * Helper to fetch user profile from Supabase
 */
async function getUserProfile(userId) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY)
        return null;
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: { persistSession: false },
        });
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
        if (error) {
            console.warn('[stripe] Could not fetch profile from Supabase:', error.message);
            return null;
        }
        return data;
    }
    catch (err) {
        console.error('[stripe] Error fetching profile:', err);
        return null;
    }
}
/**
 * Creates a Stripe Checkout Session for subscription
 */
export async function createCheckoutSession(params) {
    const { targetTier, referralCode, successUrl, cancelUrl, baseUrl = 'http://localhost:8181', authHeader, devOverride } = params;
    const stripe = getStripe();
    const isMockOverride = Boolean(devOverride && (devOverride.includes('"gemini_mock_mode":true') || devOverride.includes('"mockMode":true')));
    if (!stripe || isMockOverride) {
        console.log(`[stripe] Mock / Sandbox Mode active. Simulating checkout for tier=${targetTier}.`);
        const redirectUrl = `${successUrl || baseUrl}/?checkout_success=true&tier=${targetTier}&mock=true`;
        return {
            mock: true,
            url: redirectUrl,
            targetTier,
            message: 'Simulated checkout session (Stripe Mock Mode active).'
        };
    }
    // 1. Resolve price ID
    const studentPriceId = process.env.STRIPE_STUDENT_PRICE_ID || '';
    const teacherPriceId = process.env.STRIPE_TEACHER_PRICE_ID || '';
    const priceId = targetTier === 'teacher' ? teacherPriceId : studentPriceId;
    if (!priceId) {
        console.error(`[stripe] Missing price ID for tier=${targetTier}.`);
        throw {
            statusCode: 500,
            error: `Stripe price ID not configured for ${targetTier} plan. Please set STRIPE_${targetTier.toUpperCase()}_PRICE_ID in .env.`
        };
    }
    // 2. Identify user if logged in
    const user = await getAuthenticatedUser(authHeader);
    let customerId = undefined;
    const discounts = [];
    if (user) {
        const profile = await getUserProfile(user.id);
        customerId = profile?.stripe_customer_id;
        if (customerId) {
            try {
                const cust = await stripe.customers.retrieve(customerId);
                if (cust.deleted) {
                    console.warn(`[stripe] Customer ${customerId} was deleted in Stripe. Clearing...`);
                    customerId = undefined;
                }
            }
            catch (err) {
                if (err.code === 'resource_missing') {
                    console.warn(`[stripe] Customer ${customerId} no longer exists in Stripe. Clearing...`);
                    customerId = undefined;
                }
                else {
                    throw err;
                }
            }
        }
        if (!customerId) {
            console.log(`[stripe] Creating new Stripe customer for user=${user.id}, email=${user.email}`);
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    supabase_user_id: user.id,
                },
            });
            customerId = customer.id;
            // Save customerId to Supabase if possible
            try {
                const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    auth: { persistSession: false },
                });
                await supabase
                    .from('profiles')
                    .update({ stripe_customer_id: customerId })
                    .eq('id', user.id);
            }
            catch (dbErr) {
                console.warn('[stripe] Could not save stripe_customer_id to Supabase:', dbErr);
            }
        }
    }
    // 3. Create Stripe Checkout Session (Always enable promotional codes for manual discounts)
    const cleanBaseUrl = (successUrl || baseUrl).replace(/\/+$/, '');
    const finalSuccessUrl = `${cleanBaseUrl}/?checkout_success=true&session_id={CHECKOUT_SESSION_ID}&tier=${targetTier}`;
    const finalCancelUrl = `${(cancelUrl || baseUrl).replace(/\/+$/, '')}/?checkout_canceled=true`;
    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user?.email,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        allow_promotion_codes: true,
        success_url: finalSuccessUrl,
        cancel_url: finalCancelUrl,
        metadata: {
            supabase_user_id: user?.id || '',
            target_tier: targetTier,
            referral_code: referralCode || '',
        },
        subscription_data: {
            metadata: {
                supabase_user_id: user?.id || '',
                target_tier: targetTier,
            },
        },
    });
    return {
        mock: false,
        sessionId: session.id,
        url: session.url,
        targetTier,
    };
}
/**
 * Creates a Stripe Checkout Session for purchasing a one-time Top-Up Pack (+10 Sessions, +100 Clips)
 */
export async function createTopupCheckoutSession(params) {
    const { successUrl, cancelUrl, baseUrl = 'http://localhost:8181', authHeader, devOverride } = params;
    const stripe = getStripe();
    const isMockOverride = Boolean(devOverride && (devOverride.includes('"gemini_mock_mode":true') || devOverride.includes('"mockMode":true')));
    if (!stripe || isMockOverride) {
        console.log('[stripe] Mock / Sandbox Mode active. Simulating one-time Top-Up purchase (+10 sessions, +100 clips).');
        const redirectUrl = `${successUrl || baseUrl}/?topup_success=true&mock=true`;
        return {
            mock: true,
            url: redirectUrl,
            message: 'Simulated top-up purchase (Stripe Mock Mode active).'
        };
    }
    const priceId = process.env.STRIPE_TOPUP_PRICE_ID;
    if (!priceId) {
        console.error('[stripe] Missing STRIPE_TOPUP_PRICE_ID in environment.');
        throw {
            statusCode: 500,
            error: 'Stripe price ID for Top-Up pack is not configured. Please set STRIPE_TOPUP_PRICE_ID in .env.'
        };
    }
    const user = await getAuthenticatedUser(authHeader);
    if (!user) {
        throw {
            statusCode: 401,
            error: 'Authentication required to purchase top-up pack.'
        };
    }
    const profile = await getUserProfile(user.id);
    let customerId = profile?.stripe_customer_id;
    if (customerId) {
        try {
            const cust = await stripe.customers.retrieve(customerId);
            if (cust.deleted) {
                console.warn(`[stripe] Customer ${customerId} was deleted in Stripe. Clearing for topup...`);
                customerId = undefined;
            }
        }
        catch (err) {
            if (err.code === 'resource_missing') {
                console.warn(`[stripe] Customer ${customerId} no longer exists in Stripe. Clearing for topup...`);
                customerId = undefined;
            }
            else {
                throw err;
            }
        }
    }
    if (!customerId) {
        console.log(`[stripe] Creating new Stripe customer for top-up user=${user.id}, email=${user.email}`);
        const customer = await stripe.customers.create({
            email: user.email,
            metadata: { supabase_user_id: user.id },
        });
        customerId = customer.id;
        try {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
            await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
        }
        catch (err) {
            console.warn('[stripe] Could not save customer_id for topup:', err);
        }
    }
    const cleanBaseUrl = (successUrl || baseUrl).replace(/\/+$/, '');
    const finalSuccessUrl = `${cleanBaseUrl}/?topup_success=true&session_id={CHECKOUT_SESSION_ID}`;
    const finalCancelUrl = `${(cancelUrl || baseUrl).replace(/\/+$/, '')}/?topup_canceled=true`;
    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        allow_promotion_codes: true,
        success_url: finalSuccessUrl,
        cancel_url: finalCancelUrl,
        metadata: {
            supabase_user_id: user.id,
            purchase_type: 'topup_pack',
        },
    });
    return {
        mock: false,
        sessionId: session.id,
        url: session.url,
    };
}
/**
 * Creates a Stripe Billing Portal Session for managing subscriptions
 */
export async function createPortalSession(params) {
    const { authHeader, baseUrl = 'http://localhost:8181', returnUrl } = params;
    const stripe = getStripe();
    if (!stripe) {
        return {
            mock: true,
            url: `${returnUrl || baseUrl}/?portal_simulated=true`,
            message: 'Stripe Billing Portal is simulated in mock mode.'
        };
    }
    let customerId = null;
    // 1. Try to find customer from authenticated user
    const user = await getAuthenticatedUser(authHeader);
    if (user) {
        const profile = await getUserProfile(user.id);
        customerId = profile?.stripe_customer_id;
        if (!customerId && user.email) {
            try {
                const matchingCustomers = await stripe.customers.list({ email: user.email, limit: 1 });
                if (matchingCustomers.data.length > 0) {
                    customerId = matchingCustomers.data[0].id;
                }
            }
            catch (err) {
                console.warn('[stripe] Could not search customer by email:', err);
            }
        }
    }
    // 2. In Sandbox / Local Dev mode: fallback to the most recent customer in the Stripe account
    if (!customerId) {
        try {
            const recentCustomers = await stripe.customers.list({ limit: 1 });
            if (recentCustomers.data.length > 0) {
                customerId = recentCustomers.data[0].id;
                console.log(`[stripe] Using recent Stripe test customer (${customerId}) for Billing Portal session.`);
            }
        }
        catch (listErr) {
            console.warn('[stripe] Could not list recent customers:', listErr);
        }
    }
    if (!customerId) {
        return {
            mock: true,
            url: `${returnUrl || baseUrl}/?portal_simulated=true`,
            message: 'No Stripe customer ID found in this account.'
        };
    }
    try {
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl || baseUrl,
        });
        return {
            mock: false,
            url: portalSession.url,
        };
    }
    catch (portalErr) {
        console.error('[stripe] Stripe Billing Portal creation error:', portalErr?.message || portalErr);
        return {
            mock: true,
            url: `${returnUrl || baseUrl}/?portal_simulated=true`,
            message: portalErr?.message || 'Failed to create Stripe portal session.'
        };
    }
}
/**
 * Handles incoming Stripe Webhook events and synchronizes subscription state with Supabase
 */
export async function handleStripeWebhook(req, res) {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !webhookSecret) {
        console.warn('[stripe-webhook] Missing Stripe client or STRIPE_WEBHOOK_SECRET. Cannot verify webhook.');
        return res.status(400).send('Webhook secret not configured.');
    }
    const sig = req.headers['stripe-signature'];
    if (!sig) {
        console.warn('[stripe-webhook] Missing stripe-signature header.');
        return res.status(400).send('Missing signature');
    }
    let event;
    try {
        const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(req.body);
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    }
    catch (err) {
        console.error(`[stripe-webhook] Webhook signature verification failed:`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    console.log(`[stripe-webhook] Received verified event: ${event.type} (id: ${event.id})`);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false },
    });
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const customerId = session.customer;
                const subscriptionId = session.subscription;
                const userId = session.metadata?.supabase_user_id || session.client_reference_id;
                const purchaseType = session.metadata?.purchase_type;
                // Check if this is a one-time Top-Up Pack purchase (+10 sessions, +100 clips)
                if (session.mode === 'payment' || purchaseType === 'topup_pack') {
                    console.log(`[stripe-webhook] checkout.session.completed for one-time TOPUP pack for user=${userId}`);
                    if (userId) {
                        const { data: userProf } = await supabase
                            .from('profiles')
                            .select('topup_extra_sessions, topup_extra_clips')
                            .eq('id', userId)
                            .maybeSingle();
                        const nextSessions = (userProf?.topup_extra_sessions || 0) + 10;
                        const nextClips = (userProf?.topup_extra_clips || 0) + 100;
                        await supabase
                            .from('profiles')
                            .update({
                            topup_extra_sessions: nextSessions,
                            topup_extra_clips: nextClips,
                            updated_at: new Date().toISOString(),
                        })
                            .eq('id', userId);
                        console.log(`[stripe-webhook] Credited +10 sessions (+100 clips) top-up to user=${userId}. New balance: sessions=${nextSessions}, clips=${nextClips}`);
                    }
                    break;
                }
                const targetTier = session.metadata?.target_tier || 'student';
                const referralCode = session.metadata?.referral_code;
                let resolvedUserId = userId;
                if (!resolvedUserId && customerId) {
                    const { data: prof } = await supabase.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle();
                    if (prof?.id)
                        resolvedUserId = prof.id;
                }
                console.log(`[stripe-webhook] checkout.session.completed for user=${resolvedUserId}, customer=${customerId}, tier=${targetTier}`);
                const subObj = typeof session.subscription === 'object' && session.subscription !== null ? session.subscription : null;
                const subId = typeof session.subscription === 'string' ? session.subscription : subObj?.id;
                let currentPeriodEnd = null;
                if (subObj) {
                    const epoch = getPeriodEnd(subObj);
                    if (epoch)
                        currentPeriodEnd = new Date(epoch * 1000).toISOString();
                }
                else if (subId) {
                    try {
                        const stripe = getStripe();
                        if (stripe) {
                            const sub = await stripe.subscriptions.retrieve(subId);
                            const epoch = getPeriodEnd(sub);
                            if (epoch)
                                currentPeriodEnd = new Date(epoch * 1000).toISOString();
                        }
                    }
                    catch (err) {
                        console.warn('[stripe-webhook] Could not fetch subscription for current_period_end:', err);
                    }
                }
                console.log(`[stripe-webhook] checkout.session.completed subId=${subId}, current_period_end=${currentPeriodEnd}`);
                if (resolvedUserId) {
                    // 1. Update user profile
                    const { error: profileErr } = await supabase
                        .from('profiles')
                        .update({
                        tier: targetTier,
                        subscription_status: 'active',
                        stripe_customer_id: customerId,
                        stripe_subscription_id: subId,
                        cancel_at_period_end: false,
                        pending_downgrade: null,
                        current_period_end: currentPeriodEnd,
                        updated_at: new Date().toISOString(),
                    })
                        .eq('id', resolvedUserId);
                    if (profileErr) {
                        console.error('[stripe-webhook] Error updating profile on checkout:', profileErr);
                    }
                    // 2. Reset period counters
                    try {
                        await supabase
                            .from('usage_tracking')
                            .upsert({
                            user_id: userId,
                            period_sessions: 0,
                            period_clips: 0,
                            period_start: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'user_id' });
                    }
                    catch (usageErr) {
                        console.warn('[stripe-webhook] Could not reset usage_tracking:', usageErr);
                    }
                    // 3. Mark referral log as 'pending_refund_period' with paid_at timestamp
                    // RULE: Reward is NOT credited immediately. It matures after the 14-day refund window.
                    try {
                        const nowIso = new Date().toISOString();
                        const { data: existingLog } = await supabase
                            .from('referral_logs')
                            .select('id, status')
                            .eq('referred_user_id', userId)
                            .eq('status', 'pending')
                            .maybeSingle();
                        if (existingLog) {
                            await supabase
                                .from('referral_logs')
                                .update({
                                status: 'pending_refund_period',
                                paid_at: nowIso,
                                stripe_invoice_id: session.invoice || session.id,
                            })
                                .eq('id', existingLog.id);
                            console.log(`[stripe-webhook] Updated referral log ${existingLog.id} to pending_refund_period (14-day timer started).`);
                        }
                        else if (referralCode) {
                            // Direct checkout with code but without prior redeem log
                            const { data: referrer } = await supabase
                                .from('profiles')
                                .select('id, tier')
                                .ilike('referral_code', referralCode)
                                .maybeSingle();
                            if (referrer && referrer.id !== userId) {
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
                                    status: 'pending_refund_period',
                                    paid_at: nowIso,
                                    stripe_invoice_id: session.invoice || session.id,
                                    created_at: nowIso,
                                });
                                await supabase
                                    .from('profiles')
                                    .update({ referred_by: referrer.id })
                                    .eq('id', userId);
                                console.log(`[stripe-webhook] Created new pending_refund_period referral log for referrer=${referrer.id}`);
                            }
                        }
                    }
                    catch (refErr) {
                        console.warn('[stripe-webhook] Failed to update referral log on checkout:', refErr);
                    }
                }
                else if (customerId) {
                    // Fallback: match by stripe_customer_id
                    await supabase
                        .from('profiles')
                        .update({
                        tier: targetTier,
                        subscription_status: 'active',
                        stripe_subscription_id: subscriptionId,
                        cancel_at_period_end: false,
                        updated_at: new Date().toISOString(),
                    })
                        .eq('stripe_customer_id', customerId);
                }
                break;
            }
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                const customerId = subscription.customer;
                const status = subscription.status;
                const cancelAtPeriodEnd = subscription.cancel_at_period_end;
                const priceId = subscription.items?.data?.[0]?.price?.id;
                const teacherPriceId = process.env.STRIPE_TEACHER_PRICE_ID;
                const studentPriceId = process.env.STRIPE_STUDENT_PRICE_ID;
                let tier = 'student';
                if (priceId === teacherPriceId) {
                    tier = 'teacher';
                }
                else if (priceId === studentPriceId) {
                    tier = 'student';
                }
                else if (subscription.metadata?.target_tier === 'teacher') {
                    tier = 'teacher';
                }
                else if (subscription.metadata?.target_tier === 'student') {
                    tier = 'student';
                }
                else if (status !== 'active' && status !== 'trialing') {
                    tier = 'free';
                }
                let pendingDowngrade = subscription.metadata?.pending_downgrade || null;
                if (pendingDowngrade === tier) {
                    pendingDowngrade = null;
                    // Clean up stale metadata in Stripe
                    stripe.subscriptions.update(subscription.id, { metadata: { pending_downgrade: null } }).catch(console.error);
                }
                const epoch = getPeriodEnd(subscription);
                const currentPeriodEnd = epoch ? new Date(epoch * 1000).toISOString() : null;
                const metaUserId = subscription.metadata?.supabase_user_id;
                console.log(`[stripe-webhook] customer.subscription.updated customer=${customerId}, user=${metaUserId}, status=${status}, tier=${tier}, currentPeriodEnd=${currentPeriodEnd}`);
                const updatePayload = {
                    tier,
                    subscription_status: status,
                    cancel_at_period_end: cancelAtPeriodEnd,
                    current_period_end: currentPeriodEnd,
                    stripe_customer_id: customerId,
                    stripe_subscription_id: subscription.id,
                    pending_downgrade: pendingDowngrade,
                    updated_at: new Date().toISOString(),
                };
                let updated = false;
                if (metaUserId) {
                    const { error: metaErr } = await supabase
                        .from('profiles')
                        .update(updatePayload)
                        .eq('id', metaUserId);
                    if (!metaErr)
                        updated = true;
                }
                if (!updated) {
                    await supabase
                        .from('profiles')
                        .update(updatePayload)
                        .eq('stripe_customer_id', customerId);
                }
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const customerId = subscription.customer;
                console.log(`[stripe-webhook] customer.subscription.deleted for customer=${customerId}. Reverting to free tier & clearing remaining credits.`);
                const { data: canceledProfile } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('stripe_customer_id', customerId)
                    .maybeSingle();
                // RULE: If user unsubscribes -> remaining accumulated credits are lost
                await supabase
                    .from('profiles')
                    .update({
                    tier: 'free',
                    subscription_status: 'canceled',
                    cancel_at_period_end: false,
                    referral_credits_balance: 0,
                    updated_at: new Date().toISOString(),
                })
                    .eq('stripe_customer_id', customerId);
                // If this user was referred and was still in pending_refund_period, revoke the referral log
                if (canceledProfile?.id) {
                    await supabase
                        .from('referral_logs')
                        .update({
                        status: 'revoked',
                        revoked_at: new Date().toISOString(),
                    })
                        .eq('referred_user_id', canceledProfile.id)
                        .eq('status', 'pending_refund_period');
                }
                break;
            }
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object;
                const customerId = invoice.customer;
                const billingReason = invoice.billing_reason;
                console.log(`[stripe-webhook] invoice.payment_succeeded for customer=${customerId}, reason=${billingReason}`);
                // If it's a recurring monthly renewal, reset monthly quotas
                if (billingReason === 'subscription_cycle') {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('stripe_customer_id', customerId)
                        .maybeSingle();
                    if (profile?.id) {
                        await supabase
                            .from('usage_tracking')
                            .update({
                            period_sessions: 0,
                            period_clips: 0,
                            period_start: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                            .eq('user_id', profile.id);
                        console.log(`[stripe-webhook] Monthly quota reset for user=${profile.id}`);
                    }
                }
                break;
            }
            case 'invoice.created': {
                const invoice = event.data.object;
                const customerId = invoice.customer;
                console.log(`[stripe-webhook] invoice.created for customer=${customerId}, invoiceId=${invoice.id}, status=${invoice.status}`);
                // Apply tiered discount deductions on subscription draft invoices
                // RULES:
                // - Student: €1 discount max per monthly invoice
                // - Teacher: Up to €8 discount max per monthly invoice
                // - Remaining credits stay in balance for upcoming months
                if (customerId && (invoice.status === 'draft' || invoice.paid === false)) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id, referral_credits_balance, tier')
                        .eq('stripe_customer_id', customerId)
                        .maybeSingle();
                    if (profile && (profile.referral_credits_balance || 0) > 0) {
                        const maxUnitsPerInvoice = profile.tier === 'teacher' ? 8 : 1;
                        const unitsToUse = Math.min(profile.referral_credits_balance, maxUnitsPerInvoice);
                        const discountCents = unitsToUse * 100;
                        if (discountCents > 0) {
                            try {
                                await stripe.invoiceItems.create({
                                    customer: customerId,
                                    invoice: invoice.id,
                                    amount: -discountCents,
                                    currency: invoice.currency || 'eur',
                                    description: `Zoutty Referral Discount (€${unitsToUse}.00 off)`,
                                });
                                const remainingCredits = profile.referral_credits_balance - unitsToUse;
                                await supabase
                                    .from('profiles')
                                    .update({
                                    referral_credits_balance: remainingCredits,
                                    updated_at: new Date().toISOString(),
                                })
                                    .eq('id', profile.id);
                                console.log(`[stripe-webhook] Applied -€${unitsToUse}.00 discount to invoice=${invoice.id}. Remaining banked credits=${remainingCredits}`);
                            }
                            catch (discountErr) {
                                console.error('[stripe-webhook] Error creating invoice discount item:', discountErr);
                            }
                        }
                    }
                }
                break;
            }
            case 'charge.refunded': {
                const charge = event.data.object;
                const customerId = charge.customer;
                console.log(`[stripe-webhook] charge.refunded for customer=${customerId}`);
                if (customerId) {
                    const { data: refundedProfile } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('stripe_customer_id', customerId)
                        .maybeSingle();
                    if (refundedProfile?.id) {
                        // RULE: If subscription is refunded, referral reward is revoked
                        const { data: logsToRevoke } = await supabase
                            .from('referral_logs')
                            .select('id, referrer_id, reward_type, reward_value, status')
                            .eq('referred_user_id', refundedProfile.id)
                            .in('status', ['pending_refund_period', 'active']);
                        if (logsToRevoke && logsToRevoke.length > 0) {
                            for (const l of logsToRevoke) {
                                if (l.status === 'active' && l.referrer_id) {
                                    const { data: refProfile } = await supabase
                                        .from('profiles')
                                        .select('id, referral_credits_balance, tier')
                                        .eq('id', l.referrer_id)
                                        .maybeSingle();
                                    if (refProfile && (l.reward_type === 'student_credit' || l.reward_type === 'teacher_credit')) {
                                        const newBal = Math.max(0, (refProfile.referral_credits_balance || 0) - Number(l.reward_value));
                                        await supabase
                                            .from('profiles')
                                            .update({ referral_credits_balance: newBal })
                                            .eq('id', l.referrer_id);
                                    }
                                }
                                await supabase
                                    .from('referral_logs')
                                    .update({
                                    status: 'revoked',
                                    revoked_at: new Date().toISOString(),
                                })
                                    .eq('id', l.id);
                            }
                            console.log(`[stripe-webhook] Revoked referral logs for refunded customer=${customerId}`);
                        }
                    }
                }
                break;
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                const customerId = invoice.customer;
                console.log(`[stripe-webhook] invoice.payment_failed for customer=${customerId}`);
                await supabase
                    .from('profiles')
                    .update({
                    subscription_status: 'past_due',
                    updated_at: new Date().toISOString(),
                })
                    .eq('stripe_customer_id', customerId);
                break;
            }
            default:
                console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
        }
        return res.json({ received: true });
    }
    catch (handlerErr) {
        console.error('[stripe-webhook] Error processing event:', handlerErr);
        return res.status(500).json({ error: 'Webhook processing error', details: handlerErr.message });
    }
}
/**
 * Directly confirms a checkout session and updates Supabase profiles and referral logs.
 * Used when the client returns from Stripe Checkout to ensure instant local and cloud state synchronization.
 */
export async function confirmCheckoutSession({ sessionId, targetTier, authHeader, }) {
    const user = await getAuthenticatedUser(authHeader);
    if (!user) {
        return { success: false, error: 'User not authenticated' };
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false },
    });
    const tier = targetTier || 'student';
    const nowIso = new Date().toISOString();
    const stripe = getStripe();
    let currentPeriodEnd = null;
    let customerId = undefined;
    let subscriptionId = undefined;
    if (sessionId && stripe) {
        try {
            const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
                expand: ['subscription'],
            });
            if (checkoutSession.customer) {
                customerId = typeof checkoutSession.customer === 'string' ? checkoutSession.customer : checkoutSession.customer.id;
            }
            const sub = checkoutSession.subscription;
            if (sub) {
                subscriptionId = typeof sub === 'string' ? sub : sub.id;
                const periodEndEpoch = getPeriodEnd(sub);
                if (periodEndEpoch) {
                    currentPeriodEnd = new Date(periodEndEpoch * 1000).toISOString();
                }
                else if (subscriptionId) {
                    const fetchedSub = await stripe.subscriptions.retrieve(subscriptionId);
                    const fetchedEpoch = getPeriodEnd(fetchedSub);
                    if (fetchedEpoch) {
                        currentPeriodEnd = new Date(fetchedEpoch * 1000).toISOString();
                    }
                }
            }
            console.log(`[stripe] confirmCheckoutSession retrieved: customerId=${customerId}, subscriptionId=${subscriptionId}, currentPeriodEnd=${currentPeriodEnd}`);
        }
        catch (sessionErr) {
            console.warn('[stripe] Could not retrieve checkout session details on confirm:', sessionErr);
        }
    }
    else {
        // If no sessionId is provided, this is a simulated/mock checkout.
        // We should set a mock current_period_end (30 days from now) so the DB updates.
        currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    // 1. Update user profile to active subscription
    const profileUpdate = {
        tier,
        subscription_status: 'active',
        updated_at: nowIso,
    };
    if (currentPeriodEnd)
        profileUpdate.current_period_end = currentPeriodEnd;
    if (customerId)
        profileUpdate.stripe_customer_id = customerId;
    if (subscriptionId)
        profileUpdate.stripe_subscription_id = subscriptionId;
    console.log(`[stripe] confirmCheckoutSession about to update DB for user=${user.id} with payload:`, profileUpdate);
    const { error: dbErr } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id);
    if (dbErr) {
        console.error(`[stripe] confirmCheckoutSession DB Update Failed:`, dbErr);
    }
    else {
        console.log(`[stripe] confirmCheckoutSession DB Update Succeeded for user=${user.id}`);
    }
    // 2. Reset period counters in usage_tracking
    try {
        await supabase
            .from('usage_tracking')
            .upsert({
            user_id: user.id,
            period_sessions: 0,
            period_clips: 0,
            period_start: nowIso,
            updated_at: nowIso,
        }, { onConflict: 'user_id' });
    }
    catch (err) {
        console.warn('[stripe] Could not reset period usage:', err);
    }
    // 3. Mark referral log for this user as 'pending_refund_period' with paid_at timestamp
    try {
        const { data: existingLog } = await supabase
            .from('referral_logs')
            .select('id, referrer_id, status')
            .eq('referred_user_id', user.id)
            .eq('status', 'pending')
            .maybeSingle();
        if (existingLog) {
            await supabase
                .from('referral_logs')
                .update({
                status: 'pending_refund_period',
                paid_at: nowIso,
                stripe_invoice_id: sessionId || null,
            })
                .eq('id', existingLog.id);
            console.log(`[stripe] Confirmed checkout: referral log ${existingLog.id} updated to pending_refund_period for user=${user.id}`);
        }
        else {
            const { data: profile } = await supabase
                .from('profiles')
                .select('referred_by')
                .eq('id', user.id)
                .maybeSingle();
            if (profile?.referred_by) {
                const { data: referrer } = await supabase
                    .from('profiles')
                    .select('id, tier')
                    .eq('id', profile.referred_by)
                    .maybeSingle();
                if (referrer) {
                    const rewardType = referrer.tier === 'teacher'
                        ? 'teacher_credit'
                        : referrer.tier === 'student'
                            ? 'student_credit'
                            : 'free_boost';
                    await supabase.from('referral_logs').insert({
                        referrer_id: referrer.id,
                        referred_user_id: user.id,
                        reward_type: rewardType,
                        reward_value: 0,
                        status: 'pending_refund_period',
                        paid_at: nowIso,
                        stripe_invoice_id: sessionId || null,
                        created_at: nowIso,
                    });
                    console.log(`[stripe] Created pending_refund_period log for referrer=${referrer.id}`);
                }
            }
        }
    }
    catch (refErr) {
        console.warn('[stripe] Could not transition referral log on confirmCheckoutSession:', refErr);
    }
    return { success: true, tier };
}
export async function updateSubscription(targetTier, authHeader) {
    const stripe = getStripe();
    if (!stripe) {
        const user = await getAuthenticatedUser(authHeader);
        if (user) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
            const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            const payload = {
                tier: targetTier,
                subscription_status: 'active',
                current_period_end: currentPeriodEnd
            };
            console.log(`[stripe] updateSubscription (mock) about to update DB for user=${user.id} with payload:`, payload);
            const { error: dbErr } = await supabase.from('profiles').update(payload).eq('id', user.id);
            if (dbErr)
                console.error(`[stripe] updateSubscription (mock) DB Update Failed:`, dbErr);
            else
                console.log(`[stripe] updateSubscription (mock) DB Update Succeeded`);
        }
        return { mock: true, message: 'Simulated subscription update.' };
    }
    const user = await getAuthenticatedUser(authHeader);
    if (!user)
        throw { statusCode: 401, error: 'Authentication required' };
    const profile = await getUserProfile(user.id);
    if (!profile?.stripe_customer_id) {
        throw { statusCode: 400, error: 'No Stripe customer found.' };
    }
    if (targetTier === 'free') {
        return cancelSubscription(authHeader);
    }
    const priceId = targetTier === 'teacher' ? process.env.STRIPE_TEACHER_PRICE_ID : process.env.STRIPE_STUDENT_PRICE_ID;
    if (!priceId)
        throw { statusCode: 500, error: "Missing STRIPE_TEACHER_PRICE_ID or STRIPE_STUDENT_PRICE_ID" };
    const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'active',
        limit: 1,
    });
    if (subscriptions.data.length === 0) {
        throw { statusCode: 400, error: 'No active subscription to update.' };
    }
    const subscription = subscriptions.data[0];
    const itemId = subscription.items.data[0].id;
    const currentPriceId = subscription.items.data[0].price.id;
    // Determine if it's an upgrade or downgrade
    const isDowngrade = (targetTier === 'student' && currentPriceId === process.env.STRIPE_TEACHER_PRICE_ID);
    if (isDowngrade) {
        console.log(`[stripe] Scheduling downgrade to student at period end for sub=${subscription.id}`);
        let scheduleId = subscription.schedule;
        if (!scheduleId) {
            const schedule = await stripe.subscriptionSchedules.create({
                from_subscription: subscription.id,
            });
            scheduleId = schedule.id;
        }
        const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
        const currentPhase = schedule.phases[0];
        await stripe.subscriptionSchedules.update(scheduleId, {
            end_behavior: 'release',
            phases: [
                {
                    start_date: currentPhase.start_date,
                    end_date: currentPhase.end_date,
                    items: [{ price: currentPriceId, quantity: 1 }],
                },
                {
                    start_date: currentPhase.end_date,
                    items: [{ price: priceId, quantity: 1 }],
                }
            ],
        });
        // Also update metadata on the subscription so we know a downgrade is pending
        await stripe.subscriptions.update(subscription.id, {
            metadata: { pending_downgrade: targetTier }
        });
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
        await supabase.from('profiles').update({
            pending_downgrade: targetTier,
            updated_at: new Date().toISOString()
        }).eq('id', user.id);
        return { success: true, message: 'Downgrade scheduled for end of billing period.' };
    }
    else {
        console.log(`[stripe] Upgrading subscription ${subscription.id} to ${targetTier} directly via API.`);
        const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
            items: [{
                    id: itemId,
                    price: priceId,
                }],
            proration_behavior: 'always_invoice',
        });
        // Synchronously update the Supabase profile so the UI doesn't revert before the webhook arrives
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
        await supabase.from('profiles').update({
            tier: targetTier,
            subscription_status: 'active',
            pending_downgrade: null,
            updated_at: new Date().toISOString()
        }).eq('id', user.id);
        return { success: true, message: `Successfully upgraded to ${targetTier}.`, subscription: updatedSubscription };
    }
}
export async function cancelSubscription(authHeader) {
    const stripe = getStripe();
    if (!stripe) {
        const user = await getAuthenticatedUser(authHeader);
        if (user) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
            await supabase.from('profiles').update({
                tier: 'free',
                subscription_status: 'canceled',
                cancel_at_period_end: false,
                current_period_end: null
            }).eq('id', user.id);
        }
        return { mock: true, message: 'Simulated subscription cancellation.' };
    }
    const user = await getAuthenticatedUser(authHeader);
    if (!user)
        throw { statusCode: 401, error: 'Authentication required' };
    const profile = await getUserProfile(user.id);
    if (!profile?.stripe_customer_id) {
        throw { statusCode: 400, error: 'No Stripe customer found.' };
    }
    const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'active',
        limit: 1,
    });
    if (subscriptions.data.length === 0) {
        throw { statusCode: 400, error: 'No active subscription to cancel.' };
    }
    const subscription = subscriptions.data[0];
    // If there's a schedule (e.g., a pending downgrade), we MUST release it first.
    // Otherwise, Stripe blocks the cancellation request.
    if (subscription.schedule) {
        console.log(`[stripe] Releasing schedule ${subscription.schedule} before canceling subscription ${subscription.id}`);
        await stripe.subscriptionSchedules.release(subscription.schedule);
    }
    const canceledSubscription = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
    });
    const epoch = getPeriodEnd(canceledSubscription);
    const currentPeriodEnd = epoch ? new Date(epoch * 1000).toISOString() : null;
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
        await supabase.from('profiles').update({
            cancel_at_period_end: true,
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
        }).eq('id', user.id);
        console.log(`[stripe] Updated profile user=${user.id} cancel_at_period_end=true, currentPeriodEnd=${currentPeriodEnd}`);
    }
    catch (e) {
        console.warn('[stripe] Could not update profile after cancellation:', e);
    }
    return { success: true, subscription: canceledSubscription };
}
export async function getSubscriptionStatus(authHeader) {
    const stripe = getStripe();
    if (!stripe) {
        return { mock: true, pending_downgrade: null };
    }
    const user = await getAuthenticatedUser(authHeader);
    if (!user)
        throw { statusCode: 401, error: 'Authentication required' };
    const profile = await getUserProfile(user.id);
    if (!profile?.stripe_customer_id) {
        return { pending_downgrade: null };
    }
    const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'active',
        limit: 1,
    });
    if (subscriptions.data.length === 0) {
        return { pending_downgrade: null };
    }
    const subscription = subscriptions.data[0];
    return {
        pending_downgrade: subscription.metadata?.pending_downgrade || null,
    };
}
export async function reactivateSubscription(authHeader) {
    const stripe = getStripe();
    if (!stripe) {
        return { mock: true, message: 'Simulated subscription reactivation.' };
    }
    const user = await getAuthenticatedUser(authHeader);
    if (!user)
        throw { statusCode: 401, error: 'Authentication required' };
    const profile = await getUserProfile(user.id);
    if (!profile?.stripe_customer_id) {
        throw { statusCode: 400, error: 'No Stripe customer found.' };
    }
    const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'active',
        limit: 1,
    });
    if (subscriptions.data.length === 0) {
        throw { statusCode: 400, error: 'No active subscription to reactivate.' };
    }
    const subscription = subscriptions.data[0];
    const reactivatedSubscription = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: false,
    });
    return { success: true, subscription: reactivatedSubscription };
}
