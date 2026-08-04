/**
 * POST /api/admin/support/note
 * Body: { id: string, text: string }
 * Add an internal (customer-invisible) note to a support conversation.
 */
import type { Request, Response } from 'express';
import { addInternalNote } from '../../../../lib/supportStore.js';
import { findAdminByEmail } from '../../../../lib/adminCredentials.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const { id } = req.body as { id?: string };
  const text = sanitizeString((req.body as { text?: unknown }).text, 5000);

  if (!id || !text) {
    return res.status(400).json({ ok: false, error: 'id and text are required' });
  }

  const adminId = req.adminSession?.adminId ?? 'admin';
  const adminEmail = req.adminSession?.email ?? '';
  const adminName = (await findAdminByEmail(adminEmail))?.name ?? adminEmail;

  const conversation = addInternalNote(id, text, adminId, adminName);
  if (!conversation) return res.status(404).json({ ok: false, error: 'Conversation not found' });

  appendAudit({
    event: 'support_internal_note_added',
    adminId,
    email: adminEmail,
    ip: req.ip ?? 'unknown',
    meta: { conversationId: id },
  });

  return res.status(201).json({ ok: true, conversation });
}
