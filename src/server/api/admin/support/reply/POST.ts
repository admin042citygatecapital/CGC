/**
 * POST /api/admin/support/reply
 * Body: { id: string, text: string }
 * Add an admin reply to a support conversation (customer-visible). Moves
 * the conversation to 'in_progress' and stamps firstReplyAt — see
 * supportStore.addMessage.
 */
import type { Request, Response } from 'express';
import { addMessage, getConversationById } from '../../../../lib/supportStore.js';
import { findAdminByEmail } from '../../../../lib/adminCredentials.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const { id } = req.body as { id?: string };
  const text = sanitizeString((req.body as { text?: unknown }).text, 10_000);

  if (!id || !text) {
    return res.status(400).json({ ok: false, error: 'id and text are required' });
  }

  const existing = getConversationById(id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Conversation not found' });

  const adminEmail = req.adminSession?.email ?? '';
  const adminName = (await findAdminByEmail(adminEmail))?.name ?? adminEmail;

  const conversation = addMessage(id, 'admin', text, adminName);

  appendAudit({
    event: 'support_admin_reply',
    adminId: req.adminSession?.adminId,
    email: adminEmail,
    ip: req.ip ?? 'unknown',
    meta: { conversationId: id },
  });

  return res.status(201).json({ ok: true, conversation });
}
