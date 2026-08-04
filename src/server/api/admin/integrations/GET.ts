/**
 * GET /api/admin/integrations
 */
import type { Request, Response } from 'express';
import { getAllIntegrations } from '../../../lib/integrationStore.js';

export default async function handler(_req: Request, res: Response) {
  return res.json({ ok: true, integrations: getAllIntegrations() });
}
