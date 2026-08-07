/**
 * POST /api/admin/support/assign
 * Assign a ticket to an agent/team.
 * Body: { conversationId, assignedTo }
 */
import type { Request, Response } from 'express';
import { assignConversation } from '../../../../lib/supportStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { conversationId, assignedTo } = req.body ?? {};

  if (!conversationId) return res.status(400).json({ ok: false, error: 'conversationId required' });
  if (!assignedTo)     return res.status(400).json({ ok: false, error: 'assignedTo required' });

  const ok = assignConversation(String(conversationId), String(assignedTo));
  if (!ok) return res.status(404).json({ ok: false, error: 'Ticket not found' });

  appendAudit({
    event:   'admin_support_assign',
    adminId: session.adminId,
    ip:      req.ip ?? 'unknown',
    meta:    { conversationId, assignedTo },
  });

  return res.json({ ok: true });
}
