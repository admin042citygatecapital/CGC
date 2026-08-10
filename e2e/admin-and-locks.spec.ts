import { expect, test } from '@playwright/test';
import { E2E_ADMIN } from './test-credentials.js';

async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.locator('input[type="email"]').fill(E2E_ADMIN.email);
  await page.locator('input[type="password"]').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: /access admin panel/i }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  await expect(page.getByText('Product-preview administration')).toBeVisible();
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

test('Developer Center reports the running route registry and current auth boundaries', async ({ page }) => {
  await loginAdmin(page);
  const response = await page.request.get('/api/admin/developer');
  expect(response.status()).toBe(200);
  const data = await response.json() as {
    routes: { total: number; catalogue: Array<{ method: string; path: string; auth: string; description: string }> };
  };

  expect(data.routes.total).toBeGreaterThan(250);
  expect(data.routes.catalogue).not.toContainEqual(expect.objectContaining({ path: '/api/test-email' }));
  expect(data.routes.catalogue).toContainEqual(expect.objectContaining({
    method: 'POST',
    path: '/api/analytics/event',
    auth: 'admin',
  }));
  expect(data.routes.catalogue).toContainEqual(expect.objectContaining({
    method: 'POST',
    path: '/api/users/withdraw',
    auth: 'customer',
    description: expect.stringContaining('Preview-locked'),
  }));
});

test('admin login reaches preview controls and authenticated money mutations remain locked', async ({ page }) => {
  await loginAdmin(page);
  await page.goto('/admin/transactions');
  await expect(page.getByText('Persistent demonstration register', { exact: true })).toBeVisible();
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
  await loginAdmin(page);
  await page.goto('/admin/sponsor-readiness');
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
