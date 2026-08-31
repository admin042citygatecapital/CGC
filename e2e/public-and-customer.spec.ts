import { expect, test, type Page } from '@playwright/test';
import crypto from 'node:crypto';
import {
  E2E_CUSTOMER, E2E_RESET_CUSTOMER, E2E_ROUTE_AUDIT_CUSTOMER, E2E_TWO_FACTOR_CUSTOMER,
  E2E_UNVERIFIED_CUSTOMER,
} from './test-credentials.js';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function currentTotp(secret: string): string {
  let bits = 0; let value = 0; const bytes: number[] = [];
  for (const character of secret) {
    value = (value << 5) | BASE32.indexOf(character); bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = crypto.createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.locator('button[type="submit"]').click();
}

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
  await expect(page.getByRole('heading', { level: 1, name: /Ready to Take Control/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore Digital Banking' })).toBeVisible();
  const logo = page.locator('img[alt*="City Gate" i]').first();
  await expect(logo).toBeVisible();
  const logoLoaded = await logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0);
  expect(logoLoaded).toBe(true);

  await page.getByRole('link', { name: 'Explore Digital Banking' }).click();
  await expect(page).toHaveURL(/\/digital-banking$/);
  await expect(page.getByText('Digital Banking', { exact: true })).toBeVisible();
});

test('public account options never expose a synthetic customer dashboard', async ({ page }) => {
  await page.goto('/accounts');
  await expect(page.getByRole('heading', { level: 1, name: 'Choose the Account That Fits Your Ambition' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Your Application' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore Digital Banking' }).first()).toBeVisible();
  const body = page.locator('body');
  await expect(body).not.toContainText(/Alex Morgan|Recent transactions|Asset allocation|What Our Customers Say/i);
  await expect(body).not.toContainText(/\$\s?\d/);
});

test('protected customer routes redirect to the session-expired login state', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?reason=session_expired$/);
  await expect(page.getByText('Your session expired. Please log in again.')).toBeVisible();
});

test('customer registration creates a pending, non-financial application without exposing verification secrets', async ({ request, baseURL }) => {
  const email = `registration-${Date.now()}@example.test`;
  const registration = await request.post('/api/users/register', { headers: { Origin: baseURL! }, data: {
    name: 'Registration Acceptance Customer', email, password: 'Registration-E2E-42!',
    phone: '+44 7700 900123', country: 'United Kingdom', address: '51 Mosley Street',
    city: 'Manchester', postalCode: 'M2 3HQ', requestedProduct: 'personal-account',
    termsAccepted: true,
  } });
  expect(registration.status()).toBe(201);
  const body = await registration.json();
  expect(body).toMatchObject({ ok: true, kycAvailable: true });
  expect(body).not.toHaveProperty('emailVerifyToken');
  expect(body).not.toHaveProperty('passwordHash');

  const duplicate = await request.post('/api/users/register', { headers: { Origin: baseURL! }, data: {
    name: 'Registration Acceptance Customer', email, password: 'Registration-E2E-42!',
    phone: '+44 7700 900123', country: 'United Kingdom', address: '51 Mosley Street',
    city: 'Manchester', postalCode: 'M2 3HQ', requestedProduct: 'personal-account',
    termsAccepted: true,
  } });
  expect(duplicate.status()).toBe(409);
});

test('email verification is single-use and advances the customer to controlled KYC', async ({ page }) => {
  await page.goto(`/api/users/verify-email?token=${E2E_UNVERIFIED_CUSTOMER.token}`);
  await expect(page).toHaveURL(/\/login\?verified=success$/);
  await expect(page.getByText(/email.*verified/i)).toBeVisible();

  const repeatedVerification = await page.request.get(`/api/users/verify-email?token=${E2E_UNVERIFIED_CUSTOMER.token}`, {
    maxRedirects: 0,
  });
  expect(repeatedVerification.status()).toBe(302);
  expect(repeatedVerification.headers().location).toMatch(/verified=error&reason=invalid_token/);

  await login(page, E2E_UNVERIFIED_CUSTOMER.email, E2E_UNVERIFIED_CUSTOMER.password);
  await expect(page).toHaveURL(/\/(kyc|onboarding)$/);
  await expect(page.getByText(/Registration workflow storage is not configured|complete KYC/i)).toBeVisible();
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

test('password reset changes credentials and revokes an existing session', async ({ page }) => {
  await isolateMarketData(page);
  await login(page, E2E_RESET_CUSTOMER.email, E2E_RESET_CUSTOMER.password);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`/reset-password?token=${E2E_RESET_CUSTOMER.token}`);
  await page.getByLabel('New password', { exact: true }).fill(E2E_RESET_CUSTOMER.replacementPassword);
  await page.getByLabel('Confirm new password', { exact: true }).fill(E2E_RESET_CUSTOMER.replacementPassword);
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();

  const revokedSession = await page.request.get('/api/users/session');
  expect(revokedSession.status()).toBe(401);
  const origin = new URL(page.url()).origin;
  const oldLogin = await page.request.post('/api/users/login', { headers: { Origin: origin }, data: {
    email: E2E_RESET_CUSTOMER.email, password: E2E_RESET_CUSTOMER.password,
  } });
  expect(oldLogin.status()).toBe(401);
  const newLogin = await page.request.post('/api/users/login', { headers: { Origin: origin }, data: {
    email: E2E_RESET_CUSTOMER.email, password: E2E_RESET_CUSTOMER.replacementPassword,
  } });
  expect(newLogin.status()).toBe(200);
});

test('2FA is required at login and a valid authenticator code establishes the session', async ({ page }) => {
  await isolateMarketData(page);
  await login(page, E2E_TWO_FACTOR_CUSTOMER.email, E2E_TWO_FACTOR_CUSTOMER.password);
  await expect(page.getByLabel(/authenticator code/i)).toBeVisible();
  await page.getByLabel(/authenticator code/i).fill(currentTotp(E2E_TWO_FACTOR_CUSTOMER.secret));
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('account, transaction, beneficiary and support views remain usable on mobile without moving money', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cgc_analytics_consent_v1', JSON.stringify({ analytics: false, timestamp: Date.now() }));
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await isolateMarketData(page);
  await login(page, E2E_CUSTOMER.email, E2E_CUSTOMER.password);
  await expect(page).toHaveURL(/\/dashboard$/);

  for (const [path, heading] of [
    ['/dashboard/accounts', 'My Accounts'],
    ['/dashboard/transactions', 'Transactions'],
    ['/dashboard/beneficiaries', 'Beneficiaries'],
    ['/dashboard/support', 'Support centre'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} must not overflow a 390px viewport`).toBeLessThanOrEqual(1);
  }

  await page.goto('/dashboard/security');
  await page.getByRole('button', { name: /Sign Out/i }).click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  expect((await page.request.get('/api/users/session')).status()).toBe(401);
});

test('the authenticated customer route catalogue stays inside the customer boundary without server errors', async ({ page }) => {
  test.setTimeout(120_000);
  await isolateMarketData(page);
  await login(page, E2E_ROUTE_AUDIT_CUSTOMER.email, E2E_ROUTE_AUDIT_CUSTOMER.password);
  await expect(page).toHaveURL(/\/dashboard$/);

  const serverErrors: string[] = [];
  const expectedUnavailable = new Set([
    '/api/users/plaid',
    '/api/users/onboarding',
    '/api/users/support',
    '/api/users/bills',
    '/api/users/goals',
  ]);
  const unavailableStates = new Set<string>();
  const pageErrors: string[] = [];
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === new URL(page.url()).origin && response.status() >= 500) {
      if (response.status() === 503 && expectedUnavailable.has(url.pathname)) {
        unavailableStates.add(url.pathname);
      } else {
        serverErrors.push(`${response.status()} ${url.pathname}`);
      }
    }
  });
  page.on('pageerror', error => pageErrors.push(error.message));

  const routes = [
    '/dashboard', '/dashboard/accounts', '/dashboard/transactions', '/dashboard/transfers',
    '/dashboard/beneficiaries', '/dashboard/cards', '/dashboard/wallets', '/dashboard/deposits',
    '/dashboard/rates', '/dashboard/exchange', '/dashboard/trading', '/dashboard/trading/markets',
    '/dashboard/trading/orders', '/dashboard/trading/chart', '/dashboard/trading/watchlist',
    '/dashboard/trading/analytics', '/dashboard/trading/spot', '/dashboard/trading/trades',
    '/dashboard/portfolio', '/dashboard/statements', '/dashboard/notifications', '/dashboard/profile',
    '/dashboard/settings', '/dashboard/security', '/dashboard/devices', '/dashboard/support',
    '/dashboard/disputes', '/dashboard/goals', '/dashboard/bills', '/dashboard/payments',
    '/dashboard/rewards', '/dashboard/search', '/kyc', '/onboarding',
  ];

  for (const route of routes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page, `${route} must remain in the customer application`).not.toHaveURL(/\/admin(?:\/login)?/);
    await expect(page, `${route} must retain the authenticated customer session`).not.toHaveURL(/\/login\?reason=session_expired/);
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(100);
  }

  expect(serverErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  for (const endpoint of expectedUnavailable) {
    const response = await page.request.get(endpoint);
    expect(response.status(), `${endpoint} must fail closed when its dependency is unavailable`).toBe(503);
    unavailableStates.add(endpoint);
  }
  expect([...unavailableStates].sort()).toEqual([...expectedUnavailable].sort());
});

test('repeated customer login failures trigger per-account throttling', async ({ page }) => {
  const origin = new URL((await page.goto('/login'))!.url()).origin;
  const credentials = { email: 'rate-limit-probe@example.test', password: 'DefinitelyWrong!2026' };

  // The canonical policy records a lock on the fifth generic failure. The
  // next request observes that lock and is rejected before verification.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await page.request.post('/api/users/login', {
      headers: { Origin: origin },
      data: credentials,
    });
    expect(response.status(), `failed login ${attempt + 1} should remain generic`).toBe(401);
  }

  const blocked = await page.request.post('/api/users/login', {
    headers: { Origin: origin },
    data: credentials,
  });
  expect(blocked.status()).toBe(429);
  await expect(blocked.json()).resolves.toMatchObject({ error: expect.stringMatching(/too many failed attempts/i) });
});
