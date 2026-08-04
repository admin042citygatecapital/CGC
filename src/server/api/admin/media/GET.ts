/**
 * GET /api/admin/media
 * Query: type?, folder?, tag?, search?, page?, limit?, stats=true for
 * aggregate stats instead of a list.
 */
import type { Request, Response } from 'express';
import { listMedia, getMediaStats, getFolders, getAllTags, type MediaType } from '../../../lib/mediaStore.js';

export default async function handler(req: Request, res: Response) {
  const q = req.query as Record<string, string | undefined>;

  if (q.stats === 'true') {
    return res.json({ ok: true, stats: getMediaStats(), folders: getFolders(), tags: getAllTags() });
  }

  const { data, total } = listMedia({
    type: q.type as MediaType | undefined,
    folder: q.folder,
    tag: q.tag,
    search: q.search,
    page: q.page ? Math.max(1, parseInt(q.page, 10) || 1) : undefined,
    limit: q.limit ? Math.min(200, Math.max(1, parseInt(q.limit, 10) || 50)) : undefined,
  });

  return res.json({ ok: true, media: data, total });
}
