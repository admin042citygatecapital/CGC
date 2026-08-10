export const ANALYTICS_CONSENT_KEY = 'cgc_analytics_consent_v1';
const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export interface ConsentData {
  analytics: boolean;
  timestamp: number;
}

export function clearAnalyticsStorage(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(ANALYTICS_CONSENT_KEY);
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('cgc_ab_')) localStorage.removeItem(key);
    }
  }
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('cgc_sid');
}

function parseConsent(raw: string | null): ConsentData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentData>;
    if (typeof parsed.analytics !== 'boolean' || !Number.isFinite(parsed.timestamp)) return null;
    if ((parsed.timestamp as number) > Date.now() || Date.now() - (parsed.timestamp as number) > CONSENT_MAX_AGE_MS) {
      return null;
    }
    return parsed as ConsentData;
  } catch {
    return null;
  }
}

export function getStoredAnalyticsConsent(): ConsentData | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(ANALYTICS_CONSENT_KEY);
  const consent = parseConsent(raw);
  if (raw && !consent) clearAnalyticsStorage();
  return consent;
}

export function hasBrowserPrivacyOptOut(): boolean {
  if (typeof navigator === 'undefined') return false;
  const browser = navigator as Navigator & { globalPrivacyControl?: boolean };
  return browser.globalPrivacyControl === true || browser.doNotTrack === '1';
}

/**
 * Returns true if the visitor has accepted analytics cookies.
 * Reads the stored consent set by CookieBanner.
 */
export function getAnalyticsConsent(): boolean {
  if (hasBrowserPrivacyOptOut()) {
    clearAnalyticsStorage();
    return false;
  }
  return getStoredAnalyticsConsent()?.analytics === true;
}

/**
 * Registers a callback that fires whenever the visitor accepts or declines
 * the cookie banner. Returns a cleanup function to remove the listener.
 *
 * @example
 * const cleanup = onConsentChange((consented) => {
 *   if (consented) initMyTracker();
 * });
 * // Later: cleanup();
 */
export function onConsentChange(callback: (consented: boolean) => void): () => void {
  function handler(event: Event): void {
    const e = event as CustomEvent<{ consented: boolean }>;
    callback(e.detail.consented);
  }
  window.addEventListener('cookie-consent-changed', handler);
  return () => window.removeEventListener('cookie-consent-changed', handler);
}
