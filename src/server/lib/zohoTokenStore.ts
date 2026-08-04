/**
 * zohoTokenStore.ts — In-memory Zoho OAuth access token cache
 * ─────────────────────────────────────────────────────────────
 * Zoho access tokens expire in 3600 seconds (1 hour).
 * This module caches the current access token and auto-refreshes
 * it using ZOHO_REFRESH_TOKEN + ZOHO_CLIENT_SECRET before expiry.
 *
 * Secret name aliases (both conventions accepted):
 *   ZOHO_CLIENT_ID     or  CLIENTID
 *   ZOHO_CLIENT_SECRET or  CLIENTSECRET
 *   ZOHO_REFRESH_TOKEN or  REFRESHTOKEN
 *   ZOHO_ACCOUNT_ID    or  USERID
 *
 * IMPORTANT: Pre-flight format validation is intentionally minimal.
 * We pass credentials to Zoho and let their API return the authoritative
 * error (invalid_client_secret, invalid_code, etc.) rather than guessing
 * locally — this avoids blocking valid credentials that don't match our
 * expected pattern.
 */

import { getSecret } from '#airo/secrets';

// Zoho token endpoints by region — tried in order until one succeeds.
// The correct region depends on where the Zoho account was registered.
// EU accounts use .eu, India uses .in, Australia uses .com.au, US uses .com.
const ZOHO_TOKEN_URLS = [
  'https://accounts.zoho.eu/oauth/v2/token',   // EU (most common for UK/Europe)
  'https://accounts.zoho.com/oauth/v2/token',  // US
  'https://accounts.zoho.in/oauth/v2/token',   // India
  'https://accounts.zoho.com.au/oauth/v2/token', // Australia
];
// DEFAULT_CLIENT_ID intentionally removed — must be set via ZOHO_CLIENT_ID secret.
const EXPIRY_BUFFER_MS  = 5 * 60 * 1000; // refresh 5 min before expiry

// Cache the working region URL so we don't retry all regions on every call
let workingTokenUrl: string | null = null;

// ── Secret name aliases ───────────────────────────────────────────────────────
// Supports both canonical names (ZOHO_*) and short aliases (CLIENTID, etc.)
// so the app works regardless of which naming convention was used in Settings.
function getZohoClientId():     string { return String(getSecret('ZOHO_CLIENT_ID')     || getSecret('CLIENTID')     || ''); }
function getZohoClientSecret(): string {
  const v1 = getSecret('ZOHO_CLIENT_SECRET') || '';
  const v2 = getSecret('CLIENTSECRET') || '';
  // Prefer whichever value is different from the Client ID (avoids the common
  // mistake of entering the Client ID in the Client Secret field).
  const clientId = getZohoClientId();
  if (v1 && v1 !== clientId) return String(v1);
  if (v2 && v2 !== clientId) return String(v2);
  // Fall back to whichever is set
  return String(v1 || v2 || '');
}
function getZohoRefreshToken(): string { return String(getSecret('ZOHO_REFRESH_TOKEN') || getSecret('REFRESHTOKEN') || ''); }
function getZohoAccountId(): string {
  // IMPORTANT: This ID exceeds Number.MAX_SAFE_INTEGER — must be treated as a string.
  // Never parse through JSON.parse or Number() — precision is lost and the last digits change.
  const raw = String(getSecret('ZOHO_ACCOUNT_ID') || getSecret('USERID') || '');
  // If the secret was stored with numeric precision loss (ends in ...000 instead of ...002),
  // correct it here. The true account ID was confirmed via GET /api/accounts on 2026-05-27.
  if (raw === '3239949000000008000') return '3239949000000008002';
  // If the secret is not set at all, fall back to the known confirmed account ID.
  // This ID is not a secret — it is the numeric Zoho account identifier visible in the
  // mail.zoho.com URL and was confirmed correct on 2026-05-27.
  if (!raw) return '3239949000000008002';
  return raw;
}

interface TokenCache {
  accessToken: string;
  expiresAt:   number; // epoch ms
}

let cache: TokenCache | null = null;

// ── Startup diagnostic ────────────────────────────────────────────────────────

let startupLogged = false;

export function logStartupCredentialState(): void {
  if (startupLogged) return;
  startupLogged = true;

  const clientId     = getZohoClientId();
  const clientSecret = getZohoClientSecret();
  const refreshToken = getZohoRefreshToken();
  const accountId    = getZohoAccountId();

  const secretSources = {
    client_id:     getSecret('ZOHO_CLIENT_ID')     ? 'ZOHO_CLIENT_ID'
                 : getSecret('CLIENTID')            ? 'CLIENTID (alias)'
                 : 'default hardcoded',
    client_secret: getSecret('ZOHO_CLIENT_SECRET') ? 'ZOHO_CLIENT_SECRET'
                 : getSecret('CLIENTSECRET')        ? 'CLIENTSECRET (alias)'
                 : 'not set',
    refresh_token: getSecret('ZOHO_REFRESH_TOKEN') ? 'ZOHO_REFRESH_TOKEN'
                 : getSecret('REFRESHTOKEN')        ? 'REFRESHTOKEN (alias)'
                 : 'not set',
    account_id:    getSecret('ZOHO_ACCOUNT_ID')    ? 'ZOHO_ACCOUNT_ID'
                 : getSecret('USERID')              ? 'USERID (alias)'
                 : 'not set',
  };

  const rawZohoClientSecret = String(getSecret('ZOHO_CLIENT_SECRET') || '');
  const rawClientSecret     = String(getSecret('CLIENTSECRET') || '');

  console.log(JSON.stringify({
    event:          'zoho.credentials.startup',
    secretSources,
    hasClientId:     !!clientId,
    hasClientSecret: !!clientSecret,
    hasRefreshToken: !!refreshToken,
    hasAccountId:    !!accountId,
    clientIdPrefix:              clientId           ? clientId.slice(0, 10)           + '…' : null,
    clientSecretPrefix:          clientSecret       ? clientSecret.slice(0, 8)        + '…' : null,
    ZOHO_CLIENT_SECRET_prefix:   rawZohoClientSecret ? rawZohoClientSecret.slice(0, 8) + '…' : '(not set)',
    CLIENTSECRET_prefix:         rawClientSecret     ? rawClientSecret.slice(0, 8)     + '…' : '(not set)',
    secretMatchesClientId:       clientSecret === clientId,
    refreshTokenPrefix: refreshToken ? refreshToken.slice(0, 8)  + '…' : null,
    accountIdPrefix:    accountId    ? accountId.slice(0, 6)     + '…' : null,
    readyForTokenExchange: !!(clientSecret && refreshToken),
  }));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a valid Zoho access token, refreshing if expired or missing.
 * Returns null if credentials are missing or Zoho rejects them.
 *
 * NOTE: We do NOT pre-validate the client secret format here.
 * We pass it directly to Zoho and log whatever error they return.
 * This ensures we never block a valid credential due to a pattern mismatch.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const refreshToken = getZohoRefreshToken();
  const clientSecret = getZohoClientSecret();
  const clientId     = getZohoClientId();

  if (!refreshToken) {
    console.warn(JSON.stringify({
      event:  'zoho.token.missing_refresh_token',
      action: 'Add ZOHO_REFRESH_TOKEN in Settings → Secrets. Run OAuth flow at /api/zoho/connect to obtain it.',
    }));
    return null;
  }

  if (!clientSecret) {
    console.warn(JSON.stringify({
      event:  'zoho.token.missing_client_secret',
      action: 'Add ZOHO_CLIENT_SECRET in Settings → Secrets. Get it from accounts.zoho.com/developerconsole → your app.',
    }));
    return null;
  }

  // Return cached token if still valid
  if (cache && Date.now() < cache.expiresAt - EXPIRY_BUFFER_MS) {
    return cache.accessToken;
  }

  // Exchange refresh token for access token — try each regional endpoint
  try {
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'refresh_token',
    });

    // Build ordered list: try the known-working URL first, then the rest
    const urlsToTry = workingTokenUrl
      ? [workingTokenUrl, ...ZOHO_TOKEN_URLS.filter(u => u !== workingTokenUrl)]
      : ZOHO_TOKEN_URLS;

    let lastError = '';
    for (const tokenUrl of urlsToTry) {
      const res = await fetch(tokenUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    params.toString(),
      });

      const text = await res.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(text); } catch { /* not JSON */ }

      if (data.access_token) {
        // Success — cache the working region
        workingTokenUrl = tokenUrl;
        const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
        cache = {
          accessToken: data.access_token as string,
          expiresAt:   Date.now() + expiresIn * 1000,
        };
        console.log(JSON.stringify({
          event:      'zoho.token.refreshed',
          region:     tokenUrl,
          expiresIn,
          expiresAt:  new Date(cache.expiresAt).toISOString(),
        }));
        return cache.accessToken;
      }

      // Log this region's failure and try the next
      const zohoError = String(data.error ?? '');
      lastError = zohoError || `HTTP ${res.status}`;
      console.warn(JSON.stringify({
        event:      'zoho.token.region_failed',
        region:     tokenUrl,
        zohoError,
        httpStatus: res.status,
      }));
    }

    // All regions failed — log with actionable hints
    let hint = '';
    if (lastError === 'invalid_client_secret') {
      hint = 'ZOHO_CLIENT_SECRET is wrong. Get the correct value from accounts.zoho.com/developerconsole → your app → Client Secret.';
    } else if (lastError === 'invalid_code') {
      hint = 'ZOHO_REFRESH_TOKEN looks like an auth code, not a refresh token. Re-run the OAuth flow at /api/zoho/connect to get a real refresh token.';
    } else if (lastError === 'invalid_client') {
      hint = 'ZOHO_CLIENT_ID is wrong. Check accounts.zoho.com/developerconsole for the correct Client ID.';
    } else if (lastError === 'access_denied') {
      hint = 'Zoho denied access. The app may not have the required scopes. Re-authorize at /api/zoho/connect.';
    }

    console.error(JSON.stringify({
      event:      'zoho.token.refresh_failed',
      lastError,
      hint,
      regionsTriedCount: urlsToTry.length,
      clientIdPrefix:     clientId.slice(0, 10) + '…',
      clientSecretPrefix: clientSecret.slice(0, 8) + '…',
      refreshTokenPrefix: refreshToken.slice(0, 8) + '…',
    }));
    cache = null;
    return null;

  } catch (err) {
    console.error(JSON.stringify({
      event: 'zoho.token.refresh_error',
      error: err instanceof Error ? err.message : String(err),
    }));
    cache = null;
    return null;
  }
}

/** Invalidate the cached token (e.g. after a 401 from the mail API) */
export function invalidateTokenCache(): void {
  cache = null;
}

/**
 * Returns the expiry of the currently cached access token, without forcing
 * a token exchange (diagnostics polling should never trigger real network
 * calls to Zoho). Null if no token has been minted yet this process.
 */
export function getCachedTokenExpiry(): string | null {
  return cache ? new Date(cache.expiresAt).toISOString() : null;
}

/** Returns true if both refresh token and client secret are present */
export function hasOAuthCredentials(): boolean {
  return !!(getZohoRefreshToken() && getZohoClientSecret());
}

/** Returns a human-readable diagnosis of the current OAuth credential state */
export function diagnoseOAuthCredentials(): {
  hasRefreshToken:    boolean;
  hasClientSecret:    boolean;
  clientSecretValid:  boolean;
  clientSecretReason?: string;
  refreshTokenValid:  boolean;
  secretSources: {
    client_id:     string;
    client_secret: string;
    refresh_token: string;
    account_id:    string;
  };
} {
  const secret  = getZohoClientSecret();
  const refresh = getZohoRefreshToken();

  // Soft validation — informational only, does NOT block token exchange
  const secretOk     = !!secret;
  const secretReason = !secret
    ? 'ZOHO_CLIENT_SECRET is not set. Add it in Settings → Secrets.'
    : undefined;

  return {
    hasRefreshToken:    !!refresh,
    hasClientSecret:    !!secret,
    clientSecretValid:  secretOk,
    clientSecretReason: secretReason,
    refreshTokenValid:  !!refresh,
    secretSources: {
      client_id:     getSecret('ZOHO_CLIENT_ID')     ? 'ZOHO_CLIENT_ID'
                   : getSecret('CLIENTID')            ? 'CLIENTID (alias)'
                   : 'default hardcoded',
      client_secret: getSecret('ZOHO_CLIENT_SECRET') ? 'ZOHO_CLIENT_SECRET'
                   : getSecret('CLIENTSECRET')        ? 'CLIENTSECRET (alias)'
                   : 'not set',
      refresh_token: getSecret('ZOHO_REFRESH_TOKEN') ? 'ZOHO_REFRESH_TOKEN'
                   : getSecret('REFRESHTOKEN')        ? 'REFRESHTOKEN (alias)'
                   : 'not set',
      account_id:    getSecret('ZOHO_ACCOUNT_ID')    ? 'ZOHO_ACCOUNT_ID'
                   : getSecret('USERID')              ? 'USERID (alias)'
                   : 'not set',
    },
  };
}

/** Expose resolved account ID for use in transport */
export function getResolvedAccountId(): string { return getZohoAccountId(); }
