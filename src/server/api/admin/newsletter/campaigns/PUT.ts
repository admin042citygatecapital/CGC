import type { Request, Response } from 'express';
import { updateCampaign, type CampaignSegment } from '../../../../lib/campaignStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { id, name, subject, body, segment, scheduledAt, status } = req.body as {
      id: string; name?: string; subject?: string; body?: string;
      segment?: CampaignSegment; scheduledAt?: string; status?: string;
    };
    if (!id) return res.status(400).json({ error: 'id required' });
    if (name !== undefined && (typeof name !== 'string' || name.length > 200)) return res.status(400).json({ error: 'Invalid name.' });
    if (subject !== undefined && (typeof subject !== 'string' || subject.length > 500)) return res.status(400).json({ error: 'Invalid subject.' });
    if (body !== undefined && (typeof body !== 'string' || body.length > 200_000)) return res.status(400).json({ error: 'Invalid body.' });
    if (status && !['draft','scheduled'].includes(status)) return res.status(400).json({ error: 'Invalid campaign status.' });
    const campaign = await updateCampaign(id, { name, subject, body, segment, scheduledAt, status: status as 'draft' | 'scheduled' | undefined });
    return res.json({ ok: true, campaign });
  } catch (err) {
    console.error('newsletter.campaign.update_failed', err);
    return res.status(500).json({ error: 'Unable to update campaign.' });
  }
}
