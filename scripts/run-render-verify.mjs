import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Render injects production connections and feature flags into build commands.
// Verification must never run test fixtures against production services.
const isolatedEnv = { ...process.env };
for (const name of [
  'DATABASE_URL',
  'PRIVATE_DATA_ROOT',
  'SESSION_SECRET',
  'CARD_ENCRYPTION_KEY',
  'ADMIN_PASSWORD',
  'ADMIN_PASSWORD_HASH',
  'RESEND_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'ZOHO_CLIENT_SECRET',
  'ZOHO_REFRESH_TOKEN',
  'PLAID_SECRET',
  'ENFORCE_PREVIEW_LOCKS',
]) {
  delete isolatedEnv[name];
}

const isolatedDataRoot = mkdtempSync(path.join(tmpdir(), 'cgc-render-verify-'));

Object.assign(isolatedEnv, {
  NODE_ENV: 'test',
  PLATFORM_MODE: 'preview',
  VITE_PLATFORM_MODE: 'preview',
  ENABLE_FINANCIAL_OPERATIONS: '0',
  ENABLE_PAPER_TRADING: '0',
  ALLOW_PUBLIC_REGISTRATION: '0',
  VITE_ALLOW_PUBLIC_REGISTRATION: '0',
  PUBLIC_SITE_PUBLISHED: '0',
  VITE_PUBLIC_SITE_PUBLISHED: '0',
  PRIVATE_DATA_ROOT: isolatedDataRoot,
  MEDIA_ASSET_ROOT: path.join(isolatedDataRoot, 'public-assets'),
  BACKUP_DIRECTORY: path.join(isolatedDataRoot, 'backups'),
});

const npmExecPath = process.env.npm_execpath;
if (!npmExecPath) throw new Error('npm_execpath is required to run the isolated Render verifier.');

let result;
try {
  result = spawnSync(process.execPath, [npmExecPath, 'run', 'verify:checks'], {
    env: isolatedEnv,
    stdio: 'inherit',
    shell: false,
  });
} finally {
  rmSync(isolatedDataRoot, { recursive: true, force: true });
}

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
