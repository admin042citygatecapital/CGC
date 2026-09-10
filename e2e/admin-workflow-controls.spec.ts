import { expect, test } from '@playwright/test';
import { E2E_ADMIN } from './test-credentials.js';

test('financial sandbox requires administrator authentication', async ({ page }) => {
  await page.goto('/admin/financial-sandbox');
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('super admin enables independent workflow switches and can disable sandbox writes', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/admin/login');
  await page.locator('input[type="email"]').fill(E2E_ADMIN.email);
  await page.locator('input[type="password"]').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: /access admin panel/i }).click();
  await page.getByLabel('Verification code').fill(E2E_ADMIN.otp);
  await page.getByRole('button', { name: /verify and continue/i }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });

  await page.goto('/admin/config?section=featureToggles');
  for (const name of ['KYC Approvals: disabled', 'Sandbox Financial Controls: disabled']) {
    await page.getByRole('switch', { name, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(page.getByText('Configuration saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('switch', { name: 'KYC Approvals: enabled', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('switch', { name: 'Sandbox Financial Controls: enabled', exact: true })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('link', { name: 'Financial Sandbox', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Financial operations sandbox', exact: true })).toBeVisible();
  const state = await page.request.get('/api/admin/financial-sandbox');
  expect(state.status()).toBe(200);
  expect(await state.json()).toMatchObject({ mutationsEnabled: true, syntheticOnly: true, executionSource: 'SIMULATION', liveProviderAdaptersImplemented: false });
  const csrf = await (await page.request.get('/api/csrf')).json() as { csrfToken: string };
  const create = await page.request.post('/api/admin/financial-sandbox', {
    headers: { 'X-CSRF-Token': csrf.csrfToken, 'Idempotency-Key': 'e2e-workflow-account' },
    data: { action: 'create_account', name: 'E2E synthetic workflow account', type: 'personal', asset: 'GBP' },
  });
  expect(create.status()).toBe(201);
  expect(await create.json()).toMatchObject({ synthetic: true, balanceMinor: '0' });

  await page.goto('/admin/config?section=featureToggles');
  await page.getByRole('switch', { name: 'Sandbox Financial Controls: enabled', exact: true }).click();
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(page.getByText('Configuration saved', { exact: true })).toBeVisible();
  const refreshedCsrf = await (await page.request.get('/api/csrf')).json() as { csrfToken: string };
  const blocked = await page.request.post('/api/admin/financial-sandbox', {
    headers: { 'X-CSRF-Token': refreshedCsrf.csrfToken, 'Idempotency-Key': 'e2e-workflow-blocked' },
    data: { action: 'create_account', name: 'Must not be created', type: 'personal', asset: 'GBP' },
  });
  expect(blocked.status()).toBe(403);
  expect(await blocked.json()).toMatchObject({ code: 'SANDBOX_FINANCIAL_CONTROLS_DISABLED' });
  const config = await (await page.request.get('/api/admin/config')).json();
  expect(config.featureToggles).toMatchObject({ kycApprovalsEnabled: true, sandboxFinancialControlsEnabled: false });
  const readable = await page.request.get('/api/admin/financial-sandbox');
  expect(readable.status()).toBe(200);
  expect(await readable.json()).toMatchObject({ mutationsEnabled: false });
  await page.reload();
  await page.getByRole('switch', { name: 'KYC Approvals: enabled', exact: true }).click();
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(page.getByText('Configuration saved', { exact: true })).toBeVisible();
});
