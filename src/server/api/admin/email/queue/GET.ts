/**
 * GET /api/admin/email/queue
 * Returns email logs and queue stats.
 * Query: ?view=logs|pending&limit=100
 */
import type { Request, Response } from 'express';
import { getEmailLogs, getPendingQueue, getQueueStats, toEmailDiagnostic } from '../../../../lib/emailQueue.js';

export default async function handler(req: Request, res: Response) {
  const { view = 'logs', limit = '100' } = req.query as { view?: string; limit?: string };
  const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));

  if (view === 'pending') {
    const [data, stats] = await Promise.all([getPendingQueue(), getQueueStats()]);
    return res.json({ data: data.map(toEmailDiagnostic), stats });
  }

  const [data, stats] = await Promise.all([getEmailLogs(limitNum), getQueueStats()]);
  return res.json({ data: data.map(toEmailDiagnostic), stats });
}
