/**
 * trustedDeviceStore.ts — PostgreSQL-backed trusted device store.
 * ────────────────────────────────────────────────────────────────
 * Stores trusted device tokens in the `config` table under key
 * 'trusted_devices'. Falls back to in-memory Map when no DB.
 *
 * Security properties (unchanged):
 *  - 256-bit cryptographically random device tokens
 *  - 30-day expiry (configurable via TRUSTED_DEVICE_DAYS env)
 *  - Bound to adminId
 *  - Max 10 trusted devices per admin (oldest evicted)
 *  - Revocable individually or all-at-once
 */

import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { config as configTable } from '../db/schema.js';

const CONFIG_KEY  = 'trusted_devices';
const TTL_MS      = (parseInt(process.env.TRUSTED_DEVICE_DAYS ?? '30', 10)) * 86_400_000;
const MAX_DEVICES = 10;

export const DEVICE_COOKIE = 'cgc_trusted_device';

export interface TrustedDevice {
  adminId:    string;
  email:      string;
  name:       string;
  ip:         string;
  ua:         string;
  createdAt:  string;
  expiresAt:  string;
  lastUsedAt: string;
}

// ── In-memory fallback ────────────────────────────────────────────────────────

let _mem: Record<string, TrustedDevice> = {};

// ── DB helpers ────────────────────────────────────────────────────────────────

async function loadDevices(): Promise<Record<string, TrustedDevice>> {
  if (!isDatabaseConfigured()) return _mem;
  try {
    const db   = getDb();
    const rows = await db.select().from(configTable).where(eq(configTable.key, CONFIG_KEY));
    if (!rows.length) return {};
    return (rows[0].value as Record<string, TrustedDevice>) ?? {};
  } catch { return {}; }
}

async function saveDevices(devices: Record<string, TrustedDevice>): Promise<void> {
  if (!isDatabaseConfigured()) { _mem = devices; return; }
  try {
    const db = getDb();
    await db.insert(configTable)
      .values({ key: CONFIG_KEY, value: devices as unknown as Record<string, unknown>, updatedBy: 'system' })
      .onConflictDoUpdate({ target: configTable.key, set: { value: devices as unknown as Record<string, unknown>, updatedAt: new Date() } });
  } catch { /* non-fatal */ }
}

// ── UA label helper ───────────────────────────────────────────────────────────

function parseUaLabel(ua: string): string {
  let browser = 'Browser';
  let os      = 'Unknown OS';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/Edg\//.test(ua)) browser = 'Edge';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  return `${browser} on ${os}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RegisterDeviceResult {
  token:     string;
  expiresAt: Date;
}

export async function registerTrustedDevice(
  adminId: string,
  email:   string,
  ip:      string,
  ua:      string,
): Promise<RegisterDeviceResult> {
  const devices   = await loadDevices();
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + TTL_MS);

  // Evict oldest devices for this admin if over limit
  const adminDevices = Object.entries(devices)
    .filter(([, d]) => d.adminId === adminId)
    .sort(([, a], [, b]) => a.createdAt.localeCompare(b.createdAt));

  if (adminDevices.length >= MAX_DEVICES) {
    const toRemove = adminDevices.slice(0, adminDevices.length - MAX_DEVICES + 1);
    for (const [t] of toRemove) delete devices[t];
  }

  const token = crypto.randomBytes(32).toString('hex');
  devices[token] = {
    adminId,
    email,
    name:       parseUaLabel(ua),
    ip,
    ua,
    createdAt:  now.toISOString(),
    expiresAt:  expiresAt.toISOString(),
    lastUsedAt: now.toISOString(),
  };
  await saveDevices(devices);
  return { token, expiresAt };
}

export async function validateTrustedDevice(token: string, adminId: string): Promise<TrustedDevice | null> {
  if (!token || token.length !== 64 || !/^[0-9a-f]+$/.test(token)) return null;
  const devices = await loadDevices();
  const device  = devices[token];
  if (!device) return null;
  if (device.adminId !== adminId) return null;
  if (new Date(device.expiresAt).getTime() < Date.now()) {
    delete devices[token];
    await saveDevices(devices);
    return null;
  }
  device.lastUsedAt = new Date().toISOString();
  devices[token] = device;
  await saveDevices(devices);
  return device;
}

export async function listTrustedDevices(adminId: string): Promise<Array<TrustedDevice & { token: string }>> {
  const devices = await loadDevices();
  const now     = Date.now();
  return Object.entries(devices)
    .filter(([, d]) => d.adminId === adminId && new Date(d.expiresAt).getTime() > now)
    .map(([token, d]) => ({ token, ...d }))
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
}

export async function revokeTrustedDevice(token: string): Promise<void> {
  const devices = await loadDevices();
  delete devices[token];
  await saveDevices(devices);
}

export async function revokeAllTrustedDevices(adminId: string): Promise<void> {
  const devices = await loadDevices();
  for (const [token, d] of Object.entries(devices)) {
    if (d.adminId === adminId) delete devices[token];
  }
  await saveDevices(devices);
}

export async function purgeExpiredDevices(): Promise<void> {
  const devices = await loadDevices();
  const now     = Date.now();
  let changed   = false;
  for (const [token, d] of Object.entries(devices)) {
    if (new Date(d.expiresAt).getTime() < now) {
      delete devices[token];
      changed = true;
    }
  }
  if (changed) await saveDevices(devices);
}

// Auto-purge every hour
setInterval(() => purgeExpiredDevices().catch(() => {}), 60 * 60_000).unref();
