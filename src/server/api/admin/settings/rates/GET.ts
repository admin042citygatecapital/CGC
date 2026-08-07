/**
 * GET /api/admin/settings/rates
 * Admin reads current exchange rates and fees config.
 */
import type { Request, Response } from 'express';
import { readRatesConfig } from '../../../../lib/ratesStore.js';

export default function handler(_req: Request, res: Response) {
  return res.json(readRatesConfig());
}
