/**
 * DELETE /api/admin/email/queue/:id
 * Permanently remove a single email from the queue or logs by ID.
 */
import type { Request, Response } from 'express';
import { purgeEmail } from '../../../../../lib/emailQueue.js';

export default async function handler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing email id' });
  }
  const removed = purgeEmail(id);
  if (!removed) {
    return res.status(404).json({ ok: false, error: 'Email not found in queue or logs' });
  }
  return res.json({ ok: true, purged: id });
}
