/**
 * POST /api/admin/support/assign
 * Body: { id: string, assignedTo: string }
 * Assign a support conversation to an agent/team.
 */
import type { Request, Response } from 'express';
import { assignConversation, getConversationById } from '../../../../lib/supportStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const { id, assignedTo } = req.body as { id?: string; assignedTo?: string };
  if (!id || !assignedTo) {
    return res.status(400).json({ ok: false, error: 'id and assignedTo are required' });
  }

  const safeAssignee = sanitizeString(assignedTo, 100);
  const ok = assignConversation(id, safeAssignee);
  if (!ok) return res.status(404).json({ ok: false, error: 'Conversation not found' });

  appendAudit({
    event: 'support_conversation_assigned',
    adminId: req.adminSession?.adminId,
    email: req.adminSession?.email,
    ip: req.ip ?? 'unknown',
    meta: { conversationId: id, assignedTo: safeAssignee },
  });

  return res.json({ ok: true, conversation: getConversationById(id) });
}
