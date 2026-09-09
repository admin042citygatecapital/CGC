import { expect, test } from '@playwright/test';
import { E2E_ADMIN } from './test-credentials.js';

test('sandbox creation is authenticated and missing CSRF cannot create an applicant', async ({ page, request }) => {
  const unauthenticated = await request.post('/api/admin/onboarding/sandbox', { data: { requestId: '01234567-89ab-4def-8123-456789abcdef' } });
  expect(unauthenticated.status()).toBe(401);
  await page.goto('/admin/login');
  await page.locator('input[type="email"]').fill(E2E_ADMIN.email);
  await page.locator('input[type="password"]').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: /access admin panel/i }).click();
  await page.getByLabel('Verification code').fill(E2E_ADMIN.otp);
  await page.getByRole('button', { name: /verify and continue/i }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  const noCsrf = await page.request.post('/api/admin/onboarding/sandbox', { data: { requestId: '01234567-89ab-4def-8123-456789abcdef' } });
  expect(noCsrf.status()).toBe(403);
});

test('sandbox panel preserves a failed request ID and shows the signed result separately', async ({ page }) => {
  await page.goto('/admin/login');
  await page.locator('input[type="email"]').fill(E2E_ADMIN.email);
  await page.locator('input[type="password"]').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: /access admin panel/i }).click();
  await page.getByLabel('Verification code').fill(E2E_ADMIN.otp);
  await page.getByRole('button', { name: /verify and continue/i }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  await page.route('**/api/admin/integrations', route => route.fulfill({ json: { integrations: [], sumsub: {
    approved: true, webhookConfigured: true, receiverReady: true, status: 'awaiting_test', message: 'Awaiting a signed sandbox result.', evidenceStatus: 'available',
    evidence: { eventCount: 0, latestEventAt: null, identityEvents: 0, screeningEvents: 0 },
  } } }));
  const requestIds: string[] = [];
  let signedResult = false;
  await page.route('**/api/admin/onboarding/sandbox', async route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { configuration: { ready: true, missing: [], webhookPath: '/api/providers/onboarding/webhook/sumsub-sandbox' },
        tests: signedResult ? [{ externalUserId: 'sbx_0123456789ab4def8123456789abcdef', applicantId: '5cb56e8e0a975a35f333cb83', status: 'accepted', reviewedAt: '2026-01-01T12:00:00Z' }] : [] } });
    }
    requestIds.push(route.request().postDataJSON().requestId);
    if (requestIds.length === 1) return route.fulfill({ status: 502, json: { error: 'Provider temporarily unavailable. Retry this test.' } });
    return route.fulfill({ json: { verificationUrl: 'https://api.sumsub.com/idensic/l/synthetic-test-link', expiresAt: '2030-01-01T12:00:00Z' } });
  });
  await page.goto('/admin/integrations');
  const panel = page.getByRole('region', { name: 'Sandbox verification tests' });
  await expect(panel.getByRole('button', { name: 'Create sandbox test' })).toBeEnabled();
  await panel.getByRole('button', { name: 'Create sandbox test' }).click();
  await expect(panel.getByRole('alert')).toContainText('Provider temporarily unavailable');
  await panel.getByRole('button', { name: 'Create sandbox test' }).click();
  await expect(panel.getByRole('link', { name: 'Open sandbox verification' })).toHaveAttribute('href', 'https://api.sumsub.com/idensic/l/synthetic-test-link');
  expect(requestIds).toHaveLength(2);
  expect(requestIds[1]).toBe(requestIds[0]);
  signedResult = true;
  await panel.getByRole('button', { name: 'Refresh test results' }).click();
  await expect(panel.getByText(/Sandbox result: accepted/)).toBeVisible();
  await expect(panel).toContainText('do not approve customer accounts');
});
