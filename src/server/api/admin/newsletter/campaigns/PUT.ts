/**
 * PUT /api/admin/newsletter/campaigns
 * Body: { id, name?, subject?, body?, segment?, scheduledAt?, status? }
 * A sent campaign's content is not editable (only draft/scheduled).
 */
import type { Request, Response } from 'express';
import { getCampaign, updateCampaign } from '../../../../lib/campaignStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id : '';
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  const existing = getCampaign(id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Campaign not found' });
  if (existing.status === 'sent') return res.status(400).json({ ok: false, error: 'A sent campaign cannot be edited' });

  const patch: Record<string, unknown> = {};
  if (typeof raw.name === 'string') patch.name = sanitizeString(raw.name, 200);
  if (typeof raw.subject === 'string') patch.subject = sanitizeString(raw.subject, 300);
  if (typeof raw.body === 'string') patch.body = raw.body;
  if (raw.segment && typeof raw.segment === 'object') patch.segment = raw.segment;
  if (typeof raw.scheduledAt === 'string') patch.scheduledAt = raw.scheduledAt;

  const updated = updateCampaign(id, patch as never);
  appendAudit({ event: 'admin_campaign_updated', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { campaignId: id } });

  return res.json({ ok: true, campaign: updated });
}
