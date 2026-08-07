/**
 * bruteForce.ts — Brute-force lockout, PostgreSQL-backed.
 * ─────────────────────────────────────────────────────────
 * State is stored in the `config` table under key 'brute_force'.
 * Falls back to in-memory Map when DATABASE_URL is not set.
 *
 * Two independent axes:
 *   1. Per-email  — protects a specific account from credential stuffing
 *   2. Per-IP     — protects the endpoint from distributed spray attacks
 *
 * Lockout schedule (exponential backoff):
 *   Attempt 1-4  → no lockout
 *   Attempt 5    → 1 min
 *   Attempt 6    → 2 min
 *   Attempt 7    → 4 min
 *   Attempt 8    → 8 min
 *   Attempt 9+   → 15 min (cap)
 */

import { getDb, isDatabaseConfigured } from '../db/db.js';
import { config as configTable } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const CONFIG_KEY      = 'brute_force';
const BASE_LOCKOUT_MS = 60_000;
const MAX_LOCKOUT_MS  = 15 * 60_000;
const FAIL_THRESHOLD  = 4;
const STALE_WINDOW_MS = 30 * 60_000;

interface FailRecord {
  count:       number;
  lockedUntil: number;
  lastFailAt:  number;
}

interface Store {
  email: Record<string, FailRecord>;
  ip:    Record<string, FailRecord>;
}

// ── In-memory fallback (no DB) ────────────────────────────────────────────────

const _mem: Store = { email: {}, ip: {} };

// ── DB persistence ────────────────────────────────────────────────────────────

async function loadStore(): Promise<Store> {
  if (!isDatabaseConfigured()) return _mem;
  try {
    const db = getDb();
    const rows = await db.select().from(configTable).where(eq(configTable.key, CONFIG_KEY));
    if (!rows.length) return { email: {}, ip: {} };
    return (rows[0].value as Store) ?? { email: {}, ip: {} };
  } catch { return { email: {}, ip: {} }; }
}

async function saveStore(store: Store): Promise<void> {
  if (!isDatabaseConfigured()) {
    Object.assign(_mem.email, store.email);
    Object.assign(_mem.ip, store.ip);
    return;
  }
  try {
    const db = getDb();
    await db.insert(configTable)
      .values({ key: CONFIG_KEY, value: store as unknown as Record<string, unknown>, updatedBy: 'system' })
      .onConflictDoUpdate({ target: configTable.key, set: { value: store as unknown as Record<string, unknown>, updatedAt: new Date() } });
  } catch { /* non-fatal */ }
}

function pruneStale(store: Store): Store {
  const now    = Date.now();
  const cutoff = now - STALE_WINDOW_MS * 2;
  for (const [k, v] of Object.entries(store.email)) {
    if (v.lastFailAt < cutoff && v.lockedUntil < now) delete store.email[k];
  }
  for (const [k, v] of Object.entries(store.ip)) {
    if (v.lastFailAt < cutoff && v.lockedUntil < now) delete store.ip[k];
  }
  return store;
}

// ── Core logic ────────────────────────────────────────────────────────────────

function lockoutMs(count: number): number {
  if (count <= FAIL_THRESHOLD) return 0;
  return Math.min(Math.pow(2, count - FAIL_THRESHOLD - 1) * BASE_LOCKOUT_MS, MAX_LOCKOUT_MS);
}

function checkRecord(map: Record<string, FailRecord>, key: string): { blocked: boolean; remainingMs: number } {
  const rec = map[key];
  if (!rec) return { blocked: false, remainingMs: 0 };
  if (rec.lockedUntil > Date.now()) return { blocked: true, remainingMs: rec.lockedUntil - Date.now() };
  return { blocked: false, remainingMs: 0 };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface LockoutStatus {
  blocked:      boolean;
  remainingMs:  number;
  remainingMin: number;
}

export async function checkLockout(email: string, ip: string): Promise<LockoutStatus> {
  const store   = await loadStore();
  const byEmail = checkRecord(store.email, email.toLowerCase());
  const byIp    = checkRecord(store.ip, ip);

  if (byEmail.blocked) return { blocked: true, remainingMs: byEmail.remainingMs, remainingMin: Math.ceil(byEmail.remainingMs / 60_000) };
  if (byIp.blocked)    return { blocked: true, remainingMs: byIp.remainingMs,    remainingMin: Math.ceil(byIp.remainingMs / 60_000) };
  return { blocked: false, remainingMs: 0, remainingMin: 0 };
}

export async function recordLoginFailure(email: string, ip: string): Promise<void> {
  const store = await loadStore();
  const now   = Date.now();

  for (const [map, key] of [[store.email, email.toLowerCase()], [store.ip, ip]] as [Record<string, FailRecord>, string][]) {
    const rec = map[key] ?? { count: 0, lockedUntil: 0, lastFailAt: 0 };
    if (now - rec.lastFailAt > STALE_WINDOW_MS) rec.count = 0;
    rec.count      += 1;
    rec.lastFailAt  = now;
    rec.lockedUntil = now + lockoutMs(rec.count);
    map[key] = rec;
  }

  await saveStore(store);
}

export async function recordLoginSuccess(email: string, ip: string): Promise<void> {
  const store = await loadStore();
  delete store.email[email.toLowerCase()];
  delete store.ip[ip];
  delete store.ip['127.0.0.1'];
  delete store.ip['::1'];
  delete store.ip['::ffff:127.0.0.1'];
  await saveStore(store);
}

export async function getFailCount(email: string): Promise<number> {
  const store = await loadStore();
  return store.email[email.toLowerCase()]?.count ?? 0;
}

export async function clearAllLockouts(): Promise<void> {
  await saveStore({ email: {}, ip: {} });
}

// ── Auto-cleanup every 30 min ─────────────────────────────────────────────────
setInterval(async () => {
  try {
    const store = await loadStore();
    await saveStore(pruneStale(store));
  } catch { /* non-fatal */ }
}, 30 * 60_000).unref();
