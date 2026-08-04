/**
 * POST /api/users/support
 * Body: { conversationId?: string, subject?, category?, priority?, message: string }
 * - conversationId given: appends a customer message to that conversation
 *   (reopens it if it was resolved/closed — see supportStore.addMessage).
 * - conversationId omitted: opens a new conversation (subject + category
 *   required, auto-assigned per the admin-configured routing rules).
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { createConversation, addMessage, getConversationById } from '../../../lib/supportStore.js';
import { appendAudit } from '../../../lib/auditLog.js';
import { sanitizeString } from '../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const raw = req.body as Record<string, unknown>;
  const message = sanitizeString(raw.message, 10_000);
  if (!message) return res.status(400).json({ ok: false, error: 'message is required' });

  const conversationId = typeof raw.conversationId === 'string' ? raw.conversationId : '';

  if (conversationId) {
    const existing = getConversationById(conversationId);
    if (!existing || existing.userId !== user.id) {
      return res.status(404).json({ ok: false, error: 'Conversation not found' });
    }
    const conversation = addMessage(conversationId, 'customer', message);
    appendAudit({ event: 'user_support_message_added', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { conversationId } });
    return res.status(201).json({ ok: true, conversation });
  }

  const subject = sanitizeString(raw.subject, 200);
  const category = sanitizeString(raw.category, 100) || 'Other';
  const priority = raw.priority === 'urgent' || raw.priority === 'high' || raw.priority === 'low' ? raw.priority : undefined;
  if (!subject) return res.status(400).json({ ok: false, error: 'subject is required to open a new conversation' });

  const conversation = createConversation({
    userId: user.id, userName: user.name, userEmail: user.email,
    subject, category, message, priority,
  });
  appendAudit({ event: 'user_support_conversation_created', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { conversationId: conversation.id } });

  return res.status(201).json({ ok: true, conversation });
}
