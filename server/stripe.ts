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

  const user = await getAuthenticatedUser(authHeader);
  if (!user) {
    return {
      mock: true,
      url: `${returnUrl || baseUrl}/?portal_simulated=true`,
      message: 'No authenticated user session found.'
    };
  }

  const profile = await getUserProfile(user.id);
  const customerId = profile?.stripe_customer_id;

  if (!customerId) {
    return {
      mock: true,
      url: `${returnUrl || baseUrl}/?portal_simulated=true`,
      message: 'No Stripe customer ID associated with this account yet.'
    };
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl || baseUrl,
  });

  return {
    mock: false,
    url: portalSession.url,
  };
}
