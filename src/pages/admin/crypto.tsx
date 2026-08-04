import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Copy, RefreshCw, TrendingUp, TrendingDown, CheckCircle } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth } from '@/lib/adminAuth';

const WALLETS = [
  { symbol: 'BTC', name: 'Bitcoin',  color: '#F7931A', balance: 142.8,     usd: 9_847_320, change: +3.2,  address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', pending: 3 },
  { symbol: 'ETH', name: 'Ethereum', color: '#627EEA', balance: 2841.4,    usd: 7_103_500, change: +1.8,  address: '0x742d35Cc6634C0532925a3b8D4C9C2B4E1A2F3D', pending: 7 },
  { symbol: 'USDT',name: 'Tether',   color: '#26A17B', balance: 4_200_000, usd: 4_200_000, change: 0,     address: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', pending: 12 },
  { symbol: 'BNB', name: 'BNB',      color: '#F3BA2F', balance: 8_420,     usd: 2_526_000, change: -0.9,  address: 'bnb1grpf0955h0ykzq3ar5nmum7y6gdfl6lxfn46h2', pending: 1 },
];

const PENDING_TXS = [
  { id: 'btx_001', symbol: 'BTC', user: 'Alice Morgan',   amount: 0.42,    usd: 28_980, type: 'withdrawal', ts: '5m ago' },
  { id: 'btx_002', symbol: 'ETH', user: 'Bob Keller',     amount: 12.5,    usd: 31_250, type: 'withdrawal', ts: '12m ago' },
  { id: 'btx_003', symbol: 'USDT',user: 'Carol Thompson', amount: 50_000,  usd: 50_000, type: 'transfer',   ts: '18m ago' },
  { id: 'btx_004', symbol: 'BTC', user: 'David Rivera',   amount: 1.8,     usd: 124_200,type: 'withdrawal', ts: '34m ago' },
  { id: 'btx_005', symbol: 'ETH', user: 'Emma Santos',    amount: 5.0,     usd: 12_500, type: 'deposit',    ts: '1h ago' },
];

export default function AdminCrypto() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState('');
  const [approving, setApproving] = useState('');
  const [approved, setApproved]   = useState<string[]>([]);

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  function copyAddress(addr: string, sym: string) {
    navigator.clipboard.writeText(addr).catch(() => {});
    setCopied(sym);
    setTimeout(() => setCopied(''), 2000);
  }

  function approveTx(id: string) {
    setApproving(id);
    setTimeout(() => { setApproving(''); setApproved(a => [...a, id]); }, 1200);
  }

  return (
    <>
      <Helmet><title>Crypto Panel — CGC Admin</title><meta name="robots" content="noindex" /></Helmet>
      <AdminLayout title="Crypto">
        <div className="mb-6">
          <h1 className="text-white text-xl font-bold">Crypto Wallet Management</h1>
          <p className="text-white/30 text-sm">Monitor balances, approve transfers, generate addresses</p>
        </div>

        {/* Wallet cards */}
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {WALLETS.map((w, i) => (
            <motion.div key={w.symbol} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-colors"
              style={{ background: 'rgba(255,255,255,0.025)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-black"
                  style={{ background: w.color }}>
                  {w.symbol.slice(0, 1)}
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold ${w.change > 0 ? 'text-emerald-400' : w.change < 0 ? 'text-red-400' : 'text-white/30'}`}>
                  {w.change > 0 ? <TrendingUp size={12} /> : w.change < 0 ? <TrendingDown size={12} /> : null}
                  {w.change > 0 ? '+' : ''}{w.change}%
                </div>
              </div>
              <p className="text-white font-bold text-lg leading-none mb-1">{Number(w?.balance ?? 0).toLocaleString()} <span className="text-white/30 text-sm font-normal">{w.symbol}</span></p>
              <p className="text-white/50 text-sm mb-3">${Number(w?.usd ?? 0).toLocaleString()}</p>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/5">
                <p className="text-white/25 text-[10px] font-mono truncate flex-1">{w.address.slice(0, 20)}...</p>
                <button onClick={() => copyAddress(w.address, w.symbol)}
                  className="text-white/30 hover:text-primary transition-colors shrink-0">
                  {copied === w.symbol ? <CheckCircle size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
              {w.pending > 0 && (
                <p className="text-amber-400 text-[10px] mt-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {w.pending} pending transactions
                </p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Pending approvals */}
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h3 className="text-white font-semibold text-sm">Pending Crypto Approvals</h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{PENDING_TXS.filter(t => !approved.includes(t.id)).length} pending</span>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {PENDING_TXS.map(tx => {
              const isApproved = approved.includes(tx.id);
              return (
                <div key={tx.id} className={`flex items-center gap-4 px-5 py-4 transition-colors ${isApproved ? 'opacity-40' : 'hover:bg-white/[0.02]'}`}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-black shrink-0"
                    style={{ background: WALLETS.find(w => w.symbol === tx.symbol)?.color ?? '#C9A84C' }}>
                    {tx.symbol.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium">{tx.user}</p>
                    <p className="text-white/30 text-[10px] capitalize">{tx.type} · {tx.ts}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-xs font-semibold font-mono">{tx.amount} {tx.symbol}</p>
                    <p className="text-white/30 text-[10px]">${Number(tx?.usd ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isApproved ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle size={12} /> Approved</span>
                    ) : (
                      <>
                        <button onClick={() => approveTx(tx.id)} disabled={approving === tx.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-50">
                          {approving === tx.id ? <RefreshCw size={10} className="animate-spin" /> : null}
                          Approve
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-colors">
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AdminLayout>
    </>
  );
}
