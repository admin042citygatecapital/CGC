import type { Request, Response } from 'express';
import { getPublicPlatformFeatures } from '../../../lib/platformFeatureControls.js';

export default function handler(_req: Request, res: Response) {
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  res.json({ features: getPublicPlatformFeatures() });
}
