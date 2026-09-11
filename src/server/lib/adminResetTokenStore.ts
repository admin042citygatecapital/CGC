/**
 * adminResetTokenStore.ts — PostgreSQL-backed admin password-reset tokens.
 * ──────────────────────────────────────────────────────────────────────────
 * Stores the SHA-256 hash of the current reset token in the `config` table
 * under key 'admin_reset_token'. Falls back to in-memory when no DB.
 *
 * Security properties (unchanged from flat-file version):
 *  - Raw token is 256-bit cryptographically random (never stored)
 *  - Only the SHA-256 hash is persisted
 *  - Tokens expire after EXPIRY_MS (45 minutes) in both the DB and the
 *    in-memory fallback
 *  - Single-use: consumed after a successful password change
 *  - At most one pending token at a time
 *  - Constant-time comparison to prevent timing attacks
 *
 * Persistence failures are reported to the caller: issuing a raw token that
 * was never stored would email the admin a dead link, so issueResetToken()
 * returns null instead and the request handler can fail closed.
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

/** Stored hashes are lowercase SHA-256 hex digests. */
const VALID_HASH = /^[0-9a-f]{64}$/;

// ── In-memory fallback ────────────────────────────────────────────────────────

let _memToken: StoredToken | null = null;

// ── DB helpers ────────────────────────────────────────────────────────────────

function isWellFormedToken(entry: StoredToken | null | undefined): entry is StoredToken {
  return Boolean(
    entry?.hash && VALID_HASH.test(entry.hash) &&
    entry?.expiresAt && !Number.isNaN(new Date(entry.expiresAt).getTime()),
  );
}

async function loadToken(): Promise<StoredToken | null> {
  if (!isDatabaseConfigured()) {
    // The in-memory fallback honours the same expiry as the DB path —
    // without this check a token would live forever on database-free hosts.
    if (_memToken && Date.now() > new Date(_memToken.expiresAt).getTime()) {
      _memToken = null;
    }
    return _memToken;
  }
  try {
    const db   = getDb();
    const rows = await db.select().from(configTable).where(eq(configTable.key, CONFIG_KEY));
    const entry = rows.length ? (rows[0].value as StoredToken) : null;
    if (!isWellFormedToken(entry)) return null;
    if (Date.now() > new Date(entry.expiresAt).getTime()) {
      await saveToken(null);
      return null;
    }
    return entry;
  } catch { return null; }
}

async function saveToken(entry: StoredToken | null): Promise<boolean> {
  if (!isDatabaseConfigured()) { _memToken = entry; return true; }
  try {
    const db = getDb();
    if (entry === null) {
      await db.delete(configTable).where(eq(configTable.key, CONFIG_KEY));
    } else {
      await db.insert(configTable)
        .values({ key: CONFIG_KEY, value: entry as unknown as Record<string, unknown>, updatedBy: 'system' })
        .onConflictDoUpdate({ target: configTable.key, set: { value: entry as unknown as Record<string, unknown>, updatedAt: new Date() } });
    }
    return true;
  } catch (err) {
    console.error('admin.reset_token.persistence_failed', err);
    return false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a new reset token. Returns the raw (unhashed) token for the email
 * link, or null when the hash could not be persisted — the caller must not
 * email a token that no validation path will accept.
 * Any previously pending token is invalidated.
 */
export async function issueResetToken(): Promise<string | null> {
  const raw      = crypto.randomBytes(32).toString('hex');
  const hash     = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + EXPIRY_MS).toISOString();
  const persisted = await saveToken({ hash, expiresAt });
  if (!persisted) return null;
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

/**
 * Invalidate the current reset token. Returns false when deletion failed so
 * callers can retry instead of assuming the token is spent.
 */
export async function consumeResetToken(): Promise<boolean> {
  return saveToken(null);
}