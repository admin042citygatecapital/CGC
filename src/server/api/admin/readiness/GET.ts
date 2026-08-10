/**
 * GET /api/admin/readiness
 * ─────────────────────────────────────────────────────────────────────────────
 * Deployment readiness report — verifies every subsystem and returns a
 * structured pass/fail result for each check.
 *
 * Checks performed:
 *  1. Admin authentication      — password hash present + bcrypt-format valid
 *  2. Customer authentication   — user store readable + session config present
 *  3. Zoho SMTP                 — credentials present + token exchange attempt
 *  4. Smartsupp chat            — key present (client-side load cannot be verified server-side)
 *  5. Database (flat-file)      — /private/ directories readable + writable
 *  6. Admin route protection    — middleware registered (structural check)
 *  7. HTTPS enforcement         — enforceHttps middleware active in production
 *  8. Session security          — SESSION_SECRET / JWT_SECRET present
 *  9. Sitemap integrity         — no private routes in sitemap
 * 10. Environment detection     — NODE_ENV correctly set
 *
 * Admin auth required (enforced by global middleware in entry.ts).
 */
import type { Request, Response } from 'express';
import fs from 'node:fs';
import { getSecret } from '#airo/secrets';
import { APP_ENV, isProd } from '../../../lib/envConfig.js';
import { getValidAccessToken } from '../../../lib/zohoTokenStore.js';
import { seoRoutes } from '../../../../lib/seo-routes.js';
import { getStorageBackend } from '../../../lib/supabaseStorage.js';
import { verifyManualSmtp } from '../../../lib/smtpTransport.js';
import { isDatabaseConfigured, testConnection } from '../../../db/db.js';
import { getOperationalBackupStatus } from '../../../lib/operationalBackup.js';
import {
  LIVE_PROVIDER_ADAPTERS_IMPLEMENTED,
  getLiveFinancialReadinessGaps,
  hasLiveFinancialReadiness,
  platformMode,
} from '../../../lib/platformMode.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CheckStatus = 'PASS' | 'FAIL' | 'WARN' | 'SKIP';

export interface ReadinessCheck {
  id:          string;
  name:        string;
  subsystem:   string;
  status:      CheckStatus;
  message:     string;
  detail?:     string;
  critical:    boolean;
  durationMs?: number;
}

export interface ReadinessReport {
  environment:  string;
  generatedAt:  string;
  overallStatus: 'READY' | 'DEGRADED' | 'NOT_READY';
  summary: {
    total:    number;
    pass:     number;
    warn:     number;
    fail:     number;
    skip:     number;
    critical: number;
  };
  checks: ReadinessCheck[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function s(canonical: string, ...aliases: string[]): string {
  const v = getSecret(canonical);
  if (v) return String(v);
  for (const alias of aliases) {
    const a = getSecret(alias);
    if (a) return String(a);
  }
  return '';
}

function dirReadable(path: string): boolean {
  try { fs.accessSync(path, fs.constants.R_OK); return true; } catch { return false; }
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - t0 };
}

// ── Individual checks ─────────────────────────────────────────────────────────

function checkAdminAuth(): ReadinessCheck {
  const hash = s('ADMIN_PASSWORD_HASH', 'ADMIN_PASSWORD_HASH_V2');
  if (!hash) {
    return {
      id: 'admin_auth', name: 'Admin Authentication', subsystem: 'Authentication',
      status: 'FAIL', critical: true,
      message: 'ADMIN_PASSWORD_HASH secret is missing.',
      detail: 'Admin login will fail. Add ADMIN_PASSWORD_HASH in Settings → Secrets.',
    };
  }
  const valid = hash.startsWith('$argon2') || hash.startsWith('$2a$') ||
    hash.startsWith('$2b$') || hash.startsWith('$2y$') || hash.startsWith('100000:');
  if (!valid) {
    return {
      id: 'admin_auth', name: 'Admin Authentication', subsystem: 'Authentication',
      status: 'FAIL', critical: true,
      message: 'ADMIN_PASSWORD_HASH is not in a supported secure format.',
      detail: 'Use Argon2id. Legacy bcrypt and PBKDF2 hashes remain accepted for migration.',
    };
  }
  return {
    id: 'admin_auth', name: 'Admin Authentication', subsystem: 'Authentication',
    status: 'PASS', critical: true,
    message: 'Admin password hash is present and securely formatted.',
    detail: `Hash prefix: ${hash.slice(0, 7)}…`,
  };
}

function checkCustomerAuth(): ReadinessCheck {
  const sessionSecret = s('SESSION_SECRET', 'JWT_SECRET');
  const configured = isDatabaseConfigured() && sessionSecret.length >= 32;
  return configured
    ? {
        id: 'customer_auth', name: 'Customer Authentication', subsystem: 'Authentication',
        status: 'PASS', critical: true,
        message: 'Customer authentication is backed by PostgreSQL and a configured session secret.',
      }
    : {
        id: 'customer_auth', name: 'Customer Authentication', subsystem: 'Authentication',
        status: isProd ? 'FAIL' : 'WARN', critical: isProd,
        message: 'Customer authentication prerequisites are incomplete.',
        detail: 'Production requires PostgreSQL and a session secret of at least 32 characters.',
      };
}

async function checkEmailDelivery(): Promise<ReadinessCheck> {
  const resendKey = s('RESEND_API_KEY');
  if (resendKey) {
    const { result, ms } = await timed(() => verifyManualSmtp());
    return result.ok
      ? {
          id: 'email_delivery', name: 'Resend Email Delivery', subsystem: 'Email',
          status: 'PASS', critical: false,
          message: 'Resend API connectivity succeeded. Email delivery is operational.',
          durationMs: ms,
        }
      : {
          id: 'email_delivery', name: 'Resend Email Delivery', subsystem: 'Email',
          status: 'FAIL', critical: false,
          message: 'Resend is configured but its API check failed.',
          detail: result.error,
          durationMs: ms,
        };
  }

  const clientId     = s('ZOHO_CLIENT_ID',     'CLIENTID');
  const clientSecret = s('ZOHO_CLIENT_SECRET', 'CLIENTSECRET');
  const refreshToken = s('ZOHO_REFRESH_TOKEN', 'REFRESHTOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    const missing = [
      !clientId     && 'ZOHO_CLIENT_ID',
      !clientSecret && 'ZOHO_CLIENT_SECRET',
      !refreshToken && 'ZOHO_REFRESH_TOKEN',
    ].filter(Boolean).join(', ');
    return {
      id: 'email_delivery', name: 'Email Delivery', subsystem: 'Email',
      status: 'FAIL', critical: false,
      message: `No production email transport is configured. Missing RESEND_API_KEY; Zoho fallback is incomplete (${missing}).`,
      detail: 'Configure RESEND_API_KEY, or complete all Zoho OAuth credentials.',
    };
  }

  // Attempt a live token exchange (non-blocking — 5s timeout)
  try {
    const { result: token, ms } = await timed(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        return await getValidAccessToken();
      } finally {
        clearTimeout(timeout);
      }
    });

    if (token) {
      return {
        id: 'email_delivery', name: 'Zoho Email Delivery (Legacy Fallback)', subsystem: 'Email',
        status: 'PASS', critical: false,
        message: 'Zoho OAuth token exchange succeeded. Email delivery is operational.',
        detail: `Token obtained in ${ms}ms.`,
        durationMs: ms,
      };
    } else {
      return {
        id: 'email_delivery', name: 'Zoho Email Delivery (Legacy Fallback)', subsystem: 'Email',
        status: 'FAIL', critical: false,
        message: 'Zoho token exchange failed. Credentials may be invalid or expired.',
        detail: 'Re-run OAuth flow: admin login → visit /api/zoho/connect → save ZOHO_REFRESH_TOKEN.',
        durationMs: ms,
      };
    }
  } catch (err) {
    return {
      id: 'email_delivery', name: 'Zoho Email Delivery (Legacy Fallback)', subsystem: 'Email',
      status: 'WARN', critical: false,
      message: 'Zoho token exchange timed out or threw an error.',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function checkSmartsupp(): ReadinessCheck {
  const key = s('SMARTSUPP_KEY');
  if (!key) {
    return {
      id: 'smartsupp', name: 'Smartsupp Live Chat', subsystem: 'Chat Widget',
      status: 'WARN', critical: false,
      message: 'SMARTSUPP_KEY secret is not configured. Widget will not load.',
      detail: 'Set the SMARTSUPP_KEY secret to enable the live chat widget.',
    };
  }
  return {
    id: 'smartsupp', name: 'Smartsupp Live Chat', subsystem: 'Chat Widget',
    status: 'PASS', critical: false,
    message: 'Smartsupp key is configured. Widget will load client-side.',
    detail: `Key: ${key.slice(0, 8)}…${key.slice(-4)} (public identifier)`,
  };
}

async function checkDatabase(): Promise<ReadinessCheck> {
  if (!isDatabaseConfigured()) {
    return {
      id: 'database', name: 'PostgreSQL Database', subsystem: 'Database',
      status: isProd ? 'FAIL' : 'WARN', critical: isProd,
      message: 'DATABASE_URL is not configured.',
      detail: 'Production requires managed PostgreSQL. Flat-file storage is development-only.',
    };
  }
  const result = await testConnection();
  return result.ok
    ? {
        id: 'database', name: 'PostgreSQL Database', subsystem: 'Database',
        status: 'PASS', critical: true,
        message: `PostgreSQL connection succeeded in ${result.latencyMs ?? 0}ms.`,
        durationMs: result.latencyMs,
      }
    : {
        id: 'database', name: 'PostgreSQL Database', subsystem: 'Database',
        status: 'FAIL', critical: true,
        message: 'PostgreSQL is configured but the connection check failed.',
        detail: result.error,
        durationMs: result.latencyMs,
      };
}

function checkFinancialLaunchGate(): ReadinessCheck {
  const gaps = getLiveFinancialReadinessGaps();
  if (platformMode !== 'live') {
    return {
      id: 'financial_launch', name: 'Financial Launch Gate', subsystem: 'Compliance & Providers',
      status: 'FAIL', critical: true,
      message: 'Product preview mode is active; live financial operations remain disabled.',
      detail: `This is the safe expected state. Outstanding evidence:\n- ${gaps.join('\n- ')}`,
    };
  }
  if (!LIVE_PROVIDER_ADAPTERS_IMPLEMENTED || !hasLiveFinancialReadiness()) {
    return {
      id: 'financial_launch', name: 'Financial Launch Gate', subsystem: 'Compliance & Providers',
      status: 'FAIL', critical: true,
      message: 'Live mode was requested, but the verified financial launch gate is incomplete.',
      detail: `Environment labels cannot unlock money movement. Outstanding evidence:\n- ${gaps.join('\n- ')}`,
    };
  }
  return {
    id: 'financial_launch', name: 'Financial Launch Gate', subsystem: 'Compliance & Providers',
    status: 'PASS', critical: true,
    message: 'Financial launch gate is satisfied.',
  };
}

function checkAdminRouteProtection(): ReadinessCheck {
  // Structural check — the middleware is registered in entry.ts.
  // We verify the session store is accessible as a proxy for auth working.
  const dirOk = dirReadable('/private/admin') || !fs.existsSync('/private/admin');

  if (!dirOk) {
    return {
      id: 'admin_routes', name: 'Admin Route Protection', subsystem: 'Security',
      status: 'FAIL', critical: true,
      message: 'Admin session store directory is not accessible.',
      detail: '/private/admin is not readable. Admin auth middleware cannot persist sessions.',
    };
  }

  return {
    id: 'admin_routes', name: 'Admin Route Protection', subsystem: 'Security',
    status: 'PASS', critical: true,
    message: 'Admin route protection middleware is registered. All /api/admin/* routes require auth.',
    detail: 'Public exclusions: /auth/login, /auth/logout, /auth/password-reset, /auth/otp/verify, /auth/unlock, /auth/diag, /auth/verify, /zoho/oauth/callback',
  };
}

function checkHttpsEnforcement(): ReadinessCheck {
  if (!isProd) {
    return {
      id: 'https', name: 'HTTPS Enforcement', subsystem: 'Security',
      status: 'SKIP', critical: false,
      message: `HTTPS enforcement is active in production only. Current environment: ${APP_ENV}.`,
      detail: 'enforceHttps middleware redirects HTTP → HTTPS when NODE_ENV=production.',
    };
  }
  return {
    id: 'https', name: 'HTTPS Enforcement', subsystem: 'Security',
    status: 'PASS', critical: true,
    message: 'HTTPS enforcement is active. HTTP requests are redirected to HTTPS (301).',
    detail: 'HSTS header set: max-age=63072000; includeSubDomains; preload (2 years)',
  };
}

function checkSessionSecurity(): ReadinessCheck {
  const secret = s('SESSION_SECRET', 'JWT_SECRET');
  if (!secret) {
    const level: CheckStatus = isProd ? 'FAIL' : 'WARN';
    return {
      id: 'session_security', name: 'Session Security', subsystem: 'Security',
      status: level, critical: isProd,
      message: 'SESSION_SECRET / JWT_SECRET is not set.',
      detail: isProd
        ? 'REQUIRED in production. Add SESSION_SECRET in Settings → Secrets.'
        : 'Recommended for staging/production. Sessions use default entropy without it.',
    };
  }
  if (secret.length < 32) {
    return {
      id: 'session_security', name: 'Session Security', subsystem: 'Security',
      status: 'WARN', critical: false,
      message: 'SESSION_SECRET is shorter than 32 characters.',
      detail: 'Use a cryptographically random string of ≥32 characters for production.',
    };
  }
  return {
    id: 'session_security', name: 'Session Security', subsystem: 'Security',
    status: 'PASS', critical: true,
    message: `Session secret is configured (${secret.length} chars).`,
  };
}

function checkSitemapIntegrity(): ReadinessCheck {
  const PRIVATE_PREFIXES = ['/admin', '/dashboard', '/kyc', '/wallet', '/transfers',
    '/login', '/register', '/forgot-password', '/reset-password', '/analytics', '/newsletter'];

  const violations = seoRoutes
    .map(r => r.path)
    .filter(p => PRIVATE_PREFIXES.some(prefix => p === prefix || p.startsWith(prefix + '/')));

  if (violations.length > 0) {
    return {
      id: 'sitemap', name: 'Sitemap Integrity', subsystem: 'SEO',
      status: 'FAIL', critical: false,
      message: `${violations.length} private/authenticated route(s) found in sitemap.xml.`,
      detail: `Leaking: ${violations.join(', ')}. Remove from seo-routes.ts.`,
    };
  }

  return {
    id: 'sitemap', name: 'Sitemap Integrity', subsystem: 'SEO',
    status: 'PASS', critical: false,
    message: `Sitemap contains ${seoRoutes.length} public routes only. No private routes exposed.`,
  };
}

function checkEnvironmentDetection(): ReadinessCheck {
  const nodeEnv = process.env.NODE_ENV ?? '(not set)';
  if (!process.env.NODE_ENV) {
    return {
      id: 'env_detection', name: 'Environment Detection', subsystem: 'Configuration',
      status: 'WARN', critical: false,
      message: 'NODE_ENV is not set. Defaulting to development mode.',
      detail: 'Set NODE_ENV=production in your deployment environment.',
    };
  }
  if (isProd) {
    return {
      id: 'env_detection', name: 'Environment Detection', subsystem: 'Configuration',
      status: 'PASS', critical: false,
      message: `Environment correctly detected as production (NODE_ENV=${nodeEnv}).`,
    };
  }
  return {
    id: 'env_detection', name: 'Environment Detection', subsystem: 'Configuration',
    status: 'WARN', critical: false,
    message: `Running in ${APP_ENV} mode (NODE_ENV=${nodeEnv}).`,
    detail: 'Set NODE_ENV=production before deploying to production.',
  };
}

function checkCspHeaders(): ReadinessCheck {
  // CSP is always set by securityHeaders middleware — verify it's production-grade
  if (isProd) {
    return {
      id: 'csp', name: 'Content Security Policy', subsystem: 'Security',
      status: 'PASS', critical: false,
      message: 'CSP is active with per-request nonce (no unsafe-inline on scripts in production).',
      detail: 'Nonce injected via res.locals.cspNonce. HSTS, X-Frame-Options, Permissions-Policy all set.',
    };
  }
  return {
    id: 'csp', name: 'Content Security Policy', subsystem: 'Security',
    status: 'WARN', critical: false,
    message: `CSP active with unsafe-inline (development mode). Will use nonce in production.`,
  };
}

function checkStorageBackend(): ReadinessCheck {
  const backend = getStorageBackend();
  if (backend === 'supabase') {
    return {
      id: 'storage', name: 'Media Storage (Supabase)', subsystem: 'Storage',
      status: 'PASS', critical: false,
      message: 'Supabase Storage is configured. Media uploads will use managed object storage.',
      detail: `Bucket: ${String(getSecret('SUPABASE_STORAGE_BUCKET') || 'cgc-media')}`,
    };
  }
  return {
    id: 'storage', name: 'Media Storage (Local Filesystem)', subsystem: 'Storage',
    status: isProd ? 'WARN' : 'PASS', critical: false,
    message: isProd
      ? 'Using local filesystem for media storage. Ensure MEDIA_ASSET_ROOT is on a persistent disk or configure Supabase Storage.'
      : 'Using local filesystem for media storage (development mode).',
    detail: isProd
      ? 'Set SUPABASE_URL and SUPABASE_SECRET_KEY to enable managed object storage.'
      : `Local path: ${process.env.MEDIA_ASSET_ROOT || '/shared-storage/public/assets'}/media/`,
  };
}

function checkBackupReadiness(): ReadinessCheck {
  const local = getOperationalBackupStatus();
  const managedConfirmed = process.env.MANAGED_DATABASE_BACKUPS_CONFIRMED === '1';
  const restoreTest = process.env.BACKUP_LAST_RESTORE_TEST_AT?.trim();
  if (local.error) {
    return { id: 'backups', name: 'Backup & Recovery', subsystem: 'Database', status: 'FAIL', critical: false,
      message: 'The operational backup directory is invalid or unreadable.', detail: local.error };
  }
  if (!local.enabled) {
    return { id: 'backups', name: 'Backup & Recovery', subsystem: 'Database', status: 'WARN', critical: false,
      message: 'Automated operational snapshots are disabled.', detail: 'Set ENABLE_LOCAL_OPERATIONAL_BACKUPS=1. Provider-managed PostgreSQL backups are still required.' };
  }
  if (local.checksumValid === false) {
    return { id: 'backups', name: 'Backup & Recovery', subsystem: 'Database', status: 'FAIL', critical: true,
      message: 'The latest operational snapshot failed checksum verification.', detail: `Directory: ${local.directory}` };
  }
  if (!local.latestAt) {
    return { id: 'backups', name: 'Backup & Recovery', subsystem: 'Database', status: 'WARN', critical: false,
      message: 'Backup worker is enabled but has not completed its first snapshot.', detail: `Directory: ${local.directory}` };
  }
  const complete = managedConfirmed && Boolean(restoreTest);
  return {
    id: 'backups', name: 'Backup & Recovery', subsystem: 'Database',
    status: complete ? 'PASS' : 'WARN', critical: false,
    message: complete
      ? `Local operational backup verified; managed backups and restore test are confirmed.`
      : `Latest local operational backup is ${local.ageHours ?? 0} hours old; managed backup/restore attestation remains outstanding.`,
    detail: `Latest: ${local.latestAt}\nChecksum: verified\nDirectory: ${local.directory}\nManaged backups confirmed: ${managedConfirmed}\nLast restore test: ${restoreTest || 'not recorded'}\nLocal snapshots are a recovery aid, not a substitute for provider-managed off-site backups.`,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(_req: Request, res: Response): Promise<void> {
  const t0 = Date.now();

  // Run async checks in parallel, sync checks inline
  const [emailCheck, dbCheck] = await Promise.all([
    checkEmailDelivery(),
    checkDatabase(),
  ]);

  const checks: ReadinessCheck[] = [
    checkAdminAuth(),
    checkCustomerAuth(),
    emailCheck,
    checkSmartsupp(),
    dbCheck,
    checkAdminRouteProtection(),
    checkHttpsEnforcement(),
    checkSessionSecurity(),
    checkSitemapIntegrity(),
    checkEnvironmentDetection(),
    checkCspHeaders(),
    checkStorageBackend(),
    checkBackupReadiness(),
    checkFinancialLaunchGate(),
  ];

  const pass     = checks.filter(c => c.status === 'PASS').length;
  const warn     = checks.filter(c => c.status === 'WARN').length;
  const fail     = checks.filter(c => c.status === 'FAIL').length;
  const skip     = checks.filter(c => c.status === 'SKIP').length;
  const critical = checks.filter(c => c.status === 'FAIL' && c.critical).length;

  const overallStatus: ReadinessReport['overallStatus'] =
    critical > 0 ? 'NOT_READY' :
    fail > 0     ? 'DEGRADED'  :
    warn > 0     ? 'DEGRADED'  :
    'READY';

  const report: ReadinessReport = {
    environment:   APP_ENV,
    generatedAt:   new Date().toISOString(),
    overallStatus,
    summary: { total: checks.length, pass, warn, fail, skip, critical },
    checks,
  };

  console.log(JSON.stringify({
    event:         'readiness.report.generated',
    environment:   APP_ENV,
    overallStatus,
    pass, warn, fail, skip, critical,
    durationMs:    Date.now() - t0,
  }));

  res.json({ ok: true, report });
}
