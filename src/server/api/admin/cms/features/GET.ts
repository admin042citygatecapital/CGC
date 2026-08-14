import type { Request, Response } from 'express';
import { getFeatureCards } from '../../../../lib/cmsExtStore.js';
export default async function handler(req: Request, res: Response) {
  const { page } = req.query as Record<string, string>;
  res.json({ features: await getFeatureCards(page) });
}
