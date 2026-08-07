/**
 * POST /api/admin/email/requeue
 * SUPER_ADMIN only.
 *
 * Resets ALL exhausted (failed) emails from the log back into the active
 * queue so they will be retried on the next flush or worker cycle.
 *
 * Also accepts an optional body { ids: string[] } to requeue specific emails.
 *
 * Returns: { requeued: number; ids: string[] }
 */
import type { Request, Response } from 'express';
import { getEmailLogs, requeueEmail, getQueueStats } from '../../../../lib/emailQueue.js';

export default async function handler(req: Request, res: Response) {
  const { ids } = req.body as { ids?: string[] };

  let targetIds: string[];

  if (Array.isArray(ids) && ids.length > 0) {
    targetIds = ids;
  } else {
    const logs = await getEmailLogs(500);
    targetIds = logs.filter(e => e.status === 'failed').map(e => e.id);
  }

  const requeued: string[] = [];
  for (const id of targetIds) {
    const ok = await requeueEmail(id);
    if (ok) requeued.push(id);
  }

  const stats = await getQueueStats();

  console.log(JSON.stringify({ event: 'email.requeue.manual', requeued: requeued.length, ids: requeued }));

  return res.json({ ok: true, requeued: requeued.length, ids: requeued, queue: stats });
}
