/**
 * GET /api/admin/cms
 * Return the currently saved CMS content, or defaults if none saved yet.
 */
import type { Request, Response } from 'express';
import { readCmsSettings } from '../../../lib/cmsSettingsStore.js';

export default async function handler(_req: Request, res: Response) {

  try {
    return res.json({ ok: true, data: await readCmsSettings() });
  } catch (err) {
    console.error('admin.cms.get.error', err);
    return res.status(500).json({ error: 'Failed to load CMS content.' });
  }
}
