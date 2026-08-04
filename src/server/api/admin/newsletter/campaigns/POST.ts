/**
 * POST /api/admin/newsletter/campaigns
 * Body: { name, subject, body, segment: CampaignSegment, scheduledAt? }
 */
import type { Request, Response } from 'express';
import { createCampaign, type CampaignSegment } from '../../../../lib/campaignStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, isOneOf } from '../../../../lib/inputValidator.js';

const GROUPS = ['all', 'personal', 'savings', 'business', 'custom'] as const;

export default async function handler(req: Request, res: Response) {
  const raw = req.body as { name?: string; subject?: string; body?: string; segment?: Partial<CampaignSegment>; scheduledAt?: string };

  const name = sanitizeString(raw.name, 200);
  const subject = sanitizeString(raw.subject, 300);
  const body = typeof raw.body === 'string' ? raw.body : '';
  const group = isOneOf(raw.segment?.group, GROUPS);

  if (!name || !subject || !body || !group) {
    return res.status(400).json({ ok: false, error: 'name, subject, body, and a valid segment.group are required' });
  }

  const segment: CampaignSegment = {
    group,
    registeredAfter: raw.segment?.registeredAfter,
    registeredBefore: raw.segment?.registeredBefore,
    country: raw.segment?.country ? sanitizeString(raw.segment.country, 100) : undefined,
  };

  const campaign = createCampaign({
    name, subject, body, segment,
    scheduledAt: raw.scheduledAt,
    createdBy: req.adminSession?.email ?? 'admin',
  });

  appendAudit({ event: 'admin_campaign_created', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { campaignId: campaign.id } });

  return res.status(201).json({ ok: true, campaign });
}
