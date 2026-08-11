/**
 * GET /api/admin/zoho/oauth/callback
 * Protected — admin session required.
 *
 * Receives the Zoho OAuth authorization code, exchanges it for
 * access + refresh tokens, and returns them as JSON so the admin
 * can save ZOHO_REFRESH_TOKEN as a secret.
 *
 * Query params: ?code=XXXX&state=zoho_oauth
 */
import type { Request, Response } from 'express';
import { getSecret } from '#runtime/secrets';

const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
// DEFAULT_CLIENT_ID removed — must be set via ZOHO_CLIENT_ID secret.
const REDIRECT_URI   = 'https://citygate.capital/api/admin/zoho/oauth/callback';

export default async function handler(req: Request, res: Response) {
  const { code } = req.query as { code?: string };

  if (!code) {
    return res.status(400).send(`
      <html><body style="background:#0A0A0A;color:#fff;font-family:monospace;padding:40px;">
        <h2 style="color:#ef4444;">❌ Missing authorization code</h2>
        <p>No <code>code</code> parameter in the callback URL.</p>
        <p>Please restart the OAuth flow from Admin → Security → Health.</p>
      </body></html>
    `);
  }

  const clientSecret = getSecret('ZOHO_CLIENT_SECRET') || getSecret('CLIENTSECRET');
  const clientId     = String(getSecret('ZOHO_CLIENT_ID') || getSecret('CLIENTID') || '');
  if (!clientSecret) {
    return res.status(503).send(`
      <html><body style="background:#0A0A0A;color:#fff;font-family:monospace;padding:40px;">
        <h2 style="color:#ef4444;">❌ ZOHO_CLIENT_SECRET not configured</h2>
        <p>Add <code>ZOHO_CLIENT_SECRET</code> in Settings → Secrets, then retry the OAuth flow.</p>
      </body></html>
    `);
  }

  try {
    const params = new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: String(clientSecret),
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    });

    const tokenRes = await fetch(ZOHO_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString(),
    });

    const tokenText = await tokenRes.text();
    let tokenData: Record<string, unknown> = {};
    try { tokenData = JSON.parse(tokenText); } catch { /* not JSON */ }

    if (!tokenRes.ok || tokenData.error) {
      console.error('zoho.oauth.token_exchange_failed', { status: tokenRes.status, body: tokenText.slice(0, 400) });
      return res.status(502).send(`
        <html><body style="background:#0A0A0A;color:#fff;font-family:monospace;padding:40px;">
          <h2 style="color:#ef4444;">❌ Token exchange failed</h2>
          <pre style="color:#fca5a5;background:#1a0000;padding:16px;border-radius:8px;overflow:auto;">${tokenText.slice(0, 600)}</pre>
          <p>Common causes: expired code (use within 60s), wrong client secret, or redirect URI mismatch.</p>
        </body></html>
      `);
    }

    const refreshToken = tokenData.refresh_token as string | undefined;
    const accessToken  = tokenData.access_token  as string | undefined;
    const expiresIn    = tokenData.expires_in     as number | undefined;

    console.log('zoho.oauth.token_exchange_success', {
      hasRefreshToken: !!refreshToken,
      hasAccessToken:  !!accessToken,
      expiresIn,
    });

    // Return a clean HTML page with the tokens — admin copies refresh token to Secrets
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Zoho OAuth — City Gate Capital</title>
        <meta charset="UTF-8"/>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0A0A0A; color: #fff; font-family: Inter, Arial, sans-serif; padding: 40px 24px; min-height: 100vh; }
          .card { max-width: 640px; margin: 0 auto; background: #111; border: 1px solid rgba(201,168,76,0.2); border-radius: 16px; overflow: hidden; }
          .header { background: linear-gradient(135deg,#0A1F44,#0d2a5e); padding: 28px 32px; }
          .header h1 { color: #C9A84C; font-size: 18px; font-weight: 700; }
          .header p  { color: rgba(255,255,255,0.4); font-size: 13px; margin-top: 4px; }
          .body { padding: 28px 32px; }
          .success { display: flex; align-items: center; gap: 10px; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); border-radius: 10px; padding: 14px 16px; margin-bottom: 24px; color: #10B981; font-size: 14px; font-weight: 600; }
          .field { margin-bottom: 20px; }
          .field label { display: block; color: rgba(255,255,255,0.3); font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
          .token-box { background: #0A0A0A; border: 1px solid rgba(201,168,76,0.15); border-radius: 10px; padding: 14px 16px; font-family: monospace; font-size: 12px; color: #C9A84C; word-break: break-all; cursor: pointer; transition: border-color 0.2s; }
          .token-box:hover { border-color: rgba(201,168,76,0.4); }
          .copy-hint { color: rgba(255,255,255,0.2); font-size: 11px; margin-top: 6px; }
          .step { background: rgba(201,168,76,0.04); border: 1px solid rgba(201,168,76,0.1); border-radius: 10px; padding: 16px; margin-top: 24px; }
          .step h3 { color: #C9A84C; font-size: 13px; font-weight: 600; margin-bottom: 10px; }
          .step ol { color: rgba(255,255,255,0.5); font-size: 13px; line-height: 1.8; padding-left: 18px; }
          .step ol li strong { color: rgba(255,255,255,0.8); }
          .warn { color: rgba(255,200,100,0.7); font-size: 12px; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>✅ Zoho OAuth — Authorization Successful</h1>
            <p>citygate.capital · Zoho Mail API</p>
          </div>
          <div class="body">
            <div class="success">
              <span>✓</span> Tokens received from Zoho
            </div>

            ${refreshToken ? `
            <div class="field">
              <label>Refresh Token — save this as ZOHO_REFRESH_TOKEN</label>
              <div class="token-box" onclick="navigator.clipboard.writeText('${refreshToken}').then(()=>this.style.borderColor='#10B981')" title="Click to copy">
                ${refreshToken}
              </div>
              <p class="copy-hint">↑ Click to copy · This token is permanent and used to mint fresh access tokens</p>
            </div>
            ` : '<p style="color:#fca5a5;font-size:13px;margin-bottom:16px;">⚠ No refresh token returned — ensure <code>access_type=offline</code> was in the auth URL.</p>'}

            ${accessToken ? `
            <div class="field">
              <label>Access Token — expires in ${expiresIn ?? '?'} seconds (optional to save)</label>
              <div class="token-box" onclick="navigator.clipboard.writeText('${accessToken}').then(()=>this.style.borderColor='#10B981')" title="Click to copy" style="color:rgba(255,255,255,0.4);font-size:11px;">
                ${accessToken}
              </div>
              <p class="copy-hint">↑ Short-lived — the server auto-refreshes using ZOHO_REFRESH_TOKEN</p>
            </div>
            ` : ''}

            <div class="step">
              <h3>Next Steps</h3>
              <ol>
                <li>Copy the <strong>Refresh Token</strong> above (click it)</li>
                <li>Go to <strong>Admin → Security → Health</strong></li>
                <li>Click <strong>"Save Refresh Token"</strong> and paste it</li>
                <li>The server will auto-refresh access tokens — email is now live</li>
              </ol>
            </div>

            <p class="warn">⚠ Close this tab after saving the token. Do not share it.</p>
          </div>
        </div>
        <script>
          // Auto-copy refresh token to clipboard on load
          ${refreshToken ? `
          try {
            navigator.clipboard.writeText('${refreshToken}');
            console.log('Refresh token auto-copied to clipboard');
          } catch(e) {}
          ` : ''}
        </script>
      </body>
      </html>
    `);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zoho.oauth.callback_error', msg);
    return res.status(500).send(`
      <html><body style="background:#0A0A0A;color:#fff;font-family:monospace;padding:40px;">
        <h2 style="color:#ef4444;">❌ Unexpected error</h2>
        <pre style="color:#fca5a5;">${msg}</pre>
      </body></html>
    `);
  }
}
