/**
 * userStore.flatfile.ts — Original flat-file implementation.
 * Used as fallback when DATABASE_URL is not configured.
 * Do not import this directly — use userStore.ts instead.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { stripDangerousKeys } from './inputValidator.js';
import type { UserRecord, BalanceAdjustResult } from './userStore.js';

const INACTIVITY_MS   = (parseInt(process.env.SESSION_CUSTOMER_TIMEOUT_MINUTES ?? '60', 10)) * 60_000;
const ABSOLUTE_TTL_MS = (parseInt(process.env.SESSION_CUSTOMER_MAX_HOURS       ?? '8',  10)) * 3_600_000;
const USERS_FILE = '/private/users/users.jsonl';

function ensureDir() {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadAllUsers(): UserRecord[] {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return fs.readFileSync(USERS_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .map(l => JSON.parse(l) as UserRecord);
  } catch { return []; }
}

function saveAllUsers(users: UserRecord[]) {
  ensureDir();
  fs.writeFileSync(USERS_FILE, users.map(u => JSON.stringify(u)).join('\n') + '\n');
}

export function findUserByEmail(email: string): UserRecord | undefined {
  return loadAllUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
}

export function deleteUser(id: string): boolean {
  const all = loadAllUsers();
  const idx = all.findIndex(u => u.id === id);
  if (idx === -1) return false;
  all.splice(idx, 1);
  saveAllUsers(all);
  return true;
}

export function findUserById(id: string): UserRecord | undefined {
  return loadAllUsers().find(u => u.id === id);
}

export function findUserByVerifyToken(token: string): UserRecord | undefined {
  return loadAllUsers().find(u => u.emailVerifyToken === token);
}

export function findUserBySessionToken(token: string): UserRecord | undefined {
  if (!token) return undefined;
  const users = loadAllUsers();
  const idx   = users.findIndex(u => u.sessionToken === token);
  if (idx === -1) return undefined;
  const user = users[idx];
  const now  = Date.now();
  const lastSeen = user.sessionLastSeenAt ?? user.sessionCreatedAt;
  if (lastSeen && now - new Date(lastSeen).getTime() > INACTIVITY_MS) {
    users[idx] = { ...user, sessionToken: undefined, sessionCreatedAt: undefined, sessionLastSeenAt: undefined, sessionExpiresAt: undefined, updatedAt: new Date().toISOString() };
    saveAllUsers(users);
    return undefined;
  }
  if (user.sessionCreatedAt && now - new Date(user.sessionCreatedAt).getTime() > ABSOLUTE_TTL_MS) {
    users[idx] = { ...user, sessionToken: undefined, sessionCreatedAt: undefined, sessionLastSeenAt: undefined, sessionExpiresAt: undefined, updatedAt: new Date().toISOString() };
    saveAllUsers(users);
    return undefined;
  }
  users[idx] = { ...user, sessionLastSeenAt: new Date().toISOString() };
  saveAllUsers(users);
  return users[idx];
}

export function createUser(data: Omit<UserRecord, 'id' | 'createdAt' | 'updatedAt' | 'loginAttempts'>): UserRecord {
  const users = loadAllUsers();
  const user: UserRecord = {
    ...data,
    id: 'usr_' + crypto.randomBytes(8).toString('hex'),
    loginAttempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  users.push(user);
  saveAllUsers(users);
  return user;
}

export function updateUser(id: string, patch: Partial<UserRecord>): UserRecord | null {
  const users = loadAllUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  const safePatch = stripDangerousKeys(patch as Record<string, unknown>) as Partial<UserRecord>;
  users[idx] = { ...users[idx], ...safePatch, updatedAt: new Date().toISOString() };
  saveAllUsers(users);
  return users[idx];
}

// FIX (Category C, task #41): flat-file counterpart of userStore.ts's
// adjustUserBalance — see that function for full rationale. This uses only
// synchronous fs calls (readFileSync/writeFileSync via loadAllUsers/
// saveAllUsers) with no `await` between the read and the write, so Node's
// single-threaded event loop cannot interleave another request's handler
// in between — the read-modify-write here is genuinely atomic for the
// flat-file backend, unlike the old call sites which read the balance in
// one step and wrote it back in a separate step with async work in between.
export function adjustUserBalance(
  id: string,
  delta: number,
  opts: { allowNegative?: boolean; clampToZero?: boolean } = {}
): BalanceAdjustResult {
  if (!Number.isFinite(delta)) return { ok: false };

  const users = loadAllUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return { ok: false };

  const previousBalance = Number(users[idx].balance ?? 0);
  let newBalance = previousBalance + delta;

  if (opts.clampToZero) {
    newBalance = Math.max(0, newBalance);
  } else if (!(opts.allowNegative ?? false) && newBalance < 0) {
    return { ok: false, previousBalance };
  }

  users[idx] = { ...users[idx], balance: newBalance, updatedAt: new Date().toISOString() };
  saveAllUsers(users);
  return { ok: true, user: users[idx], previousBalance, newBalance };
}

// swapUserBalance — see userStore.ts for full rationale. Same
// synchronous-read-modify-write guarantee as adjustUserBalance above makes
// the expectedBalance check race-free for the flat-file backend.
export function swapUserBalance(
  id: string,
  expectedBalance: number,
  newBalance: number,
  newCurrency: string
): { ok: boolean; conflict?: boolean; user?: UserRecord } {
  const users = loadAllUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return { ok: false };

  if (Number(users[idx].balance ?? 0) !== expectedBalance) {
    return { ok: false, conflict: true };
  }

  users[idx] = { ...users[idx], balance: newBalance, primaryCurrency: newCurrency, updatedAt: new Date().toISOString() };
  saveAllUsers(users);
  return { ok: true, user: users[idx] };
}

export function generateVerifyToken(): { token: string; expiry: string } {
  return {
    token: crypto.randomBytes(32).toString('hex'),
    expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function detectDuplicate(email: string, ip?: string): { isDuplicate: boolean; reason?: string } {
  const users = loadAllUsers();
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { isDuplicate: true, reason: 'email_exists' };
  }
  if (ip) {
    const recentFromIp = users.filter(u =>
      u.ip === ip && Date.now() - new Date(u.createdAt).getTime() < 60 * 60 * 1000
    );
    if (recentFromIp.length >= 3) return { isDuplicate: true, reason: 'too_many_from_ip' };
  }
  return { isDuplicate: false };
}
