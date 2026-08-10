import type { Request, Response } from 'express';
import { normalizeBusinessAddress } from '../../../../lib/businessLocation.js';
import { writeWebsiteSettings } from '../../../lib/websiteStore.js';
import { appendAudit } from '../../../lib/auditLog.js';

export default function handler(req: Request, res: Response) {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings required' });

  if (settings.footerAddress !== undefined) {
    if (typeof settings.footerAddress !== 'string' || settings.footerAddress.trim().length > 300) {
      return res.status(400).json({ error: 'Address must be 300 characters or fewer.' });
    }
    settings.footerAddress = normalizeBusinessAddress(settings.footerAddress);
  }

  if (settings.announcementEnabled !== undefined && typeof settings.announcementEnabled !== 'boolean') {
    return res.status(400).json({ error: 'Invalid announcement display option.' });
  }
  if (
    settings.announcementText !== undefined
    && (typeof settings.announcementText !== 'string' || settings.announcementText.trim().length < 10 || settings.announcementText.trim().length > 300)
  ) {
    return res.status(400).json({ error: 'Announcement text must be between 10 and 300 characters.' });
  }
  if (settings.announcementLink !== undefined) {
    const link = settings.announcementLink;
    if (
      typeof link !== 'string'
      || link.length > 200
      || (link !== '' && !link.startsWith('/') && !link.startsWith('https://citygate.capital'))
    ) {
      return res.status(400).json({ error: 'Announcement link must be blank or point to City Gate Capital.' });
    }
  }

  writeWebsiteSettings(settings);
  appendAudit({
    event: 'admin_website_settings_updated',
    ip: req.ip ?? 'unknown',
    meta: { fields: Object.keys(settings) },
  });
  res.json({ ok: true });
}
