/**
 * GET /api/zoho/connect
 * Security-admin protected — redirects the browser to Zoho's OAuth authorization page.
 * A random `state` token is embedded so the callback can verify the
 * request originated here (CSRF protection).
 */
import type { Request, Response } from 'express';
import { getSecret } from '#runtime/secrets';
import { randomBytes } from 'node:crypto';
import { appendAudit } from '../../../lib/auditLog.js';

// DEFAULT_CLIENT_ID intentionally removed — must be set via ZOHO_CLIENT_ID secret.
const REDIRECT_URI       = 'https://citygate.capital/api/zoho/callback';

// In-memory state store (single-server; fine for admin-only one-time flow)
export const pendingStates = new Set<string>();

export default function handler(req: Request, res: Response) {
  const clientId = String(getSecret('ZOHO_CLIENT_ID') || getSecret('CLIENTID') || '');

  // Generate a short-lived state token
  const state = randomBytes(16).toString('hex');
  pendingStates.add(state);
  // Expire after 10 minutes
  setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000);

  // OAuth initiation mutates integration state (the one-time state set) and
  // sits outside the central /api/admin audit middleware, so record it here.
  // The state value itself is never recorded. adminId is omitted when no
  // administrator session exists so the record's actorKind stays 'system'.
  appendAudit({
    event:   'admin_zoho_oauth_started',
    adminId: req.adminSession?.adminId,
    email:   req.adminSession?.email,
    ip:      req.ip,
    meta:    { integration: 'zoho-mail', clientIdConfigured: Boolean(clientId) },
  });

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
