import type { Request, Response } from 'express';
import { upsertNews, deleteNews } from '../../../../lib/cmsExtStore.js';
export default async function handler(req: Request, res: Response) {
  const { action, id, ...data } = req.body ?? {};
  try {
    if (action === 'delete') {
      if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'id required' });
      return res.json({ ok: await deleteNews(id, req.adminSession!.adminId) });
    }
    if (JSON.stringify(data).length > 500_000 || typeof data.title !== 'string' || data.title.length > 300 || typeof data.body !== 'string' || data.body.length > 400_000 || (data.status !== undefined && !['draft','published','archived'].includes(data.status))) return res.status(400).json({ error: 'Invalid news article.' });
    res.json({ ok: true, article: await upsertNews({ id, ...data }, req.adminSession!.adminId) });
  } catch (err) { console.error('cms.news.save_failed', err); res.status(500).json({ error: 'Unable to update news article.' }); }
}
