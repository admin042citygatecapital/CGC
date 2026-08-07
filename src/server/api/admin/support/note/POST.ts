/**
 * POST /api/admin/support/note
 * Add an internal note to a ticket (not visible to customer).
 * Body: { conversationId, text }
 */
import type { Request, Response } from 'express';
import { addInternalNote } from '../../../../lib/supportStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { conversationId, text } = req.body ?? {};

  if (!conversationId) return res.status(400).json({ ok: false, error: 'conversationId required' });
  if (!text?.trim())   return res.status(400).json({ ok: false, error: 'text required' });

  const conv = addInternalNote(
    String(conversationId),
    String(text).trim(),
    session.adminId,
    session.email,
  );
  if (!conv) return res.status(404).json({ ok: false, error: 'Ticket not found' });

  appendAudit({
    event:   'admin_support_note',
    adminId: session.adminId,
    ip:      req.ip ?? 'unknown',
    meta:    { conversationId },
  });

  return res.json({ ok: true, conversation: conv });
}
