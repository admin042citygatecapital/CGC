/** GET /api/settings/website — safe public projection of website settings. */
import type { Request, Response } from 'express';
import { resolveBusinessLocation } from '../../../../lib/businessLocation.js';
import { resolveWebsiteAnnouncement } from '../../../../lib/websiteAnnouncement.js';
import { readWebsiteSettings } from '../../../lib/websiteStore.js';

export default function handler(_req: Request, res: Response) {
  const settings = readWebsiteSettings();
  return res
    .set('Cache-Control', 'no-store')
    .json({
      ok: true,
      data: {
        announcement: resolveWebsiteAnnouncement(settings),
        location: resolveBusinessLocation(settings),
      },
    });
}
