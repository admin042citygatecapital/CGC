/**
 * customerSessionStore.ts — PostgreSQL-backed customer session store.
 *
 * Customer sessions are now stored in the customer_sessions table,
 * separate from the user record. This enables:
 *   - Multiple concurrent sessions per user
 *   - Efficient session lookup without loading the full user record
 *   - Proper TTL enforcement via DB queries
 *   - Session revocation without touching the user record
 */

import crypto from 'node:crypto';
import { eq, lt, and } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { customerSessions, users } from '../db/schema.js';
import type { UserRecord } from './userStore.js';
import {
  CUSTOMER_SESSION_ABSOLUTE_MS,
  CUSTOMER_SESSION_INACTIVITY_MS,
} from './customerSessionConfig.js';

const INACTIVITY_MS = CUSTOMER_SESSION_INACTIVITY_MS;
const ABSOLUTE_TTL_MS = CUSTOMER_SESSION_ABSOLUTE_MS;

export function generateCustomerToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export interface CustomerSessionView {
  id: string;
  ip: string;
  ua: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

function publicSessionId(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 24);
}

/** List active sessions without exposing their bearer credentials. */
export async function listCustomerSessions(
  userId: string,
  currentToken: string,
): Promise<CustomerSessionView[]> {
  const now = Date.now();
  if (!isDatabaseConfigured()) {
    const store = await import('./userStore.flatfile.js');
    const user = store.findUserById(userId);
    if (!user?.sessionToken) return [];
    const createdAt = user.sessionCreatedAt ?? new Date(now).toISOString();
    const lastSeenAt = user.sessionLastSeenAt ?? createdAt;
    const expiresAt = user.sessionExpiresAt ?? new Date(new Date(createdAt).getTime() + ABSOLUTE_TTL_MS).toISOString();
    if (new Date(expiresAt).getTime() <= now || new Date(lastSeenAt).getTime() + INACTIVITY_MS <= now) return [];
    return [{
      id: publicSessionId(user.sessionToken),
      ip: user.lastLoginIp ?? '',
      ua: '',
      createdAt,
      lastSeenAt,
      expiresAt,
      isCurrent: user.sessionToken === currentToken,
    }];
  }

  const rows = await getDb().select().from(customerSessions).where(eq(customerSessions.userId, userId));
  return rows
    .filter(row => new Date(row.expiresAt).getTime() > now && new Date(row.lastSeenAt).getTime() + INACTIVITY_MS > now)
    .map(row => ({
      id: publicSessionId(row.token),
      ip: row.ip ?? '',
      ua: row.ua ?? '',
      createdAt: new Date(row.createdAt).toISOString(),
      lastSeenAt: new Date(row.lastSeenAt).toISOString(),
      expiresAt: new Date(row.expiresAt).toISOString(),
      isCurrent: row.token === currentToken,
    }));
}

/** Revoke one session owned by this user, addressed by its non-secret ID. */
export async function revokeCustomerSession(userId: string, sessionId: string): Promise<boolean> {
  if (!/^[a-f0-9]{24}$/i.test(sessionId)) return false;
  if (!isDatabaseConfigured()) {
    const store = await import('./userStore.flatfile.js');
    const token = store.findUserById(userId)?.sessionToken;
    if (!token || publicSessionId(token) !== sessionId) return false;
    await deleteCustomerSession(token);
    return true;
  }

  const rows = await getDb().select({ token: customerSessions.token })
    .from(customerSessions)
    .where(eq(customerSessions.userId, userId));
  const match = rows.find(row => publicSessionId(row.token) === sessionId);
  if (!match) return false;
  await getDb().delete(customerSessions).where(and(
    eq(customerSessions.userId, userId),
    eq(customerSessions.token, match.token),
  ));
  return true;
}

/**
 * Create a new customer session in the database.
 * Returns the session token.
 */
export async function createCustomerSession(
  userId: string,
  opts: { ip?: string; ua?: string } = {}
): Promise<string> {
  const token     = generateCustomerToken();
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + ABSOLUTE_TTL_MS);

  if (isDatabaseConfigured()) {
    const db = getDb();
    await db.insert(customerSessions).values({
      token,
      userId,
      ip:         opts.ip ?? null,
      ua:         opts.ua ?? null,
      createdAt:  now,
      lastSeenAt: now,
      expiresAt,
    });
  } else {
    // Development-only flat-file compatibility: persist the token so the
    // session returned by login is immediately usable by authenticated APIs.
    const store = await import('./userStore.flatfile.js');
    await store.updateUser(userId, {
      sessionToken: token,
      sessionCreatedAt: now.toISOString(),
      sessionLastSeenAt: now.toISOString(),
      sessionExpiresAt: expiresAt.toISOString(),
    });
  }

  return token;
}

/**
 * Look up a user by their customer session token.
 * Updates lastSeenAt on every call (sliding window inactivity TTL).
 * Returns undefined if the session is expired or not found.
 */
export async function findUserByCustomerToken(token: string): Promise<UserRecord | undefined> {
  if (!token || token.length < 32) return undefined;
  if (!isDatabaseConfigured()) return undefined;

  const db  = getDb();
  const now = new Date();

  // Find the session
  const sessions = await db.select()
    .from(customerSessions)
    .where(eq(customerSessions.token, token))
    .limit(1);

  if (sessions.length === 0) return undefined;
  const session = sessions[0];

  // Check absolute TTL
  if (new Date(session.expiresAt) < now) {
    await db.delete(customerSessions).where(eq(customerSessions.token, token));
    return undefined;
  }

  // Check inactivity TTL
  const inactivityDeadline = new Date(new Date(session.lastSeenAt).getTime() + INACTIVITY_MS);
  if (inactivityDeadline < now) {
    await db.delete(customerSessions).where(eq(customerSessions.token, token));
    return undefined;
  }

  // Touch lastSeenAt (sliding window)
  await db.update(customerSessions)
    .set({ lastSeenAt: now })
    .where(eq(customerSessions.token, token));

  // Load the user
  const userRows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (userRows.length === 0) return undefined;

  // Import toRecord from userStore to avoid circular dependency
  const { findUserById } = await import('./userStore.js');
  return findUserById(session.userId);
}

/**
 * Delete a specific customer session (logout).
 */
export async function deleteCustomerSession(token: string): Promise<void> {
  if (!isDatabaseConfigured()) {
    const store = await import('./userStore.flatfile.js');
    const user = store.findUserBySessionToken(token);
    if (user) await store.updateUser(user.id, {
      sessionToken: undefined,
      sessionCreatedAt: undefined,
      sessionLastSeenAt: undefined,
      sessionExpiresAt: undefined,
    });
    return;
  }
  const db = getDb();
  await db.delete(customerSessions).where(eq(customerSessions.token, token));
}

/**
 * Delete all sessions for a user (force logout everywhere).
 */
export async function deleteAllCustomerSessions(userId: string): Promise<number> {
  if (!isDatabaseConfigured()) {
    const store = await import('./userStore.flatfile.js');
    const user = store.findUserById(userId);
    if (!user?.sessionToken) return 0;
    await store.updateUser(userId, {
      sessionToken: undefined,
      sessionCreatedAt: undefined,
      sessionLastSeenAt: undefined,
      sessionExpiresAt: undefined,
    });
    return 1;
  }
  const db = getDb();
  const result = await db.delete(customerSessions)
    .where(eq(customerSessions.userId, userId))
    .returning({ token: customerSessions.token });
  return result.length;
}

/**
 * Purge expired sessions. Called periodically by the background job.
 */
export async function purgeExpiredCustomerSessions(): Promise<number> {
  if (!isDatabaseConfigured()) {
    const store = await import('./userStore.flatfile.js');
    const now = Date.now();
    let purged = 0;
    for (const user of store.loadAllUsers()) {
      if (!user.sessionToken) continue;
      const absoluteExpired = !!user.sessionCreatedAt && now - new Date(user.sessionCreatedAt).getTime() > ABSOLUTE_TTL_MS;
      const lastSeen = user.sessionLastSeenAt ?? user.sessionCreatedAt;
      const inactive = !!lastSeen && now - new Date(lastSeen).getTime() > INACTIVITY_MS;
      if (absoluteExpired || inactive) {
        await store.updateUser(user.id, {
          sessionToken: undefined,
          sessionCreatedAt: undefined,
          sessionLastSeenAt: undefined,
          sessionExpiresAt: undefined,
        });
        purged += 1;
      }
    }
    return purged;
  }
  const db  = getDb();
  const now = new Date();
  const result = await db.delete(customerSessions)
    .where(lt(customerSessions.expiresAt, now))
    .returning({ token: customerSessions.token });
  return result.length;
}

/**
 * Count active sessions for a user.
 */
export async function countCustomerSessions(userId: string): Promise<number> {
  if (!isDatabaseConfigured()) {
    const store = await import('./userStore.flatfile.js');
    return store.findUserById(userId)?.sessionToken ? 1 : 0;
  }
  const db  = getDb();
  const rows = await db.select({ token: customerSessions.token })
    .from(customerSessions)
    .where(and(
      eq(customerSessions.userId, userId),
      // Only count non-expired sessions
    ));
  return rows.length;
}
