/**
 * sessionStore.ts — PostgreSQL-backed admin session store.
 * Drop-in replacement for the flat-file JSON implementation.
 *
 * Falls back to flat-file when DATABASE_URL is not configured.
 */

import crypto from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { adminSessions } from '../db/schema.js';
import type { AdminSession } from '../db/schema.js';

const INACTIVITY_MS          = (parseInt(process.env.SESSION_TIMEOUT_MINUTES ?? '60', 10)) * 60_000;
const ABSOLUTE_TTL_MS        = (parseInt(process.env.SESSION_MAX_HOURS        ?? '8',  10)) * 3_600_000;
const MAX_SESSIONS_PER_ADMIN = 5;

export type AdminRole = 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'SECURITY_ADMIN' | 'SUPPORT_ADMIN' | 'COMPLIANCE_ADMIN';

export interface Session {
  adminId:    string;
  email:      string;
  role:       AdminRole;
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

function toSession(r: AdminSession): Session {
  return {
    adminId:    r.adminId,
    email:      r.email,
    role:       r.role as AdminRole,
    createdAt:  r.createdAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
    ip:         r.ip,
    ua:         r.ua,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function createSession(
  token: string,
  data: Omit<Session, 'lastSeenAt'>,
): Promise<void> {
  if (!isDatabaseConfigured()) return (await ff()).createSession(token, data);
  const db  = getDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ABSOLUTE_TTL_MS);

  // Enforce max sessions per admin — evict oldest if needed
  const existing = await db.select({ token: adminSessions.token, createdAt: adminSessions.createdAt })
    .from(adminSessions)
    .where(eq(adminSessions.adminId, data.adminId))
    .orderBy(adminSessions.createdAt);

  if (existing.length >= MAX_SESSIONS_PER_ADMIN) {
    const toEvict = existing.slice(0, existing.length - MAX_SESSIONS_PER_ADMIN + 1);
    for (const s of toEvict) {
      await db.delete(adminSessions).where(eq(adminSessions.token, s.token));
    }
  }

  await db.insert(adminSessions).values({
    token,
    adminId:    data.adminId,
    email:      data.email,
    role:       data.role as AdminSession['role'],
    ip:         data.ip,
    ua:         data.ua,
    createdAt:  now,
    lastSeenAt: now,
    expiresAt,
  }).onConflictDoNothing();
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
  const db  = getDb();
  const now = new Date();

  const rows = await db.select().from(adminSessions).where(eq(adminSessions.token, token)).limit(1);
  if (rows.length === 0) return null;
  const s = rows[0];

  // Check absolute TTL
  if (new Date(s.expiresAt) < now) {
    await db.delete(adminSessions).where(eq(adminSessions.token, token));
    return null;
  }

  // Check inactivity TTL
  const inactivityDeadline = new Date(new Date(s.lastSeenAt).getTime() + INACTIVITY_MS);
  if (inactivityDeadline < now) {
    await db.delete(adminSessions).where(eq(adminSessions.token, token));
    return null;
  }

  if (fingerprint && (s.ip !== fingerprint.ip || s.ua !== fingerprint.ua)) {
    return null;
  }

  // Touch lastSeenAt
  await db.update(adminSessions)
    .set({ lastSeenAt: now })
    .where(eq(adminSessions.token, token));

  return toSession({ ...s, lastSeenAt: now });
}

export async function deleteSession(token: string): Promise<void> {
  if (!isDatabaseConfigured()) return (await ff()).deleteSession(token);
  const db = getDb();
  await db.delete(adminSessions).where(eq(adminSessions.token, token));
}

export async function listSessions(): Promise<Array<{ token: string } & Session>> {
  if (!isDatabaseConfigured()) return (await ff()).listSessions();
  const db   = getDb();
  const rows = await db.select().from(adminSessions).orderBy(adminSessions.createdAt);
  return rows.map(r => ({ token: r.token, ...toSession(r) }));
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
    .returning({ token: adminSessions.token });
  return result.length;
}

export async function getSessionsByAdmin(adminId: string): Promise<Array<{ token: string } & Session>> {
  if (!isDatabaseConfigured()) return (await ff()).getSessionsByAdmin(adminId);
  const db   = getDb();
  const rows = await db.select().from(adminSessions)
    .where(eq(adminSessions.adminId, adminId))
    .orderBy(adminSessions.createdAt);
  return rows.map(r => ({ token: r.token, ...toSession(r) }));
}

/** Delete all sessions belonging to a given admin (e.g. after password reset). */
export async function deleteAllSessionsForAdmin(adminId: string): Promise<void> {
  if (!isDatabaseConfigured()) {
    const sessions = await (await ff()).getSessionsByAdmin(adminId);
    for (const s of sessions) await deleteSession(s.token);
    return;
  }
  const db = getDb();
  await db.delete(adminSessions).where(eq(adminSessions.adminId, adminId));
}
