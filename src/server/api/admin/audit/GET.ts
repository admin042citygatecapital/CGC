import type { Request, Response } from 'express';
import { getAuditLogPage, deriveAuditSeverity, type AuditEntry, type AuditSeverity } from '../../../lib/auditLog.js';

function normalize(entry: AuditEntry) {
  const details = entry.details ?? {};
  const { severity, source: severitySource } = deriveAuditSeverity(entry);
  const resultValue = String(details.result ?? '').toLowerCase();
  const result = resultValue === 'failure' || resultValue === 'success'
    ? resultValue
    : /(failed|denied|rejected)/i.test(entry.action) ? 'failure' : 'success';
  return {
    id: entry.id,
    ts: entry.ts,
    actor: entry.adminEmail || entry.adminId || 'system',
    actorId: entry.adminId,
    actorRole: typeof details.role === 'string' ? details.role : undefined,
    action: entry.action,
    resource: entry.target,
    resourceId: entry.targetId,
    severity,
    /** 'declared' when the record itself carried a severity, else 'assessed'. */
    severitySource,
    ip: entry.ip,
    userAgent: typeof details.ua === 'string' ? details.ua : undefined,
    payload: details,
    result,
    // Compatibility aliases used by the Security Center audit tab.
    event: entry.action,
    adminId: entry.adminId,
    userId: typeof details.userId === 'string' ? details.userId : undefined,
    email: entry.adminEmail || undefined,
    reason: typeof details.reason === 'string' ? details.reason : undefined,
    meta: details,
  };
}

/** Accept only plain positive integers — "2abc", "1.5" and "NaN" are rejected. */
function parseStrictPositiveInteger(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export default async function handler(req: Request, res: Response) {
  // String() of an array query value yields "1,2", which the strict parser rejects.
  const page = parseStrictPositiveInteger(String(req.query.page ?? '1'));
  const limit = parseStrictPositiveInteger(String(req.query.limit ?? '20'));
  if (page === null || limit === null || limit > 100 || page > 100_000) {
    res.status(400).json({ error: 'page and limit must be positive integers (limit at most 100)' });
    return;
  }
  const search = String(req.query.search ?? '').trim().toLowerCase();
  const requestedSeverity = String(req.query.severity ?? '').trim().toLowerCase();
  const severity: AuditSeverity | undefined = requestedSeverity === 'info' || requestedSeverity === 'warn' || requestedSeverity === 'critical'
    ? requestedSeverity
    : undefined;

  const { entries, total, dataQuality } = await getAuditLogPage({ page, limit, search, severity });
  const data = entries.map(normalize);

  return res.json({ data, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), ...(dataQuality ? { dataQuality } : {}) });
}