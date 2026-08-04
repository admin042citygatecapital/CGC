/**
 * GET /api/zoho/connect
 * Public — redirects the browser to Zoho's OAuth authorization page.
 * A random `state` token is embedded so the callback can verify the
 * request originated here (CSRF protection).
 */
import type { Request, Response } from 'express';
import { getSecret } from '#airo/secrets';
import { randomBytes } from 'node:crypto';

const DEFAULT_CLIENT_ID  = '1000.4H7OUAQ96SGO8USH4C4EMKW8J6PAJC';
const REDIRECT_URI       = 'https://citygate.capital/api/zoho/callback';

// In-memory state store (single-server; fine for admin-only one-time flow)
export const pendingStates = new Set<string>();

export default function handler(req: Request, res: Response) {
  const clientId = String(getSecret('ZOHO_CLIENT_ID') || getSecret('CLIENTID') || DEFAULT_CLIENT_ID);

  // Generate a short-lived state token
  const state = randomBytes(16).toString('hex');
  pendingStates.add(state);
  // Expire after 10 minutes
  setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000);

  // Use EU auth endpoint — citygate.capital is UK-based.
  // The auth URL region must match the token exchange region.
  // If this fails, try accounts.zoho.com instead.
  const authUrl = new URL('https://accounts.zoho.eu/oauth/v2/auth');
  authUrl.searchParams.set('scope',         'ZohoMail.messages.CREATE,ZohoMail.accounts.READ');
  authUrl.searchParams.set('client_id',     clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('access_type',   'offline');
  authUrl.searchParams.set('redirect_uri',  REDIRECT_URI);
  authUrl.searchParams.set('state',         state);

  res.redirect(authUrl.toString());
}
