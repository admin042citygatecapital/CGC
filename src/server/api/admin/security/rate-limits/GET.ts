/** GET /api/admin/security/rate-limits */
import type { Request, Response } from 'express';
import { readRateLimits } from '../../../../lib/securityCenterStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    res.json({ rules: await readRateLimits() });
  } catch {
    res.status(500).json({ error: 'Failed to load rate limits' });
  }
}
