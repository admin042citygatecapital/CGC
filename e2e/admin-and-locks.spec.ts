import { expect, test } from '@playwright/test';
import { E2E_ADMIN } from './test-credentials.js';

async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.locator('input[type="email"]').fill(E2E_ADMIN.email);
  await page.locator('input[type="password"]').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: /access admin panel/i }).click();
  await page.getByLabel('Verification code').fill(E2E_ADMIN.otp);
  await page.getByRole('button', { name: /verify and continue/i }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Super/i })).toBeVisible();
  await expect(page.getByText('Financial data safeguards')).toBeVisible();
}

test('protected sponsor workspace redirects unauthenticated administrators', async ({ page }) => {
  await page.goto('/admin/sponsor-readiness');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('heading', { name: 'Secure Login' })).toBeVisible();
});

test('API reference downloads are not publicly accessible', async ({ request }) => {
  const protectedReference = await request.get('/api/admin/documentation/markdown');
  expect(protectedReference.status()).toBe(401);

  const removedPublicReference = await request.get('/docs/api-documentation.md');
  expect(removedPublicReference.status()).toBe(404);

  const removedEmailSender = await request.post('/api/test-email', { data: { email: 'attacker@example.test' } });
  expect(removedEmailSender.status()).toBe(404);

  expect((await request.get('/api/zoho/connect')).status()).toBe(401);
  expect((await request.get('/api/zoho/status')).status()).toBe(401);
});

test('development surfaces stay outside the production administration API', async ({ page }) => {
  await loginAdmin(page);
  const response = await page.request.get('/api/admin/developer');
  expect(response.status()).toBe(404);
  expect((await page.request.get('/api/admin/env-report')).status()).toBe(404);
});

test('admin financial screens are excluded and authenticated money mutations remain locked', async ({ page }) => {
  await loginAdmin(page);
  await page.goto('/admin/transactions');
  await expect(page.getByRole('heading', { name: "Financial activity is outside this project's scope" })).toBeVisible();
  await expect(page.getByRole('button', { name: /create transaction/i })).toHaveCount(0);

  const csrfResponse = await page.request.get('/api/csrf');
  const { csrfToken } = await csrfResponse.json() as { csrfToken: string };
  const mutation = await page.request.post('/api/admin/balance/adjust', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { userId: 'e2e-preview-user', amount: 1, currency: 'GBP', type: 'credit', note: 'must remain locked' },
  });
  expect(mutation.status()).toBe(503);
  await expect(mutation.json()).resolves.toMatchObject({ code: 'PREVIEW_MODE' });
});

test('sponsor-readiness remains an authenticated workspace and reports its database dependency', async ({ page }) => {
  test.setTimeout(60_000);
  await loginAdmin(page);
  await page.goto('/admin/sponsor-readiness', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('UK sponsor-readiness workspace')).toBeVisible();
  await expect(page.getByText('Financial operations remain locked')).toBeVisible();
  await expect(page.getByText('Sponsor readiness requires PostgreSQL.')).toBeVisible();
});

test('admin password recovery gives the same generic confirmation for unknown accounts', async ({ page }) => {
  await page.goto('/admin/forgot-password');
  await page.locator('input[type="email"]').fill('unknown-admin@example.test');
  await page.getByRole('button', { name: /send reset link/i }).click();
  await expect(page.getByRole('heading', { name: 'Check Your Inbox' })).toBeVisible();
  await expect(page.getByText(/If that email is registered/i)).toBeVisible();
});

test('admin health and Sumsub evidence stay truthful through loading and failures', async ({ page }) => {
  await page.route('**/api/admin/health', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...await response.json(), status: 'warning' } });
  });
  await loginAdmin(page);
  await expect(page.getByText('Service warning', { exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/\u00c2\u00b7|\u00e2\u20ac\u201d|\u00f0\u0178/);

  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/admin/integrations', async route => {
    await gate;
    await route.fulfill({ json: { integrations: [], sumsub: {
      approved: false, webhookConfigured: false, receiverReady: false, status: 'not_configured',
      evidenceStatus: 'available', evidence: { eventCount: 0, latestEventAt: null, identityEvents: 0, screeningEvents: 0 },
      message: 'Sandbox identity verification only. Applicant creation and an isolated sandbox receiver remain incomplete.',
    } } });
  });
  await page.goto('/admin/integrations');
  const panel = page.getByRole('region', { name: 'Sumsub readiness' });
  try { await expect(panel.getByText('Loading provider evidence...')).toBeVisible(); }
  finally { release(); }
  await expect(panel.getByText('Receiver configuration incomplete')).toBeVisible();
  await expect(panel.getByText('None recorded')).toBeVisible();
  await page.unroute('**/api/admin/health');
  await page.route('**/api/admin/health', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
  await page.reload();
  await expect(page.getByText('Health unverified', { exact: true })).toBeVisible();
});

test('session list distinguishes idle unexpired sessions from recent activity', async ({ page }) => {
  await loginAdmin(page);
  await page.route('**/api/admin/security/sessions', route => route.fulfill({ json: { sessions: [
    { token: 'fixture-session-reference', adminId: 'fixture-admin', email: E2E_ADMIN.email, createdAt: '2020-01-01T00:00:00Z', lastSeenAt: '2020-01-01T00:00:00Z', ip: '127.0.0.1', ua: 'Local test fixture' },
  ] } }));
  await page.goto('/admin/security');
  await page.getByRole('button', { name: 'Sessions', exact: true }).click();
  await expect(page.getByText('1 unexpired admin session; 0 active in the last 60 minutes')).toBeVisible();
  await expect(page.getByText('Idle - unexpired', { exact: true })).toBeVisible();
});

test('sandbox KYC hides financial navigation and blocks direct financial screens', async ({ page }) => {
  await loginAdmin(page);
  await expect(page.getByRole('link', { name: 'KYC & Onboarding', exact: true })).toBeVisible();
  for (const name of ['Trading', 'Transfers', 'Accounts', 'Cards', 'Reconciliation']) {
    await expect(page.getByRole('navigation').getByRole('link', { name, exact: true })).toHaveCount(0);
  }
  for (const route of ['/admin/trading', '/admin/transfers', '/admin/cards', '/admin/crypto', '/admin/accounts', '/admin/reconciliation']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: "Financial activity is outside this project's scope" })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open KYC workspace' })).toHaveAttribute('href', '/admin/onboarding');
  }
});
