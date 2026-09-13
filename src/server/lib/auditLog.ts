/**
 * auditLog.ts — PostgreSQL-backed admin audit log.
 * Drop-in replacement for the flat-file implementation.
 */

import crypto from 'node:crypto';
import { desc, eq, and, gte, ilike, or, sql } from 'drizzle-orm';
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
  /** Structured target identity, mirroring the handler-level appendAuditEntry writers. */
  target?:   string;
  targetId?: string;
  [key: string]: unknown;
}

// Metadata keys whose values must never reach the audit record verbatim —
// callers pass free-form payloads, so secret-shaped keys are redacted at the
// audit boundary regardless of the caller's care.
const SENSITIVE_KEY_PATTERN = /pass(word)?|pwd|secret|token|otp|authorization|credential|cookie|cvv|cvc|ssn|\b(pin|card)s?\b|recovery.?codes?/i;
const REDACTED = '[redacted]';

function redactMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    safe[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : value;
  }
  return safe;
}

/**
 * Which identifier family supplied the actor. Legacy call-sites conflate
 * administrator ids, customer ids and the literal 'system'; recording the
 * source field keeps downstream viewers honest about what the id refers to.
 */
type ActorKind = 'admin' | 'customer' | 'system';

function actorDetails(adminId: string | undefined, userId: string | undefined, kind: ActorKind): Record<string, unknown> {
  return { actorKind: kind, ...(userId ? { userId } : {}) };
}

export function appendAudit(payload: LegacyAuditPayload): void {
  const { event, adminId, userId, email, ip, reason, ua, meta, target, targetId, ...rest } = payload;
  const actorId = adminId ?? userId ?? 'system';
  const actorKind: ActorKind = adminId !== undefined ? 'admin' : userId !== undefined ? 'customer' : 'system';
  const details: Record<string, unknown> = redactMeta({ ...meta });
  if (reason) details.reason = reason;
  if (ua)     details.ua     = ua;
  Object.assign(details, actorDetails(adminId, userId, actorKind));
  // Merge any extra keys
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) details[k] = SENSITIVE_KEY_PATTERN.test(k) ? REDACTED : v;
  }
  appendAuditEntry({
    adminId:    actorId,
    adminEmail: email   ?? '',
    action:     event,
    target,
    targetId,
    ip,
    details:    Object.keys(details).length > 0 ? details : undefined,
  }).catch((error) => {
    console.error('[audit] asynchronous audit write failed', {
      event,
      adminId: actorId,
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
  const { event, adminId, userId, email, ip, reason, ua, meta, target, targetId, ...rest } = payload;
  const actorId = adminId ?? userId ?? 'system';
  const actorKind: ActorKind = adminId !== undefined ? 'admin' : userId !== undefined ? 'customer' : 'system';
  if (process.env.NODE_ENV === 'production' && !isDatabaseConfigured()) {
    console.error('[audit] critical audit storage unavailable', { event, adminId: actorId });
    throw new Error('Critical audit storage is unavailable.');
  }
  const details: Record<string, unknown> = redactMeta({ ...meta });
  if (reason) details.reason = reason;
  if (ua) details.ua = ua;
  Object.assign(details, actorDetails(adminId, userId, actorKind));
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) details[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : value;
  }
  try {
    await appendAuditEntry({
      adminId: actorId,
      adminEmail: email ?? '',
      action: event,
      target,
      targetId,
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

/**
 * Redaction lives at this lowest-level writer, not only in the legacy helpers:
 * roughly a dozen call sites append structured entries directly, so applying
 * the sensitive-key boundary here covers every appendAuditEntry caller
 * regardless of which helper it used. It does NOT reach the three
 * transaction-internal writers that insert into the auditLog table directly
 * (kycReviewService, finalCustomerActivation, synthetic-test POST) — those
 * must keep their detail keys secret-free at the call site. Re-redacting
 * already-redacted payloads (appendAudit/appendCriticalAudit) is idempotent,
 * so no caller needs an opt-out.
 */
function redactEntryDetails(entry: Omit<AuditEntry, 'id' | 'ts'>): Omit<AuditEntry, 'id' | 'ts'> {
  if (!entry.details) return entry;
  return { ...entry, details: redactMeta(entry.details) };
}

export async function appendAuditEntry(uncheckedEntry: Omit<AuditEntry, 'id' | 'ts'>): Promise<AuditEntry> {
  const entry = redactEntryDetails(uncheckedEntry);
  if (!isDatabaseConfigured()) {
    // The flat-file fallback keeps records durable when the database is not
    // configured, but in production a database-backed audit trail is the
    // expected store — running on the fallback must be loud, not silent.
    if (process.env.NODE_ENV === 'production') {
      console.error('[audit] database not configured — audit records are being written to the flat-file fallback', {
        action: entry.action,
        adminId: entry.adminId,
      });
    }
    return (await ff()).appendAuditEntry(entry);
  }
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

export type AuditSeverity = 'info' | 'warn' | 'critical';

export interface AuditLogPageOptions {
  page: number;
  limit: number;
  search?: string;
  severity?: AuditSeverity;
}

export function deriveAuditSeverity(entry: { action: string; details?: Record<string, unknown> }): { severity: AuditSeverity; source: 'declared' | 'assessed' } {
  const declared = String(entry.details?.severity ?? '').toLowerCase();
  if (declared === 'critical' || declared === 'warn' || declared === 'info') {
    return { severity: declared, source: 'declared' };
  }
  const assessed: AuditSeverity = /(failed|denied|rejected|revoked|lockout|quarantine|security)/i.test(entry.action)
    ? 'warn'
    : 'info';
  return { severity: assessed, source: 'assessed' };
}

/** Shared search/severity filter used by the flat-file fallback path. */
function matchesPageFilters(
  entry: AuditEntry,
  normalizedSearch: string | undefined,
  severity: AuditSeverity | undefined,
): boolean {
  if (severity) {
    const { severity: derived } = deriveAuditSeverity(entry);
    if (derived !== severity) return false;
  }
  if (!normalizedSearch) return true;
  const needle = normalizedSearch.toLowerCase();
  return [entry.adminEmail, entry.adminId, entry.action, entry.target, entry.targetId, entry.ip]
    .some((value) => String(value ?? '').toLowerCase().includes(needle));
}

/**
 * Query one audit page. Filtering and counting deliberately live at the
 * database boundary when PostgreSQL is configured; the flat-file fallback
 * performs a single scan of the file and returns the same page contract.
 * The stores are not immutable — no caller may describe this history as
 * immutable without an integrity guarantee.
 */
export async function getAuditLogPage(
  opts: AuditLogPageOptions,
): Promise<{
  entries: AuditEntry[];
  total: number;
  /** Set only by the flat-file fallback when lines could not be parsed/read. */
  dataQuality?: { malformedLines: number; unreadable: boolean };
}> {
  const page = Math.max(1, opts.page);
  const limit = Math.min(100, Math.max(1, opts.limit));
  const offset = (page - 1) * limit;
  const normalizedSearch = opts.search?.trim();

  if (!isDatabaseConfigured()) {
    const { entries, malformedLines, unreadable } = (await ff()).readAuditFile();
    const filtered: AuditEntry[] = [];
    let total = 0;
    // Newest first, matching the database ordering (desc by ts).
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (!matchesPageFilters(entry, normalizedSearch, opts.severity)) continue;
      if (total >= offset && total < offset + limit) filtered.push(entry);
      total++;
    }
    return {
      entries: filtered,
      total,
      ...(malformedLines > 0 || unreadable ? { dataQuality: { malformedLines, unreadable } } : {}),
    };
  }

  const conditions = [];
  if (normalizedSearch) {
    const pattern = `%${normalizedSearch.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
    conditions.push(or(
      ilike(auditLog.adminEmail, pattern),
      ilike(auditLog.adminId, pattern),
      ilike(auditLog.action, pattern),
      ilike(auditLog.target, pattern),
      ilike(auditLog.targetId, pattern),
      ilike(auditLog.ip, pattern),
    ));
  }

  if (opts.severity === 'critical') {
    conditions.push(sql`lower(coalesce(${auditLog.details}->>'severity', '')) = 'critical'`);
  } else if (opts.severity === 'warn') {
    conditions.push(sql`(
      lower(coalesce(${auditLog.details}->>'severity', '')) = 'warn'
      OR (
        lower(coalesce(${auditLog.details}->>'severity', '')) NOT IN ('critical', 'warn', 'info')
        AND ${auditLog.action} ~* '(failed|denied|rejected|revoked|lockout|quarantine|security)'
      )
    )`);
  } else if (opts.severity === 'info') {
    conditions.push(sql`(
      lower(coalesce(${auditLog.details}->>'severity', '')) = 'info'
      OR (
        lower(coalesce(${auditLog.details}->>'severity', '')) NOT IN ('critical', 'warn', 'info')
        AND ${auditLog.action} !~* '(failed|denied|rejected|revoked|lockout|quarantine|security)'
      )
    )`);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const db = getDb();
  const [rows, totals] = await Promise.all([
    db.select().from(auditLog).where(where).orderBy(desc(auditLog.ts)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(auditLog).where(where),
  ]);

  return {
    entries: rows.map((r) => ({
      id: r.id,
      adminId: r.adminId,
      adminEmail: r.adminEmail,
      action: r.action,
      target: r.target ?? undefined,
      targetId: r.targetId ?? undefined,
      details: r.details as Record<string, unknown> | undefined,
      ip: r.ip ?? undefined,
      ts: r.ts.toISOString(),
    })),
    total: totals[0]?.count ?? 0,
  };
}
