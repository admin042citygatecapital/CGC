/**
 * POST /api/admin/email/purge
 * Purge all failed/exhausted emails from the queue and logs.
 * Body: {} (purge all failed) or { id: string } (purge single item)
 */
import type { Request, Response } from 'express';
import { purgeEmail, purgeAllFailed } from '../../../../lib/emailQueue.js';

export default async function handler(req: Request, res: Response) {
  const { id } = req.body as { id?: string };

  if (id) {
    const removed = purgeEmail(id);
    if (!removed) return res.status(404).json({ ok: false, error: 'Email not found' });
    return res.json({ ok: true, purged: 1, ids: [id] });
  }

  const count = purgeAllFailed();
  return res.json({ ok: true, purged: count });
}
