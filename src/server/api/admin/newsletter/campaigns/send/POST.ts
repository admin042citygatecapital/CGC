/**
 * POST /api/admin/newsletter/campaigns/send
 * Body: { id }
 * Resolves the campaign's segment against real customer accounts
 * (userStore.loadAllUsers, filtered by accountTier/country/registration
 * date) and enqueues one real email per recipient via emailQueue.ts —
 * the same queue/worker every other outbound email in this app uses.
 * Stats reflect the real recipient count; openRate/clickRate stay 0 since
 * this app has no open/click tracking (never fabricated).
 */
import type { Request, Response } from 'express';
import { getCampaign, updateCampaign, markCampaignSent, appendEmailLog } from '../../../../../lib/campaignStore.js';
import { loadAllUsers, type UserRecord } from '../../../../../lib/userStore.js';
import { enqueueEmail } from '../../../../../lib/emailQueue.js';
import { appendAudit } from '../../../../../lib/auditLog.js';

function matchesSegment(user: UserRecord, campaign: ReturnType<typeof getCampaign>): boolean {
  if (!campaign) return false;
  const { segment } = campaign;
  if (segment.group !== 'all' && segment.group !== 'custom' && user.accountTier !== segment.group) return false;
  if (segment.registeredAfter && user.createdAt < segment.registeredAfter) return false;
  if (segment.registeredBefore && user.createdAt > segment.registeredBefore) return false;
  if (segment.country && user.country !== segment.country) return false;
  return true;
}

export default async function handler(req: Request, res: Response) {
  const { id } = req.body as { id?: string };
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  const campaign = getCampaign(id);
  if (!campaign) return res.status(404).json({ ok: false, error: 'Campaign not found' });
  if (campaign.status === 'sent') return res.status(400).json({ ok: false, error: 'Campaign already sent' });

  updateCampaign(id, { status: 'sending' });

  const users = await loadAllUsers();
  const recipients = users.filter(u => matchesSegment(u, campaign));

  let sent = 0;
  let failed = 0;
  for (const user of recipients) {
    try {
      const html = campaign.body.replace(/\{name\}/g, user.name).replace(/\{email\}/g, user.email);
      await enqueueEmail({ to: user.email, subject: campaign.subject, html });
      appendEmailLog({ to: user.email, subject: campaign.subject, template: `campaign:${id}`, status: 'pending', sentAt: new Date().toISOString(), campaignId: id });
      sent++;
    } catch (err) {
      appendEmailLog({ to: user.email, subject: campaign.subject, template: `campaign:${id}`, status: 'failed', sentAt: new Date().toISOString(), campaignId: id, errorMessage: err instanceof Error ? err.message : String(err) });
      failed++;
    }
  }

  const updated = markCampaignSent(id, {
    totalRecipients: recipients.length,
    sent, failed,
    openRate: 0, clickRate: 0, unsubscribes: 0,
  });

  appendAudit({ event: 'admin_campaign_sent', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { campaignId: id, recipients: recipients.length } });

  return res.json({ ok: true, campaign: updated });
}
