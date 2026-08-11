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
  await expect(page.getByRole('heading', { level: 1, name: /The Future of Banking is Here/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore Features' })).toBeVisible();
  const logo = page.locator('img[alt*="City Gate" i]').first();
  await expect(logo).toBeVisible();
  const logoLoaded = await logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0);
  expect(logoLoaded).toBe(true);

  await page.getByRole('link', { name: 'Explore Features' }).click();
  await expect(page).toHaveURL(/\/digital-banking$/);
  await expect(page.getByText('Digital Banking', { exact: true })).toBeVisible();
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
  const loginResponsePromise = page.waitForResponse(response =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/users/login',
  );
  await page.locator('button[type="submit"]').click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.status()).toBe(200);
  await expect(loginResponse.json()).resolves.not.toHaveProperty('token');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page).toHaveTitle(/Dashboard/i);
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);

  expect(await page.evaluate(() => localStorage.getItem('cgc_customer_token'))).toBeNull();
  expect(await page.evaluate(() => document.cookie)).not.toContain('cgc_customer_sid');
  const sessionCookie = (await page.context().cookies()).find(cookie => cookie.name === 'cgc_customer_sid');
  expect(sessionCookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/api/users' });

  const missingOrigin = await page.request.post('/api/users/transfer', {
    headers: { 'Idempotency-Key': 'e2e-preview-csrf-0001' },
    data: { recipient: 'Locked Preview Recipient', amount: 10, currency: 'GBP' },
  });
  expect(missingOrigin.status()).toBe(403);
  await expect(missingOrigin.json()).resolves.toMatchObject({ code: 'CUSTOMER_CSRF_REJECTED' });

  const response = await page.request.post('/api/users/transfer', {
    headers: { Origin: new URL(page.url()).origin, 'Idempotency-Key': 'e2e-preview-lock-0001' },
    data: { recipient: 'Locked Preview Recipient', amount: 10, currency: 'GBP' },
  });
  expect(response.status()).toBe(503);
  await expect(response.json()).resolves.toMatchObject({ code: 'PREVIEW_MODE' });

  const cardResponse = await page.request.post('/api/users/cards/freeze', {
    headers: { Origin: new URL(page.url()).origin },
    data: { cardId: 'synthetic-card-record' },
  });
  expect(cardResponse.status()).toBe(503);
  await expect(cardResponse.json()).resolves.toMatchObject({ code: 'CARD_ISSUER_ADAPTER_UNAVAILABLE' });
});

test('customer password recovery uses a generic anti-enumeration result', async ({ page }) => {
  await page.goto('/forgot-password');
  await page.locator('#email').fill('unknown-customer@example.test');
  await page.getByRole('button', { name: /send reset link/i }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await expect(page.getByText(/If an account with that address exists/i)).toBeVisible();
});
