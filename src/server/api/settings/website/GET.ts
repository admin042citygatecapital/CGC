/** GET /api/settings/website — safe public projection of website settings. */
import type { Request, Response } from 'express';
import { resolvePublicBusinessLocation } from '../../../../lib/businessLocation.js';
import { resolveWebsiteAnnouncement } from '../../../../lib/websiteAnnouncement.js';
import { readWebsiteSettings } from '../../../lib/websiteStore.js';
import { normalizeAccountPlans } from '../../../../lib/accountPlans.js';

export default async function handler(_req: Request, res: Response) {
  try {
    const settings = await readWebsiteSettings();
    return res
      .set('Cache-Control', 'no-store')
      .json({
        ok: true,
        data: {
          announcement: resolveWebsiteAnnouncement(settings),
          location: resolvePublicBusinessLocation(settings),
          accountPlans: normalizeAccountPlans(settings.accountPlans),
        },
      });
  } catch {
    return res.status(503).set('Cache-Control', 'no-store').json({ error: 'Website settings are temporarily unavailable.' });
  }
}
