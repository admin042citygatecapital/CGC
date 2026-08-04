/**
 * GET /api/admin/zoho/discover
 * Discovers Zoho Mail account ID using configured OAuth env vars.
 */
import type { Request, Response } from 'express';

export async function GET(req: Request, res: Response) {
  try {
    const clientId     = process.env.ZOHO_CLIENT_ID     || '';
    const clientSecret = process.env.ZOHO_CLIENT_SECRET || '';
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN || '';

    const envDebug = {
      hasClientId:     !!clientId,
      hasClientSecret: !!clientSecret,
      hasRefreshToken: !!refreshToken,
      zohoKeys: Object.keys(process.env).filter(k => k.includes('ZOHO')),
    };

    if (!clientId || !clientSecret || !refreshToken) {
      return res.status(503).json({ ok: false, error: 'Zoho credentials not configured', envDebug });
    }

    const tokenRes = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }).toString(),
    });
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      return res.status(502).json({ ok: false, error: 'Token exchange failed', detail: tokenData });
    }

    const accRes = await fetch('https://mail.zoho.com/api/accounts', {
      headers: { Authorization: 'Zoho-oauthtoken ' + tokenData.access_token },
    });
    const accData = await accRes.json() as { data?: Array<{ accountId: string; emailAddress: string; displayName: string }> };
    const accounts = (accData.data || []).map(a => ({ accountId: a.accountId, emailAddress: a.emailAddress }));

    return res.json({ ok: true, accounts, setThis: accounts[0]?.accountId });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
