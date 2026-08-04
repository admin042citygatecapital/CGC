/**
 * POST /api/admin/newsletter/campaigns/duplicate
 * Body: { id }
 */
import type { Request, Response } from 'express';
import { duplicateCampaign } from '../../../../../lib/campaignStore.js';
import { appendAudit } from '../../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const { id } = req.body as { id?: string };
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  let copy;
  try {
    copy = duplicateCampaign(id, req.adminSession?.email ?? 'admin');
  } catch {
    return res.status(404).json({ ok: false, error: 'Campaign not found' });
  }

  appendAudit({ event: 'admin_campaign_duplicated', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { sourceId: id, newId: copy.id } });

  return res.status(201).json({ ok: true, campaign: copy });
}
