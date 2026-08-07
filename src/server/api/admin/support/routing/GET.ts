/**
 * GET /api/admin/support/routing
 * Returns the auto-assignment routing rules.
 */
import type { Request, Response } from 'express';
import { readRoutingConfig } from '../../../../lib/supportStore.js';

export default function handler(_req: Request, res: Response) {
  return res.json(readRoutingConfig());
}
