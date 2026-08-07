/**
 * POST /api/admin/support/status
 * Update status of a single ticket.
 * Body: { conversationId, status }
 */
import type { Request, Response } from 'express';
import { updateConversationStatus } from '../../../../lib/supportStore.js';
import type { SupportConversation } from '../../../../lib/supportStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { conversationId, status } = req.body ?? {};

  if (!conversationId) return res.status(400).json({ ok: false, error: 'conversationId required' });
  const valid = ['open', 'pending', 'in_progress', 'resolved', 'closed'];
  if (!valid.includes(String(status))) return res.status(400).json({ ok: false, error: 'invalid status' });

  const ok = updateConversationStatus(String(conversationId), status as SupportConversation['status']);
  if (!ok) return res.status(404).json({ ok: false, error: 'Ticket not found' });

  appendAudit({
    event:   'admin_support_status_change',
    adminId: session.adminId,
    ip:      req.ip ?? 'unknown',
    meta:    { conversationId, status },
  });

  return res.json({ ok: true });
}
