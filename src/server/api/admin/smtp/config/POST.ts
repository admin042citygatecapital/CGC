/**
 * POST /api/admin/smtp/config
 * Save SMTP configuration. Password field is only updated if non-empty.
 */
import type { Request, Response } from 'express';
import { saveSmtpConfig, type SmtpMode } from '../../../../lib/smtpConfigStore.js';

export default function handler(req: Request, res: Response) {
  try {
    const body = req.body as Record<string, unknown>;

    const patch: Record<string, unknown> = {};
    if (typeof body.mode === 'string' && ['oauth', 'manual'].includes(body.mode)) patch.mode = body.mode as SmtpMode;
    if (typeof body.host === 'string')            patch.host = body.host.trim();
    if (typeof body.port === 'number')            patch.port = body.port;
    if (typeof body.username === 'string')        patch.username = body.username.trim();
    // Only update password if a new non-placeholder value is provided
    if (typeof body.password === 'string' && body.password && body.password !== '••••••••') {
      patch.password = body.password;
    }
    if (typeof body.senderEmail === 'string')     patch.senderEmail = body.senderEmail.trim();
    if (typeof body.senderName === 'string')      patch.senderName = body.senderName.trim();
    if (typeof body.encryption === 'string')      patch.encryption = body.encryption;
    if (typeof body.oauthClientId === 'string')   patch.oauthClientId = body.oauthClientId.trim();
    if (typeof body.oauthClientSecret === 'string') patch.oauthClientSecret = body.oauthClientSecret.trim();
    if (typeof body.oauthRefreshToken === 'string') patch.oauthRefreshToken = body.oauthRefreshToken.trim();

    const saved = saveSmtpConfig(patch as Parameters<typeof saveSmtpConfig>[0], 'admin');
    return res.json({ ok: true, config: { ...saved, password: saved.password ? '••••••••' : '' } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
