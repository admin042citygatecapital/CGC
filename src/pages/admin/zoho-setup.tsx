/**
 * /admin/zoho-setup
 * One-shot Zoho OAuth helper page.
 * Step 1 — Launches the OAuth flow (opens /api/zoho/connect).
 * Step 2 — If Zoho redirected back with ?code=…, exchanges it for tokens
 *           and displays the refresh token for saving to secrets.
 * Step 3 — Lets the admin paste a code manually if the redirect was intercepted.
 *
 * noindex — admin-only utility page.
 */
import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { zoho_setup } from 'virtual:content';

type Step = 'idle' | 'exchanging' | 'done' | 'error';

interface ExchangeResult {
  ok: boolean;
  refresh_token?: string;
  access_token?: string;
  expires_in?: number;
  region?: string;
  error?: string;
  hint?: string;
}

export default function ZohoSetupPage() {
  const [searchParams] = useSearchParams();
  const [step, setStep]           = useState<Step>('idle');
  const [result, setResult]       = useState<ExchangeResult | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [copied, setCopied]       = useState(false);

  const exchange = useCallback(async (code: string) => {
    setStep('exchanging');
    setResult(null);
    try {
      const res = await fetch('/api/admin/zoho/exchange', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: code.trim() }),
      });
      const data: ExchangeResult = await res.json();
      setResult(data);
      setStep(data.ok ? 'done' : 'error');
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
      setStep('error');
    }
  }, []);

  // If the callback redirected here with tokens already resolved, show them directly
  useEffect(() => {
    const status = searchParams.get('status');
    const rt     = searchParams.get('refresh_token');
    const at     = searchParams.get('access_token');
    const exp    = searchParams.get('expires_in');
    const region = searchParams.get('region');
    if (status === 'success' && rt && step === 'idle') {
      setResult({
        ok:            true,
        refresh_token: rt,
        access_token:  at ?? undefined,
        expires_in:    exp ? Number(exp) : undefined,
        region:        region ? decodeURIComponent(region) : undefined,
      });
      setStep('done');
      return;
    }
    // Auto-exchange if Zoho redirected here with ?code=
    const code = searchParams.get('code');
    if (code && step === 'idle') exchange(code);
  }, [searchParams, step, exchange]);

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* fallback: select the text */ }
  };

  return (
    <>
      <Helmet>
        <title>Zoho OAuth Setup — City Gate Capital Admin</title>
        <meta name="description" content="Admin-only Zoho OAuth re-authorization utility for City Gate Capital SMTP configuration." />
        <link rel="canonical" href="https://citygate.capital/admin/zoho-setup" />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div style={{
        minHeight: '100vh', background: '#0A0A0A', display: 'flex',
        alignItems: 'flex-start', justifyContent: 'center', padding: '48px 16px',
        fontFamily: 'Inter, Arial, sans-serif',
      }}>
        <div style={{
          width: '100%', maxWidth: 660,
          background: '#111', border: '1px solid rgba(201,168,76,.18)',
          borderRadius: 18, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg,#0A1F44,#0d2a5e)',
            padding: '28px 32px',
          }}>
            <h1 style={{ color: '#C9A84C', fontSize: 17, fontWeight: 700, margin: 0 }}>
              <span>{zoho_setup.header.title}</span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 12, margin: '4px 0 0' }}>
              <span>{zoho_setup.header.subtitle}</span>
            </p>
          </div>

          <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Step 1: Launch OAuth ─────────────────────────────────── */}
            <div style={{
              background: 'rgba(201,168,76,.03)',
              border: '1px solid rgba(201,168,76,.09)',
              borderRadius: 10, padding: '16px 18px',
            }}>
              <h3 style={{
                color: '#C9A84C', fontSize: 12, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 10px',
              }}>
                <span>{zoho_setup.step1.label}</span>
              </h3>
              <p style={{ color: 'rgba(255,255,255,.45)', fontSize: 13, margin: '0 0 14px', lineHeight: 1.6 }}>
                <span>{zoho_setup.step1.description}</span>
              </p>
              <a
                href="/api/zoho/connect"
                style={{
                  display: 'inline-block', background: '#C9A84C', color: '#0A0A0A',
                  fontWeight: 700, fontSize: 13, padding: '10px 22px',
                  borderRadius: 8, textDecoration: 'none', letterSpacing: '.01em',
                }}
              >
                <span>{zoho_setup.step1.cta}</span>
              </a>
            </div>

            {/* ── Step 2: Manual code paste ────────────────────────────── */}
            <div style={{
              background: 'rgba(255,255,255,.02)',
              border: '1px solid rgba(255,255,255,.06)',
              borderRadius: 10, padding: '16px 18px',
            }}>
              <h3 style={{
                color: 'rgba(255,255,255,.5)', fontSize: 12, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 10px',
              }}>
                <span>{zoho_setup.step2.label}</span>
              </h3>
              <p style={{ color: 'rgba(255,255,255,.3)', fontSize: 12, margin: '0 0 12px', lineHeight: 1.6 }}>
                <span>{zoho_setup.step2.description}</span>
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder={zoho_setup.step2.placeholder}
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  style={{
                    flex: 1, background: '#0A0A0A',
                    border: '1px solid rgba(201,168,76,.18)',
                    borderRadius: 8, padding: '9px 12px',
                    color: '#C9A84C', fontSize: 12, fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => manualCode.trim() && exchange(manualCode)}
                  disabled={step === 'exchanging' || !manualCode.trim()}
                  style={{
                    background: manualCode.trim() ? '#C9A84C' : 'rgba(201,168,76,.2)',
                    color: '#0A0A0A', fontWeight: 700, fontSize: 12,
                    padding: '9px 18px', borderRadius: 8, border: 'none',
                    cursor: manualCode.trim() ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>{step === 'exchanging' ? zoho_setup.step2.buttonBusy : zoho_setup.step2.buttonIdle}</span>
                </button>
              </div>
            </div>

            {/* ── Exchanging spinner ───────────────────────────────────── */}
            {step === 'exchanging' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(201,168,76,.05)',
                border: '1px solid rgba(201,168,76,.15)',
                borderRadius: 10, padding: '13px 16px',
                color: '#C9A84C', fontSize: 13, fontWeight: 600,
              }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                <span>{zoho_setup.status.exchanging}</span>
              </div>
            )}

            {/* ── Success ──────────────────────────────────────────────── */}
            {step === 'done' && result?.refresh_token && (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(16,185,129,.07)',
                  border: '1px solid rgba(16,185,129,.2)',
                  borderRadius: 10, padding: '13px 16px',
                  color: '#10B981', fontSize: 13, fontWeight: 600,
                }}>
                  ✓ Tokens received from Zoho ({result.region?.replace('https://accounts.', '').replace('/oauth/v2/token', '')})
                </div>

                <div>
                  <label style={{
                    display: 'block', color: 'rgba(255,255,255,.28)',
                    fontSize: 10, textTransform: 'uppercase',
                    letterSpacing: '.12em', marginBottom: 7,
                  }}>
                    <span>{zoho_setup.status.tokenLabel}</span>
                  </label>
                  <div
                    onClick={() => copyToken(result.refresh_token!)}
                    title="Click to copy"
                    style={{
                      background: '#0A0A0A',
                      border: `1px solid ${copied ? '#10B981' : 'rgba(201,168,76,.18)'}`,
                      borderRadius: 10, padding: '13px 15px',
                      fontFamily: 'monospace', fontSize: 12,
                      color: '#C9A84C', wordBreak: 'break-all',
                      cursor: 'pointer', transition: 'border-color .2s',
                    }}
                  >
                    {result.refresh_token}
                  </div>
                  <p style={{ color: 'rgba(255,255,255,.2)', fontSize: 11, margin: '6px 0 0' }}>
                    <span>{copied ? zoho_setup.status.copiedConfirm : zoho_setup.status.copyIdle}</span>
                  </p>
                </div>

                <div style={{
                  background: 'rgba(201,168,76,.03)',
                  border: '1px solid rgba(201,168,76,.09)',
                  borderRadius: 10, padding: '16px 18px',
                }}>
                  <h3 style={{
                    color: '#C9A84C', fontSize: 12, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 10px',
                  }}>
                    <span>{zoho_setup.nextSteps.label}</span>
                  </h3>
                  <ol style={{
                    color: 'rgba(255,255,255,.45)', fontSize: 13,
                    lineHeight: 1.9, paddingLeft: 18, margin: 0,
                  }}>
                    {zoho_setup.nextSteps.items.map((item) => (
                      <li key={item.id}><span>{item.text}</span></li>
                    ))}
                  </ol>
                </div>

                <p style={{ color: 'rgba(255,200,80,.55)', fontSize: 11, margin: 0 }}>
                  <span>{zoho_setup.status.warning}</span>
                </p>
              </>
            )}

            {/* ── Error ────────────────────────────────────────────────── */}
            {step === 'error' && result && (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(239,68,68,.07)',
                  border: '1px solid rgba(239,68,68,.2)',
                  borderRadius: 10, padding: '13px 16px',
                  color: '#f87171', fontSize: 13, fontWeight: 600,
                  marginBottom: 12,
                }}>
                  ✗ Token exchange failed: {result.error}
                </div>
                {result.hint && (
                  <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                    {result.hint}
                  </p>
                )}
                <button
                  onClick={() => { setStep('idle'); setResult(null); setManualCode(''); }}
                  style={{
                    marginTop: 12, background: 'transparent',
                    border: '1px solid rgba(201,168,76,.3)',
                    color: '#C9A84C', fontSize: 12, padding: '8px 16px',
                    borderRadius: 8, cursor: 'pointer',
                  }}
                >
                  Try again
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
