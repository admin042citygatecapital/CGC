/**
 * POST /api/admin/zoho/exchange
 * Admin-only one-shot endpoint: exchanges a Zoho authorization code for
 * access + refresh tokens without requiring the in-memory OAuth CSRF-state
 * check that the standard /api/admin/zoho/oauth/callback redirect uses.
 * Used when the OAuth callback redirect cannot complete in a live browser flow.
 *
 * Body: { code: string }
 */
import type { Request, Response } from 'express';
import { getSecret } from '#airo/secrets';
import { appendAudit } from '../../../../lib/auditLog.js';

const REDIRECT_URI = 'https://citygate.capital/api/admin/zoho/oauth/callback';

const ZOHO_TOKEN_URLS = [
  'https://accounts.zoho.eu/oauth/v2/token',
  'https://accounts.zoho.com/oauth/v2/token',
  'https://accounts.zoho.in/oauth/v2/token',
  'https://accounts.zoho.com.au/oauth/v2/token',
];

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { code } = req.body as { code?: string };

  if (!code || typeof code !== 'string' || !code.startsWith('1000.')) {
    return res.status(400).json({ ok: false, error: 'Missing or invalid code. Must start with 1000.' });
  }

  const clientId = String(getSecret('ZOHO_CLIENT_ID') || getSecret('CLIENTID') || '');
  const clientSecret = String(getSecret('ZOHO_CLIENT_SECRET') || getSecret('CLIENTSECRET') || '');

  if (!clientId || !clientSecret) {
    return res.status(503).json({ ok: false, error: 'ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET not configured.' });
  }

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  let lastError = '';
  for (const tokenUrl of ZOHO_TOKEN_URLS) {
    let data: Record<string, unknown> = {};
    try {
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const text = await tokenRes.text();
      try { data = JSON.parse(text); } catch { lastError = text.slice(0, 200); continue; }

      if (data.refresh_token || data.access_token) {
        appendAudit({
          event: 'admin_zoho_manual_exchange',
          adminId: session.adminId,
          email: session.email,
          ip: req.ip ?? 'unknown',
          meta: { region: tokenUrl },
        });
        return res.json({
          ok: true,
          refresh_token: data.refresh_token ?? null,
          access_token: data.access_token ?? null,
          expires_in: data.expires_in ?? null,
          region: tokenUrl,
        });
      }
      lastError = String(data.error ?? data.error_description ?? tokenRes.status);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return res.status(502).json({
    ok: false,
    error: lastError,
    hint: lastError === 'invalid_code'
      ? 'The authorization code has expired (60s TTL) or was already used. Re-run the OAuth flow.'
      : lastError === 'invalid_client_secret'
      ? 'ZOHO_CLIENT_SECRET is wrong. Check Zoho Developer Console.'
      : 'All Zoho regions failed. Check credentials and try again.',
  });
}
