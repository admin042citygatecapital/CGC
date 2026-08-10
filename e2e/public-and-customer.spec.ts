import { expect, test, type Page } from '@playwright/test';
import { E2E_CUSTOMER } from './test-credentials.js';

async function isolateMarketData(page: Page) {
  await page.routeWebSocket('**/ws/market', socket => socket.close());
  await page.route('**/api/market/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith('/ticker') ? { tickers: [] }
      : path.endsWith('/providers') ? { providers: [] }
        : path.endsWith('/search') ? { results: [] }
          : path.endsWith('/summary') ? { gainers: [], losers: [], trending: [], mostActive: [], timestamp: 0 }
            : path.endsWith('/candles') ? { candles: [] }
              : {};
    await route.fulfill({ json: body });
  });
}

test('public site renders the owned brand without unsupported banking claims', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/City Gate Capital/i);
  await expect(page.locator('body')).not.toContainText('FDIC insured');
  await expect(page.locator('body')).not.toContainText('FSCS protected');
  const logo = page.locator('img[alt*="City Gate" i]').first();
  await expect(logo).toBeVisible();
  const logoLoaded = await logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0);
  expect(logoLoaded).toBe(true);
});

test('protected customer routes redirect to the session-expired login state', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?reason=session_expired$/);
  await expect(page.getByText('Your session expired. Please log in again.')).toBeVisible();
});

test('customer login establishes a persistent browser session and financial writes stay locked', async ({ page }) => {
  await isolateMarketData(page);
  await page.goto('/login');
  await page.getByLabel('Email address').fill(E2E_CUSTOMER.email);
  await page.getByLabel('Password', { exact: true }).fill(E2E_CUSTOMER.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page).toHaveTitle(/Dashboard/i);
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);

  const token = await page.evaluate(() => localStorage.getItem('cgc_customer_token'));
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  const response = await page.request.post('/api/users/transfer', {
    headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': 'e2e-preview-lock-0001' },
    data: { recipient: 'Locked Preview Recipient', amount: 10, currency: 'GBP' },
  });
  expect(response.status()).toBe(503);
  await expect(response.json()).resolves.toMatchObject({ code: 'PREVIEW_MODE' });
});

test('customer password recovery uses a generic anti-enumeration result', async ({ page }) => {
  await page.goto('/forgot-password');
  await page.locator('#email').fill('unknown-customer@example.test');
  await page.getByRole('button', { name: /send reset link/i }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await expect(page.getByText(/If an account with that address exists/i)).toBeVisible();
});
