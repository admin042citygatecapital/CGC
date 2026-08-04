/**
 * POST /api/admin/smartsupp/conversations
 * Body: { id, message: { role, text, agentId? } } — append a message
 *       { id, status?, assignedAgentId?, tags?, rating? } — update fields
 *       (no id) Partial<Conversation> — start a new conversation record
 */
import type { Request, Response } from 'express';
import { createConversation, updateConversation, addMessage, type Conversation, type ChatMessage } from '../../../../lib/smartsuppStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const raw = req.body as {
    id?: string; message?: Omit<ChatMessage, 'id' | 'ts'>;
  } & Partial<Conversation>;

  if (raw.id && raw.message) {
    const conversation = addMessage(raw.id, raw.message);
    if (!conversation) return res.status(404).json({ ok: false, error: 'Conversation not found' });
    return res.status(201).json({ ok: true, conversation });
  }

  if (raw.id) {
    const { id, message, ...patch } = raw;
    void message;
    const conversation = updateConversation(id, patch);
    if (!conversation) return res.status(404).json({ ok: false, error: 'Conversation not found' });
    appendAudit({ event: 'admin_smartsupp_conversation_updated', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { id } });
    return res.json({ ok: true, conversation });
  }

  const conversation = createConversation(raw);
  return res.status(201).json({ ok: true, conversation });
}
