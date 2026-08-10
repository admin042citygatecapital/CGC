import { Helmet } from '@dr.pogodin/react-helmet';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Bitcoin, FileClock, Loader2, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/transactions/real?limit=100', {
        credentials: 'same-origin',
        headers: authHeaders(),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load demonstration records.');
      setTransactions((result.data ?? []).filter((tx: CryptoTx) => CRYPTO.has(tx.currency)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load demonstration records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const recent = useMemo(() => transactions.slice(0, 20), [transactions]);

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
              <Link to="/admin/sponsor-readiness" className="rounded-lg bg-amber-400 px-4 py-2.5 text-black text-sm font-semibold flex items-center gap-2 w-fit">
                Sponsor workspace <ArrowRight className="w-4 h-4" />
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
