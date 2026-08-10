import type { Request, Response } from 'express';
import { appendAudit } from '../../../../../lib/auditLog.js';
import { markSocialShareOpened } from '../../../../../lib/socialStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const id = typeof req.body?.id === 'string' ? req.body.id : '';
    if (!id) return res.status(400).json({ error: 'Share id is required' });
    const share = await markSocialShareOpened(id, req.body?.platformId);
    if (!share) return res.status(404).json({ error: 'Share activity not found' });
    const session = req.adminSession!;
    appendAudit({
      event: 'social.share.intent_opened', adminId: session.adminId, email: session.email, ip: req.ip,
      meta: { shareId: id, platformId: req.body?.platformId },
    });
    return res.json({ ok: true, share });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update share activity' });
  }
}
