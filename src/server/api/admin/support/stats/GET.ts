/**
 * GET /api/admin/support/stats
 * Aggregate support metrics: conversation stats plus counts of unread
 * messages, new contact forms/feedback, open/critical complaints, and
 * active announcements.
 */
import type { Request, Response } from 'express';
import { getSupportStats } from '../../../../lib/supportStore.js';
import { getSupportExtSummary } from '../../../../lib/supportExtStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    const conversations = getSupportStats();
    const extensions = getSupportExtSummary();
    return res.json({ ok: true, conversations, extensions });
  } catch (err) {
    console.error('[admin/support/stats] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load support stats' });
  }
}
