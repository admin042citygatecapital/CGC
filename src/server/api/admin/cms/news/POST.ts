/**
 * POST /api/admin/cms/news
 * Body: { action: 'delete', id } to remove, otherwise
 * Partial<NewsArticle> & { id? } to create (no id) or update (id given).
 */
import type { Request, Response } from 'express';
import { upsertNews, deleteNews, type NewsArticle } from '../../../../lib/cmsExtStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const raw = req.body as { action?: string; id?: string } & Partial<NewsArticle>;

  if (raw.action === 'delete') {
    if (!raw.id) return res.status(400).json({ ok: false, error: 'id is required to delete' });
    const ok = deleteNews(raw.id);
    if (!ok) return res.status(404).json({ ok: false, error: 'Article not found' });
    return res.json({ ok: true });
  }

  const article = upsertNews(raw);
  appendAudit({ event: 'admin_cms_news_saved', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { id: article.id } });
  return res.status(201).json({ ok: true, article });
}
