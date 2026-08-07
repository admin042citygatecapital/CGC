/**
 * GET /api/admin/rates
 * Returns the full rates config: exchange rates, transfer fees, FX markups,
 * tier fees, and withdrawal limits.
 */
import type { Request, Response } from 'express';
import { readRatesConfig } from '../../../lib/ratesStore.js';

export default function handler(_req: Request, res: Response) {
  return res.json(readRatesConfig());
}
