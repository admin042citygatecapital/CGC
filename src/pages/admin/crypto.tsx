import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Copy, TrendingUp, TrendingDown, CheckCircle, XCircle,
  Loader2, AlertTriangle, Edit2, DollarSign, List, ChevronDown, ChevronUp,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WalletInfo {
  id: string;
  symbol: string;
  name: string;
  color: string;
  balance: number;
  usd: number;
  change: number;
  address: string;
  pending: number;
}

interface CryptoTx {
  id: string;
  type: string;
  status: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  currency: string;
  reference: string;
  description: string;
  createdAt: string;
  flagged: boolean;
}

// Static wallet definitions — balances are display-only (platform custody wallets)
const WALLET_DEFS: Omit<WalletInfo, 'id'>[] = [
  { symbol: 'BTC',  name: 'Bitcoin',  color: '#F7931A', balance: 142.8,     usd: 9_847_320, change: +3.2,  address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', pending: 0 },
  { symbol: 'ETH',  name: 'Ethereum', color: '#627EEA', balance: 2841.4,    usd: 7_103_500, change: +1.8,  address: '0x742d35Cc6634C0532925a3b8D4C9C2B4E1A2F3D', pending: 0 },
  { symbol: 'USDT', name: 'Tether',   color: '#26A17B', balance: 4_200_000, usd: 4_200_000, change: 0,     address: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',         pending: 0 },
  { symbol: 'BNB',  name: 'BNB',      color: '#F3BA2F', balance: 8_420,     usd: 2_526_000, change: -0.9,  address: 'bnb1grpf0955h0ykzq3ar5nmum7y6gdfl6lxfn46h2',  pending: 0 },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminCrypto() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();

  const [copied,    setCopied]    = useState('');
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  // Per-wallet expanded panel: 'txs' | 'adjust' | 'edit' | null
  const [expanded,  setExpanded]  = useState<Record<string, string | null>>({});

  // Transactions per wallet
  const [walletTxs,    setWalletTxs]    = useState<Record<string, CryptoTx[]>>({});
  const [txLoading,    setTxLoading]    = useState<Record<string, boolean>>({});

  // Approve / reject state
  const [actionLoading, setAL]          = useState<string | null>(null);
  const [rejectModal,   setRejectModal] = useState<{ txId: string; ref: string } | null>(null);
  const [rejectNote,    setRejectNote]  = useState('');

  // Edit address state per wallet
  const [editAddr,     setEditAddr]     = useState<Record<string, string>>({});
  const [addrSaving,   setAddrSaving]   = useState<Record<string, boolean>>({});

  // Manual balance adjust per wallet
  const [adjustForm,   setAdjustForm]   = useState<Record<string, { amount: string; type: string; userId: string; note: string }>>({});
  const [adjustSaving, setAdjustSaving] = useState<Record<string, boolean>>({});
  const [adjustDone,   setAdjustDone]   = useState<Record<string, boolean>>({});

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  function copyAddress(addr: string, sym: string) {
    navigator.clipboard.writeText(addr).catch(() => {});
    setCopied(sym);
    setTimeout(() => setCopied(''), 2000);
  }

  function togglePanel(sym: string, panel: string) {
    setExpanded(prev => ({ ...prev, [sym]: prev[sym] === panel ? null : panel }));
    // Fetch txs when opening the txs panel
    if (panel === 'txs' && expanded[sym] !== 'txs') {
      fetchWalletTxs(sym);
    }
  }

  const fetchWalletTxs = useCallback(async (symbol: string) => {
    setTxLoading(prev => ({ ...prev, [symbol]: true }));
    try {
      const params = new URLSearchParams({ currency: symbol, limit: '20' });
      const res = await fetch(`/api/admin/transactions/real?${params}`, { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setWalletTxs(prev => ({ ...prev, [symbol]: d.data ?? [] }));
        // Update pending count
      }
    } catch { /* silent */ }
    setTxLoading(prev => ({ ...prev, [symbol]: false }));
  }, []);

  // Also fetch pending counts on mount
  useEffect(() => {
    WALLET_DEFS.forEach(w => fetchWalletTxs(w.symbol));
  }, [fetchWalletTxs]);

  async function approveTx(txId: string, symbol: string) {
    setAL(txId + 'approve');
    try {
      const res = await fetch('/api/admin/transactions/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ transactionId: txId }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast('Transaction approved');
        fetchWalletTxs(symbol);
      } else showToast(d.error ?? 'Approval failed', false);
    } catch { showToast('Network error', false); }
    setAL(null);
  }

  async function rejectTx() {
    if (!rejectModal) return;
    setAL(rejectModal.txId + 'reject');
    try {
      const res = await fetch('/api/admin/transactions/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ transactionId: rejectModal.txId, reason: rejectNote || undefined }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast('Transaction rejected');
        // Refresh all wallet txs
        WALLET_DEFS.forEach(w => fetchWalletTxs(w.symbol));
      } else showToast(d.error ?? 'Rejection failed', false);
    } catch { showToast('Network error', false); }
    setAL(null);
    setRejectModal(null);
    setRejectNote('');
  }

  async function saveAddress(symbol: string, walletId: string) {
    const addr = editAddr[symbol]?.trim();
    if (!addr) return;
    setAddrSaving(prev => ({ ...prev, [symbol]: true }));
    try {
      const res = await fetch('/api/admin/wallets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ id: walletId, address: addr }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast(`${symbol} deposit address updated`);
        setExpanded(prev => ({ ...prev, [symbol]: null }));
      } else showToast(d.error ?? 'Update failed', false);
    } catch { showToast('Network error', false); }
    setAddrSaving(prev => ({ ...prev, [symbol]: false }));
  }

  async function applyAdjust(symbol: string) {
    const form = adjustForm[symbol];
    if (!form?.userId || !form?.amount || !form?.note) {
      showToast('Fill in User ID, amount, and reason', false);
      return;
    }
    setAdjustSaving(prev => ({ ...prev, [symbol]: true }));
    try {
      const res = await fetch('/api/admin/balance/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          userId:   form.userId,
          amount:   Number(form.amount),
          currency: symbol,
          type:     form.type ?? 'credit',
          note:     form.note,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast(`${form.type === 'credit' ? 'Credited' : 'Debited'} ${form.amount} ${symbol}`);
        setAdjustDone(prev => ({ ...prev, [symbol]: true }));
        setAdjustForm(prev => ({ ...prev, [symbol]: { amount: '', type: 'credit', userId: '', note: '' } }));
        setTimeout(() => setAdjustDone(prev => ({ ...prev, [symbol]: false })), 4000);
      } else showToast(d.error ?? 'Adjustment failed', false);
    } catch { showToast('Network error', false); }
    setAdjustSaving(prev => ({ ...prev, [symbol]: false }));
  }

  // Derive pending counts from fetched txs
  const pendingCounts: Record<string, number> = {};
  for (const [sym, txs] of Object.entries(walletTxs)) {
    pendingCounts[sym] = txs.filter(t => t.status === 'pending').length;
  }

  return (
    <>
      <Helmet><title>Crypto Panel — CGC Admin</title><meta name="description" content="Cryptocurrency management panel for City Gate Capital." /><meta name="robots" content="noindex, nofollow" /><link rel="canonical" href="https://citygate.capital/admin/crypto" /></Helmet>
      <AdminLayout title="Crypto">

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl ${
                toast.ok ? 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400' : 'bg-red-500/15 border-red-500/20 text-red-400'
              }`}>
              {toast.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reject modal */}
        <AnimatePresence>
          {rejectModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                className="w-full max-w-md rounded-2xl border border-white/8 p-6"
                style={{ background: 'rgba(15,15,15,0.98)' }}>
                <h3 className="text-white font-bold mb-2">Reject Transaction</h3>
                <p className="text-white/40 text-sm mb-4">Ref: <span className="text-white/70 font-mono">{rejectModal.ref}</span></p>
                <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Rejection Reason (optional)</label>
                <textarea rows={3} value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                  placeholder="e.g. Suspicious activity, invalid address..."
                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-red-500/40 resize-none mb-4" />
                <div className="flex gap-3">
                  <button onClick={() => { setRejectModal(null); setRejectNote(''); }}
                    className="flex-1 py-2.5 rounded-xl border border-white/8 text-white/50 text-sm hover:bg-white/[0.04]">Cancel</button>
                  <button onClick={rejectTx} disabled={!!actionLoading}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/30 flex items-center justify-center gap-2">
                    {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                    Reject
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-6">
          <h1 className="text-white text-xl font-bold">Crypto Wallet Management</h1>
          <p className="text-white/30 text-sm">Monitor balances, approve transfers, edit addresses, manual adjustments</p>
        </div>

        {/* Wallet cards */}
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {WALLET_DEFS.map((w, i) => {
            const sym        = w.symbol;
            const pendingCnt = pendingCounts[sym] ?? w.pending;
            const panel      = expanded[sym] ?? null;
            const txs        = walletTxs[sym] ?? [];
            const pendingTxs = txs.filter(t => t.status === 'pending');
            const adj        = adjustForm[sym] ?? { amount: '', type: 'credit', userId: '', note: '' };
            // wallet store id is typically the symbol lowercased
            const walletId   = sym.toLowerCase();

            return (
              <motion.div key={sym} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-white/5 overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.025)' }}>

                {/* Card header */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-black"
                      style={{ background: w.color }}>
                      {sym.slice(0, 1)}
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-semibold ${w.change > 0 ? 'text-emerald-400' : w.change < 0 ? 'text-red-400' : 'text-white/30'}`}>
                      {w.change > 0 ? <TrendingUp size={12} /> : w.change < 0 ? <TrendingDown size={12} /> : null}
                      {w.change > 0 ? '+' : ''}{w.change}%
                    </div>
                  </div>
                  <p className="text-white font-bold text-lg leading-none mb-1">
                    {Number(w.balance).toLocaleString()} <span className="text-white/30 text-sm font-normal">{sym}</span>
                  </p>
                  <p className="text-white/50 text-sm mb-3">${Number(w.usd).toLocaleString()}</p>

                  {/* Address row */}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/5 mb-3">
                    <p className="text-white/25 text-[10px] font-mono truncate flex-1">{w.address.slice(0, 20)}…</p>
                    <button onClick={() => copyAddress(w.address, sym)}
                      className="text-white/30 hover:text-primary transition-colors shrink-0">
                      {copied === sym ? <CheckCircle size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>

                  {pendingCnt > 0 && (
                    <p className="text-amber-400 text-[10px] mb-3 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      {pendingCnt} pending transaction{pendingCnt !== 1 ? 's' : ''}
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => { togglePanel(sym, 'txs'); if (panel !== 'txs') fetchWalletTxs(sym); }}
                      className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
                        panel === 'txs' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-white/[0.04] border border-white/8 text-white/40 hover:text-white'
                      }`}
                    >
                      <List size={10} />
                      Transactions
                      {panel === 'txs' ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                    </button>
                    <button
                      onClick={() => togglePanel(sym, 'adjust')}
                      className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
                        panel === 'adjust' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/[0.04] border border-white/8 text-white/40 hover:text-white'
                      }`}
                    >
                      <DollarSign size={10} />
                      Adjust
                      {panel === 'adjust' ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                    </button>
                    <button
                      onClick={() => { togglePanel(sym, 'edit'); setEditAddr(prev => ({ ...prev, [sym]: w.address })); }}
                      className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors col-span-2 ${
                        panel === 'edit' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/[0.04] border border-white/8 text-white/40 hover:text-white'
                      }`}
                    >
                      <Edit2 size={10} />
                      Edit Address
                      {panel === 'edit' ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                    </button>
                  </div>
                </div>

                {/* Expandable panels */}
                <AnimatePresence initial={false}>
                  {panel === 'txs' && (
                    <motion.div
                      key="txs"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-white/5"
                    >
                      <div className="p-4 space-y-2">
                        <p className="text-white/40 text-[10px] uppercase tracking-wide font-semibold mb-2">
                          {sym} Transactions
                        </p>
                        {txLoading[sym] ? (
                          <div className="flex justify-center py-4">
                            <Loader2 size={16} className="animate-spin text-white/20" />
                          </div>
                        ) : txs.length === 0 ? (
                          <p className="text-white/20 text-xs text-center py-3">No transactions found</p>
                        ) : (
                          txs.slice(0, 8).map(tx => {
                            const isPending = tx.status === 'pending';
                            return (
                              <div key={tx.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                                <div className="flex items-start justify-between mb-1.5">
                                  <div className="min-w-0">
                                    <p className="text-white text-[10px] font-semibold truncate">{tx.userName}</p>
                                    <p className="text-white/25 text-[9px] font-mono truncate">{tx.reference}</p>
                                  </div>
                                  <div className="text-right shrink-0 ml-2">
                                    <p className="text-white text-[10px] font-bold font-mono">
                                      {Number(tx.amount).toLocaleString('en-US', { maximumFractionDigits: 6 })} {tx.currency}
                                    </p>
                                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                                      tx.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                                      tx.status === 'pending'   ? 'bg-amber-500/15 text-amber-400' :
                                      'bg-red-500/15 text-red-400'
                                    }`}>{tx.status}</span>
                                  </div>
                                </div>
                                <p className="text-white/20 text-[9px] capitalize mb-2">{tx.type.replace(/_/g, ' ')} · {new Date(tx.createdAt).toLocaleDateString()}</p>
                                {isPending && (
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={() => approveTx(tx.id, sym)}
                                      disabled={!!actionLoading}
                                      className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-[9px] font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                                    >
                                      {actionLoading === tx.id + 'approve' ? <Loader2 size={9} className="animate-spin" /> : <CheckCircle size={9} />}
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => setRejectModal({ txId: tx.id, ref: tx.reference })}
                                      disabled={!!actionLoading}
                                      className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-red-500/15 text-red-400 text-[9px] font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50"
                                    >
                                      <XCircle size={9} /> Reject
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                        {pendingTxs.length > 0 && (
                          <p className="text-amber-400 text-[10px] text-center pt-1">
                            {pendingTxs.length} pending — approve or reject above
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {panel === 'edit' && (
                    <motion.div
                      key="edit"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-white/5"
                    >
                      <div className="p-4 space-y-3">
                        <p className="text-white/40 text-[10px] uppercase tracking-wide font-semibold">Edit {sym} Deposit Address</p>
                        <textarea
                          rows={2}
                          value={editAddr[sym] ?? w.address}
                          onChange={e => setEditAddr(prev => ({ ...prev, [sym]: e.target.value }))}
                          placeholder={`New ${sym} deposit address...`}
                          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-xs font-mono placeholder:text-white/20 focus:outline-none focus:border-amber-500/40 resize-none transition-colors"
                        />
                        <button
                          onClick={() => saveAddress(sym, walletId)}
                          disabled={addrSaving[sym] || !editAddr[sym]?.trim()}
                          className="w-full relative py-2 rounded-xl font-bold text-black text-xs overflow-hidden disabled:opacity-50"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-yellow-400" />
                          <span className="relative flex items-center justify-center gap-1.5">
                            {addrSaving[sym] ? <Loader2 size={11} className="animate-spin" /> : <Edit2 size={11} />}
                            Save Address
                          </span>
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {panel === 'adjust' && (
                    <motion.div
                      key="adjust"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-white/5"
                    >
                      <div className="p-4 space-y-3">
                        <p className="text-white/40 text-[10px] uppercase tracking-wide font-semibold">Manual {sym} Adjustment</p>
                        {adjustDone[sym] ? (
                          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                            <CheckCircle size={12} /> Adjustment applied and audit-logged
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="text-white/25 text-[9px] uppercase tracking-wide mb-1 block">User ID</label>
                              <input
                                value={adj.userId}
                                onChange={e => setAdjustForm(prev => ({ ...prev, [sym]: { ...(prev[sym] ?? { amount: '', type: 'credit', userId: '', note: '' }), userId: e.target.value } }))}
                                placeholder="usr_xxxxxxxxxxxxxxxx"
                                className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-white text-xs font-mono placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-white/25 text-[9px] uppercase tracking-wide mb-1 block">Amount ({sym})</label>
                                <input
                                  type="number" min="0" step="any"
                                  value={adj.amount}
                                  onChange={e => setAdjustForm(prev => ({ ...prev, [sym]: { ...(prev[sym] ?? { amount: '', type: 'credit', userId: '', note: '' }), amount: e.target.value } }))}
                                  placeholder="0.00"
                                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
                                />
                              </div>
                              <div>
                                <label className="text-white/25 text-[9px] uppercase tracking-wide mb-1 block">Type</label>
                                <div className="grid grid-cols-2 gap-1">
                                  {['credit', 'debit'].map(t => (
                                    <button key={t} type="button"
                                      onClick={() => setAdjustForm(prev => ({ ...prev, [sym]: { ...(prev[sym] ?? { amount: '', type: 'credit', userId: '', note: '' }), type: t } }))}
                                      className={`py-1.5 rounded-lg text-[9px] font-semibold transition-colors capitalize ${
                                        (adj.type ?? 'credit') === t ? 'bg-primary text-black' : 'bg-white/[0.04] border border-white/8 text-white/30 hover:text-white'
                                      }`}>{t}</button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="text-white/25 text-[9px] uppercase tracking-wide mb-1 block">Reason</label>
                              <input
                                value={adj.note}
                                onChange={e => setAdjustForm(prev => ({ ...prev, [sym]: { ...(prev[sym] ?? { amount: '', type: 'credit', userId: '', note: '' }), note: e.target.value } }))}
                                placeholder="Reason for adjustment"
                                className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
                              />
                            </div>
                            <button
                              onClick={() => applyAdjust(sym)}
                              disabled={adjustSaving[sym]}
                              className="w-full relative py-2 rounded-xl font-bold text-black text-xs overflow-hidden disabled:opacity-50"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                              <span className="relative flex items-center justify-center gap-1.5">
                                {adjustSaving[sym] ? <Loader2 size={11} className="animate-spin" /> : <DollarSign size={11} />}
                                Apply · {(adj.type ?? 'credit') === 'credit' ? '+' : '-'}{adj.amount || '0'} {sym}
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Global pending approvals — all currencies */}
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h3 className="text-white font-semibold text-sm">All Pending Crypto Approvals</h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
              {Object.values(walletTxs).flat().filter(t => t.status === 'pending').length} pending
            </span>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {Object.values(walletTxs).flat().filter(t => t.status === 'pending').length === 0 ? (
              <div className="p-10 text-center">
                <CheckCircle size={24} className="text-emerald-400/30 mx-auto mb-2" />
                <p className="text-white/25 text-sm">No pending crypto transactions</p>
              </div>
            ) : (
              Object.values(walletTxs).flat().filter(t => t.status === 'pending').map(tx => (
                <div key={tx.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-black shrink-0"
                    style={{ background: WALLET_DEFS.find(w => w.symbol === tx.currency)?.color ?? '#C9A84C' }}>
                    {tx.currency.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium">{tx.userName}</p>
                    <p className="text-white/30 text-[10px] capitalize">{tx.type.replace(/_/g, ' ')} · {new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-xs font-semibold font-mono">
                      {Number(tx.amount).toLocaleString('en-US', { maximumFractionDigits: 6 })} {tx.currency}
                    </p>
                    <p className="text-white/30 text-[10px] font-mono">{tx.reference}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => approveTx(tx.id, tx.currency)}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === tx.id + 'approve' ? <Loader2 size={10} className="animate-spin" /> : null}
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectModal({ txId: tx.id, ref: tx.reference })}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </AdminLayout>
    </>
  );
}
