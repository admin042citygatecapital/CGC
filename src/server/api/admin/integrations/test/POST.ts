/**
 * POST /api/admin/integrations/test
 * Performs a lightweight connectivity test for the given integration.
 * Returns { ok, message, latencyMs } — never exposes secret values.
 *
 * Body: { id: IntegrationId }
 */
import type { Request, Response } from 'express';
import { getSecret } from '#runtime/secrets';
import { recordTestResult, type IntegrationId } from '../../../../lib/integrationStore.js';

function s(...names: string[]): string {
  for (const n of names) {
    const v = getSecret(n);
    if (v) return String(v).trim();
  }
  return '';
}

async function testZohoMail(): Promise<{ ok: boolean; message: string }> {
  const clientId     = s('ZOHO_CLIENT_ID', 'CLIENTID');
  const clientSecret = s('ZOHO_CLIENT_SECRET', 'CLIENTSECRET');
  const refreshToken = s('ZOHO_REFRESH_TOKEN', 'REFRESHTOKEN');
  if (!clientId || !clientSecret) return { ok: false, message: 'ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET not configured' };
  if (!refreshToken) return { ok: false, message: 'ZOHO_REFRESH_TOKEN not configured — re-authorize via SMTP Config' };
  // Attempt a token refresh to verify credentials
  try {
    const resp = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await resp.json() as Record<string, unknown>;
    if (data.access_token) return { ok: true,  message: 'Token refresh successful — Zoho Mail is reachable' };
    return { ok: false, message: `Token refresh failed: ${data.error ?? 'unknown error'}` };
  } catch (e) {
    return { ok: false, message: `Network error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function testResend(): Promise<{ ok: boolean; message: string }> {
  const apiKey = s('RESEND_API_KEY');
  const webhookSecret = s('RESEND_WEBHOOK_SECRET');
  if (!apiKey) return { ok: false, message: 'RESEND_API_KEY not configured' };
  try {
    const resp = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(6000),
    });
    if (resp.ok) {
      return {
        ok: Boolean(webhookSecret),
        message: webhookSecret
          ? 'Resend API verified and signed webhook verification is configured'
          : 'Resend API verified, but RESEND_WEBHOOK_SECRET is not configured',
      };
    }
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, message: `Resend credential could not inspect domains (HTTP ${resp.status})` };
    }
    return { ok: false, message: `Resend API returned HTTP ${resp.status}` };
  } catch (e) {
    return { ok: false, message: `Network error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function testSmartsuppApi(): Promise<{ ok: boolean; message: string }> {
  const apiKey = s('SMARTSUPP_API_KEY');
  const widgetKey = s('SMARTSUPP_KEY');
  if (!apiKey) {
    if (widgetKey) return { ok: true, message: 'Widget key present — API key not configured (read-only mode)' };
    return { ok: false, message: 'SMARTSUPP_KEY not configured' };
  }
  try {
    const resp = await fetch('https://api.smartsupp.com/v2/account', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(6000),
    });
    if (resp.ok) return { ok: true, message: 'Smartsupp API reachable — account verified' };
    return { ok: false, message: `API returned HTTP ${resp.status}` };
  } catch (e) {
    return { ok: false, message: `Network error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function testCloudflare(): Promise<{ ok: boolean; message: string }> {
  const token  = s('CLOUDFLARE_API_TOKEN');
  const zoneId = s('CLOUDFLARE_ZONE_ID');
  if (!token)  return { ok: false, message: 'CLOUDFLARE_API_TOKEN not configured' };
  if (!zoneId) return { ok: false, message: 'CLOUDFLARE_ZONE_ID not configured' };
  try {
    const resp = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    const data = await resp.json() as { success?: boolean; result?: { name?: string } };
    if (data.success) return { ok: true, message: `Zone verified: ${data.result?.name ?? zoneId}` };
    return { ok: false, message: `Cloudflare API error — check token permissions` };
  } catch (e) {
    return { ok: false, message: `Network error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function testGoogleAnalytics(): Promise<{ ok: boolean; message: string }> {
  const measurementId = s('GA_MEASUREMENT_ID');
  if (!measurementId) return { ok: false, message: 'GA_MEASUREMENT_ID not configured' };
  if (!measurementId.startsWith('G-')) return { ok: false, message: `Measurement ID format invalid — expected G-XXXXXXXXXX, got: ${measurementId.slice(0, 12)}` };
  return { ok: true, message: `Measurement ID ${measurementId} is configured` };
}

async function testGTM(): Promise<{ ok: boolean; message: string }> {
  const containerId = s('GTM_CONTAINER_ID');
  if (!containerId) return { ok: false, message: 'GTM_CONTAINER_ID not configured' };
  if (!containerId.startsWith('GTM-')) return { ok: false, message: `Container ID format invalid — expected GTM-XXXXXXX` };
  return { ok: true, message: `Container ID ${containerId} is configured` };
}

async function testGoogleMaps(): Promise<{ ok: boolean; message: string }> {
  const apiKey = s('GOOGLE_MAPS_API_KEY');
  if (!apiKey) return { ok: false, message: 'GOOGLE_MAPS_API_KEY not configured' };
  try {
    const resp = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=Lagos&key=${apiKey}`,
      { signal: AbortSignal.timeout(6000) }
    );
    const data = await resp.json() as { status?: string };
    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') return { ok: true, message: 'Google Maps API key is valid and reachable' };
    if (data.status === 'REQUEST_DENIED') return { ok: false, message: 'API key rejected — check key restrictions and enabled APIs' };
    return { ok: false, message: `Unexpected status: ${data.status}` };
  } catch (e) {
    return { ok: false, message: `Network error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function testStripe(): Promise<{ ok: boolean; message: string }> {
  const secretKey = s('STRIPE_SECRET_KEY');
  if (!secretKey) return { ok: false, message: 'STRIPE_SECRET_KEY not configured' };
  try {
    const resp = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(6000),
    });
    if (resp.ok) {
      const mode = secretKey.startsWith('sk_live_') ? 'live' : 'test';
      return { ok: true, message: `Stripe API reachable — ${mode} mode` };
    }
    if (resp.status === 401) return { ok: false, message: 'Invalid Stripe secret key' };
    return { ok: false, message: `Stripe API returned HTTP ${resp.status}` };
  } catch (e) {
    return { ok: false, message: `Network error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function testPayPal(): Promise<{ ok: boolean; message: string }> {
  const clientId     = s('PAYPAL_CLIENT_ID');
  const clientSecret = s('PAYPAL_CLIENT_SECRET');
  if (!clientId || !clientSecret) return { ok: false, message: 'PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not configured' };
  try {
    const resp = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) return { ok: true, message: 'PayPal OAuth token obtained — credentials valid (sandbox)' };
    return { ok: false, message: `PayPal auth failed: HTTP ${resp.status}` };
  } catch (e) {
    return { ok: false, message: `Network error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function testTwilio(): Promise<{ ok: boolean; message: string }> {
  const accountSid = s('TWILIO_ACCOUNT_SID');
  const authToken  = s('TWILIO_AUTH_TOKEN');
  if (!accountSid || !authToken) return { ok: false, message: 'TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not configured' };
  try {
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}` },
      signal: AbortSignal.timeout(6000),
    });
    if (resp.ok) return { ok: true, message: 'Twilio account verified — credentials valid' };
    if (resp.status === 401) return { ok: false, message: 'Invalid Twilio credentials' };
    return { ok: false, message: `Twilio API returned HTTP ${resp.status}` };
  } catch (e) {
    return { ok: false, message: `Network error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function testWhatsApp(): Promise<{ ok: boolean; message: string }> {
  const token   = s('WHATSAPP_TOKEN');
  const phoneId = s('WHATSAPP_PHONE_ID');
  if (!token)   return { ok: false, message: 'WHATSAPP_TOKEN not configured' };
  if (!phoneId) return { ok: false, message: 'WHATSAPP_PHONE_ID not configured' };
  try {
    const resp = await fetch(`https://graph.facebook.com/v18.0/${phoneId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6000),
    });
    if (resp.ok) return { ok: true, message: 'WhatsApp Business phone number verified' };
    if (resp.status === 401) return { ok: false, message: 'Invalid WhatsApp access token' };
    return { ok: false, message: `WhatsApp API returned HTTP ${resp.status}` };
  } catch (e) {
    return { ok: false, message: `Network error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function testBankingApi(): Promise<{ ok: boolean; message: string }> {
  const flw     = s('FLUTTERWAVE_SECRET_KEY');
  const paystack = s('PAYSTACK_SECRET_KEY');
  const generic  = s('BANKING_API_KEY');
  if (!flw && !paystack && !generic) return { ok: false, message: 'No banking API key configured' };
  if (flw) {
    try {
      const resp = await fetch('https://api.flutterwave.com/v3/banks/NG', {
        headers: { Authorization: `Bearer ${flw}` },
        signal: AbortSignal.timeout(6000),
      });
      if (resp.ok) return { ok: true, message: 'Flutterwave API reachable — key valid' };
      return { ok: false, message: `Flutterwave returned HTTP ${resp.status}` };
    } catch (e) {
      return { ok: false, message: `Flutterwave network error: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  if (paystack) {
    try {
      const resp = await fetch('https://api.paystack.co/bank', {
        headers: { Authorization: `Bearer ${paystack}` },
        signal: AbortSignal.timeout(6000),
      });
      if (resp.ok) return { ok: true, message: 'Paystack API reachable — key valid' };
      return { ok: false, message: `Paystack returned HTTP ${resp.status}` };
    } catch (e) {
      return { ok: false, message: `Paystack network error: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  return { ok: true, message: 'Generic banking API key is configured' };
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

const TESTERS: Record<IntegrationId, () => Promise<{ ok: boolean; message: string }>> = {
  resend:              testResend,
  zoho_mail:           testZohoMail,
  smartsupp:           testSmartsuppApi,
  cloudflare:          testCloudflare,
  google_analytics:    testGoogleAnalytics,
  google_tag_manager:  testGTM,
  google_maps:         testGoogleMaps,
  stripe:              testStripe,
  paypal:              testPayPal,
  twilio:              testTwilio,
  whatsapp_business:   testWhatsApp,
  banking_api:         testBankingApi,
};

export default async function handler(req: Request, res: Response) {
  try {
    const { id } = req.body as { id: IntegrationId };
    if (!id || !(id in TESTERS)) {
      return res.status(400).json({ error: `Unknown integration id: ${id}` });
    }

    const start  = Date.now();
    const result = await TESTERS[id]();
    const latencyMs = Date.now() - start;

    recordTestResult(id, result.ok);

    res.json({ ok: result.ok, message: result.message, latencyMs, testedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Test failed', message: String(err) });
  }
}
