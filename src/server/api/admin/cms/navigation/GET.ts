/**
 * GET /api/admin/cms/navigation
 */
import type { Request, Response } from 'express';
import { getNavigation } from '../../../../lib/cmsExtStore.js';

export default async function handler(_req: Request, res: Response) {
  return res.json({ ok: true, links: getNavigation() });
}
