import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getAnalyticsConsent, onConsentChange } from './analytics-consent';

/** All supported event types — must match backend EventType */
export type EventType =
  | 'pageview'
  | 'click'
  | 'custom'
  | 'signup_started'
  | 'signup_completed'
  | 'account_open'
  | 'transfer_initiated'
  | 'plan_selected';

/**
 * Generates or retrieves a persistent session ID stored in sessionStorage.
 * No PII is collected — this is a random token scoped to the browser tab session.
 */
function getSessionId(): string {
  try {
    const key = 'cgc_sid';
    let sid = sessionStorage.getItem(key);
    if (!sid) {
      sid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(key, sid);
    }
    return sid;
  } catch {
    return 'unknown';
  }
}

/**
 * Core event sender — fire-and-forget, never throws.
 */
async function sendEvent(
  type: EventType,
  page: string,
  meta?: Record<string, string | number | boolean>
): Promise<void> {
  if (!getAnalyticsConsent()) return;
  try {
    const safePage = page.split(/[?#]/, 1)[0];
    let referrer: string | undefined;
    if (typeof document !== 'undefined' && document.referrer) {
      try { referrer = new URL(document.referrer).origin; } catch { /* ignore malformed referrers */ }
    }
    await fetch('/api/analytics/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CGC-Analytics-Consent': 'granted',
      },
      body: JSON.stringify({
        type,
        page: safePage.startsWith('/') ? safePage : '/',
        referrer,
        sessionId: getSessionId(),
        meta,
      }),
      keepalive: true,
      referrerPolicy: 'origin',
    });
  } catch {
    // Silently ignore — analytics must never break the app
  }
}

/**
 * Track a generic event. Fire-and-forget.
 */
export async function trackEvent(
  type: EventType,
  page: string,
  meta?: Record<string, string | number | boolean>
): Promise<void> {
  return sendEvent(type, page, meta);
}

/**
 * Track a conversion event with optional metadata.
 *
 * @example
 * // User clicks "Open Account" on the homepage
 * trackConversion('signup_started', '/', { source: 'hero_cta' });
 *
 * // User selects the Premium plan
 * trackConversion('plan_selected', '/accounts', { plan: 'premium', billing: 'monthly' });
 *
 * // User submits a transfer
 * trackConversion('transfer_initiated', '/transfers', { currency: 'USD', corridor: 'US-MX' });
 */
export function trackConversion(
  type: 'signup_started' | 'signup_completed' | 'account_open' | 'transfer_initiated' | 'plan_selected',
  page: string,
  meta?: Record<string, string | number | boolean>
): void {
  void sendEvent(type, page, meta);
}

/**
 * Hook that automatically fires a pageview event on every route change.
 * Mount once in RootLayout.
 */
export function usePageViewTracking(): void {
  const location = useLocation();
  const [consented, setConsented] = useState(() => getAnalyticsConsent());
  const lastTracked = useRef<string>('');

  useEffect(() => onConsentChange(setConsented), []);

  useEffect(() => {
    if (!consented) {
      lastTracked.current = '';
      return;
    }
    const page = location.pathname;
    // Deduplicate — React StrictMode double-fires effects in dev
    if (lastTracked.current === page) return;
    lastTracked.current = page;
    void sendEvent('pageview', page);
  }, [consented, location.pathname]);
}
