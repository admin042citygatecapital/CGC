/**
 * GET /api/admin/cms/blog
 * Query: status?, category?, search?, page?, limit?
 */
import type { Request, Response } from 'express';
import { getBlog } from '../../../../lib/cmsExtStore.js';

export default async function handler(req: Request, res: Response) {
  const q = req.query as Record<string, string | undefined>;
  const { data, total } = getBlog({
    status: q.status, category: q.category, search: q.search,
    page: q.page ? Math.max(1, parseInt(q.page, 10) || 1) : undefined,
    limit: q.limit ? Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20)) : undefined,
  });
  return res.json({ ok: true, posts: data, total });
}
