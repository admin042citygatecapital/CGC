/**
 * GET /api/admin/support/routing
 * Read the category → team auto-assignment routing rules.
 */
import type { Request, Response } from 'express';
import { readRoutingConfig } from '../../../../lib/supportStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    return res.json({ ok: true, config: readRoutingConfig() });
  } catch (err) {
    console.error('[admin/support/routing GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load routing config' });
  }
}
