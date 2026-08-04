/**
 * GET /api/admin/cms/features
 * Query: page? — filter feature cards to one page.
 */
import type { Request, Response } from 'express';
import { getFeatureCards } from '../../../../lib/cmsExtStore.js';

export default async function handler(req: Request, res: Response) {
  const { page } = req.query as { page?: string };
  return res.json({ ok: true, features: getFeatureCards(page) });
}
