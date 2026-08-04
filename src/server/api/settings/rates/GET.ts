/**
 * GET /api/settings/rates
 * Public endpoint — returns current exchange rates and transfer fees.
 */
import type { Request, Response } from 'express';
import { readRatesConfig } from '../../../lib/ratesStore.js';

export default function handler(_req: Request, res: Response) {
  const config = readRatesConfig();
  return res.json(config);
}
