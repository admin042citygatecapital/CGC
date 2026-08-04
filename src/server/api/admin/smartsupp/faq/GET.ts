/**
 * GET /api/admin/smartsupp/faq
 * Query: category?, enabled?
 */
import type { Request, Response } from 'express';
import { getFaq } from '../../../../lib/smartsuppStore.js';

export default async function handler(req: Request, res: Response) {
  const { category, enabled } = req.query as { category?: string; enabled?: string };
  const faq = getFaq({
    category,
    enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
  });
  return res.json({ ok: true, faq });
}
