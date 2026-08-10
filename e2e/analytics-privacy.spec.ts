import { expect, test } from '@playwright/test';

test('public analytics requires consent and begins only after acceptance', async ({ page, request }) => {
  const rejected = await request.post('/api/analytics/event', {
    data: { type: 'pageview', page: '/' },
  });
  expect(rejected.status()).toBe(403);

  const accepted = await request.post('/api/analytics/event', {
    headers: { 'X-CGC-Analytics-Consent': 'granted' },
    data: { type: 'pageview', page: '/privacy-check?secret=removed' },
  });
  expect(accepted.status()).toBe(201);

  // Exercise the explicit-consent path in a browser that is not already
  // sending a higher-priority privacy opt-out signal.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: null });
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false });
    const state = window as Window & { __consentEvents?: boolean[] };
    state.__consentEvents = [];
    window.addEventListener('cookie-consent-changed', event => {
      state.__consentEvents?.push((event as CustomEvent<{ consented: boolean }>).detail.consented);
    });
  });

  const eventRequests: Array<{
    headers: Record<string, string>;
    payload: { type?: string; page?: string; referrer?: string };
  }> = [];
  await page.route('**/api/analytics/event', async route => {
    const req = route.request();
    eventRequests.push({ headers: req.headers(), payload: req.postDataJSON() });
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{"ok":true}' });
  });

  await page.goto('/?private_token=must-not-be-sent');
  await expect(page.getByRole('alertdialog', { name: 'Cookie consent banner' })).toBeVisible();
  await page.waitForTimeout(300);
  expect(eventRequests).toHaveLength(0);

  await page.getByRole('button', { name: 'Accept' }).click();
  await expect.poll(() => eventRequests.length).toBeGreaterThanOrEqual(1);
  const privacyState = await page.evaluate(() => ({
    consent: localStorage.getItem('cgc_analytics_consent_v1'),
    dnt: navigator.doNotTrack,
    gpc: (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl,
    events: (window as Window & { __consentEvents?: boolean[] }).__consentEvents,
  }));
  expect(privacyState).toMatchObject({ dnt: null, gpc: false, events: [true] });
  expect(JSON.parse(privacyState.consent ?? '{}')).toMatchObject({ analytics: true });
  expect(eventRequests.every(event => event.headers['x-cgc-analytics-consent'] === 'granted')).toBe(true);

  const pageView = eventRequests.find(event => event.payload.type === 'pageview');
  expect(pageView).toBeDefined();
  expect(pageView?.payload.page).toBe('/');
  expect(JSON.stringify(eventRequests)).not.toContain('private_token');
});

test('analytics reports remain administrator-only', async ({ request }) => {
  expect((await request.get('/api/analytics/summary')).status()).toBe(401);
  expect((await request.get('/api/analytics/conversions')).status()).toBe(401);
});
