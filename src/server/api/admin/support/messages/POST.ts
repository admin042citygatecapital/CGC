/**
 * POST /api/admin/support/messages
 * Actions: reply, mark_read, star, archive, create
 */
import type { Request, Response } from 'express';
import { updateMessage, replyToMessage, createMessage } from '../../../../lib/supportExtStore.js';

export default function handler(req: Request, res: Response) {
  const { action, id, body, adminName, ...data } = req.body ?? {};
  try {
    if (action === 'reply') {
      if (!id || !body) return res.status(400).json({ error: 'id and body required' });
      const msg = replyToMessage(id, body, adminName ?? 'Admin');
      if (!msg) return res.status(404).json({ error: 'Message not found' });
      return res.json({ ok: true, message: msg });
    }
    if (action === 'mark_read') {
      const msg = updateMessage(id, { read: true });
      return res.json({ ok: !!msg, message: msg });
    }
    if (action === 'star') {
      const msg = updateMessage(id, { starred: data.starred ?? true });
      return res.json({ ok: !!msg, message: msg });
    }
    if (action === 'archive') {
      const msg = updateMessage(id, { archived: true });
      return res.json({ ok: !!msg, message: msg });
    }
    // default: create
    const msg = createMessage(data);
    res.status(201).json({ ok: true, message: msg });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
