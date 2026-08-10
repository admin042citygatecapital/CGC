import { Helmet } from '@dr.pogodin/react-helmet';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Search,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders, useAdminAuth } from '@/lib/adminAuth';

interface TransactionRecord {
  id: string;
  type: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  amount: number;
  currency: string;
  status: string;
  reference: string;
  description: string;
  createdAt: string;
  flagged: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  deposit: '#10B981',
  withdrawal: '#EF4444',
  transfer: '#627EEA',
  wire_transfer: '#627EEA',
  crypto_buy: '#F59E0B',
  crypto_sell: '#8B5CF6',
  fee: '#6B7280',
  refund: '#06B6D4',
  manual_credit: '#10B981',
  manual_debit: '#EF4444',
};

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-500/15 text-emerald-400',
  approved: 'bg-emerald-500/15 text-emerald-400',
  pending: 'bg-amber-500/15 text-amber-400',
  failed: 'bg-red-500/15 text-red-400',
  rejected: 'bg-red-500/15 text-red-400',
  flagged: 'bg-red-500/20 text-red-300',
  frozen: 'bg-sky-500/15 text-sky-300',
};

function displayUser(record: TransactionRecord): string {
  return record.userName?.trim() || record.userEmail?.trim() || record.userId;
}

function displayAmount(record: TransactionRecord, csv = false): string {
  const amount = Number(record.amount ?? 0);
  if (['BTC', 'ETH', 'SOL', 'BNB'].includes(record.currency)) return amount.toFixed(6);
  if (csv) return amount.toFixed(2);
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AdminTransactions() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<TransactionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!authLoading && !admin) navigate('/admin/login');
  }, [admin, authLoading, navigate]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (search.trim()) params.set('search', search.trim());
    if (typeFilter) params.set('type', typeFilter);
    if (statusFilter) params.set('status', statusFilter);
    try {
      const response = await fetch(`/api/admin/transactions?${params}`, { headers: authHeaders() });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load the transaction register.');
      setRecords(Array.isArray(result.data) ? result.data : []);
      setTotal(Number(result.total ?? 0));
      setPages(Math.max(1, Number(result.pages ?? 1)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the transaction register.');
      setRecords([]);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, typeFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => void loadRecords(), search ? 350 : 0);
    return () => clearTimeout(timeout);
  }, [loadRecords, search]);

  function exportCsv() {
    const headers = ['ID', 'Type', 'User', 'Amount', 'Currency', 'Status', 'Reference', 'Flagged', 'Date', 'Classification'];
    const rows = records.map(record => [
      record.id,
      record.type,
      displayUser(record),
      displayAmount(record, true),
      record.currency,
      record.status,
      record.reference,
      record.flagged ? 'Yes' : 'No',
      new Date(record.createdAt).toISOString(),
      'Synthetic preview record',
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cgc-preview-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Helmet>
        <title>Transaction Register — CGC Admin</title>
        <meta name="description" content="Read-only persistent demonstration transaction register." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/admin/transactions" />
      </Helmet>
      <AdminLayout title="Transaction Register">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Transaction Register</h1>
            <p className="text-sm text-white/30">{total.toLocaleString()} persistent demonstration records</p>
          </div>
          <button onClick={exportCsv} disabled={records.length === 0} className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary transition-colors hover:bg-primary/20 disabled:opacity-40">
            <Download size={13} /> Export labelled CSV
          </button>
        </div>

        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-sky-400/20 bg-sky-400/[0.06] px-4 py-3">
          <Database size={16} className="mt-0.5 shrink-0 text-sky-300" />
          <div>
            <p className="text-sm font-semibold text-sky-100">Persistent demonstration register</p>
            <p className="mt-1 text-xs leading-relaxed text-sky-100/55">Records come from the application database and may contain synthetic preview activity. They are not sponsor-ledger entries or evidence that funds moved. This screen is read-only, and production financial mutations remain disabled.</p>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-3">
          <div className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2">
            <Search size={13} className="shrink-0 text-white/25" />
            <input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search user, ID, or reference" className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/20" />
          </div>
          <select value={typeFilter} onChange={event => { setTypeFilter(event.target.value); setPage(1); }} className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-white/60 outline-none">
            <option value="">All types</option>
            {['deposit', 'withdrawal', 'transfer', 'wire_transfer', 'crypto_buy', 'crypto_sell', 'fee', 'refund', 'manual_credit', 'manual_debit'].map(type => <option key={type} value={type} className="bg-[#0A0A0A]">{type.replaceAll('_', ' ')}</option>)}
          </select>
          <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }} className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-white/60 outline-none">
            <option value="">All statuses</option>
            {['completed', 'pending', 'failed', 'rejected', 'flagged', 'frozen'].map(status => <option key={status} value={status} className="bg-[#0A0A0A]">{status}</option>)}
          </select>
        </div>

        {error && <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300"><AlertTriangle size={13} />{error}</div>}

        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/5">{['ID', 'Type', 'User', 'Amount', 'Currency', 'Status', 'Reference', 'Date'].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white/30">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-white/[0.03]">
                {loading ? Array.from({ length: 8 }).map((_, index) => <tr key={index}><td colSpan={8} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-white/[0.04]" /></td></tr>) : records.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-white/25">No persistent demonstration records match these filters.</td></tr> : records.map((record, index) => (
                  <motion.tr key={record.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.015 }} className={record.flagged ? 'bg-red-500/[0.03]' : 'hover:bg-white/[0.02]'}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-white/40"><span className="flex items-center gap-1">{record.flagged && <AlertTriangle size={10} className="text-red-400" />}{record.id}</span></td>
                    <td className="whitespace-nowrap px-4 py-3"><span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: TYPE_COLORS[record.type] ?? '#C9A84C' }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: TYPE_COLORS[record.type] ?? '#C9A84C' }} />{record.type.replaceAll('_', ' ')}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-white/70">{displayUser(record)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-white">{displayAmount(record)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-white/50">{record.currency}</td>
                    <td className="whitespace-nowrap px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[record.status] ?? 'bg-white/10 text-white/30'}`}>{record.status}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-white/30">{record.reference}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-white/30">{record.createdAt ? new Date(record.createdAt).toLocaleString() : '—'}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-white/5 px-4 py-3">
            <p className="text-xs text-white/30">Page {page} of {pages} · {total} records</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} aria-label="Previous page" className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-white/40 disabled:opacity-30"><ChevronLeft size={13} /></button>
              <button onClick={() => setPage(current => Math.min(pages, current + 1))} disabled={page === pages} aria-label="Next page" className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-white/40 disabled:opacity-30"><ChevronRight size={13} /></button>
            </div>
          </div>
        </div>
      </AdminLayout>
    </>
  );
}
