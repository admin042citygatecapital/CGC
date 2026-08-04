/**
 * smtpConfigStore.ts — Persistent SMTP / email-mode configuration
 * ─────────────────────────────────────────────────────────────────
 * Stores admin-controlled SMTP settings in /private/smtp/config.json.
 * Supports two modes:
 *   oauth  — Zoho OAuth2 via REST API (primary, default)
 *   manual — Direct SMTP credentials (fallback)
 */

import { eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { config as configTable } from '../db/schema.js';

const CONFIG_KEY = 'smtp_config';

export type SmtpMode = 'oauth' | 'manual';

export interface SmtpConfig {
  mode: SmtpMode;
  host: string;
  port: number;
  username: string;
  password: string;          // stored encrypted-at-rest via admin; never logged
  senderEmail: string;
  senderName: string;
  encryption: 'ssl' | 'tls' | 'none';
  oauthClientId: string;
  oauthClientSecret: string;
  oauthRefreshToken: string;
  updatedAt: string;
  updatedBy: string;
}

const DEFAULTS: SmtpConfig = {
  mode:               'oauth',
  host:               'smtp.zoho.com',
  port:               465,
  username:           'info@citygate.capital',
  password:           '',
  senderEmail:        'info@citygate.capital',
  senderName:         'City Gate Capital',
  encryption:         'ssl',
  oauthClientId:      '',
  oauthClientSecret:  '',
  oauthRefreshToken:  '',
  updatedAt:          new Date().toISOString(),
  updatedBy:          'system',
};

// ── In-memory write-through cache ─────────────────────────────────────────────
let _cache: SmtpConfig | null = null;

export function loadSmtpConfig(): SmtpConfig {
  if (_cache) return { ..._cache };
  return { ...DEFAULTS };
}

export function saveSmtpConfig(patch: Partial<SmtpConfig>, updatedBy = 'admin'): SmtpConfig {
  const current = loadSmtpConfig();
  const next: SmtpConfig = { ...current, ...patch, updatedAt: new Date().toISOString(), updatedBy };
  _cache = next;
  persistSmtpConfig(next).catch(err =>
    console.error(JSON.stringify({ event: 'smtpConfigStore.write.failed', error: String(err) }))
  );
  return next;
}

async function persistSmtpConfig(cfg: SmtpConfig): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db.insert(configTable)
    .values({ key: CONFIG_KEY, value: cfg as unknown as Record<string, unknown>, updatedBy: cfg.updatedBy })
    .onConflictDoUpdate({ target: configTable.key, set: { value: cfg as unknown as Record<string, unknown>, updatedAt: new Date() } });
}

/** Load SMTP config from DB into cache. Call once at server startup. */
export async function loadSmtpConfigFromDb(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const db   = getDb();
    const rows = await db.select().from(configTable).where(eq(configTable.key, CONFIG_KEY));
    if (rows.length) {
      _cache = { ...DEFAULTS, ...(rows[0].value as Partial<SmtpConfig>) };
    }
  } catch { /* use defaults */ }
}

export function getSmtpMode(): SmtpMode {
  return loadSmtpConfig().mode;
}

export function setSmtpMode(mode: SmtpMode, updatedBy = 'admin'): void {
  saveSmtpConfig({ mode }, updatedBy);
}

/**
 * syncSecretsIntoConfig — called once at server startup.
 *
 * Writes the live secret values (resolved via alias fallbacks) into the
 * persistent SMTP config file so the admin SMTP panel always reflects the
 * current credential state without requiring a manual save.
 *
 * Only overwrites fields that are currently empty in the stored config,
 * so admin-entered values are never silently clobbered.
 */
export function syncSecretsIntoConfig(opts: {
  clientId?:     string;
  clientSecret?: string;
  refreshToken?: string;
  accountId?:    string;
}): void {
  try {
    const current = loadSmtpConfig();
    const patch: Partial<SmtpConfig> = {};

    if (opts.clientId     && !current.oauthClientId)     patch.oauthClientId     = opts.clientId;
    if (opts.clientSecret && !current.oauthClientSecret) patch.oauthClientSecret = opts.clientSecret;
    if (opts.refreshToken && !current.oauthRefreshToken) patch.oauthRefreshToken = opts.refreshToken;

    if (Object.keys(patch).length > 0) {
      saveSmtpConfig(patch, 'system:startup-sync');
    }
  } catch {
    // Non-fatal — config sync failure must never crash the server
  }
}
