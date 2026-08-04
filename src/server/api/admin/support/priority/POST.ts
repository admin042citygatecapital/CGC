/**
 * POST /api/admin/support/priority
 * Body: { id: string, priority: 'low' | 'medium' | 'high' | 'urgent' }
 */
import type { Request, Response } from 'express';
import { updateConversationPriority, getConversationById } from '../../../../lib/supportStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { isOneOf } from '../../../../lib/inputValidator.js';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export default async function handler(req: Request, res: Response) {
  const { id } = req.body as { id?: string };
  const priority = isOneOf((req.body as { priority?: unknown }).priority, PRIORITIES);

  if (!id || !priority) {
    return res.status(400).json({ ok: false, error: "id and a valid priority ('low'|'medium'|'high'|'urgent') are required" });
  }

  const ok = updateConversationPriority(id, priority);
  if (!ok) return res.status(404).json({ ok: false, error: 'Conversation not found' });

  appendAudit({
    event: 'support_conversation_priority_changed',
    adminId: req.adminSession?.adminId,
    email: req.adminSession?.email,
    ip: req.ip ?? 'unknown',
    meta: { conversationId: id, priority },
  });

  return res.json({ ok: true, conversation: getConversationById(id) });
}
