/**
 * POST /api/admin/support/reply
 * Admin replies to a support conversation.
 * Body: { conversationId, message, status? }
 */
import type { Request, Response } from 'express';
import { addMessage, updateConversationStatus, type SupportConversation } from '../../../../lib/supportDatabaseStore.js';
import { createNotification } from '../../../../lib/notificationStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sendSupportReplyEmail } from '../../../../lib/emailService.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { conversationId, message, status } = req.body ?? {};

  if (!conversationId) return res.status(400).json({ error: 'conversationId is required' });
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'message is required' });

  const conv = await addMessage(
    String(conversationId),
    'admin',
    String(message).trim(),
    session.adminId,
  );

  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  // Update status if provided
  if (status) await updateConversationStatus(String(conversationId), status as SupportConversation['status']);

  // Notify the customer
  await createNotification(
    conv.userId,
    'Support Reply',
    `Our team has replied to your support request: "${conv.subject}". Tap to view.`,
    '/support',
  );

  await sendSupportReplyEmail(
    conv.userEmail,
    conv.userName || 'Customer',
    conv.subject,
    String(message).trim(),
  );

  appendAudit({
    event:   'admin_support_reply',
    adminId: session.adminId,
    userId:  conv.userId,
    email:   conv.userEmail,
    ip:      req.ip ?? 'unknown',
    meta:    { conversationId },
  });

  return res.json({ ok: true, conversation: conv });
}
