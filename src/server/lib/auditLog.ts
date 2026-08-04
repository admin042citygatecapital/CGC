/**
 * auditLog.ts — PostgreSQL-backed admin audit log.
 * Drop-in replacement for the flat-file implementation.
 */

import crypto from 'node:crypto';
import { desc, eq, and, gte, count } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { auditLog } from '../db/schema.js';

export interface AuditEntry {
  id:         string;
  adminId:    string;
  adminEmail: string;
  action:     string;
  target?:    string;
  targetId?:  string;
  details?:   Record<string, unknown>;
  ip?:        string;
  ts:         string;
}

// ── Flat-file fallback ────────────────────────────────────────────────────────

let _ff: typeof import('./auditLog.flatfile.js') | null = null;
async function ff() {
  if (!_ff) _ff = await import('./auditLog.flatfile.js');
  return _ff;
}

// ── Public API ────────────────────────────────────────────────────────────────

// ── Legacy compatibility shim ─────────────────────────────────────────────────
// Many call-sites use appendAudit({ event, email, ip, reason, meta, ... })
// which predates the structured AuditEntry schema. This shim maps the old
// shape to appendAuditEntry so no call-site needs to change.

interface LegacyAuditPayload {
  event:    string;
  adminId?: string;
  userId?:  string;
  email?:   string;
  ip?:      string;
  reason?:  string;
  ua?:      string;
  meta?:    Record<string, unknown>;
  [key: string]: unknown;
}

export function appendAudit(payload: LegacyAuditPayload): void {
  const { event, adminId, userId, email, ip, reason, ua, meta, ...rest } = payload;
  const details: Record<string, unknown> = { ...meta };
  if (reason) details.reason = reason;
  if (ua)     details.ua     = ua;
  if (userId) details.userId = userId;
  // Merge any extra keys
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) details[k] = v;
  }
  appendAuditEntry({
    adminId:    adminId ?? userId ?? 'system',
    adminEmail: email   ?? '',
    action:     event,
    ip,
    details:    Object.keys(details).length > 0 ? details : undefined,
  }).catch(() => { /* fire-and-forget — never throw on audit failure */ });
}

export async function appendAuditEntry(entry: Omit<AuditEntry, 'id' | 'ts'>): Promise<AuditEntry> {
  if (!isDatabaseConfigured()) return (await ff()).appendAuditEntry(entry);
  const db   = getDb();
  const rows = await db.insert(auditLog).values({
    id:         'al_' + crypto.randomBytes(8).toString('hex'),
    adminId:    entry.adminId,
    adminEmail: entry.adminEmail,
    action:     entry.action,
    target:     entry.target ?? null,
    targetId:   entry.targetId ?? null,
    details:    entry.details ?? null,
    ip:         entry.ip ?? null,
    ts:         new Date(),
  }).returning();
  const r = rows[0];
  return {
    id:         r.id,
    adminId:    r.adminId,
    adminEmail: r.adminEmail,
    action:     r.action,
    target:     r.target ?? undefined,
    targetId:   r.targetId ?? undefined,
    details:    r.details as Record<string, unknown> | undefined,
    ip:         r.ip ?? undefined,
    ts:         r.ts.toISOString(),
  };
}

export async function getAuditLog(
  opts: { adminId?: string; action?: string; limit?: number; from?: string } = {}
): Promise<AuditEntry[]> {
  if (!isDatabaseConfigured()) return (await ff()).getAuditLog(opts);
  const db = getDb();

  const conditions = [];
  if (opts.adminId) conditions.push(eq(auditLog.adminId, opts.adminId));
  if (opts.action)  conditions.push(eq(auditLog.action, opts.action));
  if (opts.from)    conditions.push(gte(auditLog.ts, new Date(opts.from)));

  const rows = await db.select().from(auditLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLog.ts))
    .limit(opts.limit ?? 200);

  return rows.map(r => ({
    id:         r.id,
    adminId:    r.adminId,
    adminEmail: r.adminEmail,
    action:     r.action,
    target:     r.target ?? undefined,
    targetId:   r.targetId ?? undefined,
    details:    r.details as Record<string, unknown> | undefined,
    ip:         r.ip ?? undefined,
    ts:         r.ts.toISOString(),
  }));
}

/** Paginated audit log read — newest first. Used by the admin audit viewer, stats dashboard, and security export. */
export async function readAudit(limit = 200, offset = 0): Promise<{ data: AuditEntry[]; total: number }> {
  if (!isDatabaseConfigured()) return (await ff()).readAudit(limit, offset);
  const db = getDb();

  const [rows, totalRows] = await Promise.all([
    db.select().from(auditLog).orderBy(desc(auditLog.ts)).limit(limit).offset(offset),
    db.select({ value: count() }).from(auditLog),
  ]);

  const data = rows.map(r => ({
    id:         r.id,
    adminId:    r.adminId,
    adminEmail: r.adminEmail,
    action:     r.action,
    target:     r.target ?? undefined,
    targetId:   r.targetId ?? undefined,
    details:    r.details as Record<string, unknown> | undefined,
    ip:         r.ip ?? undefined,
    ts:         r.ts.toISOString(),
  }));

  return { data, total: totalRows[0]?.value ?? 0 };
}
