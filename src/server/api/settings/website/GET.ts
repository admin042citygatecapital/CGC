/** GET /api/settings/website — safe public projection of website settings. */
import type { Request, Response } from 'express';
import { resolveWebsiteAnnouncement } from '../../../../lib/websiteAnnouncement.js';
import { readWebsiteSettings } from '../../../lib/websiteStore.js';

export default function handler(_req: Request, res: Response) {
  return res
    .set('Cache-Control', 'public, max-age=30, stale-while-revalidate=30')
    .json({
      ok: true,
      data: {
        announcement: resolveWebsiteAnnouncement(readWebsiteSettings()),
      },
    });
}
