import { supabase } from './supabase';
import { getDevState, saveDevState } from './devLab';
import { UserTier } from '../types';

export interface CheckoutResult {
  success: boolean;
  mock?: boolean;
  url?: string;
  targetTier?: UserTier;
  error?: string;
}

/**
 * Initiates Stripe Checkout session creation and handles redirection
 */
export async function startStripeCheckout(
  targetTier: 'student' | 'teacher',
  referralCode?: string
): Promise<CheckoutResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const devState = getDevState();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (devState) {
      headers['x-dev-override'] = JSON.stringify(devState);
    }

    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        targetTier,
        referralCode: referralCode || localStorage.getItem('zoutty_referral_code') || '',
        successUrl: window.location.origin,
        cancelUrl: window.location.origin,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[stripe] Checkout session creation failed:', data);
      return {
        success: false,
        error: data?.error || 'Failed to start checkout. Please try again.',
      };
    }

    // Mock Mode fallback simulation
    if (data.mock) {
      console.log('[stripe] Mock checkout simulated successfully for tier:', targetTier);
      saveDevState({
        tier: targetTier,
        subscription_status: 'active',
        period_sessions: 0,
        period_clips: 0,
      });
      return {
        success: true,
        mock: true,
        targetTier,
        url: data.url,
      };
    }

    // Real Stripe Checkout redirect
    if (data.url) {
      window.location.href = data.url;
      return {
        success: true,
        mock: false,
        url: data.url,
      };
    }

    return {
      success: false,
      error: 'Invalid response from checkout server.',
    };
  } catch (err: any) {
    console.error('[stripe] Error during startStripeCheckout:', err);
    return {
      success: false,
      error: err?.message || 'Network error occurred while contacting billing server.',
    };
  }
}

/**
 * Opens Stripe Customer Billing Portal for managing subscription
 */
export async function openStripeCustomerPortal(): Promise<{ success: boolean; url?: string; mock?: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        returnUrl: window.location.origin,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data?.error || 'Failed to open billing portal.',
      };
    }

    if (data.url && !data.mock) {
      window.location.href = data.url;
      return { success: true, url: data.url };
    }

    return { success: true, mock: true, url: data.url };
  } catch (err: any) {
    console.error('[stripe] Error opening portal:', err);
    return {
      success: false,
      error: err?.message || 'Network error occurred.',
    };
  }
}
