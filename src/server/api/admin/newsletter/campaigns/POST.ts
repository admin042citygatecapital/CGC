import type { Request, Response } from 'express';
import { createCampaign, type CampaignSegment } from '../../../../lib/campaignStore.js';

export default function handler(req: Request, res: Response) {
  try {
    const { name, subject, body, segment, scheduledAt, status } = req.body as {
      name: string; subject: string; body: string;
      segment: CampaignSegment; scheduledAt?: string; status?: string;
    };
    if (!name || !subject || !body || !segment) {
      return res.status(400).json({ error: 'name, subject, body, segment required' });
    }
    const campaign = createCampaign({ name, subject, body, segment, scheduledAt, status: status as 'draft' | 'scheduled' | undefined });
    return res.status(201).json({ ok: true, campaign });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
