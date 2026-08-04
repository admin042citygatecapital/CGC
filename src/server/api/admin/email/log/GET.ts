/**
 * GET /api/admin/email/log
 *
 * Reworked against the current backend: the original implementation read
 * from EmailTransportManager's own nodemailer-based log (a parallel email
 * path not used elsewhere in this codebase). The email stack actually in
 * use here is zohoTokenStore + smtpTransport + emailQueue (see
 * emailService.ts), so this now reads from emailQueue's own log instead —
 * the same source already used by admin/email/status/GET.ts and
 * admin/email/requeue/POST.ts.
 */
import type { Request, Response } from 'express';
import { getEmailLogs } from '../../../../lib/emailQueue.js';

export default async function handler(req: Request, res: Response) {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200);
    const entries = await getEmailLogs(limit);
    return res.json({ ok: true, entries });
  } catch (err) {
    console.error('[Admin] email/log error:', err);
    return res.status(500).json({ success: false, error: 'Failed to read log' });
  }
}
