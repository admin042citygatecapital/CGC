import type { Request, Response } from 'express';
import { listCampaigns } from '../../../../lib/campaignStore.js';

export default function handler(_req: Request, res: Response) {
  try {
    return res.json({
      campaigns: listCampaigns(),
      dataClassification: 'email_delivery_records_without_engagement_tracking',
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
