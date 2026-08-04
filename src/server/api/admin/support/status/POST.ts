/**
 * POST /api/admin/support/status
 * Body: { id: string, status: 'open' | 'pending' | 'in_progress' | 'resolved' | 'closed' }
 */
import type { Request, Response } from 'express';
import { updateConversationStatus, getConversationById } from '../../../../lib/supportStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { isOneOf } from '../../../../lib/inputValidator.js';

const STATUSES = ['open', 'pending', 'in_progress', 'resolved', 'closed'] as const;

export default async function handler(req: Request, res: Response) {
  const { id } = req.body as { id?: string };
  const status = isOneOf((req.body as { status?: unknown }).status, STATUSES);

  if (!id || !status) {
    return res.status(400).json({ ok: false, error: "id and a valid status ('open'|'pending'|'in_progress'|'resolved'|'closed') are required" });
  }

  const ok = updateConversationStatus(id, status);
  if (!ok) return res.status(404).json({ ok: false, error: 'Conversation not found' });

  appendAudit({
    event: 'support_conversation_status_changed',
    adminId: req.adminSession?.adminId,
    email: req.adminSession?.email,
    ip: req.ip ?? 'unknown',
    meta: { conversationId: id, status },
  });

  return res.json({ ok: true, conversation: getConversationById(id) });
}
