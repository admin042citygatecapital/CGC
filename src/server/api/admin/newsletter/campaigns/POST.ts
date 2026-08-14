import type { Request, Response } from 'express';
import { createCampaign, type CampaignSegment } from '../../../../lib/campaignStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { name, subject, body, segment, scheduledAt, status } = req.body as {
      name: string; subject: string; body: string;
      segment: CampaignSegment; scheduledAt?: string; status?: string;
    };
    if (!name || !subject || !body || !segment) {
      return res.status(400).json({ error: 'name, subject, body, segment required' });
    }
    if (name.length > 200 || subject.length > 500 || body.length > 200_000 || !['all','personal','savings','business','custom'].includes(segment.group)) return res.status(400).json({ error: 'Invalid campaign fields.' });
    if (status && !['draft','scheduled'].includes(status)) return res.status(400).json({ error: 'Invalid campaign status.' });
    const campaign = await createCampaign({ name, subject, body, segment, scheduledAt, status: status as 'draft' | 'scheduled' | undefined, createdBy: req.adminSession!.adminId });
    return res.status(201).json({ ok: true, campaign });
  } catch (err) {
    console.error('newsletter.campaign.create_failed', err);
    return res.status(500).json({ error: 'Unable to create campaign.' });
  }
}
