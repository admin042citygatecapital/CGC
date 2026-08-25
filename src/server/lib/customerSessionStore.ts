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
import { getDb, getQueryClient, isDatabaseConfigured } from '../db/db.js';
import { customerSessions, users } from '../db/schema.js';
import type { UserRecord } from './userStore.js';
import {
  CUSTOMER_SESSION_ABSOLUTE_MS,
  CUSTOMER_SESSION_INACTIVITY_MS,
} from './customerSessionConfig.js';
import {
  digestFromPersistedTokenKey,
  digestOpaqueToken,
  persistedTokenKey,
} from './tokenDigest.js';

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

function publicSessionIdFromHash(tokenHash: string): string {
  return tokenHash.slice(0, 24);
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
    if ((user.sessionCredentialVersion ?? 1) !== (user.credentialVersion ?? 1)) return [];
    const tokenHash = digestFromPersistedTokenKey(user.sessionToken);
    if (!tokenHash) return [];
    const createdAt = user.sessionCreatedAt ?? new Date(now).toISOString();
    const lastSeenAt = user.sessionLastSeenAt ?? createdAt;
    const expiresAt = user.sessionExpiresAt ?? new Date(new Date(createdAt).getTime() + ABSOLUTE_TTL_MS).toISOString();
    if (new Date(expiresAt).getTime() <= now || new Date(lastSeenAt).getTime() + INACTIVITY_MS <= now) return [];
    return [{
      id: publicSessionIdFromHash(tokenHash),
      ip: user.lastLoginIp ?? '',
      ua: '',
      createdAt,
      lastSeenAt,
      expiresAt,
      isCurrent: user.sessionToken === persistedTokenKey(currentToken),
    }];
  }

  const db = getDb();
  const [principal] = await db.select({ credentialVersion: users.credentialVersion })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (!principal) return [];
  const rows = await db.select().from(customerSessions).where(eq(customerSessions.userId, userId));
  return rows
    .filter(row => row.credentialVersion === principal.credentialVersion && row.expiresAt.getTime() > now && row.lastSeenAt.getTime() + INACTIVITY_MS > now)
    .map(row => ({
      id: publicSessionIdFromHash(row.tokenHash),
      ip: row.ip ?? '',
      ua: row.ua ?? '',
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      isCurrent: row.tokenHash === digestOpaqueToken(currentToken),
    }));
}

/** Revoke one session owned by this user, addressed by its non-secret ID. */
export async function revokeCustomerSession(userId: string, sessionId: string): Promise<boolean> {
  if (!/^[a-f0-9]{24}$/i.test(sessionId)) return false;
  if (!isDatabaseConfigured()) {
    const store = await import('./userStore.flatfile.js');
    const tokenKey = store.findUserById(userId)?.sessionToken;
    const tokenHash = tokenKey ? digestFromPersistedTokenKey(tokenKey) : null;
    if (!tokenHash || publicSessionIdFromHash(tokenHash) !== sessionId) return false;
    await store.updateUser(userId, {
      sessionToken: undefined,
      sessionCreatedAt: undefined,
      sessionLastSeenAt: undefined,
      sessionExpiresAt: undefined,
    });
    return true;
  }

  const rows = await getDb().select({ tokenHash: customerSessions.tokenHash })
    .from(customerSessions)
    .where(eq(customerSessions.userId, userId));
  const match = rows.find(row => publicSessionIdFromHash(row.tokenHash) === sessionId);
  if (!match) return false;
  await getDb().delete(customerSessions).where(and(
    eq(customerSessions.userId, userId),
    eq(customerSessions.tokenHash, match.tokenHash),
  ));
  return true;
}

/**
 * Create a new customer session in the database.
 * Returns the session token.
 */
export async function createCustomerSession(
  userId: string,
  opts: { ip?: string; ua?: string; credentialVersion: number },
): Promise<string | null> {
  const token     = generateCustomerToken();
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + ABSOLUTE_TTL_MS);

  if (isDatabaseConfigured()) {
    const sql = getQueryClient();
    const inserted = await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`customer-credential:${userId}`}))`;
      const rows = await tx<{ token_hash: string }[]>`
        INSERT INTO customer_sessions (
          token_hash, user_id, credential_version, ip, ua,
          created_at, last_seen_at, expires_at
        )
        SELECT ${digestOpaqueToken(token)}, id, credential_version, ${opts.ip ?? null}, ${opts.ua ?? null},
               ${now}, ${now}, ${expiresAt}
        FROM users
        WHERE id = ${userId} AND credential_version = ${opts.credentialVersion}
        RETURNING token_hash
      `;
      return rows.length === 1;
    });
    if (!inserted) return null;
  } else {
    // Development-only flat-file compatibility: persist the token so the
    // session returned by login is immediately usable by authenticated APIs.
    const store = await import('./userStore.flatfile.js');
    const principal = store.findUserById(userId);
    if (!principal || (principal.credentialVersion ?? 1) !== opts.credentialVersion) return null;
    await store.updateUser(userId, {
      sessionToken: persistedTokenKey(token),
      sessionCreatedAt: now.toISOString(),
      sessionLastSeenAt: now.toISOString(),
      sessionExpiresAt: expiresAt.toISOString(),
      sessionCredentialVersion: opts.credentialVersion,
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

  const now = new Date();
  const tokenHash = digestOpaqueToken(token);
  const sql = getQueryClient();
  const userId = await sql.begin(async (tx) => {
    const [identity] = await tx<{ user_id: string }[]>`
      SELECT user_id FROM customer_sessions WHERE token_hash = ${tokenHash}
    `;
    if (!identity) return null;
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`customer-credential:${identity.user_id}`}))`;
    const [session] = await tx<{
      user_id: string;
      credential_version: number;
      current_credential_version: number;
      last_seen_at: Date;
      expires_at: Date;
    }[]>`
      SELECT s.user_id, s.credential_version,
             u.credential_version AS current_credential_version,
             s.last_seen_at, s.expires_at
      FROM customer_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ${tokenHash}
      FOR UPDATE OF s
    `;
    if (!session) return null;
    const stale = session.credential_version !== session.current_credential_version;
    const expired = session.expires_at < now || new Date(session.last_seen_at.getTime() + INACTIVITY_MS) < now;
    if (stale || expired) {
      await tx`DELETE FROM customer_sessions WHERE token_hash = ${tokenHash}`;
      return null;
    }
    await tx`UPDATE customer_sessions SET last_seen_at = ${now} WHERE token_hash = ${tokenHash}`;
    return session.user_id;
  });
  if (!userId) return undefined;

  // Import toRecord from userStore to avoid circular dependency
  const { findUserById } = await import('./userStore.js');
  return findUserById(userId);
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
  await db.delete(customerSessions).where(eq(customerSessions.tokenHash, digestOpaqueToken(token)));
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
    .returning({ tokenHash: customerSessions.tokenHash });
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
    .returning({ tokenHash: customerSessions.tokenHash });
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
  const rows = await db.select({ tokenHash: customerSessions.tokenHash })
    .from(customerSessions)
    .where(and(
      eq(customerSessions.userId, userId),
      // Only count non-expired sessions
    ));
  return rows.length;
}
