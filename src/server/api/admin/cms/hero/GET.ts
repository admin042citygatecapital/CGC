/**
 * GET /api/admin/cms/hero
 */
import type { Request, Response } from 'express';
import { getHeroMedia } from '../../../../lib/cmsExtStore.js';

export default async function handler(_req: Request, res: Response) {
  return res.json({ ok: true, hero: getHeroMedia() });
}
