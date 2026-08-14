import type { Request, Response } from 'express';
import { duplicateCampaign } from '../../../../../lib/campaignStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { id } = req.body as { id: string };
    if (!id) return res.status(400).json({ error: 'id required' });
    const campaign = await duplicateCampaign(id, req.adminSession!.adminId);
    return res.status(201).json({ ok: true, campaign });
  } catch (err) {
    console.error('newsletter.campaign.duplicate_failed', err);
    return res.status(500).json({ error: 'Unable to duplicate campaign.' });
  }
}
