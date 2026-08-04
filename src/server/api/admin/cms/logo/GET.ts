/**
 * GET /api/admin/cms/logo
 */
import type { Request, Response } from 'express';
import { getLogoConfig } from '../../../../lib/cmsExtStore.js';

export default async function handler(_req: Request, res: Response) {
  return res.json({ ok: true, logo: getLogoConfig() });
}
