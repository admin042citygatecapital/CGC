/**
 * sessionStore.ts — PostgreSQL-backed admin session store.
 * Drop-in replacement for the flat-file JSON implementation.
 *
 * Falls back to flat-file when DATABASE_URL is not configured.
 */

import crypto from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import { getDb, getQueryClient, isDatabaseConfigured } from '../db/db.js';
import { adminSessions } from '../db/schema.js';
import type { AdminSession } from '../db/schema.js';
import { digestOpaqueToken, isSha256Digest } from './tokenDigest.js';

const INACTIVITY_MS          = (parseInt(process.env.SESSION_TIMEOUT_MINUTES ?? '60', 10)) * 60_000;
const ABSOLUTE_TTL_MS        = (parseInt(process.env.SESSION_MAX_HOURS        ?? '8',  10)) * 3_600_000;
const MAX_SESSIONS_PER_ADMIN = 5;

export type AdminRole =
  | 'SUPER_ADMIN'
  | 'FINANCE_ADMIN'
  | 'COMPLIANCE_ADMIN'
  | 'SECURITY_ADMIN'
  | 'SUPPORT_ADMIN'
  | 'CONTENT_ADMIN'
  | 'OPERATIONS_ADMIN'
  | 'AUDITOR';

export const ADMIN_ROLES: readonly AdminRole[] = [
  'SUPER_ADMIN',
  'FINANCE_ADMIN',
  'COMPLIANCE_ADMIN',
  'SECURITY_ADMIN',
  'SUPPORT_ADMIN',
  'CONTENT_ADMIN',
  'OPERATIONS_ADMIN',
  'AUDITOR',
] as const;

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}

export interface Session {
  adminId:    string;
  email:      string;
  role:       AdminRole;
  credentialVersion: number;
  createdAt:  string;
  lastSeenAt: string;
  ip:         string;
  ua:         string;
}

// ── Flat-file fallback ────────────────────────────────────────────────────────

let _ff: typeof import('./sessionStore.flatfile.js') | null = null;
async function ff() {
  if (!_ff) _ff = await import('./sessionStore.flatfile.js');
  return _ff;
}

// ── Token generation ──────────────────────────────────────────────────────────

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ── DB row → Session ──────────────────────────────────────────────────────────

function parseTimestamp(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toSession(r: AdminSession): Session | null {
  const createdAt = parseTimestamp(r.createdAt);
  const lastSeenAt = parseTimestamp(r.lastSeenAt);
  if (!createdAt || !lastSeenAt) return null;
  return {
    adminId:    r.adminId,
    email:      r.email,
    role:       r.role as AdminRole,
    credentialVersion: r.credentialVersion,
    createdAt:  createdAt.toISOString(),
    lastSeenAt: lastSeenAt.toISOString(),
    ip:         r.ip,
    ua:         r.ua,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function createSession(
  token: string,
  data: Omit<Session, 'lastSeenAt'>,
): Promise<boolean> {
  if (!isDatabaseConfigured()) return (await ff()).createSession(token, data);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ABSOLUTE_TTL_MS);
  const tokenHash = digestOpaqueToken(token);
  const sql = getQueryClient();

  // Password rotation and session issuance share this principal-scoped lock.
  // A login that verified an older credential revision can never publish a
  // session after the rotation transaction revoked the old sessions.
  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`admin-credential:${data.adminId}`}))`;
    const [principal] = await tx<{ credential_version: number; is_active: boolean }[]>`
      SELECT credential_version, is_active
      FROM admins
      WHERE id = ${data.adminId}
    `;
    if (!principal?.is_active || principal.credential_version !== data.credentialVersion) return false;

    await tx`
      DELETE FROM admin_sessions
      WHERE token_hash IN (
        SELECT token_hash
        FROM admin_sessions
        WHERE admin_id = ${data.adminId}
        ORDER BY created_at ASC
        OFFSET ${MAX_SESSIONS_PER_ADMIN - 1}
      )
    `;
    const inserted = await tx<{ token_hash: string }[]>`
      INSERT INTO admin_sessions (
        token_hash, admin_id, email, role, credential_version,
        ip, ua, created_at, last_seen_at, expires_at
      ) VALUES (
        ${tokenHash}, ${data.adminId}, ${data.email}, ${data.role}::admin_role,
        ${data.credentialVersion}, ${data.ip}, ${data.ua}, ${now.toISOString()}, ${now.toISOString()}, ${expiresAt.toISOString()}
      )
      ON CONFLICT DO NOTHING
      RETURNING token_hash
    `;
    return inserted.length === 1;
  });
}

/**
 * Resolve a session and, when supplied, enforce the fingerprint captured at
 * login.  Callers that service an authenticated request must pass both values;
 * the optional form is reserved for narrowly scoped internal checks.
 */
export async function getSession(
  token: string,
  fingerprint?: { ip: string; ua: string },
): Promise<Session | null> {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  if (!isDatabaseConfigured()) {
    const session = (await ff()).getSession(token);
    if (!session) return null;
    if (fingerprint && (session.ip !== fingerprint.ip || session.ua !== fingerprint.ua)) {
      return null;
    }
    return session;
  }
  const now = new Date();
  const tokenHash = digestOpaqueToken(token);
  const sql = getQueryClient();
  return sql.begin(async (tx) => {
    const [identity] = await tx<{ admin_id: string }[]>`
      SELECT admin_id FROM admin_sessions WHERE token_hash = ${tokenHash}
    `;
    if (!identity) return null;
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`admin-credential:${identity.admin_id}`}))`;
    const [s] = await tx<{
      admin_id: string;
      email: string;
      role: AdminRole;
      credential_version: number;
      ip: string;
      ua: string;
      created_at: Date | string;
      last_seen_at: Date | string;
      expires_at: Date | string;
      current_credential_version: number;
      is_active: boolean;
    }[]>`
      SELECT s.admin_id, s.email, s.role::text AS role, s.credential_version,
             s.ip, s.ua, s.created_at, s.last_seen_at, s.expires_at,
             a.credential_version AS current_credential_version, a.is_active
      FROM admin_sessions s
      JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = ${tokenHash}
      FOR UPDATE OF s
    `;
    if (!s) return null;

    const expiresAt = parseTimestamp(s.expires_at);
    const lastSeenAt = parseTimestamp(s.last_seen_at);
    const createdAt = parseTimestamp(s.created_at);
    const inactive = !s.is_active || s.credential_version !== s.current_credential_version;
    const malformedTimestamp = !expiresAt || !lastSeenAt || !createdAt;
    const absoluteExpired = !expiresAt || expiresAt < now;
    const inactivityExpired = !lastSeenAt || new Date(lastSeenAt.getTime() + INACTIVITY_MS) < now;
    if (inactive || malformedTimestamp || absoluteExpired || inactivityExpired) {
      await tx`DELETE FROM admin_sessions WHERE token_hash = ${tokenHash}`;
      return null;
    }
    if (fingerprint && (s.ip !== fingerprint.ip || s.ua !== fingerprint.ua)) return null;
    await tx`UPDATE admin_sessions SET last_seen_at = ${now.toISOString()} WHERE token_hash = ${tokenHash}`;
    return {
      adminId: s.admin_id,
      email: s.email,
      role: s.role,
      credentialVersion: s.credential_version,
      createdAt: createdAt.toISOString(),
      lastSeenAt: now.toISOString(),
      ip: s.ip,
      ua: s.ua,
    };
  });
}

export async function deleteSession(token: string): Promise<void> {
  if (!isDatabaseConfigured()) return (await ff()).deleteSession(token);
  const db = getDb();
  await db.delete(adminSessions).where(eq(adminSessions.tokenHash, digestOpaqueToken(token)));
}

/** Delete a session by its persisted digest (used by protected session controls). */
export async function deleteSessionByHash(tokenHash: string): Promise<void> {
  if (!isSha256Digest(tokenHash)) return;
  if (!isDatabaseConfigured()) return (await ff()).deleteSessionByHash(tokenHash);
  const db = getDb();
  await db.delete(adminSessions).where(eq(adminSessions.tokenHash, tokenHash.toLowerCase()));
}

export async function listSessions(): Promise<Array<{ token: string } & Session>> {
  if (!isDatabaseConfigured()) return (await ff()).listSessions();
  const db   = getDb();
  const rows = await db.select().from(adminSessions).orderBy(adminSessions.createdAt);
  return rows.flatMap(r => {
    const session = toSession(r);
    return session ? [{ token: r.tokenHash, ...session }] : [];
  });
}

export async function purgeAllSessions(): Promise<void> {
  if (!isDatabaseConfigured()) return (await ff()).purgeAllSessions();
  const db = getDb();
  await db.delete(adminSessions);
}

export async function purgeExpiredSessions(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const db  = getDb();
  const now = new Date();
  const result = await db.delete(adminSessions)
    .where(lt(adminSessions.expiresAt, now))
    .returning({ tokenHash: adminSessions.tokenHash });
  return result.length;
}

export async function getSessionsByAdmin(adminId: string): Promise<Array<{ token: string } & Session>> {
  if (!isDatabaseConfigured()) return (await ff()).getSessionsByAdmin(adminId);
  const db   = getDb();
  const rows = await db.select().from(adminSessions)
    .where(eq(adminSessions.adminId, adminId))
    .orderBy(adminSessions.createdAt);
  return rows.flatMap(r => {
    const session = toSession(r);
    return session ? [{ token: r.tokenHash, ...session }] : [];
  });
}

/** Delete all sessions belonging to a given admin (e.g. after password reset). */
export async function deleteAllSessionsForAdmin(adminId: string): Promise<void> {
  if (!isDatabaseConfigured()) {
    const sessions = await (await ff()).getSessionsByAdmin(adminId);
    for (const s of sessions) await deleteSessionByHash(s.token);
    return;
  }
  const db = getDb();
  await db.delete(adminSessions).where(eq(adminSessions.adminId, adminId));
}
