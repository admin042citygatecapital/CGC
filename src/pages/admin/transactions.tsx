import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronLeft, ChevronRight, AlertTriangle, Download, Plus, X, Loader2, CheckCircle } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';

interface Tx {
  id: string; type: string; user: string; userId: string; amount: number;
  currency: string; status: string; reference: string; description: string;
  createdAt: string; flagged: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  deposit: '#10B981', withdrawal: '#EF4444', transfer: '#627EEA',
  crypto_buy: '#F59E0B', crypto_sell: '#8B5CF6', fee: '#6B7280', refund: '#06B6D4',
};
const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-500/15 text-emerald-400',
  pending:   'bg-amber-500/15 text-amber-400',
  failed:    'bg-red-500/15 text-red-400',
  flagged:   'bg-red-500/20 text-red-300',
};

function safeAmount(tx: Tx): string {
  const amt = Number(tx?.amount ?? 0);
  if (tx?.currency === 'BTC' || tx?.currency === 'ETH') return amt.toFixed(6);
  return amt.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function safeAmountCSV(tx: Tx): string {
  const amt = Number(tx?.amount ?? 0);
  if (tx?.currency === 'BTC' || tx?.currency === 'ETH') return amt.toFixed(6);
  return amt.toFixed(2);
}

export default function AdminTransactions() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [txs, setTxs]         = useState<Tx[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [pages, setPages]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [typeFilter, setTypeFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    userId: '', type: 'deposit', status: 'completed', amount: '',
    currency: 'USD', description: '', createdAt: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError,   setCreateError]   = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  const fetchTxs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (search) params.set('search', search);
    if (typeFilter) params.set('type', typeFilter);
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/admin/transactions?${params}`, { headers: authHeaders() });
    if (res.ok) {
      const d = await res.json();
      setTxs(d.data ?? []);
      setTotal(d.total ?? 0);
      setPages(d.pages ?? 1);
    }
    setLoading(false);
  }, [page, typeFilter, statusFilter, search]);

  function exportCSV() {
    const headers = ['ID', 'Type', 'User', 'Amount', 'Currency', 'Status', 'Reference', 'Flagged', 'Date'];
    const rows = txs.map(tx => [
      tx.id, tx.type, tx.user ?? '—',
      safeAmountCSV(tx),
      tx.currency, tx.status, tx.reference,
      tx.flagged ? 'Yes' : 'No',
      new Date(tx.createdAt).toISOString(),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `cgc-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => { fetchTxs(); }, [fetchTxs]);
  // Debounce search — reset page and refetch
  useEffect(() => {
    setPage(1);
    const t = setTimeout(() => fetchTxs(), 400);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');
    setCreateSuccess('');
    try {
      const res = await fetch('/api/admin/transactions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          ...createForm,
          amount: Number(createForm.amount),
          createdAt: createForm.createdAt || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setCreateError(d.error ?? 'Failed to create transaction'); setCreateLoading(false); return; }
      setCreateSuccess('Transaction created successfully.');
      fetchTxs();
      setTimeout(() => {
        setShowCreate(false);
        setCreateForm({ userId: '', type: 'deposit', status: 'completed', amount: '', currency: 'USD', description: '', createdAt: '' });
        setCreateSuccess('');
      }, 1500);
    } catch (err) {
      setCreateError(String(err));
    }
    setCreateLoading(false);
  }

  return (
    <>
      <Helmet><title>Transactions — CGC Admin</title><meta name="description" content="Transaction monitoring and management panel for City Gate Capital." /><meta name="robots" content="noindex, nofollow" /><link rel="canonical" href="https://citygate.capital/admin/transactions" /></Helmet>
      <AdminLayout title="Transactions">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">Transaction History</h1>
            <p className="text-white/30 text-sm">{Number(total ?? 0).toLocaleString()} total transactions</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 border border-primary/25 text-primary text-sm hover:bg-primary/25 transition-colors font-medium">
              <Plus size={13} /> Create Transaction
            </button>
            <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm hover:bg-primary/20 transition-colors">
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>

        {/* Create Transaction Modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
              onClick={() => setShowCreate(false)}>
              <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="w-full max-w-lg rounded-2xl border border-white/8 overflow-hidden"
                style={{ background: 'rgba(10,10,10,0.98)' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
                  <p className="text-white font-bold text-sm">Create Transaction</p>
                  <button onClick={() => setShowCreate(false)} className="text-white/30 hover:text-white"><X size={16} /></button>
                </div>
                <form onSubmit={handleCreate} className="p-6 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">User ID *</label>
                      <input required value={createForm.userId} onChange={e => setCreateForm(f => ({ ...f, userId: e.target.value }))}
                        placeholder="usr_..."
                        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
                    </div>
                    <div>
                      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Amount *</label>
                      <input required type="number" min="0.01" step="0.01" value={createForm.amount}
                        onChange={e => setCreateForm(f => ({ ...f, amount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Type *</label>
                      <select value={createForm.type} onChange={e => setCreateForm(f => ({ ...f, type: e.target.value }))}
                        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40">
                        {['deposit','withdrawal','transfer','crypto_buy','crypto_sell','wire_transfer','fee','refund','manual_credit','manual_debit'].map(t => (
                          <option key={t} value={t} className="bg-[#0A0A0A]">{t.replace(/_/g,' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Currency</label>
                      <select value={createForm.currency} onChange={e => setCreateForm(f => ({ ...f, currency: e.target.value }))}
                        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40">
                        {['USD','EUR','GBP','BTC','ETH','USDT','BNB','SOL','CHF','JPY'].map(c => (
                          <option key={c} value={c} className="bg-[#0A0A0A]">{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Status</label>
                      <select value={createForm.status} onChange={e => setCreateForm(f => ({ ...f, status: e.target.value }))}
                        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40">
                        {['completed','pending','failed','rejected','flagged'].map(s => (
                          <option key={s} value={s} className="bg-[#0A0A0A]">{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Description</label>
                    <input value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="e.g. Manual deposit — wire received"
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
                  </div>
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Transaction Date (optional)</label>
                    <input type="datetime-local" value={createForm.createdAt}
                      onChange={e => setCreateForm(f => ({ ...f, createdAt: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 [color-scheme:dark]" />
                    <p className="text-white/25 text-[10px] mt-1">Leave blank to use the current date and time.</p>
                  </div>
                  {createError && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                      <AlertTriangle size={12} /> {createError}
                    </div>
                  )}
                  {createSuccess && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                      <CheckCircle size={12} /> {createSuccess}
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setShowCreate(false)}
                      className="flex-1 py-2.5 rounded-xl border border-white/8 text-white/50 text-sm hover:bg-white/[0.04]">Cancel</button>
                    <button type="submit" disabled={createLoading || !!createSuccess}
                      className="flex-1 relative py-2.5 rounded-xl font-bold text-black text-sm overflow-hidden disabled:opacity-60">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                      <span className="relative flex items-center justify-center gap-2">
                        {createLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        Create Transaction
                      </span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 flex-1 min-w-48">
            <Search size={13} className="text-white/25 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search user, ID, reference..."
              className="bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none flex-1" />
          </div>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
            className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/60 focus:outline-none">
            <option value="">All Types</option>
            {['deposit','withdrawal','transfer','crypto_buy','crypto_sell','fee','refund'].map(t => (
              <option key={t} value={t} className="bg-[#0A0A0A]">{t.replace('_',' ')}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/60 focus:outline-none">
            <option value="">All Status</option>
            {['completed','pending','failed','flagged'].map(s => <option key={s} value={s} className="bg-[#0A0A0A]">{s}</option>)}
          </select>
        </div>

        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['ID','Type','User','Amount','Currency','Status','Reference','Date'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-white/30 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 bg-white/[0.04] rounded animate-pulse" /></td></tr>
                  ))
                ) : txs.map((tx, i) => (
                  <motion.tr key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className={`hover:bg-white/[0.02] transition-colors ${tx.flagged ? 'bg-red-500/[0.03]' : ''}`}>
                    <td className="px-4 py-3 font-mono text-white/40 text-xs whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        {tx.flagged && <AlertTriangle size={10} className="text-red-400" />}
                        {tx.id}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: TYPE_COLORS[tx.type] ?? '#C9A84C' }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: TYPE_COLORS[tx.type] ?? '#C9A84C' }} />
                        {tx.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/70 text-xs whitespace-nowrap">{tx.user}</td>
                    <td className="px-4 py-3 text-white font-mono text-xs whitespace-nowrap font-semibold">
                      {safeAmount(tx)}
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">{tx.currency}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[tx.status] ?? 'bg-white/10 text-white/30'}`}>{tx.status}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-white/30 text-xs whitespace-nowrap">{tx.reference}</td>
                    <td className="px-4 py-3 text-white/30 text-xs whitespace-nowrap">{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : '—'}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-white/30 text-xs">Page {page} of {pages} · {total} transactions</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/8 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-30 transition-colors">
                <ChevronLeft size={13} />
              </button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/8 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-30 transition-colors">
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    </>
  );
}
