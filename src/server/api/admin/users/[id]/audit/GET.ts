/**
 * GET /api/admin/users/:id/audit
 * Returns ALL audit log entries for a specific customer (any event type).
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../../lib/userStore.js';
import { getAuditLog } from '../../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const id = String(req.params.id ?? '');
  const limit  = Math.min(500, parseInt(String(req.query.limit ?? '100'), 10));
  const offset = parseInt(String(req.query.offset ?? '0'), 10);

  if (!id) return res.status(400).json({ error: 'User ID required' });

  const user = await findUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const all = await getAuditLog({ limit: 10_000 });
  const userEvents = all.filter(e =>
    e.adminId === id || e.targetId === id || e.details?.userId === id ||
    e.adminEmail?.toLowerCase() === user.email.toLowerCase()
  );

  return res.json({
    data: userEvents.slice(offset, offset + limit),
    total: userEvents.length,
  });
}
