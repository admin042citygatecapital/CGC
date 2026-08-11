import { useCallback, useEffect, useState } from 'react';
import { Building2, Link2, Loader2, ShieldCheck, Unlink } from 'lucide-react';

type PlaidMetadata = { institution?: { institution_id?: string; name?: string }; accounts?: unknown[] };
type PlaidHandler = { open(): void; exit(): void };
type PlaidItem = { id: string; institutionName: string | null; accounts: Array<{ id: string; name: string; mask: string | null; type: string; subtype: string | null }> };

declare global {
  interface Window {
    Plaid?: { create(options: { token: string; receivedRedirectUri?: string; onSuccess(publicToken: string, metadata: PlaidMetadata): void; onExit(error: unknown): void }): PlaidHandler };
  }
}

async function ensurePlaidScript(): Promise<void> {
  if (window.Plaid) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-cgc-plaid]');
    if (existing) { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', () => reject(new Error('Plaid Link failed to load')), { once: true }); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.async = true; script.dataset.cgcPlaid = 'true';
    script.onload = () => resolve(); script.onerror = () => reject(new Error('Plaid Link failed to load'));
    document.head.appendChild(script);
  });
}

export function PlaidLinkCard({ token }: { token: string }) {
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const headers = { Authorization: `Bearer ${token}` };

  const refresh = useCallback(async () => {
    const response = await fetch('/api/users/plaid', { headers });
    if (response.ok) setItems(((await response.json()) as { items?: PlaidItem[] }).items ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => { void refresh(); }, [refresh]);

  const connect = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/users/plaid/link-token', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' });
      const data = await response.json() as { linkToken?: string; error?: string };
      if (!response.ok || !data.linkToken) throw new Error(data.error || 'Unable to start Plaid Link');
      sessionStorage.setItem('cgc_plaid_link_token', data.linkToken);
      await ensurePlaidScript();
      const handler = window.Plaid?.create({
        token: data.linkToken,
        onSuccess: async (publicToken, metadata) => {
          const exchange = await fetch('/api/users/plaid/exchange', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ publicToken, metadata }) });
          if (!exchange.ok) { setMessage('The institution connected, but account setup could not be completed.'); setBusy(false); return; }
          sessionStorage.removeItem('cgc_plaid_link_token'); setMessage('Sandbox institution connected securely.'); await refresh(); setBusy(false);
        },
        onExit: () => { setBusy(false); },
      });
      if (!handler) throw new Error('Plaid Link is unavailable');
      handler.open();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to connect'); setBusy(false); }
  };

  const disconnect = async (id: string) => {
    setBusy(true);
    const response = await fetch('/api/users/plaid/disconnect', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setMessage(response.ok ? 'Institution disconnected.' : 'Unable to disconnect the institution.');
    await refresh(); setBusy(false);
  };

  return (
    <section className="rounded-2xl border border-[#C9A84C]/20 bg-gradient-to-br from-[#17140c] to-[#0d0d0d] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#C9A84C]/10"><Building2 className="h-5 w-5 text-[#C9A84C]" /></div>
          <div><div className="flex items-center gap-2"><h2 className="font-semibold text-white">Connected bank accounts</h2><span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">Sandbox</span></div>
          <p className="mt-1 text-xs text-white/45">Securely test UK account linking through Plaid. No real funds or payments are enabled.</p></div>
        </div>
        <button disabled={busy} onClick={() => void connect()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A84C] px-4 py-2.5 text-xs font-bold text-black disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Connect account
        </button>
      </div>
      {items.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{items.map((item) => <div key={item.id} className="rounded-xl border border-white/[0.07] bg-black/20 p-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-medium text-white"><ShieldCheck className="h-4 w-4 text-emerald-400" />{item.institutionName || 'Linked institution'}</div><button disabled={busy} onClick={() => void disconnect(item.id)} aria-label="Disconnect institution" className="text-white/30 hover:text-red-300"><Unlink className="h-4 w-4" /></button></div><p className="mt-2 text-[11px] text-white/40">{item.accounts.length} account{item.accounts.length === 1 ? '' : 's'} linked · identifiers masked</p></div>)}</div>}
      {message && <p className="mt-3 text-xs text-white/60" role="status">{message}</p>}
    </section>
  );
}
