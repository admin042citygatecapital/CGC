import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  DollarSign, ArrowUpDown, CheckCircle, XCircle, RefreshCw,
  AlertTriangle, Loader2, Clock, TrendingUp, TrendingDown,
  Building2, Search, Globe, UserCheck, ChevronDown, ChevronUp,
  Shield, BarChart2,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PendingTx {
  id: string;
  type: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  currency: string;
  reference: string;
  description: string;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  swiftCode?: string;
  walletAddress?: string;
  network?: string;
  flagged: boolean;
  createdAt: string;
}

interface BankStats {
  pendingWithdrawals: number;
  pendingDeposits: number;
  totalPendingValue: number;
  flaggedCount: number;
}

interface UserResult {
  id: string;
  name: string;
  email: string;
  status: string;
  primaryCurrency?: string;
  balance?: number;
}

interface UserLimitInfo {
  userId: string;
  userName: string;
  tier: string;
  hasOverride: boolean;
  overrideNote: string;
  effectiveDaily: number;
  effectiveMonthly: number;
  usedToday: number;
  usedMonth: number;
  remainingToday: number | null;
  remainingMonth: number | null;
}

const RISK_STYLES: Record<string, string> = {
  low:    'bg-emerald-500/15 text-emerald-400',
  medium: 'bg-amber-500/15 text-amber-400',
  high:   'bg-red-500/15 text-red-400',
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'SGD', 'AED', 'BTC', 'ETH', 'SOL', 'USDT', 'BNB'];

function riskLevel(tx: PendingTx): 'low' | 'medium' | 'high' {
  if (tx.flagged) return 'high';
  const amt = Number(tx.amount ?? 0);
  if (amt > 100_000) return 'high';
  if (amt > 20_000)  return 'medium';
  return 'low';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminBanking() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();

  const [pendingTxs, setPendingTxs] = useState<PendingTx[]>([]);
  const [stats, setStats]           = useState<BankStats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setAL]      = useState<string | null>(null);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'withdrawal' | 'deposit' | 'wire_transfer'>('all');
  const [rejectModal, setRejectModal] = useState<{ txId: string; ref: string } | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  // Balance adjustment form
  const [balanceForm, setBalanceForm] = useState({ userId: '', amount: '', currency: 'USD', type: 'credit', note: '' });
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [balanceDone, setBalanceDone]     = useState(false);
  const [balanceError, setBalanceError]   = useState('');

  // User search + currency override
  const [userQuery,       setUserQuery]       = useState('');
  const [userResults,     setUserResults]     = useState<UserResult[]>([]);
  const [userSearching,   setUserSearching]   = useState(false);
  const [selectedUser,    setSelectedUser]    = useState<UserResult | null>(null);
  const [currencyPick,    setCurrencyPick]    = useState('USD');
  const [currencySaving,  setCurrencySaving]  = useState(false);
  const [currencyDone,    setCurrencyDone]    = useState(false);
  const [currencyError,   setCurrencyError]   = useState('');
  const [userPanelOpen,   setUserPanelOpen]   = useState(true);

  // Withdrawal limit state
  const [limitInfo,       setLimitInfo]       = useState<UserLimitInfo | null>(null);
  const [limitLoading,    setLimitLoading]    = useState(false);
  const [limitOverride,   setLimitOverride]   = useState({ daily: '', monthly: '', note: '' });
  const [limitSaving,     setLimitSaving]     = useState(false);
  const [limitSaved,      setLimitSaved]      = useState(false);

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: 'pending', limit: '50' });
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/transactions/real?${params}`, { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        const txs: PendingTx[] = (d.data ?? []).filter((t: PendingTx) =>
          ['withdrawal', 'wire_transfer', 'deposit'].includes(t.type)
        );
        setPendingTxs(txs);
        setStats({
          pendingWithdrawals: txs.filter(t => t.type === 'withdrawal' || t.type === 'wire_transfer').length,
          pendingDeposits:    txs.filter(t => t.type === 'deposit').length,
          totalPendingValue:  txs.reduce((s, t) => s + Number(t.amount ?? 0), 0),
          flaggedCount:       txs.filter(t => t.flagged).length,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  // ── User search ──────────────────────────────────────────────────────────────
  async function searchUsers() {
    if (!userQuery.trim()) return;
    setUserSearching(true);
    setUserResults([]);
    setSelectedUser(null);
    setCurrencyDone(false);
    setCurrencyError('');
    try {
      const params = new URLSearchParams({ search: userQuery.trim(), limit: '10' });
      const res = await fetch(`/api/admin/users?${params}`, { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setUserResults((d.users ?? d.data ?? []) as UserResult[]);
      }
    } catch { /* silent */ }
    setUserSearching(false);
  }

  function selectUser(u: UserResult) {
    setSelectedUser(u);
    setCurrencyPick(u.primaryCurrency ?? 'USD');
    setCurrencyDone(false);
    setCurrencyError('');
    // Pre-fill balance form userId
    setBalanceForm(f => ({ ...f, userId: u.id }));
    // Fetch withdrawal limit info
    fetchLimitInfo(u.id);
  }

  async function fetchLimitInfo(userId: string) {
    setLimitLoading(true);
    setLimitInfo(null);
    try {
      const res = await fetch(`/api/admin/rates/limits/user?userId=${encodeURIComponent(userId)}`, { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setLimitInfo(d);
        setLimitOverride({
          daily:   d.hasOverride ? String(d.effectiveDaily)   : '',
          monthly: d.hasOverride ? String(d.effectiveMonthly) : '',
          note:    d.overrideNote ?? '',
        });
      }
    } catch { /* silent */ }
    setLimitLoading(false);
  }

  async function saveLimitOverride() {
    if (!selectedUser) return;
    setLimitSaving(true);
    setLimitSaved(false);
    try {
      const res = await fetch('/api/admin/rates/limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          userOverride: {
            userId:          selectedUser.id,
            dailyLimitUSD:   Number(limitOverride.daily)   || 0,
            monthlyLimitUSD: Number(limitOverride.monthly) || 0,
            note:            limitOverride.note,
          },
        }),
      });
      if (res.ok) {
        setLimitSaved(true);
        fetchLimitInfo(selectedUser.id);
        showToast(`Withdrawal limits updated for ${selectedUser.name}`);
        setTimeout(() => setLimitSaved(false), 4000);
      } else {
        const d = await res.json();
        showToast(d.error ?? 'Failed to save limits', false);
      }
    } catch { showToast('Network error', false); }
    setLimitSaving(false);
  }

  async function saveCurrency() {
    if (!selectedUser) return;
    setCurrencySaving(true);
    setCurrencyError('');
    setCurrencyDone(false);
    try {
      const res = await fetch('/api/admin/users/currency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId: selectedUser.id, currency: currencyPick }),
      });
      const d = await res.json();
      if (res.ok) {
        setCurrencyDone(true);
        setSelectedUser(u => u ? { ...u, primaryCurrency: currencyPick } : u);
        setUserResults(rs => rs.map(r => r.id === selectedUser.id ? { ...r, primaryCurrency: currencyPick } : r));
        showToast(`Primary currency set to ${currencyPick} for ${selectedUser.name}`);
        setTimeout(() => setCurrencyDone(false), 5000);
      } else {
        setCurrencyError(d.error ?? 'Failed to update currency');
      }
    } catch { setCurrencyError('Network error'); }
    setCurrencySaving(false);
  }

  // ── Transaction actions ──────────────────────────────────────────────────────
  async function approveTransaction(txId: string) {
    setAL(txId + 'approve');
    try {
      const res = await fetch('/api/admin/transactions/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ transactionId: txId }),
      });
      const d = await res.json();
      if (res.ok) { showToast('Transaction approved'); fetchPending(); }
      else showToast(d.error ?? 'Approval failed', false);
    } catch { showToast('Network error', false); }
    setAL(null);
  }

  async function rejectTransaction() {
    if (!rejectModal) return;
    setAL(rejectModal.txId + 'reject');
    try {
      const res = await fetch('/api/admin/transactions/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ transactionId: rejectModal.txId, reason: rejectNote || undefined }),
      });
      const d = await res.json();
      if (res.ok) { showToast('Transaction rejected'); fetchPending(); }
      else showToast(d.error ?? 'Rejection failed', false);
    } catch { showToast('Network error', false); }
    setAL(null);
    setRejectModal(null);
    setRejectNote('');
  }

  // ── Balance adjustment ───────────────────────────────────────────────────────
  async function handleBalanceSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBalanceSaving(true);
    setBalanceError('');
    try {
      const res = await fetch('/api/admin/balance/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          userId:   balanceForm.userId,
          amount:   Number(balanceForm.amount),
          currency: balanceForm.currency,
          type:     balanceForm.type,
          note:     balanceForm.note,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setBalanceDone(true);
        setBalanceForm(f => ({ ...f, amount: '', note: '' }));
        setTimeout(() => setBalanceDone(false), 4000);
        showToast(`${balanceForm.type === 'credit' ? 'Credited' : 'Debited'} ${balanceForm.amount} ${balanceForm.currency}`);
      } else {
        setBalanceError(d.error ?? 'Adjustment failed');
      }
    } catch { setBalanceError('Network error'); }
    setBalanceSaving(false);
  }

  const filtered = pendingTxs.filter(tx => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      tx.userName?.toLowerCase().includes(s) ||
      tx.userEmail?.toLowerCase().includes(s) ||
      tx.reference?.toLowerCase().includes(s) ||
      tx.id.includes(s)
    );
  });

  return (
    <>
      <Helmet><title>Banking — CGC Admin</title><meta name="description" content="Banking management panel for City Gate Capital administrators." /><meta name="robots" content="noindex, nofollow" /><link rel="canonical" href="https://citygate.capital/admin/banking" /></Helmet>
      <AdminLayout title="Banking">

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
                  placeholder="e.g. Insufficient documentation, suspicious activity..."
                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-red-500/40 resize-none mb-4" />
                <div className="flex gap-3">
                  <button onClick={() => { setRejectModal(null); setRejectNote(''); }}
                    className="flex-1 py-2.5 rounded-xl border border-white/8 text-white/50 text-sm hover:bg-white/[0.04]">Cancel</button>
                  <button onClick={rejectTransaction} disabled={!!actionLoading}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/30 flex items-center justify-center gap-2">
                    {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                    Reject
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">Banking Operations</h1>
            <p className="text-white/30 text-sm">Withdrawal approvals, deposits, balance adjustments, currency control</p>
          </div>
          <button onClick={() => fetchPending()} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/50 text-sm hover:text-white transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Pending Withdrawals', value: stats?.pendingWithdrawals ?? 0, icon: TrendingDown, color: '#EF4444' },
            { label: 'Pending Deposits',    value: stats?.pendingDeposits ?? 0,    icon: TrendingUp,   color: '#10B981' },
            { label: 'Total Pending Value', value: `$${Number(stats?.totalPendingValue ?? 0).toLocaleString()}`, icon: DollarSign, color: '#C9A84C' },
            { label: 'Flagged',             value: stats?.flaggedCount ?? 0,        icon: AlertTriangle, color: '#F59E0B' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-white/5 p-4 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.025)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${s.color}15` }}>
                <s.icon size={16} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-white/30 text-xs">{s.label}</p>
                <p className="text-white font-bold text-lg leading-none">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Pending transactions */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-40">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search user, ref, ID..."
                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-8 pr-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
              </div>
              <div className="flex gap-1 bg-white/[0.04] border border-white/8 rounded-xl p-1">
                {(['all', 'withdrawal', 'deposit', 'wire_transfer'] as const).map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                      typeFilter === t ? 'bg-primary text-black' : 'text-white/40 hover:text-white/70'
                    }`}>{t.replace('_', ' ')}</button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <Clock size={13} className="text-amber-400" /> Pending Transactions
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                  {filtered.length} pending
                </span>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 size={20} className="animate-spin text-white/20 mx-auto" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-10 text-center">
                  <CheckCircle size={24} className="text-emerald-400/30 mx-auto mb-2" />
                  <p className="text-white/25 text-sm">No pending transactions</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.03]">
                  {filtered.map(tx => {
                    const risk = riskLevel(tx);
                    const isApproving = actionLoading === tx.id + 'approve';
                    const isRejecting = actionLoading === tx.id + 'reject';
                    return (
                      <motion.div key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className={`p-5 transition-colors hover:bg-white/[0.02] ${tx.flagged ? 'bg-red-500/[0.03]' : ''}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-white text-sm font-semibold">{tx.userName}</p>
                              {tx.flagged && <AlertTriangle size={11} className="text-red-400" />}
                            </div>
                            <p className="text-white/30 text-xs">{tx.userEmail}</p>
                            <p className="text-white/20 text-[10px] font-mono mt-0.5">{tx.reference}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-bold">
                              {tx.currency} {Number(tx.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${RISK_STYLES[risk]}`}>
                              {risk} risk
                            </span>
                          </div>
                        </div>

                        {/* Bank / wallet details */}
                        {(tx.bankName || tx.accountNumber || tx.walletAddress) && (
                          <div className="flex items-start gap-3 p-2.5 rounded-lg bg-white/[0.03] border border-white/5 mb-3">
                            <Building2 size={12} className="text-white/25 mt-0.5 shrink-0" />
                            <div className="text-xs space-y-0.5">
                              {tx.bankName && <p className="text-white/50">{tx.bankName}</p>}
                              {tx.accountNumber && <p className="text-white/30 font-mono">Acct: {tx.accountNumber}</p>}
                              {tx.routingNumber && <p className="text-white/30 font-mono">Routing: {tx.routingNumber}</p>}
                              {tx.swiftCode && <p className="text-white/30 font-mono">SWIFT: {tx.swiftCode}</p>}
                              {tx.walletAddress && <p className="text-white/30 font-mono break-all">{tx.walletAddress}</p>}
                              {tx.network && <p className="text-white/20">{tx.network}</p>}
                            </div>
                          </div>
                        )}

                        {/* Per-transaction Set Currency shortcut */}
                        <div className="flex gap-2 mb-2">
                          <button
                            onClick={() => {
                              setUserQuery(tx.userEmail);
                              setUserPanelOpen(true);
                              // Trigger search for this user
                              setTimeout(async () => {
                                setUserSearching(true);
                                try {
                                  const r = await fetch(`/api/admin/users?search=${encodeURIComponent(tx.userEmail)}&limit=5`, { headers: authHeaders() });
                                  if (r.ok) {
                                    const d = await r.json();
                                    const users = (d.users ?? d.data ?? []) as UserResult[];
                                    setUserResults(users);
                                    const match = users.find(u => u.email === tx.userEmail || u.id === tx.userId);
                                    if (match) selectUser(match);
                                  }
                                } finally { setUserSearching(false); }
                              }, 50);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-[10px] font-semibold hover:bg-blue-500/20 transition-colors border border-blue-500/15"
                          >
                            <Globe size={10} /> Set Account Currency
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => approveTransaction(tx.id)} disabled={!!actionLoading}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-50">
                            {isApproving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                            Approve
                          </button>
                          <button onClick={() => setRejectModal({ txId: tx.id, ref: tx.reference })} disabled={!!actionLoading}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50">
                            {isRejecting ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                            Reject
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">

            {/* ── User Search + Currency Override ─────────────────────────── */}
            <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)' }}>
              <button
                onClick={() => setUserPanelOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Globe size={14} className="text-blue-400" />
                  </div>
                  <h3 className="text-white font-semibold text-sm">User Currency Control</h3>
                </div>
                {userPanelOpen ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
              </button>

              <AnimatePresence initial={false}>
                {userPanelOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-3 border-t border-white/5 pt-4">
                      <p className="text-white/30 text-xs">Search a user to view and change their primary display currency. Takes effect immediately on their dashboard.</p>

                      {/* Search input */}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                          <input
                            value={userQuery}
                            onChange={e => setUserQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && searchUsers()}
                            placeholder="Name, email, or user ID..."
                            className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-8 pr-3 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
                          />
                        </div>
                        <button
                          onClick={searchUsers}
                          disabled={userSearching || !userQuery.trim()}
                          className="px-3 py-2 rounded-xl bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors disabled:opacity-50 shrink-0"
                        >
                          {userSearching ? <Loader2 size={11} className="animate-spin" /> : 'Search'}
                        </button>
                      </div>

                      {/* Results list */}
                      {userResults.length > 0 && (
                        <div className="rounded-xl border border-white/8 overflow-hidden divide-y divide-white/[0.04]">
                          {userResults.map(u => (
                            <button
                              key={u.id}
                              onClick={() => selectUser(u)}
                              className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors ${selectedUser?.id === u.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                            >
                              <div className="min-w-0">
                                <p className="text-white text-xs font-medium truncate">{u.name}</p>
                                <p className="text-white/30 text-[10px] truncate">{u.email}</p>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 shrink-0 ml-2">
                                {u.primaryCurrency ?? 'USD'}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Selected user — currency picker */}
                      {selectedUser && (
                        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
                          <div className="flex items-center gap-2">
                            <UserCheck size={13} className="text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="text-white text-xs font-semibold truncate">{selectedUser.name}</p>
                              <p className="text-white/30 text-[10px] truncate">{selectedUser.email}</p>
                            </div>
                          </div>
                          <div>
                            <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1 block">Primary Display Currency</label>
                            <select
                              value={currencyPick}
                              onChange={e => { setCurrencyPick(e.target.value); setCurrencyDone(false); }}
                              className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors"
                            >
                              {CURRENCIES.map(c => (
                                <option key={c} value={c} className="bg-[#0A0A0A]">{c}</option>
                              ))}
                            </select>
                          </div>
                          {currencyError && (
                            <p className="text-red-400 text-xs flex items-center gap-1.5">
                              <AlertTriangle size={10} /> {currencyError}
                            </p>
                          )}
                          {currencyDone && (
                            <p className="text-emerald-400 text-xs flex items-center gap-1.5">
                              <CheckCircle size={10} /> Currency updated — takes effect immediately
                            </p>
                          )}
                          <button
                            onClick={saveCurrency}
                            disabled={currencySaving || currencyPick === (selectedUser.primaryCurrency ?? 'USD')}
                            className="w-full relative py-2 rounded-xl font-bold text-black text-xs overflow-hidden disabled:opacity-50"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                            <span className="relative flex items-center justify-center gap-1.5">
                              {currencySaving ? <Loader2 size={11} className="animate-spin" /> : <Globe size={11} />}
                              Set Currency to {currencyPick}
                            </span>
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Withdrawal Limits ────────────────────────────────────────── */}
            {selectedUser && (
              <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)' }}>
                <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <Shield size={14} className="text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">Withdrawal Limits</h3>
                    <p className="text-white/25 text-[10px]">{selectedUser.name}</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {limitLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 size={16} className="animate-spin text-white/20" />
                    </div>
                  ) : limitInfo ? (
                    <>
                      {/* Usage bars */}
                      <div className="space-y-3">
                        {/* Daily */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white/40 text-[10px] uppercase tracking-wide">Today</span>
                            <span className="text-white/60 text-[10px]">
                              ${limitInfo.usedToday.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                              {limitInfo.effectiveDaily > 0 && ` / $${limitInfo.effectiveDaily.toLocaleString()}`}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: limitInfo.effectiveDaily === 0 ? '0%' : `${Math.min(100, (limitInfo.usedToday / limitInfo.effectiveDaily) * 100)}%`,
                                background: limitInfo.effectiveDaily > 0 && limitInfo.usedToday / limitInfo.effectiveDaily > 0.8 ? '#EF4444' : '#C9A84C',
                              }}
                            />
                          </div>
                          {limitInfo.remainingToday !== null && (
                            <p className="text-white/25 text-[10px] mt-0.5">
                              ${limitInfo.remainingToday.toLocaleString('en-US', { maximumFractionDigits: 0 })} remaining
                            </p>
                          )}
                          {limitInfo.effectiveDaily === 0 && <p className="text-emerald-400 text-[10px] mt-0.5">Unlimited</p>}
                        </div>
                        {/* Monthly */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white/40 text-[10px] uppercase tracking-wide">This Month</span>
                            <span className="text-white/60 text-[10px]">
                              ${limitInfo.usedMonth.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                              {limitInfo.effectiveMonthly > 0 && ` / $${limitInfo.effectiveMonthly.toLocaleString()}`}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: limitInfo.effectiveMonthly === 0 ? '0%' : `${Math.min(100, (limitInfo.usedMonth / limitInfo.effectiveMonthly) * 100)}%`,
                                background: limitInfo.effectiveMonthly > 0 && limitInfo.usedMonth / limitInfo.effectiveMonthly > 0.8 ? '#EF4444' : '#6366F1',
                              }}
                            />
                          </div>
                          {limitInfo.remainingMonth !== null && (
                            <p className="text-white/25 text-[10px] mt-0.5">
                              ${limitInfo.remainingMonth.toLocaleString('en-US', { maximumFractionDigits: 0 })} remaining
                            </p>
                          )}
                          {limitInfo.effectiveMonthly === 0 && <p className="text-emerald-400 text-[10px] mt-0.5">Unlimited</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] text-white/25">
                        <BarChart2 size={10} />
                        Tier: <span className="capitalize text-white/40">{limitInfo.tier}</span>
                        {limitInfo.hasOverride && <span className="text-amber-400 ml-1">· Custom override active</span>}
                      </div>

                      {/* Override form */}
                      <div className="border-t border-white/5 pt-3 space-y-2">
                        <p className="text-white/30 text-[10px] uppercase tracking-wide">Set Custom Override (0 = unlimited)</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-white/25 text-[9px] block mb-1">Daily (USD)</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 text-xs">$</span>
                              <input type="number" min="0" step="1000" value={limitOverride.daily}
                                onChange={e => setLimitOverride(l => ({ ...l, daily: e.target.value }))}
                                placeholder={String(limitInfo.effectiveDaily)}
                                className="w-full bg-white/[0.04] border border-white/8 rounded-lg pl-6 pr-2 py-2 text-white text-xs focus:outline-none focus:border-primary/40 transition-colors" />
                            </div>
                          </div>
                          <div>
                            <label className="text-white/25 text-[9px] block mb-1">Monthly (USD)</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 text-xs">$</span>
                              <input type="number" min="0" step="1000" value={limitOverride.monthly}
                                onChange={e => setLimitOverride(l => ({ ...l, monthly: e.target.value }))}
                                placeholder={String(limitInfo.effectiveMonthly)}
                                className="w-full bg-white/[0.04] border border-white/8 rounded-lg pl-6 pr-2 py-2 text-white text-xs focus:outline-none focus:border-primary/40 transition-colors" />
                            </div>
                          </div>
                        </div>
                        <input value={limitOverride.note}
                          onChange={e => setLimitOverride(l => ({ ...l, note: e.target.value }))}
                          placeholder="Reason for override (optional)"
                          className="w-full bg-white/[0.04] border border-white/8 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
                        <button onClick={saveLimitOverride} disabled={limitSaving}
                          className="w-full relative py-2 rounded-xl font-bold text-black text-xs overflow-hidden disabled:opacity-50">
                          <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-400" />
                          <span className="relative flex items-center justify-center gap-1.5">
                            {limitSaving ? <Loader2 size={11} className="animate-spin" /> : limitSaved ? <CheckCircle size={11} /> : <Shield size={11} />}
                            {limitSaved ? 'Saved!' : 'Apply Limit Override'}
                          </span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-white/20 text-xs text-center py-3">Select a user to view limits</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Balance Adjustment ───────────────────────────────────────── */}            <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign size={14} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Balance Adjustment</h3>
                  <p className="text-white/25 text-[10px]">Credits/debits in the selected currency</p>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {balanceDone ? (
                  <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                    <CheckCircle size={14} /> Adjustment applied and audit-logged
                  </motion.div>
                ) : (
                  <motion.form key="form" onSubmit={handleBalanceSubmit} className="space-y-3">
                    <div>
                      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1 block">
                        User ID {selectedUser && <span className="text-primary/70 normal-case">— pre-filled from selection</span>}
                      </label>
                      <input required value={balanceForm.userId} onChange={e => setBalanceForm({ ...balanceForm, userId: e.target.value })}
                        placeholder="usr_xxxxxxxxxxxxxxxx"
                        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors font-mono text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1 block">Amount</label>
                        <input required type="number" min="0.00000001" step="any" value={balanceForm.amount}
                          onChange={e => setBalanceForm({ ...balanceForm, amount: e.target.value })}
                          placeholder="0.00"
                          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
                      </div>
                      <div>
                        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1 block">Currency</label>
                        <select
                          value={balanceForm.currency}
                          onChange={e => setBalanceForm({ ...balanceForm, currency: e.target.value })}
                          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors"
                        >
                          {CURRENCIES.map(c => <option key={c} value={c} className="bg-[#0A0A0A]">{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1 block">Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['credit', 'debit'].map(t => (
                          <button key={t} type="button" onClick={() => setBalanceForm({ ...balanceForm, type: t })}
                            className={`py-2 rounded-xl text-xs font-semibold transition-colors capitalize ${
                              balanceForm.type === t ? 'bg-primary text-black' : 'bg-white/[0.04] border border-white/8 text-white/40 hover:text-white'
                            }`}>{t}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1 block">Reason / Note</label>
                      <input required value={balanceForm.note} onChange={e => setBalanceForm({ ...balanceForm, note: e.target.value })}
                        placeholder="Reason for adjustment"
                        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
                    </div>
                    {balanceError && (
                      <p className="text-red-400 text-xs flex items-center gap-1.5">
                        <AlertTriangle size={11} /> {balanceError}
                      </p>
                    )}
                    <button type="submit" disabled={balanceSaving}
                      className="w-full relative py-2.5 rounded-xl font-bold text-black text-sm overflow-hidden disabled:opacity-60">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                      <span className="relative flex items-center justify-center gap-2">
                        {balanceSaving ? <Loader2 size={13} className="animate-spin" /> : <DollarSign size={13} />}
                        Apply {balanceForm.type === 'credit' ? 'Credit' : 'Debit'} · {balanceForm.currency}
                      </span>
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            {/* Live FX rates */}
            <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <ArrowUpDown size={14} className="text-blue-400" />
                </div>
                <h3 className="text-white font-semibold text-sm">Live FX Rates</h3>
              </div>
              <div className="space-y-2">
                {[
                  { pair: 'USD/EUR', rate: '0.9241', change: '+0.12%' },
                  { pair: 'USD/GBP', rate: '0.7892', change: '-0.08%' },
                  { pair: 'USD/JPY', rate: '149.82', change: '+0.31%' },
                  { pair: 'EUR/GBP', rate: '0.8540', change: '+0.04%' },
                  { pair: 'BTC/USD', rate: '68,420', change: '+3.2%' },
                  { pair: 'ETH/USD', rate: '2,498',  change: '+1.8%' },
                ].map(fx => (
                  <div key={fx.pair} className="flex items-center justify-between py-1.5">
                    <p className="text-white/60 text-xs font-mono">{fx.pair}</p>
                    <div className="flex items-center gap-3">
                      <p className="text-white text-xs font-semibold font-mono">{fx.rate}</p>
                      <p className={`text-[10px] font-semibold ${fx.change.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>{fx.change}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-3 text-white/20 text-[10px]">
                <RefreshCw size={9} className="animate-spin" style={{ animationDuration: '3s' }} />
                Indicative rates · Updated 30s
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </>
  );
}
