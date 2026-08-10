/**
 * POST /api/users/support
 * Customer sends a support message / opens a conversation.
 * Body: { subject, category, message } or { conversationId, message } (to reply)
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { createConversation, addMessage } from '../../../lib/supportStore.js';
import { createNotification } from '../../../lib/notificationStore.js';
import { createOperationsItem } from '../../../lib/operationsInboxStore.js';
import { requireIntakeEnabled } from '../../../lib/operationalControls.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });
  if (!requireIntakeEnabled(res, 'supportTicketsEnabled')) return;

  const { subject, category = 'general', message, conversationId } = req.body ?? {};

  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Reply to existing conversation
  if (conversationId) {
    const conv = addMessage(String(conversationId), 'customer', String(message).trim());
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    return res.json({ ok: true, conversation: conv });
  }

  // New conversation
  if (!subject || !String(subject).trim()) {
    return res.status(400).json({ error: 'Subject is required for new conversations' });
  }

  const conv = createConversation({
    userId:    user.id,
    userName:  user.name,
    userEmail: user.email,
    subject:   String(subject).trim(),
    category:  String(category).trim(),
    message:   String(message).trim(),
  });

  await createOperationsItem({
    source: 'support_ticket', referenceId: conv.id, title: conv.subject,
    summary: String(message).trim(), requesterName: user.name, requesterEmail: user.email,
    userId: user.id, priority: conv.priority === 'medium' ? 'normal' : conv.priority,
    metadata: { category: conv.category },
  });

  await createNotification(
    user.id,
    'Support Request Received',
    `Your support request "${conv.subject}" has been received. Our team will respond shortly.`,
  );

  return res.status(201).json({ ok: true, conversation: conv });
}
