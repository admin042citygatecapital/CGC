/**
 * envConfig.ts — Typed, auto-detecting environment configuration
 * ──────────────────────────────────────────────────────────────
 * Single source of truth for all runtime configuration.
 *
 * Environment detection order:
 *   1. NODE_ENV === 'production'  → production
 *   2. NODE_ENV === 'staging'     → staging
 *   3. STAGING=true               → staging
 *   4. Everything else            → development
 *
 * All secrets are resolved via getSecret() — never from process.env directly.
 * Non-secret config (URLs, ports, feature flags) reads process.env.
 *
 * Usage:
 *   import { env, isDev, isProd, isStaging } from './envConfig.js';
 *   if (isProd) { ... }
 *   const key = env.zoho.clientId;
 */

import { getSecret } from '#runtime/secrets';
import { pathToFileURL } from 'node:url';
import { privateDataRoot } from './storagePaths.js';

// ── Environment detection ─────────────────────────────────────────────────────

export type AppEnv = 'development' | 'staging' | 'production';

function detectEnv(): AppEnv {
  const nodeEnv = (process.env.NODE_ENV ?? '').toLowerCase();
  if (nodeEnv === 'production') return 'production';
  if (nodeEnv === 'staging')    return 'staging';
  if (process.env.STAGING === 'true' || process.env.STAGING === '1') return 'staging';
  return 'development';
}

export const APP_ENV: AppEnv = detectEnv();
export const isProd    = APP_ENV === 'production';
export const isStaging = APP_ENV === 'staging';
export const isDev     = APP_ENV === 'development';

// ── Secret resolvers ──────────────────────────────────────────────────────────
// Each resolver reads from the canonical secret name first, then falls back
// to legacy aliases so existing deployments keep working without re-entering keys.

function s(canonical: string, ...aliases: string[]): string {
  const v = getSecret(canonical);
  if (v) return String(v);
  for (const alias of aliases) {
    const a = getSecret(alias);
    if (a) return String(a);
  }
  return '';
}

// ── Typed config object ───────────────────────────────────────────────────────

export const env = {
  // ── Runtime environment ───────────────────────────────────────────────────
  nodeEnv: APP_ENV,
  isProd,
  isStaging,
  isDev,

  // ── Application URLs ──────────────────────────────────────────────────────
  appUrl:   process.env.APP_URL   || process.env.PUBLIC_URL  || process.env.SITE_URL  || 'https://citygate.capital',
  adminUrl: process.env.ADMIN_URL || (process.env.APP_URL ? `${process.env.APP_URL}/admin` : 'https://citygate.capital/admin'),
  apiBase:  process.env.API_BASE_URL || '/api',

  // ── Admin credentials ─────────────────────────────────────────────────────
  admin: {
    email:        s('ADMIN_EMAIL') || 'admin@citygate.capital',
    passwordHash: s('ADMIN_PASSWORD_HASH', 'ADMIN_PASSWORD_HASH_V2'),
  },

  // ── Session / JWT ─────────────────────────────────────────────────────────
  session: {
    secret:                  s('SESSION_SECRET', 'JWT_SECRET'),
    jwtSecret:               s('JWT_SECRET', 'SESSION_SECRET'),
    timeoutMinutes:          parseInt(process.env.SESSION_TIMEOUT_MINUTES          ?? '60',  10),
    maxHours:                parseInt(process.env.SESSION_MAX_HOURS                ?? '8',   10),
    customerTimeoutMinutes:  parseInt(process.env.SESSION_CUSTOMER_TIMEOUT_MINUTES ?? '60',  10),
    customerMaxHours:        parseInt(process.env.SESSION_CUSTOMER_MAX_HOURS       ?? '8',   10),
  },

  // ── Database ──────────────────────────────────────────────────────────────
  database: {
    // DATABASE_URL is the single PostgreSQL runtime contract.
    // All are standard PostgreSQL connection strings — Drizzle ORM works with any.
    url:      s('DATABASE_URL') || pathToFileURL(privateDataRoot).href,
    basePath: privateDataRoot,
  },

  // ── Zoho Mail OAuth ───────────────────────────────────────────────────────
  zoho: {
    clientId:     s('ZOHO_CLIENT_ID',     'CLIENTID'),
    clientSecret: s('ZOHO_CLIENT_SECRET', 'CLIENTSECRET'),
    refreshToken: s('ZOHO_REFRESH_TOKEN', 'REFRESHTOKEN'),
    accountId:    s('ZOHO_ACCOUNT_ID',    'USERID') || '3239949000000008002',
    accessToken:  s('ZOHO_ACCESS_TOKEN'),
  },

  // ── Mail (manual SMTP fallback) ───────────────────────────────────────────
  mail: {
    host:        s('MAIL_HOST')         || process.env.MAIL_HOST        || 'smtp.zoho.com',
    port:        parseInt(s('MAIL_PORT') || process.env.MAIL_PORT || '465', 10),
    username:    s('MAIL_USERNAME')     || process.env.MAIL_USERNAME    || 'info@citygate.capital',
    password:    s('MAIL_PASSWORD'),
    fromAddress: s('MAIL_FROM_ADDRESS') || process.env.MAIL_FROM_ADDRESS || 'info@citygate.capital',
    fromName:    s('MAIL_FROM_NAME')    || process.env.MAIL_FROM_NAME    || 'City Gate Capital',
  },

  // ── Supabase ──────────────────────────────────────────────────────────────
  supabase: {
    url:            s('SUPABASE_URL'),
    publishableKey: s('SUPABASE_PUBLISHABLE_KEY'),
    secretKey:      s('SUPABASE_SECRET_KEY'),
    jwksUrl:        s('SUPABASE_JWKS_URL'),
    storageBucket:  s('SUPABASE_STORAGE_BUCKET') || 'cgc-media',
  },

  // ── Smartsupp live chat ───────────────────────────────────────────────────
  // The Smartsupp key is a PUBLIC widget identifier (not a secret — it is
  // embedded in client-side JS and visible in the browser). Stored as a
  // secret so it is not hard-coded in source.
  smartsupp: {
    key: s('SMARTSUPP_KEY'),
  },

  // ── SEO / Webmaster verification ─────────────────────────────────────────
  seo: {
    googleSiteVerification: s('GOOGLE_SITE_VERIFICATION'),
  },

  // ── Security ──────────────────────────────────────────────────────────────
  security: {
    adminUnlockKey:    s('ADMIN_UNLOCK_KEY'),
    trustedDeviceDays: parseInt(process.env.TRUSTED_DEVICE_DAYS ?? '30', 10),
    otpTtlSeconds:     parseInt(process.env.OTP_TTL_SECONDS      ?? '60', 10),
    // 64-char hex string (32 bytes) used to AES-256-GCM encrypt card PANs & CVVs at rest.
    // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    // REQUIRED in production — if absent, a dev-only fallback key is used (NOT safe for prod).
    cardEncryptionKey: s('CARD_ENCRYPTION_KEY'),
  },
} as const;

// ── Type export ───────────────────────────────────────────────────────────────
export type EnvConfig = typeof env;
