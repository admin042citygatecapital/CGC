/**
 * POST /api/admin/cms
 * Persist CMS content settings to disk.
 * Body: CMS form fields (heroTitle, heroSubtitle, heroCTA, metaTitle, etc.)
 */
import type { Request, Response } from 'express';
import { appendCriticalAudit } from '../../../lib/auditLog.js';
import { validateCmsSettings, writeCmsSettings } from '../../../lib/cmsSettingsStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const body = validateCmsSettings(req.body);
    if (!body) {
      return res.status(400).json({ error: 'Invalid request body.' });
    }

    const session = req.adminSession!;
    await appendCriticalAudit({
      event: 'admin_cms_updated',
      adminId: session.adminId,
      email: session.email,
      ip: req.ip ?? 'unknown',
      meta: { fields: Object.keys(body) },
    });
    const data = await writeCmsSettings(body, session.adminId);

    return res.json({ ok: true, message: 'CMS content saved.', data });
  } catch (err) {
    console.error('admin.cms.save.error', err);
    return res.status(500).json({ error: 'Failed to save CMS content.' });
  }
}
