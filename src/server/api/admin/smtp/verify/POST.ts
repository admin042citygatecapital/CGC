/**
 * POST /api/admin/smtp/verify
 * Verify manual SMTP credentials by opening a connection (no email sent).
 */
import type { Request, Response } from 'express';
import { verifyManualSmtp } from '../../../../lib/smtpTransport.js';

export default async function handler(_req: Request, res: Response) {
  try {
    const result = await verifyManualSmtp();
    if (result.ok) {
      return res.json({ ok: true, message: 'SMTP connection verified successfully.' });
    }
    return res.status(502).json({ ok: false, error: result.error ?? 'SMTP verification failed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
