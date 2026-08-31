import { Helmet } from '@dr.pogodin/react-helmet';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Bitcoin, CheckCircle2, FileClock, Loader2, LockKeyhole, RefreshCw, Save, ShieldCheck, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';

interface CryptoTx {
  id: string;
  type: string;
  status: string;
  userName: string;
  userEmail: string;
  amount: number;
  currency: string;
  reference: string;
  createdAt: string;
}

interface WalletConfig {
  id: string;
  symbol: string;
  name: string;
  network: string;
  address: string;
  minDeposit: number;
  confirmations: number;
  enabled: boolean;
  updatedAt: string;
}

type WalletDraft = WalletConfig & { reason: string; confirmed: boolean };

const ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', color: '#F7931A' },
  { symbol: 'ETH', name: 'Ethereum', color: '#627EEA' },
  { symbol: 'USDT', name: 'Tether', color: '#26A17B' },
  { symbol: 'BNB', name: 'BNB', color: '#F3BA2F' },
  { symbol: 'SOL', name: 'Solana', color: '#14F195' },
] as const;
const CRYPTO = new Set<string>(ASSETS.map(asset => asset.symbol));

export default function AdminCrypto() {
  const [transactions, setTransactions] = useState<CryptoTx[]>([]);
  const [wallets, setWallets] = useState<WalletConfig[]>([]);
  const [drafts, setDrafts] = useState<Record<string, WalletDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingId, setSavingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = authHeaders();
      const [transactionResponse, walletResponse] = await Promise.all([
        fetch('/api/admin/transactions/real?limit=100', { credentials: 'same-origin', headers }),
        fetch('/api/admin/wallets', { credentials: 'same-origin', headers }),
      ]);
      const [transactionResult, walletResult] = await Promise.all([transactionResponse.json(), walletResponse.json()]);
      if (!transactionResponse.ok) throw new Error(transactionResult.error || 'Unable to load demonstration records.');
      if (!walletResponse.ok) throw new Error(walletResult.error || 'Unable to load wallet configuration.');
      const configuredWallets = Array.isArray(walletResult.wallets) ? walletResult.wallets : [];
      setTransactions((transactionResult.data ?? []).filter((tx: CryptoTx) => CRYPTO.has(tx.currency)));
      setWallets(configuredWallets);
      setDrafts(Object.fromEntries(configuredWallets.map((wallet: WalletConfig) => [wallet.id, { ...wallet, reason: '', confirmed: false }])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load demonstration records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const recent = useMemo(() => transactions.slice(0, 20), [transactions]);

  function changeDraft(id: string, patch: Partial<WalletDraft>) {
    setDrafts(current => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  async function saveWallet(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setSavingId(id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/wallets', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          id,
          address: draft.address,
          minDeposit: Number(draft.minDeposit),
          confirmations: Number(draft.confirmations),
          enabled: draft.enabled,
          reason: draft.reason,
          confirmed: draft.confirmed,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save wallet configuration.');
      const updated = result.wallet as WalletConfig;
      setWallets(current => current.map(wallet => wallet.id === id ? updated : wallet));
      setDrafts(current => ({ ...current, [id]: { ...updated, reason: '', confirmed: false } }));
      setNotice(`${updated.symbol} wallet configuration saved. Live deposits remain provider-gated.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save wallet configuration.');
    } finally {
      setSavingId('');
    }
  }

  return (
    <>
      <Helmet>
        <title>Crypto Capability — City Gate Capital Admin</title>
        <meta name="description" content="Deferred crypto capability status and synthetic activity records." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/admin/crypto" />
      </Helmet>
      <AdminLayout title="Crypto (Deferred)">
        <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
          <section className="rounded-2xl border border-red-400/20 bg-gradient-to-br from-red-400/[0.08] to-transparent p-5 sm:p-7">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 text-red-300 text-sm font-semibold">
                  <LockKeyhole className="w-5 h-5" /> Deferred capability
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2">Crypto custody and trading are not enabled</h1>
                <p className="text-white/50 text-sm mt-2 max-w-3xl leading-relaxed">
                  No custody provider, deposit address, platform holding, trading venue, or live digital-asset balance is configured. Crypto is excluded from the current UK sponsor package.
                </p>
              </div>
              <Link to="/admin/integrations" className="rounded-lg bg-amber-400 px-4 py-2.5 text-black text-sm font-semibold flex items-center gap-2 w-fit">
                Review integrations <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </section>

          <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              ['Custody provider', 'Not contracted'],
              ['Deposit addresses', 'Not issued'],
              ['Live holdings', 'None recorded'],
              ['Execution', 'Disabled'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                <p className="text-white/35 text-xs uppercase tracking-wide">{label}</p>
                <p className="text-white font-semibold mt-1">{value}</p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            <div className="border-b border-white/[0.06] p-5">
              <div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-amber-300" /><h2 className="font-semibold text-white">Wallet address configuration</h2></div>
              <p className="mt-1 text-xs leading-relaxed text-white/40">Store reviewed platform wallet-address configuration and operational thresholds. Saving an address does not activate custody, deposits, withdrawals, or provider execution.</p>
            </div>
            {notice && <div className="m-4 flex gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200"><CheckCircle2 className="h-4 w-4 shrink-0" />{notice}</div>}
            <div className="grid gap-4 p-5 xl:grid-cols-2">
              {wallets.map(wallet => {
                const draft = drafts[wallet.id];
                if (!draft) return null;
                return <article key={wallet.id} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-white">{wallet.name}</p><p className="text-xs text-white/35">{wallet.symbol} · {wallet.network}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${draft.enabled ? 'bg-amber-400/15 text-amber-200' : 'bg-white/5 text-white/35'}`}>{draft.enabled ? 'Configured for activation' : 'Inactive'}</span></div>
                  <div className="mt-4 space-y-3">
                    <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-white/35">Wallet address</span><input name={`wallet-address-${wallet.id}`} value={draft.address} onChange={event => changeDraft(wallet.id, { address: event.target.value })} spellCheck={false} autoComplete="off" placeholder={`Enter reviewed ${wallet.symbol} address`} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-amber-300/40" /></label>
                    <div className="grid grid-cols-2 gap-3"><label><span className="mb-1 block text-[10px] uppercase tracking-wide text-white/35">Minimum amount</span><input type="number" min="0" step="any" value={draft.minDeposit} onChange={event => changeDraft(wallet.id, { minDeposit: Number(event.target.value) })} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none" /></label><label><span className="mb-1 block text-[10px] uppercase tracking-wide text-white/35">Confirmations</span><input type="number" min="0" max="10000" step="1" value={draft.confirmations} onChange={event => changeDraft(wallet.id, { confirmations: Number(event.target.value) })} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none" /></label></div>
                    <label className="block"><span className="mb-1 block text-[10px] uppercase tracking-wide text-white/35">Change reason</span><textarea value={draft.reason} onChange={event => changeDraft(wallet.id, { reason: event.target.value })} rows={2} maxLength={500} placeholder="Explain why this configuration is being changed." className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none" /></label>
                    <label className="flex items-start gap-2 text-xs text-white/50"><input type="checkbox" checked={draft.confirmed} onChange={event => changeDraft(wallet.id, { confirmed: event.target.checked })} className="mt-0.5 accent-amber-300" /><span>I confirm this address and network were independently reviewed. This does not enable customer money movement.</span></label>
                    <div className="flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs text-white/45"><input type="checkbox" checked={draft.enabled} onChange={event => changeDraft(wallet.id, { enabled: event.target.checked })} className="accent-amber-300" />Request operational activation</label><button type="button" onClick={() => void saveWallet(wallet.id)} disabled={savingId === wallet.id || draft.reason.trim().length < 10 || !draft.confirmed} className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-3 py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-35"><Save className="h-3.5 w-3.5" />{savingId === wallet.id ? 'Saving…' : 'Save configuration'}</button></div>
                  </div>
                </article>;
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="flex items-center gap-2"><Bitcoin className="w-5 h-5 text-amber-300" /><h2 className="text-white font-semibold">Deferred asset scope</h2></div>
            <p className="text-white/40 text-xs mt-2">Asset names and marks are for capability planning only. No amounts or addresses are represented.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
              {ASSETS.map(asset => (
                <div key={asset.symbol} className="rounded-xl border border-white/[0.06] bg-black/20 p-4 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full flex items-center justify-center text-black font-bold" style={{ background: asset.color }}>{asset.symbol.slice(0, 1)}</span>
                  <div><p className="text-white text-sm font-semibold">{asset.symbol}</p><p className="text-white/30 text-[11px]">{asset.name}</p></div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-5">
            <div className="flex gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-300 shrink-0" />
              <div><h2 className="text-amber-100 font-semibold">Activation dependencies</h2><p className="text-amber-100/55 text-xs mt-2 leading-relaxed">A future crypto workstream would require sponsor approval, jurisdiction-specific legal advice, custody and execution contracts, wallet screening, Travel Rule controls, key governance, reconciled provider ledgers, signed webhooks, disclosures, and independent security review. Administrator settings cannot bypass these dependencies.</p></div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            <div className="p-5 border-b border-white/[0.06] flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><FileClock className="w-5 h-5 text-sky-300" /><h2 className="text-white font-semibold">Synthetic historical records</h2></div><p className="text-white/35 text-xs mt-1">Read-only demonstration entries from the application database. They are not provider or custody records.</p></div><button onClick={() => void load()} disabled={loading} className="rounded-lg border border-white/10 px-3 py-2 text-white/60 text-xs flex items-center gap-2"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button></div>
            {error && <div className="m-4 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-red-200 text-sm flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
            {loading && recent.length === 0 ? <div className="py-12 text-center text-white/30"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Loading records…</div> : recent.length === 0 ? <div className="py-12 text-center text-white/25 text-sm">No synthetic crypto activity exists.</div> : <div className="divide-y divide-white/[0.05]">{recent.map(tx => <div key={tx.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"><div><p className="text-white/75 text-sm">{tx.userName || tx.userEmail}</p><p className="text-white/30 text-xs mt-1">{tx.type.replaceAll('_', ' ')} · {new Date(tx.createdAt).toLocaleString()}</p></div><div className="sm:text-right"><p className="text-white/65 text-sm">{Number(tx.amount).toLocaleString()} {tx.currency}</p><span className="text-[10px] uppercase text-white/30">{tx.status} · synthetic</span></div></div>)}</div>}
          </section>
        </main>
      </AdminLayout>
    </>
  );
}
