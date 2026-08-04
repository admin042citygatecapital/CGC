/**
 * GET /api/zoho/status
 * SUPER_ADMIN only (see entry.ts — requireAdminAuth). Shows first 6 chars +
 * length of each Zoho secret, attempts a token refresh, and reports ok/fail.
 * This was previously reachable without authentication — a genuine secret-
 * disclosure and OAuth-credential-validation-oracle bug, since the route
 * isn't under the /api/admin prefix that the blanket admin-auth gate covers.
 */
import type { Request, Response } from 'express';
import { getSecret } from '#airo/secrets';

const ZOHO_TOKEN_URL    = 'https://accounts.zoho.com/oauth/v2/token';
const DEFAULT_CLIENT_ID = '1000.4H7OUAQ96SGO8USH4C4EMKW8J6PAJC';

// Resolve with alias fallbacks — matches zohoTokenStore.ts logic
function resolve(canonical: string, alias: string, fallback = ''): string {
  return String(getSecret(canonical) || getSecret(alias) || fallback);
}

function diagnose(value: string | undefined | null): string {
  if (!value) return '(not set)';
  return `${value.slice(0, 6)}…(${value.length} chars)`;
}

function classifyRefreshToken(token: string | undefined | null): string {
  if (!token) return 'missing';
  if (token.startsWith('1000.') && token.length >= 60) return '✅ looks correct';
  if (token.startsWith('http')) return '❌ wrong format — a URL was saved';
  if (token.length < 30) return '❌ wrong format — too short, likely truncated';
  return '❌ wrong format — likely an auth code';
}

export default async function handler(_req: Request, res: Response) {
  const clientId     = resolve('ZOHO_CLIENT_ID',     'CLIENTID',     DEFAULT_CLIENT_ID);
  const clientSecret = resolve('ZOHO_CLIENT_SECRET', 'CLIENTSECRET', '');
  const accountId    = resolve('ZOHO_ACCOUNT_ID',    'USERID',       '');
  const refreshToken = resolve('ZOHO_REFRESH_TOKEN', 'REFRESHTOKEN', '');

  const diagnosis = {
    ZOHO_CLIENT_ID:     diagnose(clientId),
    ZOHO_CLIENT_SECRET: diagnose(clientSecret),
    ZOHO_ACCOUNT_ID:    diagnose(accountId),
    ZOHO_REFRESH_TOKEN: diagnose(refreshToken),
    refresh_token_format: classifyRefreshToken(refreshToken),
    refresh_token_length: refreshToken.length,
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

  // Attempt token refresh
  try {
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'refresh_token',
    });

    const tokenRes = await fetch(ZOHO_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString(),
    });

    const raw = await tokenRes.text();
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(raw); } catch { /* not JSON */ }

    const zohoError = data.error as string | undefined;
    const zohoDesc  = data.error_description as string | undefined;
    const accessToken = data.access_token as string | undefined;

    if (accessToken) {
      return res.json({
        ok: true,
        has_access_token: true,
        diagnosis,
        verdict: '✅ token refresh succeeded — email is operational',
      });
    }

    return res.json({
      ok: false,
      http_status: tokenRes.status,
      zoho_error: zohoError ?? null,
      zoho_desc:  zohoDesc  ?? null,
      has_access_token: false,
      diagnosis,
      verdict: `❌ ${zohoError ?? 'unknown'}: ${raw.slice(0, 200)}`,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, diagnosis, verdict: `❌ fetch error: ${msg}` });
  }
}
