/**
 * auditLog.ts — PostgreSQL-backed admin audit log.
 * Drop-in replacement for the flat-file implementation.
 */

import crypto from 'node:crypto';
import { desc, eq, and, gte } from 'drizzle-orm';
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
  }).catch((error) => {
    console.error('[audit] asynchronous audit write failed', {
      event,
      adminId: adminId ?? userId ?? 'system',
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/**
 * Persist an audit intent before a sensitive mutation. Unlike the legacy
 * fire-and-forget helper, this rejects on storage failure so callers fail
 * closed before changing regulated state.
 */
export async function appendCriticalAudit(payload: LegacyAuditPayload): Promise<void> {
  const { event, adminId, userId, email, ip, reason, ua, meta, ...rest } = payload;
  const actorId = adminId ?? userId ?? 'system';
  if (process.env.NODE_ENV === 'production' && !isDatabaseConfigured()) {
    console.error('[audit] critical audit storage unavailable', { event, adminId: actorId });
    throw new Error('Critical audit storage is unavailable.');
  }
  const details: Record<string, unknown> = { ...meta };
  if (reason) details.reason = reason;
  if (ua) details.ua = ua;
  if (userId) details.userId = userId;
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) details[key] = value;
  }
  try {
    await appendAuditEntry({
      adminId: actorId,
      adminEmail: email ?? '',
      action: event,
      ip,
      details: Object.keys(details).length > 0 ? details : undefined,
    });
  } catch (error) {
    console.error('[audit] critical audit write failed', {
      event,
      adminId: actorId,
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    throw error;
  }
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
