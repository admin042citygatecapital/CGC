/**
 * accessLog.ts — PostgreSQL-backed HTTP access log with threat detection.
 * ─────────────────────────────────────────────────────────────────────────
 * Writes are async (fire-and-forget) to avoid blocking responses.
 * Falls back to console.log when DATABASE_URL is not set.
 */

import { desc, eq, gte, lte, and, sql as drizzleSql } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { accessLog as accessLogTable } from '../db/schema.js';

const ALLOWED_METHODS = new Set(['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']);
function sanitizeMethod(m: unknown): string {
  const s = typeof m === 'string' ? m.toUpperCase() : '';
  return ALLOWED_METHODS.has(s) ? s : 'UNKNOWN';
}

export type ThreatType =
  | 'sql_injection'
  | 'xss_attempt'
  | 'path_traversal'
  | 'brute_force'
  | 'scanner'
  | 'suspicious_ua'
  | 'unauthorized_admin'
  | 'rate_limited'
  | 'oversized_payload'
  | 'none';

export interface AccessEntry {
  id:         string;
  ts:         string;
  method:     string;
  url:        string;
  status:     number;
  duration:   number;
  ip:         string;
  ua:         string;
  referer:    string;
  bytes:      number;
  userId?:    string;
  threat:     ThreatType;
  threatNote: string;
}

// ── Threat detection patterns ─────────────────────────────────────────────────

const SQL_PATTERNS = [
  /(\bselect\b.*\bfrom\b|\bunion\b.*\bselect\b|\bdrop\b.*\btable\b|\binsert\b.*\binto\b|\bdelete\b.*\bfrom\b)/i,
  /('|"|;|--|\bor\b\s+\d+=\d+|\band\b\s+\d+=\d+)/i,
  /\b(exec|execute|xp_|sp_|0x[0-9a-f]+)\b/i,
];
const XSS_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /on(load|error|click|mouse|key|focus|blur|change|submit|reset|select|input)\s*=/i,
  /<(iframe|object|embed|applet|form|input|img)[^>]*>/i,
  /expression\s*\(/i,
  /vbscript:/i,
];
const PATH_TRAVERSAL = /(\.\.[/\\]|%2e%2e[/\\]|\.\.%2f|%2e%2e%2f)/i;
const SCANNER_UAS    = /nikto|nmap|masscan|sqlmap|nessus|openvas|acunetix|burpsuite|dirbuster|gobuster|wfuzz|hydra|medusa|metasploit/i;
const SUSPICIOUS_UAS = /python-requests|go-http-client|libwww-perl|java\/|ruby|wget|scrapy|mechanize/i;

export function detectThreat(method: string, url: string, ua: string, body: string): { threat: ThreatType; note: string } {
  const combined = `${url} ${body}`.slice(0, 4000);
  if (SCANNER_UAS.test(ua))          return { threat: 'scanner',        note: `Scanner UA: ${ua.slice(0, 80)}` };
  if (PATH_TRAVERSAL.test(combined)) return { threat: 'path_traversal', note: 'Path traversal pattern detected' };
  for (const p of SQL_PATTERNS) {
    if (p.test(combined)) return { threat: 'sql_injection', note: 'SQL injection pattern detected' };
  }
  for (const p of XSS_PATTERNS) {
    if (p.test(combined)) return { threat: 'xss_attempt', note: 'XSS pattern detected' };
  }
  if (SUSPICIOUS_UAS.test(ua))       return { threat: 'suspicious_ua',  note: `Suspicious UA: ${ua.slice(0, 80)}` };
  return { threat: 'none', note: '' };
}

// ── ID generator ──────────────────────────────────────────────────────────────

let _counter = 0;
function genId(): string {
  return `al_${Date.now()}_${(++_counter).toString(36)}`;
}

// ── Write ─────────────────────────────────────────────────────────────────────

export function appendAccessEntry(entry: Omit<AccessEntry, 'id' | 'ts'>) {
  setImmediate(async () => {
    if (!isDatabaseConfigured()) return; // dev: skip
    try {
      const db = getDb();
      await db.insert(accessLogTable).values({
        id:         genId(),
        method:     sanitizeMethod(entry.method),
        url:        entry.url,
        status:     entry.status,
        duration:   entry.duration,
        ip:         entry.ip,
        ua:         entry.ua,
        referer:    entry.referer,
        bytes:      entry.bytes,
        userId:     entry.userId,
        threat:     entry.threat,
        threatNote: entry.threatNote,
      });
    } catch (e) {
      console.error('accessLog.write.failed', e);
    }
  });
}

// ── Query ─────────────────────────────────────────────────────────────────────

export interface AccessLogQuery {
  method?:    string;
  status?:    number;
  minStatus?: number;
  maxStatus?: number;
  threat?:    ThreatType;
  ip?:        string;
  search?:    string;
  from?:      string;
  to?:        string;
  limit?:     number;
  offset?:    number;
}

export async function queryAccessLog(q: AccessLogQuery = {}): Promise<{ data: AccessEntry[]; total: number }> {
  if (!isDatabaseConfigured()) return { data: [], total: 0 };
  try {
    const db         = getDb();
    const conditions = [];

    if (q.method)    conditions.push(eq(accessLogTable.method, sanitizeMethod(q.method)));
    if (q.status)    conditions.push(eq(accessLogTable.status, q.status));
    if (q.minStatus) conditions.push(gte(accessLogTable.status, q.minStatus));
    if (q.maxStatus) conditions.push(lte(accessLogTable.status, q.maxStatus));
    if (q.threat && q.threat !== 'none') conditions.push(eq(accessLogTable.threat, q.threat));
    if (q.ip)        conditions.push(eq(accessLogTable.ip, q.ip));
    if (q.from)      conditions.push(gte(accessLogTable.ts, new Date(q.from)));
    if (q.to)        conditions.push(lte(accessLogTable.ts, new Date(q.to)));

    const where = conditions.length ? and(...conditions) : undefined;

    const [countResult, rows] = await Promise.all([
      db.select({ count: drizzleSql<number>`count(*)::int` }).from(accessLogTable).where(where),
      db.select().from(accessLogTable)
        .where(where)
        .orderBy(desc(accessLogTable.ts))
        .limit(q.limit ?? 100)
        .offset(q.offset ?? 0),
    ]);

    const total = countResult[0]?.count ?? 0;
    const data  = rows.map(r => ({
      id:         r.id,
      ts:         r.ts?.toISOString() ?? '',
      method:     r.method,
      url:        r.url,
      status:     r.status,
      duration:   r.duration,
      ip:         r.ip,
      ua:         r.ua,
      referer:    r.referer,
      bytes:      r.bytes,
      userId:     r.userId ?? undefined,
      threat:     r.threat as ThreatType,
      threatNote: r.threatNote,
    }));

    // Apply search filter in-memory (full-text search across url/ip/ua)
    if (q.search) {
      const s = q.search.toLowerCase();
      const filtered = data.filter(r =>
        r.url.toLowerCase().includes(s) ||
        r.ip.includes(s) ||
        r.ua.toLowerCase().includes(s)
      );
      return { data: filtered, total: filtered.length };
    }

    return { data, total };
  } catch { return { data: [], total: 0 }; }
}

export async function accessLogStats(): Promise<{
  total: number;
  errors4xx: number;
  errors5xx: number;
  threats: number;
  avgDuration: number;
  topUrls: Array<{ url: string; count: number }>;
  topIPs: Array<{ ip: string; count: number }>;
  statusBreakdown: Record<string, number>;
  methodBreakdown: Record<string, number>;
  threatBreakdown: Record<string, number>;
}> {
  const empty = { total: 0, errors4xx: 0, errors5xx: 0, threats: 0, avgDuration: 0,
    topUrls: [], topIPs: [], statusBreakdown: {}, methodBreakdown: {}, threatBreakdown: {} };

  if (!isDatabaseConfigured()) return empty;

  try {
    const db   = getDb();
    const rows = await db.select().from(accessLogTable).orderBy(desc(accessLogTable.ts)).limit(10000);

    const urlCounts    = new Map<string, number>();
    const ipCounts     = new Map<string, number>();
    const statusCounts = new Map<string, number>();
    const methodCounts = new Map<string, number>();
    const threatCounts = new Map<string, number>();
    let totalDuration  = 0;

    for (const r of rows) {
      urlCounts.set(r.url, (urlCounts.get(r.url) ?? 0) + 1);
      ipCounts.set(r.ip, (ipCounts.get(r.ip) ?? 0) + 1);
      const sg = `${Math.floor(r.status / 100)}xx`;
      statusCounts.set(sg, (statusCounts.get(sg) ?? 0) + 1);
      const sm = sanitizeMethod(r.method);
      methodCounts.set(sm, (methodCounts.get(sm) ?? 0) + 1);
      if (r.threat !== 'none') threatCounts.set(r.threat, (threatCounts.get(r.threat) ?? 0) + 1);
      totalDuration += r.duration;
    }

    return {
      total:      rows.length,
      errors4xx:  rows.filter(r => r.status >= 400 && r.status < 500).length,
      errors5xx:  rows.filter(r => r.status >= 500).length,
      threats:    rows.filter(r => r.threat !== 'none').length,
      avgDuration: rows.length ? Math.round(totalDuration / rows.length) : 0,
      topUrls:    [...urlCounts.entries()].sort((a,b) => b[1]-a[1]).slice(0,10).map(([url,count]) => ({ url, count })),
      topIPs:     [...ipCounts.entries()].sort((a,b) => b[1]-a[1]).slice(0,10).map(([ip,count]) => ({ ip, count })),
      statusBreakdown: Object.fromEntries(statusCounts),
      methodBreakdown: Object.fromEntries(methodCounts),
      threatBreakdown: Object.fromEntries(threatCounts),
    };
  } catch { return empty; }
}
