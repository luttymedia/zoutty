import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

/**
 * Returns an initialized Stripe instance using current environment secret key
 */
export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  if (!secretKey || secretKey.startsWith('mock_')) {
    return null;
  }
  return new Stripe(secretKey);
}

/**
 * Helper to get authenticated user from Supabase JWT
 */
export async function getAuthenticatedUser(authHeader?: string) {
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
    if (error || !user) return null;
    return user;
  } catch (err) {
    console.error('[stripe] Auth verification error:', err);
    return null;
  }
}

/**
 * Helper to fetch user profile from Supabase
 */
async function getUserProfile(userId: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
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
  } catch (err) {
    console.error('[stripe] Error fetching profile:', err);
    return null;
  }
}

export interface CreateCheckoutParams {
  targetTier: 'student' | 'teacher';
  referralCode?: string;
  successUrl?: string;
  cancelUrl?: string;
  baseUrl?: string;
  authHeader?: string;
  devOverride?: string;
}

/**
 * Creates a Stripe Checkout Session for subscription
 */
export async function createCheckoutSession(params: CreateCheckoutParams) {
  const { targetTier, referralCode, successUrl, cancelUrl, baseUrl = 'http://localhost:8181', authHeader, devOverride } = params;

  const stripe = getStripe();
  const isMockOverride = Boolean(
    devOverride && (devOverride.includes('"gemini_mock_mode":true') || devOverride.includes('"mockMode":true'))
  );

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
  let customerId: string | undefined = undefined;
  const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];

  if (user) {
    const profile = await getUserProfile(user.id);
    customerId = profile?.stripe_customer_id;

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
      } catch (dbErr) {
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

export interface CreateTopupParams {
  successUrl?: string;
  cancelUrl?: string;
  baseUrl?: string;
  authHeader?: string;
  devOverride?: string;
}

/**
 * Creates a Stripe Checkout Session for purchasing a one-time Top-Up Pack (+10 Sessions, +100 Clips)
 */
export async function createTopupCheckoutSession(params: CreateTopupParams) {
  const { successUrl, cancelUrl, baseUrl = 'http://localhost:8181', authHeader, devOverride } = params;
  const stripe = getStripe();
  const isMockOverride = Boolean(
    devOverride && (devOverride.includes('"gemini_mock_mode":true') || devOverride.includes('"mockMode":true'))
  );

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
    } catch (err) {
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

export interface CreatePortalParams {
  authHeader?: string;
  baseUrl?: string;
  returnUrl?: string;
}

/**
 * Creates a Stripe Billing Portal Session for managing subscriptions
 */
export async function createPortalSession(params: CreatePortalParams) {
  const { authHeader, baseUrl = 'http://localhost:8181', returnUrl } = params;
  const stripe = getStripe();

  if (!stripe) {
    return {
      mock: true,
      url: `${returnUrl || baseUrl}/?portal_simulated=true`,
      message: 'Stripe Billing Portal is simulated in mock mode.'
    };
  }

  let customerId: string | null | undefined = null;

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
      } catch (err) {
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
    } catch (listErr) {
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
  } catch (portalErr: any) {
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
export async function handleStripeWebhook(req: any, res: any) {
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

  let event: Stripe.Event;

  try {
    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(req.body);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
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
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
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

        const targetTier = (session.metadata?.target_tier as 'student' | 'teacher') || 'student';
        const referralCode = session.metadata?.referral_code;

        console.log(`[stripe-webhook] checkout.session.completed for user=${userId}, customer=${customerId}, tier=${targetTier}`);

        if (userId) {
          // 1. Update user profile
          const { error: profileErr } = await supabase
            .from('profiles')
            .update({
              tier: targetTier,
              subscription_status: 'active',
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              cancel_at_period_end: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

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
          } catch (usageErr) {
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
                  stripe_invoice_id: (session.invoice as string) || session.id,
                })
                .eq('id', existingLog.id);

              console.log(`[stripe-webhook] Updated referral log ${existingLog.id} to pending_refund_period (14-day timer started).`);
            } else if (referralCode) {
              // Direct checkout with code but without prior redeem log
              const { data: referrer } = await supabase
                .from('profiles')
                .select('id, tier')
                .ilike('referral_code', referralCode)
                .maybeSingle();

              if (referrer && referrer.id !== userId) {
                const rewardType =
                  referrer.tier === 'teacher'
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
                  stripe_invoice_id: (session.invoice as string) || session.id,
                  created_at: nowIso,
                });

                await supabase
                  .from('profiles')
                  .update({ referred_by: referrer.id })
                  .eq('id', userId);

                console.log(`[stripe-webhook] Created new pending_refund_period referral log for referrer=${referrer.id}`);
              }
            }
          } catch (refErr) {
            console.warn('[stripe-webhook] Failed to update referral log on checkout:', refErr);
          }
        } else if (customerId) {
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
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status;
        const cancelAtPeriodEnd = subscription.cancel_at_period_end;
        const priceId = subscription.items?.data?.[0]?.price?.id;

        const teacherPriceId = process.env.STRIPE_TEACHER_PRICE_ID;
        const studentPriceId = process.env.STRIPE_STUDENT_PRICE_ID;

        let tier: 'free' | 'student' | 'teacher' = 'student';
        if (priceId === teacherPriceId || subscription.metadata?.target_tier === 'teacher') {
          tier = 'teacher';
        } else if (priceId === studentPriceId || subscription.metadata?.target_tier === 'student') {
          tier = 'student';
        } else if (status !== 'active' && status !== 'trialing') {
          tier = 'free';
        }

        console.log(`[stripe-webhook] customer.subscription.updated for customer=${customerId}, status=${status}, tier=${tier}`);

        const currentPeriodEnd = (subscription as any).current_period_end 
          ? new Date((subscription as any).current_period_end * 1000).toISOString()
          : null;

        await supabase
          .from('profiles')
          .update({
            tier,
            subscription_status: status as any,
            cancel_at_period_end: cancelAtPeriodEnd,
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

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
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const billingReason = (invoice as any).billing_reason;

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
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        console.log(`[stripe-webhook] invoice.created for customer=${customerId}, invoiceId=${invoice.id}, status=${invoice.status}`);

        // Apply tiered discount deductions on subscription draft invoices
        // RULES:
        // - Student: €1 discount max per monthly invoice
        // - Teacher: Up to €8 discount max per monthly invoice
        // - Remaining credits stay in balance for upcoming months
        if (customerId && (invoice.status === 'draft' || (invoice as any).paid === false)) {
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
              } catch (discountErr) {
                console.error('[stripe-webhook] Error creating invoice discount item:', discountErr);
              }
            }
          }
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const customerId = charge.customer as string;
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
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

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
  } catch (handlerErr: any) {
    console.error('[stripe-webhook] Error processing event:', handlerErr);
    return res.status(500).json({ error: 'Webhook processing error', details: handlerErr.message });
  }
}

/**
 * Directly confirms a checkout session and updates Supabase profiles and referral logs.
 * Used when the client returns from Stripe Checkout to ensure instant local and cloud state synchronization.
 */
export async function confirmCheckoutSession({
  sessionId,
  targetTier,
  authHeader,
}: {
  sessionId?: string;
  targetTier?: 'student' | 'teacher';
  authHeader?: string;
}) {
  const user = await getAuthenticatedUser(authHeader);
  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const tier = targetTier || 'student';
  const nowIso = new Date().toISOString();

  // 1. Update user profile to active subscription
  await supabase
    .from('profiles')
    .update({
      tier,
      subscription_status: 'active',
      updated_at: nowIso,
    })
    .eq('id', user.id);

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
  } catch (err) {
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
    } else {
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
          const rewardType =
            referrer.tier === 'teacher'
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
  } catch (refErr) {
    console.warn('[stripe] Could not transition referral log on confirmCheckoutSession:', refErr);
  }

  return { success: true, tier };
}


