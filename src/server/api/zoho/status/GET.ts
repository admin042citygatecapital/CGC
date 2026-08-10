/**
 * GET /api/zoho/status
 * Admin-protected diagnostic — shows first 6 chars + length of each Zoho secret,
 * attempts a token refresh across all regional endpoints, and reports ok/fail.
 * Protected by requireAdminAuth in entry.ts.
 */
import type { Request, Response } from 'express';
import { getSecret } from '#airo/secrets';

// Try all regions — EU first (citygate.capital is UK-based)
const ZOHO_TOKEN_URLS = [
  'https://accounts.zoho.eu/oauth/v2/token',
  'https://accounts.zoho.com/oauth/v2/token',
  'https://accounts.zoho.in/oauth/v2/token',
  'https://accounts.zoho.com.au/oauth/v2/token',
];

// Resolve with alias fallbacks — matches zohoTokenStore.ts logic
function resolve(canonical: string, alias: string, fallback = ''): string {
  return String(getSecret(canonical) || getSecret(alias) || fallback);
}

function diagnose(value: string | undefined | null): string {
  return value ? 'configured' : '(not set)';
}

function classifyRefreshToken(token: string | undefined | null): string {
  if (!token) return 'missing';
  if (token.startsWith('1000.') && token.length >= 60) return '✅ looks correct';
  if (token.startsWith('http')) return '❌ wrong format — a URL was saved';
  if (token.length < 30) return '❌ wrong format — too short, likely truncated';
  return '❌ wrong format — likely an auth code';
}

export default async function handler(_req: Request, res: Response) {
  const clientId     = resolve('ZOHO_CLIENT_ID',     'CLIENTID',     '');
  const clientSecret = resolve('ZOHO_CLIENT_SECRET', 'CLIENTSECRET', '');
  const accountId    = resolve('ZOHO_ACCOUNT_ID',    'USERID',       '');
  const refreshToken = resolve('ZOHO_REFRESH_TOKEN', 'REFRESHTOKEN', '');

  const diagnosis = {
    ZOHO_CLIENT_ID:     diagnose(clientId),
    ZOHO_CLIENT_SECRET: diagnose(clientSecret),
    ZOHO_ACCOUNT_ID:    diagnose(accountId),
    ZOHO_REFRESH_TOKEN: diagnose(refreshToken),
    refresh_token_format: classifyRefreshToken(refreshToken),
    secret_aliases_used: {
      client_id:     getSecret('ZOHO_CLIENT_ID')     ? 'ZOHO_CLIENT_ID'     : (getSecret('CLIENTID')     ? 'CLIENTID (alias)'     : 'default hardcoded'),
      client_secret: getSecret('ZOHO_CLIENT_SECRET') ? 'ZOHO_CLIENT_SECRET' : (getSecret('CLIENTSECRET') ? 'CLIENTSECRET (alias)' : 'not set'),
      account_id:    getSecret('ZOHO_ACCOUNT_ID')    ? 'ZOHO_ACCOUNT_ID'    : (getSecret('USERID')       ? 'USERID (alias)'       : 'not set'),
      refresh_token: getSecret('ZOHO_REFRESH_TOKEN') ? 'ZOHO_REFRESH_TOKEN' : (getSecret('REFRESHTOKEN') ? 'REFRESHTOKEN (alias)' : 'not set'),
    },
  };

  if (!clientId || !clientSecret || !refreshToken) {
    return res.json({ ok: false, diagnosis, verdict: '❌ missing required secrets' });
  }

  // Attempt token refresh — try all regional endpoints
  try {
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'refresh_token',
    });

    const regionResults: Array<{ region: string; error: string | null; status: number }> = [];

    for (const tokenUrl of ZOHO_TOKEN_URLS) {
      const tokenRes = await fetch(tokenUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    params.toString(),
      });

      const raw = await tokenRes.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(raw); } catch { /* not JSON */ }

      const zohoError = data.error as string | undefined;
      const accessToken = data.access_token as string | undefined;

      if (accessToken) {
        return res.json({
          ok: true,
          has_access_token: true,
          working_region: tokenUrl,
          diagnosis,
          verdict: `✅ token refresh succeeded via ${tokenUrl} — email is operational`,
        });
      }

      regionResults.push({ region: tokenUrl, error: zohoError ?? `HTTP ${tokenRes.status}`, status: tokenRes.status });
    }

    // All regions failed — return the last error with all region results
    const lastResult = regionResults[regionResults.length - 1];
    return res.json({
      ok: false,
      http_status: lastResult.status,
      zoho_error: lastResult.error,
      has_access_token: false,
      region_results: regionResults,
      diagnosis,
      verdict: `❌ All regions failed. Last error: ${lastResult.error}. If error is "invalid_code", the ZOHO_REFRESH_TOKEN is actually an auth code — re-run OAuth at /api/zoho/connect.`,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, diagnosis, verdict: `❌ fetch error: ${msg}` });
  }
}
