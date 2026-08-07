/**
 * envValidator.ts — Startup environment variable validation
 * ──────────────────────────────────────────────────────────
 * Validates every required secret / env var at server startup.
 * On missing CRITICAL variables: logs a clear error and exits(1).
 * On missing WARNING variables: logs a warning and continues.
 *
 * Call validateEnvAtStartup() once at the top of entry.ts before
 * any route handlers are registered.
 *
 * Also exports buildEnvReport() for the /api/admin/env-report endpoint.
 */

import { getSecret } from '#airo/secrets';
import { APP_ENV, isProd, isStaging } from './envConfig.js';

// ── Variable registry ─────────────────────────────────────────────────────────

export type SecretLevel = 'CRITICAL' | 'WARNING' | 'INFO';
export type SecretStatus = 'PRESENT' | 'MISSING' | 'DEFAULT' | 'INVALID';

export interface EnvVarSpec {
  name:        string;
  aliases?:    string[];
  level:       SecretLevel;
  service:     string;
  description: string;
  /** If true, the value is a public identifier (not a secret) */
  isPublic?:   boolean;
  /** Default value used when not set (INFO level only) */
  defaultVal?: string;
  /** Returns a safe, non-secret error message when a supplied value is invalid. */
  validate?: (value: string) => string | null;
}

function validateBcryptHash(value: string): string | null {
  return /^\$2[aby]\$1[012]\$[./A-Za-z0-9]{53}$/.test(value)
    ? null
    : 'Must be a valid bcrypt hash with cost 10-12.';
}

function validateSessionSecret(value: string): string | null {
  return value.length >= 32 ? null : 'Must contain at least 32 characters.';
}

function validatePostgresUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'postgres:' || url.protocol === 'postgresql:'
      ? null
      : 'Must use a postgres:// or postgresql:// URL.';
  } catch {
    return 'Must be a valid PostgreSQL connection URL.';
  }
}

function validateAppUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (isProd && url.protocol !== 'https:') return 'Production APP_URL must use HTTPS.';
    return ['http:', 'https:'].includes(url.protocol) ? null : 'Must use an HTTP(S) URL.';
  } catch {
    return 'Must be a valid absolute URL.';
  }
}

function validateCardKey(value: string): string | null {
  return /^[0-9a-fA-F]{64}$/.test(value)
    ? null
    : 'Must be exactly 64 hexadecimal characters.';
}

const REGISTRY: EnvVarSpec[] = [
  // ── Admin auth ─────────────────────────────────────────────────────────────
  {
    name:        'ADMIN_PASSWORD_HASH',
    aliases:     ['ADMIN_PASSWORD_HASH_V2'],
    level:       'CRITICAL',
    service:     'Admin Authentication',
    validate:     validateBcryptHash,
    description: 'bcrypt hash (cost 12) of the admin password. Generate with: node -e "const b=require(\'bcryptjs\'); console.log(b.hashSync(\'PASS\',12))"',
  },
  {
    name:        'ADMIN_EMAIL',
    level:       'INFO',
    service:     'Admin Authentication',
    description: 'Admin login email address',
    isPublic:    true,
    defaultVal:  'admin@citygate.capital',
  },

  // ── Session security ───────────────────────────────────────────────────────
  {
    name:        'SESSION_SECRET',
    aliases:     ['JWT_SECRET'],
    level:       isProd || isStaging ? 'CRITICAL' : 'WARNING',
    service:     'Session Management',
    validate:     validateSessionSecret,
    description: 'Secret key for signing session tokens. Must be ≥32 random characters in production.',
  },
  {
    name:        'JWT_SECRET',
    aliases:     ['SESSION_SECRET'],
    level:       'WARNING',
    service:     'Session Management / JWT',
    validate:     validateSessionSecret,
    description: 'JWT signing secret (alias for SESSION_SECRET)',
  },

  // ── Zoho Mail OAuth ────────────────────────────────────────────────────────
  {
    name:        'ZOHO_CLIENT_ID',
    aliases:     ['CLIENTID'],
    level:       'WARNING',
    service:     'Zoho Mail / Email Delivery',
    description: 'Zoho OAuth Client ID from accounts.zoho.com/developerconsole',
    isPublic:    true,
  },
  {
    name:        'ZOHO_CLIENT_SECRET',
    aliases:     ['CLIENTSECRET'],
    level:       'WARNING',
    service:     'Zoho Mail / Email Delivery',
    description: 'Zoho OAuth Client Secret from accounts.zoho.com/developerconsole',
  },
  {
    name:        'ZOHO_REFRESH_TOKEN',
    aliases:     ['REFRESHTOKEN'],
    level:       'WARNING',
    service:     'Zoho Mail / Email Delivery',
    description: 'Zoho OAuth Refresh Token. Obtain by visiting /api/zoho/connect as admin.',
  },
  {
    name:        'ZOHO_ACCOUNT_ID',
    aliases:     ['USERID'],
    level:       'INFO',
    service:     'Zoho Mail / Email Delivery',
    description: 'Zoho Mail account ID (numeric). Defaults to 3239949000000008002.',
    isPublic:    true,
    defaultVal:  '3239949000000008002',
  },

  // ── Manual SMTP fallback ───────────────────────────────────────────────────
  {
    name:        'MAIL_PASSWORD',
    level:       'INFO',
    service:     'Manual SMTP (fallback)',
    description: 'SMTP password for manual mode. Only required if Zoho OAuth is not configured.',
  },

  // ── Database ───────────────────────────────────────────────────────────────
  {
    name:        'DATABASE_URL',
    aliases:     ['NEON_CONNECTION_STRING', 'SUPABASE_DB_URL'],
    level:       isProd ? 'CRITICAL' : 'INFO',
    service:     'Database',
    validate:     validatePostgresUrl,
    description: 'PostgreSQL connection string. Production must use PostgreSQL; flat-file storage is development-only.',
  },

  // ── Application URLs ───────────────────────────────────────────────────────
  {
    name:        'APP_URL',
    level:       isProd ? 'CRITICAL' : 'INFO',
    service:     'Application / SEO',
    validate:     validateAppUrl,
    description: 'Public base URL of the application (e.g. https://citygate.capital)',
    isPublic:    true,
    defaultVal:  isProd ? undefined : 'http://127.0.0.1:5173',
  },
  {
    name:        'ADMIN_URL',
    level:       'INFO',
    service:     'Admin Panel',
    description: 'Public URL of the admin panel (defaults to APP_URL + /admin)',
    isPublic:    true,
  },
  {
    name:        'API_BASE_URL',
    level:       'INFO',
    service:     'API Client',
    description: 'Base URL for API calls (defaults to /api)',
    isPublic:    true,
    defaultVal:  '/api',
  },

  // ── Smartsupp ──────────────────────────────────────────────────────────────
  {
    name:        'SMARTSUPP_KEY',
    level:       'INFO',
    service:     'Smartsupp Live Chat',
    description: 'Smartsupp widget key (public identifier — visible in browser JS)',
    isPublic:    true,
    defaultVal:  undefined,
  },
  {
    name:        'SMARTSUPP_API_KEY',
    level:       'INFO',
    service:     'Smartsupp Live Chat',
    description: 'Smartsupp REST API key for server-side conversation management',
  },

  // ── Cloudflare ─────────────────────────────────────────────────────────────
  {
    name:        'CLOUDFLARE_API_TOKEN',
    level:       'INFO',
    service:     'Cloudflare CDN / Security',
    description: 'Cloudflare API token with Zone:Read and Cache Purge permissions',
  },
  {
    name:        'CLOUDFLARE_ZONE_ID',
    level:       'INFO',
    service:     'Cloudflare CDN / Security',
    description: 'Cloudflare Zone ID for citygate.capital (found in dashboard → Overview)',
    isPublic:    true,
  },

  // ── Google Analytics ───────────────────────────────────────────────────────
  {
    name:        'GA_MEASUREMENT_ID',
    level:       'INFO',
    service:     'Google Analytics 4',
    description: 'GA4 Measurement ID (format: G-XXXXXXXXXX)',
    isPublic:    true,
  },
  {
    name:        'GA_API_SECRET',
    level:       'INFO',
    service:     'Google Analytics 4',
    description: 'GA4 Measurement Protocol API secret for server-side event tracking',
  },

  // ── Google Tag Manager ─────────────────────────────────────────────────────
  {
    name:        'GTM_CONTAINER_ID',
    level:       'INFO',
    service:     'Google Tag Manager',
    description: 'GTM Container ID (format: GTM-XXXXXXX)',
    isPublic:    true,
  },

  // ── Google Maps ────────────────────────────────────────────────────────────
  {
    name:        'GOOGLE_MAPS_API_KEY',
    level:       'INFO',
    service:     'Google Maps',
    description: 'Google Maps JavaScript API key with Maps, Places, and Geocoding APIs enabled',
    isPublic:    true,
  },

  // ── Stripe ─────────────────────────────────────────────────────────────────
  {
    name:        'STRIPE_SECRET_KEY',
    level:       'INFO',
    service:     'Stripe Payments',
    description: 'Stripe secret key (sk_live_… or sk_test_…)',
  },
  {
    name:        'STRIPE_PUBLISHABLE_KEY',
    level:       'INFO',
    service:     'Stripe Payments',
    description: 'Stripe publishable key (pk_live_… or pk_test_…)',
    isPublic:    true,
  },
  {
    name:        'STRIPE_WEBHOOK_SECRET',
    level:       'INFO',
    service:     'Stripe Payments',
    description: 'Stripe webhook signing secret (whsec_…) for verifying webhook payloads',
  },

  // ── PayPal ─────────────────────────────────────────────────────────────────
  {
    name:        'PAYPAL_CLIENT_ID',
    level:       'INFO',
    service:     'PayPal Payments',
    description: 'PayPal REST API Client ID',
    isPublic:    true,
  },
  {
    name:        'PAYPAL_CLIENT_SECRET',
    level:       'INFO',
    service:     'PayPal Payments',
    description: 'PayPal REST API Client Secret',
  },

  // ── Twilio ─────────────────────────────────────────────────────────────────
  {
    name:        'TWILIO_ACCOUNT_SID',
    level:       'INFO',
    service:     'Twilio SMS / Voice',
    description: 'Twilio Account SID (ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)',
    isPublic:    true,
  },
  {
    name:        'TWILIO_AUTH_TOKEN',
    level:       'INFO',
    service:     'Twilio SMS / Voice',
    description: 'Twilio Auth Token',
  },
  {
    name:        'TWILIO_VERIFY_SID',
    level:       'INFO',
    service:     'Twilio SMS / Voice',
    description: 'Twilio Verify Service SID for OTP delivery (VAxxxxxxxx)',
    isPublic:    true,
  },

  // ── WhatsApp Business ──────────────────────────────────────────────────────
  {
    name:        'WHATSAPP_TOKEN',
    level:       'INFO',
    service:     'WhatsApp Business API',
    description: 'WhatsApp Business API access token from Meta Developer Console',
  },
  {
    name:        'WHATSAPP_PHONE_ID',
    level:       'INFO',
    service:     'WhatsApp Business API',
    description: 'WhatsApp Business Phone Number ID',
    isPublic:    true,
  },

  // ── Banking APIs ───────────────────────────────────────────────────────────
  {
    name:        'FLUTTERWAVE_SECRET_KEY',
    level:       'INFO',
    service:     'Banking APIs (Flutterwave)',
    description: 'Flutterwave secret key for NGN transfers and card issuance',
  },
  {
    name:        'PAYSTACK_SECRET_KEY',
    level:       'INFO',
    service:     'Banking APIs (Paystack)',
    description: 'Paystack secret key for NGN payments and transfers',
  },
  {
    name:        'BANKING_API_KEY',
    level:       'INFO',
    service:     'Banking APIs (Generic)',
    description: 'Generic banking API key for custom core banking integrations',
  },

  // ── Security ───────────────────────────────────────────────────────────────
  {
    name:        'CARD_ENCRYPTION_KEY',
    level:       isProd ? 'CRITICAL' : 'WARNING',
    service:     'Card Data Encryption',
    validate:     validateCardKey,
    description: 'A 64-character hexadecimal key used for AES-256-GCM encryption of card PAN and CVV data.',
  },
  {
    name:        'ADMIN_UNLOCK_KEY',
    level:       'INFO',
    service:     'Admin Emergency Unlock',
    description: 'Emergency unlock key for the /api/admin/auth/diag endpoint. Optional.',
  },
];

// ── Resolution helpers ────────────────────────────────────────────────────────

function resolveSecret(spec: EnvVarSpec): string {
  const v = getSecret(spec.name);
  if (v) return String(v);
  for (const alias of spec.aliases ?? []) {
    const a = getSecret(alias);
    if (a) return String(a);
  }
  // Also check process.env for non-secret config vars
  const e = process.env[spec.name];
  if (e) return e;
  return '';
}

function getStatus(spec: EnvVarSpec, value: string): SecretStatus {
  if (value) return spec.validate?.(value) ? 'INVALID' : 'PRESENT';
  if (spec.defaultVal) return 'DEFAULT';
  return 'MISSING';
}

function maskValue(value: string, isPublic: boolean): string {
  if (!value) return '';
  if (isPublic) return value;
  if (value.startsWith('$2')) return value.slice(0, 7) + '…[bcrypt]';
  if (value.length <= 8) return '***';
  return value.slice(0, 4) + '…' + value.slice(-4);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface EnvVarReport {
  name:        string;
  aliases:     string[];
  status:      SecretStatus;
  level:       SecretLevel;
  service:     string;
  description: string;
  isPublic:    boolean;
  maskedValue: string;
  defaultVal:  string;
  validationError: string;
}

export interface EnvReport {
  environment:  string;
  generatedAt:  string;
  summary: {
    total:    number;
    present:  number;
    defaults: number;
    missing:  number;
    critical: number;
    warnings: number;
  };
  variables: EnvVarReport[];
}

/** Build the full environment variable report (used by /api/admin/env-report) */
export function buildEnvReport(): EnvReport {
  const variables: EnvVarReport[] = REGISTRY.map(spec => {
    const value  = resolveSecret(spec);
    const status = getStatus(spec, value);
    return {
      name:        spec.name,
      aliases:     spec.aliases ?? [],
      status,
      level:       spec.level,
      service:     spec.service,
      description: spec.description,
      isPublic:    spec.isPublic ?? false,
      maskedValue: maskValue(value, spec.isPublic ?? false),
      defaultVal:  spec.defaultVal ?? '',
      validationError: value && spec.validate ? spec.validate(value) ?? '' : '',
    };
  });

  const present  = variables.filter(v => v.status === 'PRESENT').length;
  const defaults = variables.filter(v => v.status === 'DEFAULT').length;
  const missing  = variables.filter(v => v.status === 'MISSING').length;
  const critical = variables.filter(v => ['MISSING', 'INVALID'].includes(v.status) && v.level === 'CRITICAL').length;
  const warnings = variables.filter(v => ['MISSING', 'INVALID'].includes(v.status) && v.level === 'WARNING').length;

  return {
    environment: APP_ENV,
    generatedAt: new Date().toISOString(),
    summary: {
      total: variables.length,
      present,
      defaults,
      missing,
      critical,
      warnings,
    },
    variables,
  };
}

// ── Startup validation ────────────────────────────────────────────────────────

/**
 * Validates all required environment variables at server startup.
 *
 * - CRITICAL missing vars: logs error + calls process.exit(1)
 * - WARNING missing vars:  logs warning, continues
 * - INFO missing vars:     silent (defaults apply)
 *
 * Call once at the top of entry.ts before any route handlers.
 */
export function validateEnvAtStartup(): void {
  const report = buildEnvReport();

  console.log(JSON.stringify({
    event:       'env.validation.start',
    environment: report.environment,
    total:       report.summary.total,
    present:     report.summary.present,
    defaults:    report.summary.defaults,
    missing:     report.summary.missing,
  }));

  const criticalMissing: EnvVarReport[] = [];
  const warningMissing:  EnvVarReport[] = [];

  for (const v of report.variables) {
    if (v.status !== 'MISSING' && v.status !== 'INVALID') continue;
    if (v.level === 'CRITICAL') criticalMissing.push(v);
    if (v.level === 'WARNING')  warningMissing.push(v);
  }

  // Log warnings (non-fatal)
  for (const v of warningMissing) {
    console.warn(JSON.stringify({
      event:       'env.validation.warning',
      variable:    v.name,
      aliases:     v.aliases,
      service:     v.service,
      description: v.description,
      problem:     v.validationError || 'Value is missing.',
      action:      `Add ${v.name} in Settings → Secrets to enable ${v.service}.`,
    }));
  }

  // Log critical errors (fatal)
  if (criticalMissing.length > 0) {
    for (const v of criticalMissing) {
      console.error(JSON.stringify({
        event:       'env.validation.critical',
        variable:    v.name,
        aliases:     v.aliases,
        service:     v.service,
        description: v.description,
        problem:     v.validationError || 'Value is missing.',
        action:      `REQUIRED: Add ${v.name} in Settings → Secrets. ${v.description}`,
      }));
    }

    console.error(JSON.stringify({
      event:   'env.validation.fatal',
      message: `Server startup aborted: ${criticalMissing.length} critical environment variable(s) missing or invalid.`,
      invalid: criticalMissing.map(v => v.name),
    }));

    // In production: hard exit. In dev/staging: warn but continue so the
    // developer can still start the server and fix the issue.
    if (isProd) {
      process.exit(1);
    } else {
      console.warn(JSON.stringify({
        event:   'env.validation.dev-override',
        message: 'Critical variables missing but continuing in non-production mode. Fix before deploying.',
      }));
    }
    return;
  }

  console.log(JSON.stringify({
    event:       'env.validation.passed',
    environment: report.environment,
    present:     report.summary.present,
    warnings:    report.summary.warnings,
  }));
}
