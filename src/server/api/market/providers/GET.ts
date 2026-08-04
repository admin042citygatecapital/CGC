/**
 * GET /api/market/providers
 * Returns registered provider status (admin use)
 */
import type { Request, Response } from 'express';
import { marketRegistry } from '../../../lib/market/registry.js';

export default function handler(_req: Request, res: Response) {
  res.json({ providers: marketRegistry.getStatus(), timestamp: Date.now() });
}
