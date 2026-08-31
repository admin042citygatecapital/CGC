import type { Request, Response } from 'express';
import { getAuditLogPage, type AuditSeverity, type AuditEntry } from '../../../lib/auditLog.js';

type Severity = 'info' | 'warn' | 'critical';

function severityFor(action: string, details: Record<string, unknown>): Severity {
  const declared = String(details.severity ?? '').toLowerCase();
  if (declared === 'critical' || declared === 'warn' || declared === 'info') return declared;
  if (/(failed|denied|rejected|revoked|lockout|quarantine|security)/i.test(action)) return 'warn';
  return 'info';
}

function normalize(entry: AuditEntry) {
  const details = entry.details ?? {};
  const severity = severityFor(entry.action, details);
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

export default async function handler(req: Request, res: Response) {
  const page  = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
  const search = String(req.query.search ?? '').trim().toLowerCase();
  const requestedSeverity = String(req.query.severity ?? '').trim().toLowerCase();
  const severity: AuditSeverity | undefined = requestedSeverity === 'info' || requestedSeverity === 'warn' || requestedSeverity === 'critical'
    ? requestedSeverity
    : undefined;

  const { entries, total } = await getAuditLogPage({ page, limit, search, severity });
  const data = entries.map(normalize);

  return res.json({ data, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
}
