/**
 * GET /api/zoho/callback
 * PUBLIC — Zoho redirects here after the user authorises the app.
 * Must NOT be behind requireAdminAuth — Zoho's redirect carries no
 * admin session cookie.
 *
 * Exchanges the one-time authorization code for access + refresh tokens
 * and renders a styled page showing the refresh token so the admin can
 * save it as ZOHO_REFRESH_TOKEN in Settings → Secrets.
 */
import type { Request, Response } from 'express';
import { getSecret } from '#airo/secrets';
import { pendingStates } from '../connect/GET.js';

// Try EU first (citygate.capital is UK-based), fall back to US
const ZOHO_TOKEN_URLS = [
  'https://accounts.zoho.eu/oauth/v2/token',
  'https://accounts.zoho.com/oauth/v2/token',
  'https://accounts.zoho.in/oauth/v2/token',
  'https://accounts.zoho.com.au/oauth/v2/token',
];
// DEFAULT_CLIENT_ID removed — must be set via ZOHO_CLIENT_ID secret.
const REDIRECT_URI      = 'https://citygate.capital/api/zoho/callback';

export default async function handler(req: Request, res: Response) {
  const { code, state, error, error_description } = req.query as Record<string, string | undefined>;

  // ── Zoho returned an error ────────────────────────────────────────────────
  if (error) {
    return res.status(400).send(errorPage(
      'Zoho Authorization Denied',
      `${error}: ${error_description ?? 'No description provided.'}`,
      'The user may have clicked Deny, or the app may not have the required scopes.'
    ));
  }

  // ── Missing code ──────────────────────────────────────────────────────────
  if (!code) {
    return res.status(400).send(errorPage(
      'Missing Authorization Code',
      'No code parameter in the callback URL.',
      'Restart the OAuth flow from Admin → Security → Health.'
    ));
  }

  // ── CSRF state check ─────────────────────────────────────────────────────
  if (!state || !pendingStates.has(state)) {
    return res.status(403).send(errorPage(
      'Invalid State Token',
      'The state parameter is missing or does not match.',
      'This may be a CSRF attempt or the flow timed out (10 min limit). Restart from Admin → Security → Health.'
    ));
  }
  pendingStates.delete(state); // one-time use

  // ── Secrets ───────────────────────────────────────────────────────────────
  const clientSecret = getSecret('ZOHO_CLIENT_SECRET') || getSecret('CLIENTSECRET');
  const clientId     = String(getSecret('ZOHO_CLIENT_ID') || getSecret('CLIENTID') || '');

  if (!clientSecret) {
    return res.status(503).send(errorPage(
      'ZOHO_CLIENT_SECRET Not Configured',
      'Add ZOHO_CLIENT_SECRET in Settings → Secrets, then retry.',
      ''
    ));
  }

  // ── Exchange code for tokens — try each regional endpoint ────────────────
  try {
    const params = new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: String(clientSecret),
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    });

    let lastRaw = '';
    let lastData: Record<string, unknown> = {};
    let lastStatus = 0;

    for (const tokenUrl of ZOHO_TOKEN_URLS) {
      const tokenRes = await fetch(tokenUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    params.toString(),
      });

      const raw = await tokenRes.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(raw); } catch { /* not JSON */ }

      console.log(JSON.stringify({ event: 'zoho.oauth.callback', region: tokenUrl, status: tokenRes.status, keys: Object.keys(data) }));

      if (data.refresh_token || data.access_token) {
        // Success — redirect to the admin setup page so the token is shown in the UI
        const refreshToken = data.refresh_token as string | undefined;
        const accessToken  = data.access_token  as string | undefined;
        const expiresIn    = data.expires_in    as number | undefined;
        const region       = encodeURIComponent(tokenUrl);
        if (refreshToken) {
          const rt = encodeURIComponent(refreshToken);
          const at = accessToken ? encodeURIComponent(accessToken) : '';
          return res.redirect(
            `/admin/zoho-setup?refresh_token=${rt}&access_token=${at}&expires_in=${expiresIn ?? ''}&region=${region}&status=success`
          );
        }
        return res.send(successPage(refreshToken, accessToken, expiresIn, tokenUrl));
      }

      lastRaw    = raw;
      lastData   = data;
      lastStatus = tokenRes.status;
    }

    return res.status(502).send(errorPage(
      'Token Exchange Failed',
      `All regions failed. Last error: ${lastData.error ?? lastStatus} — ${lastData.error_description ?? lastRaw.slice(0, 300)}`,
      'Common causes: expired code (must be used within 60 s), wrong client secret, or redirect URI mismatch.'
    ));

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: 'zoho.oauth.callback_error', error: msg }));
    return res.status(500).send(errorPage('Unexpected Error', msg, ''));
  }
}

// ── HTML helpers ─────────────────────────────────────────────────────────────

function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — City Gate Capital</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0A0A0A;color:#fff;font-family:Inter,Arial,sans-serif;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:48px 16px}
    .card{width:100%;max-width:660px;background:#111;border:1px solid rgba(201,168,76,.18);border-radius:18px;overflow:hidden}
    .hdr{background:linear-gradient(135deg,#0A1F44,#0d2a5e);padding:28px 32px}
    .hdr h1{color:#C9A84C;font-size:17px;font-weight:700;letter-spacing:.01em}
    .hdr p{color:rgba(255,255,255,.35);font-size:12px;margin-top:4px}
    .body{padding:28px 32px;display:flex;flex-direction:column;gap:20px}
    .badge{display:flex;align-items:center;gap:10px;border-radius:10px;padding:13px 16px;font-size:13px;font-weight:600}
    .badge.ok{background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.2);color:#10B981}
    .badge.err{background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);color:#f87171}
    .field label{display:block;color:rgba(255,255,255,.28);font-size:10px;text-transform:uppercase;letter-spacing:.12em;margin-bottom:7px}
    .token{background:#0A0A0A;border:1px solid rgba(201,168,76,.18);border-radius:10px;padding:13px 15px;font-family:monospace;font-size:12px;color:#C9A84C;word-break:break-all;cursor:pointer;transition:border-color .2s}
    .token:hover{border-color:rgba(201,168,76,.45)}
    .hint{color:rgba(255,255,255,.2);font-size:11px;margin-top:6px}
    .steps{background:rgba(201,168,76,.03);border:1px solid rgba(201,168,76,.09);border-radius:10px;padding:16px 18px}
    .steps h3{color:#C9A84C;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}
    .steps ol{color:rgba(255,255,255,.45);font-size:13px;line-height:1.9;padding-left:18px}
    .steps ol strong{color:rgba(255,255,255,.75)}
    .warn{color:rgba(255,200,80,.55);font-size:11px}
    pre{background:#0d0d0d;border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:12px;font-size:11px;color:#f87171;overflow:auto;white-space:pre-wrap;word-break:break-all}
  </style>
</head>
<body><div class="card">
  <div class="hdr"><h1>${title}</h1><p>citygate.capital · Zoho Mail OAuth</p></div>
  <div class="body">${body}</div>
</div></body>
</html>`;
}

function successPage(refreshToken?: string, accessToken?: string, expiresIn?: number, region?: string): string {
  const rtBlock = refreshToken
    ? `<div class="field">
        <label>Refresh Token — save as ZOHO_REFRESH_TOKEN</label>
        <div class="token" id="rt" onclick="copy('rt','${refreshToken}')" title="Click to copy">${refreshToken}</div>
        <p class="hint">↑ Click to copy · Permanent token used to mint fresh access tokens</p>
       </div>`
    : `<div class="badge err">⚠ No refresh_token in response — ensure access_type=offline was set</div>`;

  const atBlock = accessToken
    ? `<div class="field">
        <label>Access Token — expires in ${expiresIn ?? '?'}s (server auto-refreshes, no need to save)</label>
        <div class="token" id="at" onclick="copy('at','${accessToken}')" title="Click to copy" style="color:rgba(255,255,255,.3);font-size:11px">${accessToken}</div>
       </div>`
    : '';

  const steps = `<div class="steps">
    <h3>Next Steps</h3>
    <ol>
      <li>Copy the <strong>Refresh Token</strong> above (click it)</li>
      <li>Go to <strong>Settings → Secrets</strong> in the builder</li>
      <li>Update <strong>ZOHO_REFRESH_TOKEN</strong> with the copied value</li>
      <li>Re-publish — email delivery will be live immediately</li>
    </ol>
    ${region ? `<p style="color:rgba(255,255,255,.25);font-size:11px;margin-top:10px;">Region: ${region}</p>` : ''}
  </div>`;

  const warn = `<p class="warn">⚠ Close this tab after saving. Do not share the refresh token.</p>`;

  const script = refreshToken
    ? `<script>
        function copy(id,val){
          navigator.clipboard.writeText(val).then(()=>{
            const el=document.getElementById(id);
            el.style.borderColor='#10B981';
            el.title='Copied!';
          }).catch(()=>{});
        }
        // Auto-copy on load
        navigator.clipboard.writeText('${refreshToken}').catch(()=>{});
      </script>`
    : `<script>function copy(){}</script>`;

  return shell('✅ Zoho Authorization Successful',
    `<div class="badge ok">✓ Tokens received from Zoho</div>${rtBlock}${atBlock}${steps}${warn}${script}`
  );
}

function errorPage(title: string, detail: string, hint: string): string {
  return shell(`❌ ${title}`,
    `<div class="badge err">✗ ${title}</div>
     <pre>${detail}</pre>
     ${hint ? `<p style="color:rgba(255,255,255,.4);font-size:13px">${hint}</p>` : ''}
     <p style="color:rgba(255,255,255,.3);font-size:12px;margin-top:4px">
       Return to <a href="/admin/security" style="color:#C9A84C">Admin → Security → Health</a> and restart the flow.
     </p>`
  );
}
