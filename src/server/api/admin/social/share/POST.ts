import type { Request, Response } from 'express';
import { appendAudit } from '../../../../lib/auditLog.js';
import { createSocialShare } from '../../../../lib/socialStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const session = req.adminSession!;
    const share = await createSocialShare({
      message: typeof req.body?.message === 'string' ? req.body.message : '',
      targetUrl: typeof req.body?.targetUrl === 'string' ? req.body.targetUrl : '',
      platforms: req.body?.platforms,
      createdBy: session.email || session.adminId,
    });
    appendAudit({
      event: 'social.share.prepared', adminId: session.adminId, email: session.email, ip: req.ip,
      meta: { shareId: share.id, platforms: share.platforms, targetUrl: share.targetUrl },
    });
    return res.status(201).json({ ok: true, share });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to prepare social share' });
  }
}
