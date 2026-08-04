/**
 * GET /api/admin/support/announcements
 * Query: status, audience, page, limit
 */
import type { Request, Response } from 'express';
import { getAnnouncements } from '../../../../lib/supportExtStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const q = req.query as Record<string, string | undefined>;
    const result = getAnnouncements({
      status: q.status,
      audience: q.audience,
      page: q.page ? Math.max(1, parseInt(q.page, 10) || 1) : undefined,
      limit: q.limit ? Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20)) : undefined,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[admin/support/announcements GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load announcements' });
  }
}
