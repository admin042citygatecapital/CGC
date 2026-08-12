import type { Request, Response } from 'express';
import { appendAudit, appendCriticalAudit } from '../../../lib/auditLog.js';
import { updateOperationsItem } from '../../../lib/operationsInboxStore.js';

export default async function handler(req: Request, res: Response) {
  const id = typeof req.body?.id === 'string' ? req.body.id : '';
  if (!id) return res.status(400).json({ error: 'Item id is required' });
  const session = req.adminSession!;
  const actor = session.email || session.adminId;
  await appendCriticalAudit({
    event: 'operations_item_update_intent',
    adminId: session.adminId,
    email: session.email,
    ip: req.ip,
    reason: 'Operations record update',
    meta: { itemId: id, requestedStatus: req.body?.status, requestedPriority: req.body?.priority },
  });
  const item = await updateOperationsItem(id, {
    status: req.body?.status,
    priority: req.body?.priority,
    assignedTo: req.body?.assignedTo,
    note: req.body?.note,
  }, actor);
  if (!item) return res.status(404).json({ error: 'Operations item not found' });
  appendAudit({ event: 'operations_item_updated', adminId: session.adminId, email: session.email, ip: req.ip, meta: { itemId: id, status: item.status, priority: item.priority } });
  return res.json({ ok: true, item });
}
