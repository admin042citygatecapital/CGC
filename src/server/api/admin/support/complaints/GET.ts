/**
 * GET /api/admin/support/complaints
 * Query: status, severity, category, search, page, limit
 */
import type { Request, Response } from 'express';
import { getComplaints } from '../../../../lib/supportExtStore.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  try {
    const q = req.query as Record<string, string | undefined>;
    const result = getComplaints({
      status: q.status,
      severity: q.severity,
      category: q.category,
      search: q.search ? sanitizeString(q.search) : undefined,
      page: q.page ? Math.max(1, parseInt(q.page, 10) || 1) : undefined,
      limit: q.limit ? Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20)) : undefined,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[admin/support/complaints GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load complaints' });
  }
}
