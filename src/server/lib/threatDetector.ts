/**
 * threatDetector.ts — Real-time threat intelligence, PostgreSQL-backed.
 * ──────────────────────────────────────────────────────────────────────
 * Aggregates signals from loginEvents + access_log tables.
 * Threat alerts are stored in the `config` table as a JSON array
 * under key 'threat_alerts'.
 */

import { eq, desc, gte, and } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { loginEvents, accessLog as accessLogTable, config as configTable } from '../db/schema.js';
import { accessLogStats } from './accessLog.js';

export type ThreatSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface ThreatAlert {
  id:        string;
  ts:        string;
  severity:  ThreatSeverity;
  type:      string;
  title:     string;
  detail:    string;
  ip?:       string;
  email?:    string;
  count?:    number;
  resolved:  boolean;
}

const THREATS_KEY = 'threat_alerts';
let _counter = 0;
function genId(): string { return `thr_${Date.now()}_${(++_counter).toString(36)}`; }

// ── Threat store (config table) ───────────────────────────────────────────────

async function loadThreatsFromDb(): Promise<ThreatAlert[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const db   = getDb();
    const rows = await db.select().from(configTable).where(eq(configTable.key, THREATS_KEY));
    if (!rows.length) return [];
    return (rows[0].value as ThreatAlert[]) ?? [];
  } catch { return []; }
}

async function saveThreatsToDb(threats: ThreatAlert[]): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const db = getDb();
    await db.insert(configTable)
      .values({ key: THREATS_KEY, value: threats as unknown as Record<string, unknown>[], updatedBy: 'system' })
      .onConflictDoUpdate({ target: configTable.key, set: { value: threats as unknown as Record<string, unknown>[], updatedAt: new Date() } });
  } catch { /* non-fatal */ }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function appendThreat(t: Omit<ThreatAlert, 'id' | 'ts' | 'resolved'>): Promise<ThreatAlert | null> {
  try {
    const full: ThreatAlert = { ...t, id: genId(), ts: new Date().toISOString(), resolved: false };
    const existing = await loadThreatsFromDb();
    // Keep last 500 threats
    const updated = [...existing, full].slice(-500);
    await saveThreatsToDb(updated);
    return full;
  } catch { return null; }
}

export async function loadThreats(limit = 100, onlyActive = false): Promise<ThreatAlert[]> {
  let rows = await loadThreatsFromDb();
  rows = rows.reverse();
  if (onlyActive) rows = rows.filter(r => !r.resolved);
  return rows.slice(0, limit);
}

export async function resolveThreat(id: string): Promise<boolean> {
  try {
    const rows   = await loadThreatsFromDb();
    const updated = rows.map(r => r.id === id ? { ...r, resolved: true } : r);
    await saveThreatsToDb(updated);
    return true;
  } catch { return false; }
}

/**
 * analyzeThreats — scans recent DB logs and generates threat alerts.
 * Call periodically or on-demand from the security dashboard.
 */
export async function analyzeThreats(): Promise<ThreatAlert[]> {
  if (!isDatabaseConfigured()) return [];

  const newThreats: ThreatAlert[] = [];
  const db      = getDb();
  const now     = Date.now();
  const w15m    = new Date(now - 15 * 60_000);
  const w1h     = new Date(now - 60 * 60_000);

  // ── 1. Brute-force: >5 failed logins from same IP in 15 min ──────────────
  try {
    const recentFailed = await db.select()
      .from(loginEvents)
      .where(and(eq(loginEvents.result, 'failed'), gte(loginEvents.ts, w15m)))
      .limit(1000);

    const ipFailCounts = new Map<string, number>();
    for (const e of recentFailed) {
      ipFailCounts.set(e.ip, (ipFailCounts.get(e.ip) ?? 0) + 1);
    }
    for (const [ip, count] of ipFailCounts) {
      if (count >= 5) {
        newThreats.push({
          id: genId(), ts: new Date().toISOString(), resolved: false,
          severity: count >= 10 ? 'critical' : 'high',
          type: 'brute_force',
          title: 'Brute-Force Login Attack',
          detail: `${count} failed login attempts from ${ip} in the last 15 minutes.`,
          ip, count,
        });
      }
    }
  } catch { /* non-fatal */ }

  // ── 2. Credential stuffing: >5 different emails from same IP in 1h ────────
  try {
    const recentLogins = await db.select()
      .from(loginEvents)
      .where(gte(loginEvents.ts, w1h))
      .limit(2000);

    const ipEmailMap = new Map<string, Set<string>>();
    for (const e of recentLogins) {
      if (!ipEmailMap.has(e.ip)) ipEmailMap.set(e.ip, new Set());
      ipEmailMap.get(e.ip)!.add(e.email);
    }
    for (const [ip, emails] of ipEmailMap) {
      if (emails.size >= 5) {
        newThreats.push({
          id: genId(), ts: new Date().toISOString(), resolved: false,
          severity: 'high',
          type: 'credential_stuffing',
          title: 'Credential Stuffing Detected',
          detail: `IP ${ip} attempted login with ${emails.size} different email addresses in the last hour.`,
          ip, count: emails.size,
        });
      }
    }
  } catch { /* non-fatal */ }

  // ── 3. HTTP threats from access log ──────────────────────────────────────
  try {
    const httpThreats = await db.select()
      .from(accessLogTable)
      .where(and(gte(accessLogTable.ts, w1h)))
      .orderBy(desc(accessLogTable.ts))
      .limit(2000);

    const threatIpMap = new Map<string, { count: number; types: Set<string> }>();
    for (const e of httpThreats) {
      if (e.threat === 'none') continue;
      if (!threatIpMap.has(e.ip)) threatIpMap.set(e.ip, { count: 0, types: new Set() });
      const t = threatIpMap.get(e.ip)!;
      t.count++;
      t.types.add(e.threat);
    }
    for (const [ip, info] of threatIpMap) {
      const types = [...info.types].join(', ');
      newThreats.push({
        id: genId(), ts: new Date().toISOString(), resolved: false,
        severity: info.types.has('sql_injection') || info.types.has('xss_attempt') ? 'critical' : 'high',
        type: 'http_attack',
        title: 'HTTP Attack Pattern',
        detail: `${info.count} malicious requests from ${ip}: ${types}`,
        ip, count: info.count,
      });
    }
  } catch { /* non-fatal */ }

  // Persist new threats
  if (newThreats.length > 0) {
    const existing = await loadThreatsFromDb();
    await saveThreatsToDb([...existing, ...newThreats].slice(-500));
  }

  return newThreats;
}

export async function threatSummary(): Promise<{
  active:    number;
  critical:  number;
  high:      number;
  medium:    number;
  low:       number;
  httpStats: Awaited<ReturnType<typeof accessLogStats>>;
}> {
  const [threats, httpStats] = await Promise.all([
    loadThreats(1000, true),
    accessLogStats(),
  ]);
  return {
    active:   threats.length,
    critical: threats.filter(t => t.severity === 'critical').length,
    high:     threats.filter(t => t.severity === 'high').length,
    medium:   threats.filter(t => t.severity === 'medium').length,
    low:      threats.filter(t => t.severity === 'low').length,
    httpStats,
  };
}
