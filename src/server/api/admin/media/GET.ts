import type { Request, Response } from 'express';
import { listMedia, getMediaStats, getFolders, getAllTags } from '../../../lib/mediaStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { type, folder, tag, search, page, limit, view } = req.query as Record<string, string>;

    if (view === 'stats') {
      return res.json(getMediaStats());
    }
    if (view === 'folders') {
      return res.json({ folders: getFolders() });
    }
    if (view === 'tags') {
      return res.json({ tags: getAllTags() });
    }

    const result = listMedia({
      type:   type   as any || undefined,
      folder: folder || undefined,
      tag:    tag    || undefined,
      search: search || undefined,
      page:   page   ? parseInt(page,  10) : 1,
      limit:  limit  ? parseInt(limit, 10) : 50,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list media', message: String(err) });
  }
}
