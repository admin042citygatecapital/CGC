/**
 * adminResetTokenStore.ts — PostgreSQL-backed admin password-reset tokens.
 * ──────────────────────────────────────────────────────────────────────────
 * Stores the SHA-256 hash of the current reset token in the `config` table
 * under key 'admin_reset_token'. Falls back to in-memory when no DB.
 *
 * Security properties (unchanged from flat-file version):
 *  - Raw token is 256-bit cryptographically random (never stored)
 *  - Only the SHA-256 hash is persisted
 *  - Tokens expire after EXPIRY_MS (45 minutes)
 *  - Single-use: consumed immediately after validation
 *  - At most one pending token at a time
 *  - Constant-time comparison to prevent timing attacks
 */

import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { config as configTable } from '../db/schema.js';

const CONFIG_KEY = 'admin_reset_token';
const EXPIRY_MS  = 45 * 60_000;

export const EXPIRY_MINUTES = EXPIRY_MS / 60_000;

interface StoredToken {
  hash:      string;
  expiresAt: string;
}

// ── In-memory fallback ────────────────────────────────────────────────────────

let _memToken: StoredToken | null = null;

// ── DB helpers ────────────────────────────────────────────────────────────────

async function loadToken(): Promise<StoredToken | null> {
  if (!isDatabaseConfigured()) return _memToken;
  try {
    const db   = getDb();
    const rows = await db.select().from(configTable).where(eq(configTable.key, CONFIG_KEY));
    if (!rows.length) return null;
    const entry = rows[0].value as StoredToken;
    if (!entry?.hash || !entry?.expiresAt) return null;
    if (Date.now() > new Date(entry.expiresAt).getTime()) {
      await saveToken(null);
      return null;
    }
    return entry;
  } catch { return null; }
}

async function saveToken(entry: StoredToken | null): Promise<void> {
  if (!isDatabaseConfigured()) { _memToken = entry; return; }
  try {
    const db = getDb();
    if (entry === null) {
      await db.delete(configTable).where(eq(configTable.key, CONFIG_KEY));
    } else {
      await db.insert(configTable)
        .values({ key: CONFIG_KEY, value: entry as unknown as Record<string, unknown>, updatedBy: 'system' })
        .onConflictDoUpdate({ target: configTable.key, set: { value: entry as unknown as Record<string, unknown>, updatedAt: new Date() } });
    }
  } catch { /* non-fatal */ }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a new reset token. Returns the raw (unhashed) token for the email link.
 * Any previously pending token is invalidated.
 */
export async function issueResetToken(): Promise<string> {
  const raw      = crypto.randomBytes(32).toString('hex');
  const hash     = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + EXPIRY_MS).toISOString();
  await saveToken({ hash, expiresAt });
  return raw;
}

/**
 * Validate a raw token. Returns true if it matches the stored hash and hasn't expired.
 * Does NOT consume the token.
 */
export async function validateResetToken(raw: string): Promise<boolean> {
  if (!raw || typeof raw !== 'string' || raw.length !== 64) return false;
  const entry = await loadToken();
  if (!entry) return false;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(entry.hash));
}

/** Consume (invalidate) the current reset token. Call after successful password change. */
export async function consumeResetToken(): Promise<void> {
  await saveToken(null);
}
