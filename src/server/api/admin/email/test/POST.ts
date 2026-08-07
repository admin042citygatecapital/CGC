/**
 * POST /api/admin/email/test
 * Protected — admin session required.
 *
 * Sends a real test email via the Zoho Mail HTTP API (HTTPS/443).
 * Returns structured JSON with delivery result, auth method used, and timing.
 *
 * Body:    { to?: string; type?: 'connectivity' | 'login_alert' | 'kyc_approval' }
 * Returns: { ok: boolean; message: string; durationMs: number; attempts: number; config: object }
 */
import type { Request, Response } from 'express';
import { getSecret } from '#airo/secrets';
import { sendMail, sendAdminLoginAlertEmail, sendApprovalEmail } from '../../../../lib/emailService.js';

const FROM_ADDRESS  = 'info@citygate.capital';
const ZOHO_API_BASE = 'https://mail.zoho.com/api/accounts';

export default async function handler(req: Request, res: Response) {
  const { to = 'admin@citygate.capital', type = 'connectivity' } = req.body as {
    to?: string;
    type?: 'connectivity' | 'login_alert' | 'kyc_approval';
  };

  // Resolve which auth method is active.
  // The system uses ZOHO_REFRESH_TOKEN + ZOHO_CLIENT_SECRET to mint access tokens
  // dynamically via zohoTokenStore — no static ZOHO_ACCESS_TOKEN is needed.
  const hasRefreshToken = !!(getSecret('ZOHO_REFRESH_TOKEN') || getSecret('REFRESHTOKEN'));
  const hasClientSecret = !!(getSecret('ZOHO_CLIENT_SECRET') || getSecret('CLIENTSECRET'));
  const hasAppPass      = !!getSecret('ZOHO_SMTP_PASSWORD');
  const hasAcctId       = !!(getSecret('ZOHO_ACCOUNT_ID') || getSecret('USERID'));
  const hasOAuth        = hasRefreshToken && hasClientSecret;
  const authMethod      = hasOAuth    ? 'OAuth 2.0 (refresh token → access token)'
                        : hasAppPass  ? 'App password (Basic auth)'
                        : 'none';

  const config = {
    transport:    'Zoho Mail HTTP API (HTTPS/443)',
    endpoint:     hasAcctId
      ? `${ZOHO_API_BASE}/{ZOHO_ACCOUNT_ID}/messages`
      : '⚠ ZOHO_ACCOUNT_ID not set',
    sender:       FROM_ADDRESS,
    authMethod,
    secretsReady: hasAcctId && (hasOAuth || hasAppPass),
  };

  // Guard — need account ID + at least one auth credential
  if (!config.secretsReady) {
    const missing: string[] = [];
    if (!hasAcctId)              missing.push('ZOHO_ACCOUNT_ID (or USERID)');
    if (!hasOAuth && !hasAppPass) missing.push('ZOHO_REFRESH_TOKEN + ZOHO_CLIENT_SECRET');
    return res.status(503).json({
      ok:         false,
      message:    `Missing secrets: ${missing.join(', ')}. Add them in Settings → Secrets.`,
      config,
      durationMs: 0,
      attempts:   0,
    });
  }

  const t0 = Date.now();

  try {
    let result;

    if (type === 'login_alert') {
      await sendAdminLoginAlertEmail(
        to, 'Admin', req.ip ?? '127.0.0.1',
        req.headers['user-agent'] ?? 'Test Agent',
        'Test Device', false,
      );
      result = { success: true, attempts: 1 };

    } else if (type === 'kyc_approval') {
      await sendApprovalEmail(to, 'Test User');
      result = { success: true, attempts: 1 };

    } else {
      // Direct connectivity test — calls sendMail and returns full result
      result = await sendMail({
        to,
        subject: '✅ City Gate Capital — Email API Test Successful',
        html: `
          <div style="background:#0A0A0A;font-family:Inter,Arial,sans-serif;padding:40px;border-radius:16px;max-width:560px;margin:auto;">
            <div style="text-align:center;margin-bottom:32px;">
              <img src="https://citygate.capital/assets/IMG-20260519-WA0000.jpg"
                height="48" style="height:48px;width:auto;" alt="City Gate Capital"/>
            </div>
            <h2 style="color:#C9A84C;font-size:20px;margin:0 0 16px;">Zoho Mail API — Delivery Confirmed</h2>
            <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;margin:0 0 12px;">
              This test email confirms that the Zoho Mail HTTP API is correctly configured for
              <strong style="color:#fff;">citygate.capital</strong>.
              All transactional emails now route over HTTPS — no SMTP socket required.
            </p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
              <tr>
                <td style="color:rgba(255,255,255,0.4);padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Transport</td>
                <td style="color:#10B981;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;">Zoho Mail HTTP API (HTTPS/443)</td>
              </tr>
              <tr>
                <td style="color:rgba(255,255,255,0.4);padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Auth Method</td>
                <td style="color:#fff;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;">${authMethod}</td>
              </tr>
              <tr>
                <td style="color:rgba(255,255,255,0.4);padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Sender</td>
                <td style="color:#fff;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;">${FROM_ADDRESS}</td>
              </tr>
              <tr>
                <td style="color:rgba(255,255,255,0.4);padding:6px 0;">Sent at</td>
                <td style="color:#fff;padding:6px 0;text-align:right;">${new Date().toUTCString()}</td>
              </tr>
            </table>
            <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:24px 0 0;">
              Login alerts, KYC notifications, and password resets are all active.
            </p>
          </div>`,
      });
    }

    if (!result.success) {
      return res.status(502).json({
        ok:         false,
        message:    result.error ?? 'Delivery failed',
        durationMs: Date.now() - t0,
        attempts:   result.attempts,
        config,
      });
    }

    return res.json({
      ok:         true,
      message:    `Test email delivered to ${to} via Zoho Mail HTTP API`,
      durationMs: Date.now() - t0,
      attempts:   result.attempts,
      messageId:  result.messageId,
      config,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('email.test.failed', msg);
    return res.status(500).json({
      ok:         false,
      message:    `Unexpected error: ${msg}`,
      durationMs: Date.now() - t0,
      attempts:   0,
      config,
    });
  }
}
