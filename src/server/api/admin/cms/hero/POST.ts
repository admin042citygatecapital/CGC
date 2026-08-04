/**
 * POST /api/admin/cms/hero
 * Body: Partial<HeroMedia>
 */
import type { Request, Response } from 'express';
import { saveHeroMedia, type HeroMedia } from '../../../../lib/cmsExtStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const hero = saveHeroMedia(req.body as Partial<HeroMedia>);
  appendAudit({ event: 'admin_cms_hero_updated', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown' });
  return res.json({ ok: true, hero });
}
