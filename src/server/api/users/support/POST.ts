/**
 * POST /api/users/support
 * Customer sends a support message / opens a conversation.
 * Body: { subject, category, message } or { conversationId, message } (to reply)
 */
import type { Request, Response } from 'express';
import { createConversation, addCustomerMessage } from '../../../lib/supportDatabaseStore.js';
import { createNotification } from '../../../lib/notificationStore.js';
import { createOperationsItem } from '../../../lib/operationsInboxStore.js';
import { requireIntakeEnabled } from '../../../lib/operationalControls.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (!requireIntakeEnabled(res, 'supportTicketsEnabled')) return;

  const { subject, category = 'General', priority = 'medium', message, conversationId } = req.body ?? {};
  const cleanMessage = String(message ?? '').trim();
  const allowedCategories = new Set([
    'Account Access', 'Identity Verification', 'Transfer Workspace', 'Card Workspace',
    'Trading Workspace', 'Technical Support', 'General',
  ]);
  const allowedPriorities = new Set(['low', 'medium', 'high']);

  if (!cleanMessage) {
    return res.status(400).json({ error: 'Message is required' });
  }
  if (cleanMessage.length > 5000) return res.status(400).json({ error: 'Message must be 5,000 characters or fewer' });

  // Reply to existing conversation
  if (conversationId) {
    const cleanId = String(conversationId).trim();
    if (!/^sup_[a-f0-9]{16}$/i.test(cleanId)) return res.status(400).json({ error: 'Invalid conversation ID' });
    const conv = await addCustomerMessage(cleanId, user.id, cleanMessage);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    return res.json({ ok: true, conversation: conv });
  }

  // New conversation
  const cleanSubject = String(subject ?? '').trim();
  const cleanCategory = String(category).trim();
  const cleanPriority = String(priority).trim();
  if (!cleanSubject) {
    return res.status(400).json({ error: 'Subject is required for new conversations' });
  }
  if (cleanSubject.length > 200) return res.status(400).json({ error: 'Subject must be 200 characters or fewer' });
  if (!allowedCategories.has(cleanCategory)) return res.status(400).json({ error: 'Invalid support category' });
  if (!allowedPriorities.has(cleanPriority)) return res.status(400).json({ error: 'Invalid priority' });

  const conv = await createConversation({
    userId:    user.id,
    userName:  user.name,
    userEmail: user.email,
    subject: cleanSubject,
    category: cleanCategory,
    message: cleanMessage,
    priority: cleanPriority as 'low' | 'medium' | 'high',
  });

  await createOperationsItem({
    source: 'support_ticket', referenceId: conv.id, title: conv.subject,
    summary: cleanMessage, requesterName: user.name, requesterEmail: user.email,
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
