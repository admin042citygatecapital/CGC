/**
 * POST /api/admin/cms/logo
 * Body: Partial<LogoConfig>
 */
import type { Request, Response } from 'express';
import { saveLogoConfig, type LogoConfig } from '../../../../lib/cmsExtStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const logo = saveLogoConfig(req.body as Partial<LogoConfig>);
  appendAudit({ event: 'admin_cms_logo_updated', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown' });
  return res.json({ ok: true, logo });
}
