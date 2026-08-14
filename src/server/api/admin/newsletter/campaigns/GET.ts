import type { Request, Response } from 'express';
import { listCampaigns } from '../../../../lib/campaignStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    return res.json({
      campaigns: await listCampaigns(),
      dataClassification: 'email_delivery_records_without_engagement_tracking',
    });
  } catch (err) {
    console.error('newsletter.campaigns.list_failed', err);
    return res.status(500).json({ error: 'Unable to list campaigns.' });
  }
}
