/**
 * GET /api/admin/users/:id/audit
 * Returns admin audit-log entries that reference this customer.
 * appendAudit stores the target customer id inside details.userId (the
 * audit schema doesn't index by target user), so we fetch a bounded
 * recent window and filter in-memory.
 */
import type { Request, Response } from 'express';
import { getAuditLog } from '../../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  const entries = await getAuditLog({ limit: 1000 });
  const matches = entries.filter(e => e.details?.userId === id || e.targetId === id);

  return res.json({ ok: true, entries: matches });
}
