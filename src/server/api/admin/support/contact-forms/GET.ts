/**
 * GET /api/admin/support/contact-forms
 * Query: status, search, page, limit
 */
import type { Request, Response } from 'express';
import { getContactForms } from '../../../../lib/supportExtStore.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  try {
    const q = req.query as Record<string, string | undefined>;
    const result = getContactForms({
      status: q.status,
      search: q.search ? sanitizeString(q.search) : undefined,
      page: q.page ? Math.max(1, parseInt(q.page, 10) || 1) : undefined,
      limit: q.limit ? Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20)) : undefined,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[admin/support/contact-forms GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load contact form submissions' });
  }
}
