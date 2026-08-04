/**
 * POST /api/admin/support/messages
 * Body: { id: string, reply?: string } | { id: string, read?: boolean,
 *        starred?: boolean, archived?: boolean }
 * Reply to a direct message, or update its read/starred/archived flags.
 */
import type { Request, Response } from 'express';
import { replyToMessage, updateMessage } from '../../../../lib/supportExtStore.js';
import { findAdminByEmail } from '../../../../lib/adminCredentials.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const raw = req.body as { id?: string; reply?: string; read?: boolean; starred?: boolean; archived?: boolean };
  if (!raw.id) return res.status(400).json({ ok: false, error: 'id is required' });

  if (typeof raw.reply === 'string' && raw.reply.trim()) {
    const adminEmail = req.adminSession?.email ?? '';
    const adminName = (await findAdminByEmail(adminEmail))?.name ?? adminEmail;
    const message = replyToMessage(raw.id, sanitizeString(raw.reply, 10_000), adminName);
    if (!message) return res.status(404).json({ ok: false, error: 'Message not found' });

    appendAudit({
      event: 'support_message_replied',
      adminId: req.adminSession?.adminId,
      email: adminEmail,
      ip: req.ip ?? 'unknown',
      meta: { id: raw.id },
    });

    return res.status(201).json({ ok: true, message });
  }

  const patch: Record<string, boolean> = {};
  if (typeof raw.read === 'boolean') patch.read = raw.read;
  if (typeof raw.starred === 'boolean') patch.starred = raw.starred;
  if (typeof raw.archived === 'boolean') patch.archived = raw.archived;
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ ok: false, error: 'Provide reply, or at least one of read/starred/archived' });
  }

  const message = updateMessage(raw.id, patch);
  if (!message) return res.status(404).json({ ok: false, error: 'Message not found' });

  return res.json({ ok: true, message });
}
