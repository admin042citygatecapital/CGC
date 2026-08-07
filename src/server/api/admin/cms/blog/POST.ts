import type { Request, Response } from 'express';
import { upsertBlog, deleteBlog } from '../../../../lib/cmsExtStore.js';
export default function handler(req: Request, res: Response) {
  const { action, id, ...data } = req.body ?? {};
  try {
    if (action === 'delete') { return res.json({ ok: deleteBlog(id) }); }
    res.json({ ok: true, post: upsertBlog({ id, ...data }) });
  } catch (err) { res.status(500).json({ error: String(err) }); }
}
