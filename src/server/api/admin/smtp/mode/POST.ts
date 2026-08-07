/**
 * POST /api/admin/smtp/mode
 * Switch SMTP mode: { mode: 'oauth' | 'manual' }
 */
import type { Request, Response } from 'express';
import { setSmtpMode, type SmtpMode } from '../../../../lib/smtpConfigStore.js';

export default function handler(req: Request, res: Response) {
  const { mode } = req.body as { mode?: SmtpMode };
  if (!mode || !['oauth', 'manual'].includes(mode)) {
    return res.status(400).json({ ok: false, error: 'mode must be "oauth" or "manual"' });
  }
  setSmtpMode(mode, 'admin');
  return res.json({ ok: true, mode, message: `SMTP mode switched to ${mode}` });
}
