// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ANALYTICS_CONSENT_KEY,
  clearAnalyticsStorage,
  getAnalyticsConsent,
  getStoredAnalyticsConsent,
} from '../lib/analytics-consent.js';

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false });
  Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: null });
});

describe('analytics consent', () => {
  it('requires an unexpired affirmative choice', () => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify({ analytics: true, timestamp: Date.now() }));
    expect(getAnalyticsConsent()).toBe(true);

    localStorage.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify({
      analytics: true,
      timestamp: Date.now() - 366 * 24 * 60 * 60 * 1000,
    }));
    expect(getStoredAnalyticsConsent()).toBeNull();
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBeNull();
  });

  it('honours browser privacy signals and clears analytics identifiers', () => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify({ analytics: true, timestamp: Date.now() }));
    localStorage.setItem('cgc_ab_home', 'variant');
    sessionStorage.setItem('cgc_sid', 'session-id');
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });

    expect(getAnalyticsConsent()).toBe(false);
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBeNull();
    expect(localStorage.getItem('cgc_ab_home')).toBeNull();
    expect(sessionStorage.getItem('cgc_sid')).toBeNull();
  });

  it('removes the legacy third-party tracker and unsupported policy claims', () => {
    const banner = fs.readFileSync(path.resolve(process.cwd(), 'src/components/CookieBanner.tsx'), 'utf8');
    const policy = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/cookie-policy.tsx'), 'utf8');
    expect(banner).not.toMatch(/scc-c2|_signalsDataLayer|initC2Tracking/);
    expect(policy).not.toMatch(/We use Google Analytics|Google Analytics \(Google LLC|scc-c2/i);
  });

  it('clears session and experiment storage on withdrawal', () => {
    localStorage.setItem('cgc_ab_test', 'control');
    sessionStorage.setItem('cgc_sid', 'session-id');
    clearAnalyticsStorage();
    expect(localStorage.getItem('cgc_ab_test')).toBeNull();
    expect(sessionStorage.getItem('cgc_sid')).toBeNull();
  });
});
