/**
 * POST /api/admin/cms/navigation
 * Body: { links: NavLink[] } — replaces the full navigation set.
 */
import type { Request, Response } from 'express';
import { saveNavigation, type NavLink } from '../../../../lib/cmsExtStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const { links } = req.body as { links?: unknown };
  if (!Array.isArray(links)) return res.status(400).json({ ok: false, error: 'links must be an array' });

  const saved = saveNavigation(links as NavLink[]);
  appendAudit({ event: 'admin_cms_navigation_updated', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown' });
  return res.json({ ok: true, links: saved });
}
