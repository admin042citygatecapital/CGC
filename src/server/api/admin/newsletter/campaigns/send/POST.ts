/**
 * POST /api/admin/newsletter/campaigns/send
 * Send or schedule a campaign to the selected subscriber segment.
 */
import type { Request, Response } from 'express';
import { getCampaign, markCampaignSent, appendEmailLog } from '../../../../../lib/campaignStore.js';
import { getAllSubscribers as readSubscribers } from '../../../../../lib/subscriberStore.js';
import { sendMail } from '../../../../../lib/emailService.js';

function buildUnsubscribeLink(email: string): string {
  const encoded = encodeURIComponent(email);
  const baseUrl = (process.env.PUBLIC_URL || process.env.SITE_URL || 'https://citygate.capital').replace(/\/+$/, '');
  return `${baseUrl}/api/newsletter/unsubscribe?email=${encoded}`;
}

function applyVariables(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, v);
  }
  return out;
}

export default async function handler(req: Request, res: Response) {
  try {
    const { id } = req.body as { id: string };
    if (!id) return res.status(400).json({ error: 'Campaign id required' });

    const campaign = getCampaign(id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (campaign.status === 'sent') return res.status(400).json({ error: 'Campaign already sent' });

    // Resolve recipients
    let subscribers = (await readSubscribers()).filter(s => s.status === 'active');
    const seg = campaign.segment;
    if (seg.group === 'personal')  subscribers = subscribers.filter(s => s.tags?.includes('personal'));
    if (seg.group === 'savings')   subscribers = subscribers.filter(s => s.tags?.includes('savings'));
    if (seg.group === 'business')  subscribers = subscribers.filter(s => s.tags?.includes('business'));
    if (seg.group === 'custom') {
      if (seg.registeredAfter)  subscribers = subscribers.filter(s => s.subscribedAt >= seg.registeredAfter!);
      if (seg.registeredBefore) subscribers = subscribers.filter(s => s.subscribedAt <= seg.registeredBefore!);
      if (seg.country)          subscribers = subscribers.filter(s => s.tags?.includes(seg.country!.toLowerCase()));
    }

    let sent = 0, failed = 0;

    for (const sub of subscribers) {
      const vars = { user_name: sub.name ?? sub.email.split('@')[0] };
      const subject = applyVariables(campaign.subject, vars);
      const unsubLink = buildUnsubscribeLink(sub.email);
      const bodyWithFooter = applyVariables(campaign.body, vars) +
        `\n<hr style="margin:32px 0;border-color:rgba(255,255,255,0.1)"/>
<p style="font-size:12px;color:#666;text-align:center;">
  You are receiving this email because you subscribed to City Gate Capital newsletters.<br/>
  <a href="${unsubLink}" style="color:#C9A84C;">Unsubscribe</a>
</p>`;

      try {
        await sendMail({ to: sub.email, subject, html: bodyWithFooter });
        appendEmailLog({ to: sub.email, subject, template: `campaign:${id}`, status: 'delivered', sentAt: new Date().toISOString(), campaignId: id });
        sent++;
      } catch (err) {
        appendEmailLog({ to: sub.email, subject, template: `campaign:${id}`, status: 'failed', sentAt: new Date().toISOString(), errorMessage: String(err), campaignId: id });
        failed++;
      }
    }

    const stats = {
      totalRecipients: subscribers.length,
      sent,
      failed,
      openRate:    null,
      clickRate:   null,
      engagementTracking: 'not_configured' as const,
      unsubscribes: 0,
    };

    const updated = markCampaignSent(id, stats);
    return res.json({ ok: true, campaign: updated, stats });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
