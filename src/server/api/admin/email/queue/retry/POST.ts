/**
 * POST /api/admin/email/queue/retry
 * Re-queue a failed email for retry. Body: { id: string }
 */
import type { Request, Response } from 'express';
import { requeueEmail } from '../../../../../lib/emailQueue.js';

export default function handler(req: Request, res: Response) {
  const { id } = req.body as { id?: string };
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
  const ok = requeueEmail(id);
  if (!ok) return res.status(404).json({ ok: false, error: 'Email not found in logs' });
  return res.json({ ok: true, message: 'Email re-queued for retry' });
}
