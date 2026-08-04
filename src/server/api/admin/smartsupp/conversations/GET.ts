/**
 * GET /api/admin/smartsupp/conversations
 * Query: status?, search?, page?, limit?
 */
import type { Request, Response } from 'express';
import { getConversations } from '../../../../lib/smartsuppStore.js';

export default async function handler(req: Request, res: Response) {
  const q = req.query as Record<string, string | undefined>;
  const { data, total } = getConversations({
    status: q.status, search: q.search,
    page: q.page ? Math.max(1, parseInt(q.page, 10) || 1) : undefined,
    limit: q.limit ? Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20)) : undefined,
  });
  return res.json({ ok: true, conversations: data, total });
}
