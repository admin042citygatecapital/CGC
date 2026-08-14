import type { Request, Response } from 'express';
import { normalizeBusinessAddress } from '../../../../lib/businessLocation.js';
import { writeWebsiteSettings } from '../../../lib/websiteStore.js';
import { appendCriticalAudit } from '../../../lib/auditLog.js';
import { normalizeAccountPlans } from '../../../../lib/accountPlans.js';

export default async function handler(req: Request, res: Response) {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings required' });

  if (settings.footerAddress !== undefined) {
    if (typeof settings.footerAddress !== 'string' || settings.footerAddress.trim().length > 300) {
      return res.status(400).json({ error: 'Address must be 300 characters or fewer.' });
    }
    settings.footerAddress = normalizeBusinessAddress(settings.footerAddress);
  }

  if (settings.businessAddressPublished !== undefined && typeof settings.businessAddressPublished !== 'boolean') {
    return res.status(400).json({ error: 'Invalid business-address publication option.' });
  }
  if (
    settings.businessAddressPublicationEvidence !== undefined
    && (typeof settings.businessAddressPublicationEvidence !== 'string' || settings.businessAddressPublicationEvidence.trim().length > 500)
  ) {
    return res.status(400).json({ error: 'Address evidence must be 500 characters or fewer.' });
  }
  if (
    settings.businessAddressPublished === true
    && (typeof settings.businessAddressPublicationEvidence !== 'string' || settings.businessAddressPublicationEvidence.trim().length < 10)
  ) {
    return res.status(400).json({ error: 'Record documentary address evidence before publishing this location.' });
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

  if (settings.accountPlans !== undefined) {
    if (!Array.isArray(settings.accountPlans) || settings.accountPlans.length !== 3) {
      return res.status(400).json({ error: 'Standard, Premium and Elite plan configurations are required.' });
    }
    settings.accountPlans = normalizeAccountPlans(settings.accountPlans);
    if (!settings.accountPlans.some((plan: { visible: boolean }) => plan.visible)) {
      return res.status(400).json({ error: 'At least one account plan must remain visible.' });
    }
  }

  const adminId = req.adminSession?.adminId ?? 'admin';
  await appendCriticalAudit({
    event: 'admin_website_settings_updated',
    adminId,
    ip: req.ip ?? 'unknown',
    meta: { fields: Object.keys(settings) },
  });
  await writeWebsiteSettings(settings, adminId);
  res.json({ ok: true });
}
