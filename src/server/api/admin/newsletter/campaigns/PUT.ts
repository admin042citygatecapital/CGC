import type { Request, Response } from 'express';
import { updateCampaign, type CampaignSegment } from '../../../../lib/campaignStore.js';

export default function handler(req: Request, res: Response) {
  try {
    const { id, name, subject, body, segment, scheduledAt, status } = req.body as {
      id: string; name?: string; subject?: string; body?: string;
      segment?: CampaignSegment; scheduledAt?: string; status?: string;
    };
    if (!id) return res.status(400).json({ error: 'id required' });
    const campaign = updateCampaign(id, { name, subject, body, segment, scheduledAt, status: status as 'draft' | 'scheduled' | undefined });
    return res.json({ ok: true, campaign });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
