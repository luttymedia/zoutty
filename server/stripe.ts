import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
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
async function getAuthenticatedUser(authHeader?: string) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

    // Check referral discount credits
    const creditBalance = profile?.referral_credits_balance || 0;
    if (creditBalance > 0) {
      const discountAmountCents = targetTier === 'teacher' ? 200 : 100;
      try {
        const coupon = await stripe.coupons.create({
          amount_off: discountAmountCents,
          currency: 'eur',
          duration: 'once',
          name: `Zoutty Referral Reward (€${discountAmountCents / 100} off)`,
        });
        discounts.push({ coupon: coupon.id });
        console.log(`[stripe] Applied €${discountAmountCents / 100} referral coupon=${coupon.id} for user=${user.id}`);
      } catch (couponErr) {
        console.warn('[stripe] Failed to create referral coupon:', couponErr);
      }
    }
  }

  // 3. Create Stripe Checkout Session
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
    discounts: discounts.length > 0 ? discounts : undefined,
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const userId = session.metadata?.supabase_user_id || session.client_reference_id;
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

          // 3. Process referral reward if referral code was used
          if (referralCode) {
            try {
              const { data: referrer } = await supabase
                .from('profiles')
                .select('id, referral_credits_balance')
                .eq('referral_code', referralCode)
                .maybeSingle();

              if (referrer) {
                const bonusUnits = targetTier === 'teacher' ? 2 : 1;
                const newBalance = (referrer.referral_credits_balance || 0) + bonusUnits;
                await supabase
                  .from('profiles')
                  .update({
                    referral_credits_balance: newBalance,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', referrer.id);

                console.log(`[stripe-webhook] Credited ${bonusUnits} referral units to referrer=${referrer.id}`);
              }
            } catch (refErr) {
              console.warn('[stripe-webhook] Failed to credit referral reward:', refErr);
            }
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

        console.log(`[stripe-webhook] customer.subscription.deleted for customer=${customerId}. Reverting to free tier.`);

        await supabase
          .from('profiles')
          .update({
            tier: 'free',
            subscription_status: 'canceled',
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);
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

