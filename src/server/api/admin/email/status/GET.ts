/**
 * GET /api/admin/email/status
 * SUPER_ADMIN only.
 * Returns live OAuth credential diagnosis + queue stats + recent email logs.
 */
import type { Request, Response } from 'express';
import { diagnoseOAuthCredentials } from '../../../../lib/zohoTokenStore.js';
import { getQueueStats, getEmailLogs, getPendingQueue } from '../../../../lib/emailQueue.js';

export default async function handler(_req: Request, res: Response) {
  const oauth   = diagnoseOAuthCredentials();
  const stats   = await getQueueStats();
  const pending = await getPendingQueue();
  const logs    = await getEmailLogs(50);

  return res.json({ ok: true, oauth,
    queue: {
      stats,
      pending: pending.slice(0, 20),
    },
    recentLogs: logs,
  });
}
