/**
 * GET /api/admin/smtp/config
 * Returns current SMTP configuration (password redacted).
 */
import type { Request, Response } from 'express';
import { loadSmtpConfig } from '../../../../lib/smtpConfigStore.js';

export default function handler(_req: Request, res: Response) {
  const cfg = loadSmtpConfig();
  // Never return delivery credentials to the browser.
  return res.json({
    ...cfg,
    password: cfg.password ? '••••••••' : '',
    oauthClientSecret: cfg.oauthClientSecret ? '••••••••' : '',
    oauthRefreshToken: cfg.oauthRefreshToken ? '••••••••' : '',
  });
}
