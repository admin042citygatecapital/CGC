/**
 * GET /api/admin/email/health
 *
 * Reworked against the current backend: the original read from
 * EmailTransportManager's own health tracking (a parallel nodemailer path
 * not used elsewhere in this codebase). This composes the same information
 * from the transport actually in use — zohoTokenStore's OAuth diagnostics
 * plus emailQueue's send/failure counters — the same sources already used
 * by admin/email/status/GET.ts.
 *
 * Not currently mounted by entry.ts (unlike the other reworked routes in
 * this batch) — admin/email/status/GET.ts already covers this ground for
 * the admin UI. Kept as a lighter-weight, health-check-shaped alternative
 * in case a future monitoring integration wants a single ok/degraded flag.
 */
import type { Request, Response } from 'express';
import { diagnoseOAuthCredentials } from '../../../../lib/zohoTokenStore.js';
import { getQueueStats } from '../../../../lib/emailQueue.js';

export default async function handler(req: Request, res: Response) {
  try {
    const [oauth, stats] = await Promise.all([
      Promise.resolve(diagnoseOAuthCredentials()),
      getQueueStats(),
    ]);

    const oauthOk = oauth.hasRefreshToken && oauth.refreshTokenValid && oauth.clientSecretValid;
    const status: 'ok' | 'degraded' = oauthOk ? 'ok' : 'degraded';

    return res.json({
      ok: true,
      status,
      oauth,
      queue: stats,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
