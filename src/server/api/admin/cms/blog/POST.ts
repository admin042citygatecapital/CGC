/**
 * POST /api/admin/cms/blog
 * Body: { action: 'delete', id } to remove, otherwise
 * Partial<BlogPost> & { id? } to create (no id) or update (id given).
 */
import type { Request, Response } from 'express';
import { upsertBlog, deleteBlog, type BlogPost } from '../../../../lib/cmsExtStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const raw = req.body as { action?: string; id?: string } & Partial<BlogPost>;

  if (raw.action === 'delete') {
    if (!raw.id) return res.status(400).json({ ok: false, error: 'id is required to delete' });
    const ok = deleteBlog(raw.id);
    if (!ok) return res.status(404).json({ ok: false, error: 'Post not found' });
    return res.json({ ok: true });
  }

  const post = upsertBlog(raw);
  appendAudit({ event: 'admin_cms_blog_saved', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { id: post.id } });
  return res.status(201).json({ ok: true, post });
}
