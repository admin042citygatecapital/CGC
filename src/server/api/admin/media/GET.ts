import type { Request, Response } from 'express';
import { listMedia, getMediaStats, getFolders, getAllTags } from '../../../lib/mediaStore.js';
import type { MediaType } from '../../../lib/mediaStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { type, folder, tag, search, page, limit, view } = req.query as Record<string, string>;

    if (view === 'stats') {
      return res.json({ ...(await getMediaStats()), optimizedCount: 0, optimizerConfigured: false });
    }
    if (view === 'folders') {
      return res.json({ folders: await getFolders() });
    }
    if (view === 'tags') {
      return res.json({ tags: await getAllTags() });
    }

    const result = await listMedia({
      type:   type ? type as MediaType : undefined,
      folder: folder || undefined,
      tag:    tag    || undefined,
      search: search || undefined,
      page:   page   ? parseInt(page,  10) : 1,
      limit:  limit  ? parseInt(limit, 10) : 50,
    });

    res.json({
      ...result,
      data: result.data.map(record => ({ ...record, optimized: false, optimizedSize: undefined })),
      optimizerConfigured: false,
    });
  } catch (error) {
    console.error('admin.media.list.failed', { errorType: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({ error: 'The media library could not be loaded.' });
  }
}
