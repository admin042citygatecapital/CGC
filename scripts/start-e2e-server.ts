import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import {
  E2E_ADMIN, E2E_CUSTOMER, E2E_RESET_CUSTOMER,
  E2E_TWO_FACTOR_CUSTOMER, E2E_UNVERIFIED_CUSTOMER,
} from '../e2e/test-credentials.js';

const port = process.env.E2E_PORT ?? '5191';
const root = mkdtempSync(join(tmpdir(), 'cgc-e2e-'));
const privateDataRoot = join(root, 'private');
mkdirSync(privateDataRoot, { recursive: true });

const baseEnv: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: 'development',
  PLATFORM_MODE: 'preview',
  ENFORCE_PREVIEW_LOCKS: '1',
  ENABLE_FINANCIAL_OPERATIONS: '0',
  ENABLE_PAPER_TRADING: '0',
  ALLOW_PUBLIC_REGISTRATION: '1',
  DISABLE_EXTERNAL_MARKET_DATA: '1',
  E2E_TEST_MODE: '1',
  E2E_ADMIN_OTP: E2E_ADMIN.otp,
  HOST: '127.0.0.1',
  PORT: port,
  PUBLIC_URL: `http://127.0.0.1:${port}`,
  PRIVATE_DATA_ROOT: privateDataRoot,
  MEDIA_ASSET_ROOT: resolve('public', 'assets'),
  SESSION_SECRET: 'e2e-session-secret-isolated-from-all-real-environments-2026',
  JWT_SECRET: 'e2e-session-secret-isolated-from-all-real-environments-2026',
  CARD_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
};

for (const key of [
  'DATABASE_URL', 'ZOHO_ACCESS_TOKEN', 'ZOHO_REFRESH_TOKEN', 'ZOHO_CLIENT_SECRET',
  'ZOHO_SMTP_PASSWORD', 'SMTP_PASSWORD', 'RESEND_API_KEY',
]) delete baseEnv[key];
Object.assign(process.env, baseEnv);

const [{ hashPassword }, { createUser }] = await Promise.all([
  import('../src/server/lib/passwordHash.js'),
  import('../src/server/lib/userStore.js'),
]);

const [customerHash, unverifiedHash, resetHash, twoFactorHash, adminHash, validatorHash] = await Promise.all([
  hashPassword(E2E_CUSTOMER.password),
  hashPassword(E2E_UNVERIFIED_CUSTOMER.password),
  hashPassword(E2E_RESET_CUSTOMER.password),
  hashPassword(E2E_TWO_FACTOR_CUSTOMER.password),
  hashPassword(E2E_ADMIN.password),
  bcrypt.hash(E2E_ADMIN.password, 12),
]);

await createUser({
  email: E2E_CUSTOMER.email,
  name: E2E_CUSTOMER.name,
  country: 'United Kingdom',
  status: 'active',
  kycStatus: 'approved',
  amlStatus: 'cleared',
  amlRiskLevel: 'low',
  emailVerified: true,
  passwordHash: customerHash,
  balance: 125_000,
  primaryCurrency: 'GBP',
  accountTier: 'personal',
});

await createUser({
  email: E2E_UNVERIFIED_CUSTOMER.email, name: E2E_UNVERIFIED_CUSTOMER.name,
  country: 'United Kingdom', status: 'pending_verification', kycStatus: 'not_submitted',
  emailVerified: false, emailVerifyToken: E2E_UNVERIFIED_CUSTOMER.token,
  emailVerifyExpiry: new Date(Date.now() + 60 * 60_000).toISOString(),
  passwordHash: unverifiedHash, balance: 0, primaryCurrency: 'GBP', accountTier: 'personal',
});

const resetCustomer = await createUser({
  email: E2E_RESET_CUSTOMER.email, name: E2E_RESET_CUSTOMER.name,
  country: 'United Kingdom', status: 'active', kycStatus: 'approved', amlStatus: 'cleared',
  amlRiskLevel: 'low', emailVerified: true, passwordHash: resetHash,
  balance: 0, primaryCurrency: 'GBP', accountTier: 'personal',
});
baseEnv.E2E_RESET_USER_ID = resetCustomer.id;
baseEnv.E2E_RESET_TOKEN = E2E_RESET_CUSTOMER.token;
baseEnv.E2E_RESET_EXPIRES_AT = new Date(Date.now() + 60 * 60_000).toISOString();

await createUser({
  email: E2E_TWO_FACTOR_CUSTOMER.email, name: E2E_TWO_FACTOR_CUSTOMER.name,
  country: 'United Kingdom', status: 'active', kycStatus: 'approved', amlStatus: 'cleared',
  amlRiskLevel: 'low', emailVerified: true, passwordHash: twoFactorHash,
  totpEnabled: true, totpSecret: E2E_TWO_FACTOR_CUSTOMER.secret,
  balance: 0, primaryCurrency: 'GBP', accountTier: 'personal',
});

const child = spawn(process.execPath, ['dist/server.bundle.mjs'], {
  cwd: process.cwd(),
  env: {
    ...baseEnv,
    ADMIN_PASSWORD_HASH: validatorHash,
    ADMIN_PASSWORD_HASH_V2: adminHash,
  },
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

let stopping = false;
function cleanup(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  if (child.exitCode === null) child.kill();
  rmSync(root, { recursive: true, force: true });
  process.exit(exitCode);
}

process.on('SIGINT', () => cleanup(130));
process.on('SIGTERM', () => cleanup(143));
child.once('exit', code => cleanup(code ?? 1));
