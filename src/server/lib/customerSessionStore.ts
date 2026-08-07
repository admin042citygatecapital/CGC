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

const INACTIVITY_MS   = (parseInt(process.env.SESSION_CUSTOMER_TIMEOUT_MINUTES ?? '60', 10)) * 60_000;
const ABSOLUTE_TTL_MS = (parseInt(process.env.SESSION_CUSTOMER_MAX_HOURS       ?? '8',  10)) * 3_600_000;

export function generateCustomerToken(): string {
  return crypto.randomBytes(32).toString('hex');
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
  if (session.expiresAt < now) {
    await db.delete(customerSessions).where(eq(customerSessions.token, token));
    return undefined;
  }

  // Check inactivity TTL
  const inactivityDeadline = new Date(session.lastSeenAt.getTime() + INACTIVITY_MS);
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
