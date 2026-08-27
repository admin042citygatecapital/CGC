/**
 * Durable brute-force protection for administrator and customer sign-in.
 *
 * Production state lives in `brute_force_lockouts`, so restarts and multiple
 * Render instances cannot reset or disagree about an account lockout. Only
 * SHA-256 fingerprints of normalized identifiers are stored. A database-free
 * local test/development process uses an in-memory fallback with the same
 * semantics.
 */

import crypto from 'node:crypto';
import { getQueryClient, isDatabaseConfigured } from '../db/db.js';

const BASE_LOCKOUT_MS = 60_000;
const MAX_LOCKOUT_MS = 15 * 60_000;
const FAIL_THRESHOLD = 4;
const STALE_WINDOW_MS = 30 * 60_000;

export type LockoutScope = 'admin' | 'customer';

interface FailRecord {
  count: number;
  lockedUntil: number;
  lastFailAt: number;
}

const memory = new Map<string, FailRecord>();

function fingerprint(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function keyFor(scope: LockoutScope, axis: 'email' | 'ip', value: string): string {
  const normalized = axis === 'email' ? value.trim().toLowerCase() : value.trim();
  return `${scope}:${axis}:${fingerprint(normalized || 'unknown')}`;
}

function lockoutMs(count: number): number {
  if (count <= FAIL_THRESHOLD) return 0;
  return Math.min(2 ** (count - FAIL_THRESHOLD - 1) * BASE_LOCKOUT_MS, MAX_LOCKOUT_MS);
}

function statusFor(record?: FailRecord): LockoutStatus {
  if (!record || record.lockedUntil <= Date.now()) {
    return { blocked: false, remainingMs: 0, remainingMin: 0 };
  }
  const remainingMs = record.lockedUntil - Date.now();
  return { blocked: true, remainingMs, remainingMin: Math.ceil(remainingMs / 60_000) };
}

async function readRecord(key: string): Promise<FailRecord | undefined> {
  if (!isDatabaseConfigured()) return memory.get(key);
  const sql = getQueryClient();
  const rows = await sql<{ count: number; locked_until: Date | null; last_fail_at: Date }[]>`
    SELECT count, locked_until, last_fail_at
    FROM brute_force_lockouts
    WHERE key = ${key}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return undefined;
  return {
    count: Number(row.count),
    lockedUntil: row.locked_until?.getTime() ?? 0,
    lastFailAt: row.last_fail_at.getTime(),
  };
}

async function incrementRecord(key: string): Promise<void> {
  const now = Date.now();
  if (!isDatabaseConfigured()) {
    const current = memory.get(key);
    const count = !current || now - current.lastFailAt > STALE_WINDOW_MS ? 1 : current.count + 1;
    memory.set(key, { count, lastFailAt: now, lockedUntil: now + lockoutMs(count) });
    return;
  }

  const sql = getQueryClient();
  await sql.begin(async (transaction) => {
    // Serialize updates for one identifier without locking unrelated accounts.
    await transaction`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const rows = await transaction<{ count: number; last_fail_at: Date }[]>`
      SELECT count, last_fail_at
      FROM brute_force_lockouts
      WHERE key = ${key}
      FOR UPDATE
    `;
    const current = rows[0];
    const count = !current || now - current.last_fail_at.getTime() > STALE_WINDOW_MS
      ? 1
      : Number(current.count) + 1;
    const lockedUntil = lockoutMs(count) > 0 ? new Date(now + lockoutMs(count)).toISOString() : null;
    await transaction`
      INSERT INTO brute_force_lockouts (key, count, locked_until, last_fail_at)
      VALUES (${key}, ${count}, ${lockedUntil}, ${new Date(now).toISOString()})
      ON CONFLICT (key) DO UPDATE SET
        count = EXCLUDED.count,
        locked_until = EXCLUDED.locked_until,
        last_fail_at = EXCLUDED.last_fail_at
    `;
  });
}

async function deleteKeys(keys: string[]): Promise<void> {
  if (!isDatabaseConfigured()) {
    for (const key of keys) memory.delete(key);
    return;
  }
  const sql = getQueryClient();
  await sql`DELETE FROM brute_force_lockouts WHERE key IN ${sql(keys)}`;
}

export interface LockoutStatus {
  blocked: boolean;
  remainingMs: number;
  remainingMin: number;
}

export async function checkLockout(
  email: string,
  ip: string,
  scope: LockoutScope = 'admin',
): Promise<LockoutStatus> {
  const byEmail = statusFor(await readRecord(keyFor(scope, 'email', email)));
  if (byEmail.blocked) return byEmail;
  return statusFor(await readRecord(keyFor(scope, 'ip', ip)));
}

export async function recordLoginFailure(
  email: string,
  ip: string,
  scope: LockoutScope = 'admin',
): Promise<void> {
  await incrementRecord(keyFor(scope, 'email', email));
  await incrementRecord(keyFor(scope, 'ip', ip));
}

export async function recordLoginSuccess(
  email: string,
  ip: string,
  scope: LockoutScope = 'admin',
): Promise<void> {
  await deleteKeys([
    keyFor(scope, 'email', email),
    keyFor(scope, 'ip', ip),
    keyFor(scope, 'ip', '127.0.0.1'),
    keyFor(scope, 'ip', '::1'),
    keyFor(scope, 'ip', '::ffff:127.0.0.1'),
  ]);
}

export async function getFailCount(
  email: string,
  scope: LockoutScope = 'admin',
): Promise<number> {
  return (await readRecord(keyFor(scope, 'email', email)))?.count ?? 0;
}

export async function clearAllLockouts(scope: LockoutScope = 'admin'): Promise<void> {
  const prefix = `${scope}:%`;
  if (!isDatabaseConfigured()) {
    for (const key of memory.keys()) {
      if (key.startsWith(`${scope}:`)) memory.delete(key);
    }
    return;
  }
  const sql = getQueryClient();
  await sql`DELETE FROM brute_force_lockouts WHERE key LIKE ${prefix}`;
}

/** Test-only reset for database-free unit tests. */
export function resetMemoryLockoutsForTests(): void {
  if (isDatabaseConfigured()) throw new Error('Memory lockouts are unavailable while DATABASE_URL is configured.');
  memory.clear();
}
