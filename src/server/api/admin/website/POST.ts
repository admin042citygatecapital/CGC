import type { Request, Response } from 'express';
import { writeWebsiteSettings } from '../../../lib/websiteStore.js';
import { appendAudit } from '../../../lib/auditLog.js';

export default function handler(req: Request, res: Response) {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings required' });

  const previewText = settings.previewNoticeText;
  if (
    previewText !== undefined
    && (typeof previewText !== 'string' || previewText.trim().length < 40 || previewText.trim().length > 600)
  ) {
    return res.status(400).json({ error: 'Preview notice must be between 40 and 600 characters.' });
  }
  if (
    settings.previewNoticePosition !== undefined
    && !['top', 'bottom'].includes(settings.previewNoticePosition)
  ) {
    return res.status(400).json({ error: 'Invalid preview notice position.' });
  }
  if (
    settings.previewNoticeTone !== undefined
    && !['amber', 'neutral'].includes(settings.previewNoticeTone)
  ) {
    return res.status(400).json({ error: 'Invalid preview notice tone.' });
  }
  if (
    settings.previewNoticeCompact !== undefined
    && typeof settings.previewNoticeCompact !== 'boolean'
  ) {
    return res.status(400).json({ error: 'Invalid preview notice display option.' });
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
