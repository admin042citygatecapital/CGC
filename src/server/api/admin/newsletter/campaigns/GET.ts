/**
 * GET /api/admin/newsletter/campaigns
 */
import type { Request, Response } from 'express';
import { listCampaigns } from '../../../../lib/campaignStore.js';

export default async function handler(_req: Request, res: Response) {
  return res.json({ ok: true, campaigns: listCampaigns() });
}
