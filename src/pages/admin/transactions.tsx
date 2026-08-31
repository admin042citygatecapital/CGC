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
  Pencil,
  Plus,
  Save,
  Send,
  Search,
  X,
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
  adminNote?: string;
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

export default function AdminTransactions({ view = 'transactions' }: { view?: 'transactions' | 'transfers' }) {
  const transfersOnly = view === 'transfers';
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<TransactionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(transfersOnly ? 'transfer' : '');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<TransactionRecord | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editFlagged, setEditFlagged] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transferForm, setTransferForm] = useState({ userId: '', type: 'transfer', amount: '', currency: 'USD', description: '', note: '' });

  useEffect(() => {
    if (!authLoading && !admin) navigate('/admin/login');
  }, [admin, authLoading, navigate]);

  useEffect(() => {
    setTypeFilter(transfersOnly ? 'transfer' : '');
    setPage(1);
  }, [transfersOnly]);

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
      'Synthetic pre-deployment record',
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cgc-pre-deployment-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function openEditor(record: TransactionRecord) {
    setEditing(record);
    setEditDescription(record.description ?? '');
    setEditNote(record.adminNote ?? '');
    setEditFlagged(record.flagged);
    setEditReason('');
    setError('');
  }

  async function saveCorrection() {
    if (!editing || editReason.trim().length < 10) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admin/transactions/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          txId: editing.id,
          description: editDescription,
          adminNote: editNote,
          flagged: editFlagged,
          reason: editReason,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save the correction.');
      setEditing(null);
      await loadRecords();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save the correction.');
    } finally {
      setSaving(false);
    }
  }

  async function createPendingTransfer() {
    if (!transferForm.userId.trim() || Number(transferForm.amount) <= 0 || transferForm.note.trim().length < 10) return;
    setCreating(true);
    setError('');
    try {
      const response = await fetch('/api/admin/transactions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `admin-transfer-${crypto.randomUUID()}`,
          ...authHeaders(),
        },
        body: JSON.stringify({
          userId: transferForm.userId.trim(),
          type: transferForm.type,
          status: 'pending',
          amount: Number(transferForm.amount),
          currency: transferForm.currency,
          description: transferForm.description.trim() || 'Administrator-created pending transfer instruction',
          note: transferForm.note.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to create the transfer instruction.');
      setCreateOpen(false);
      setTransferForm({ userId: '', type: 'transfer', amount: '', currency: 'USD', description: '', note: '' });
      await loadRecords();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create the transfer instruction.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>{transfersOnly ? 'Transfer Review' : 'Transaction Register'} — CGC Admin</title>
        <meta name="description" content="Persistent transaction register with controlled metadata corrections and immutable financial fields." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href={`https://citygate.capital/admin/${transfersOnly ? 'transfers' : 'transactions'}`} />
      </Helmet>
      <AdminLayout title={transfersOnly ? 'Transfer Review' : 'Transaction Register'}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">{transfersOnly ? 'Transfer Review' : 'Transaction Register'}</h1>
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
            <p className="mt-1 text-xs leading-relaxed text-sky-100/55">Records come from the application database and may contain synthetic pre-deployment activity. The super-administrator may correct descriptions, internal notes, and compliance flags with a mandatory audit reason. Amount, currency, ownership, reference, timestamps, and financial status remain immutable.</p>
          </div>
        </div>

        {transfersOnly && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4"><div><p className="text-sm font-semibold text-amber-100">Controlled transfer workflow</p><p className="mt-1 text-xs text-amber-100/50">Create a pending, auditable transfer instruction. Provider execution and settlement remain disabled until the approved payment and ledger adapters are available.</p></div><button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-black"><Plus size={14} />Create transfer instruction</button></div>}

        <div className="mb-5 flex flex-wrap gap-3">
          <div className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2">
            <Search size={13} className="shrink-0 text-white/25" />
            <input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search user, ID, or reference" className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/20" />
          </div>
          <select value={typeFilter} onChange={event => { setTypeFilter(event.target.value); setPage(1); }} className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-white/60 outline-none">
            {!transfersOnly && <option value="">All types</option>}
            {(transfersOnly
              ? ['transfer', 'wire_transfer']
              : ['deposit', 'withdrawal', 'transfer', 'wire_transfer', 'crypto_buy', 'crypto_sell', 'fee', 'refund', 'manual_credit', 'manual_debit']
            ).map(type => <option key={type} value={type} className="bg-[#0A0A0A]">{type.replaceAll('_', ' ')}</option>)}
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
              <thead><tr className="border-b border-white/5">{['ID', 'Type', 'User', 'Amount', 'Currency', 'Status', 'Reference', 'Date', 'Control'].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white/30">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-white/[0.03]">
                {loading ? Array.from({ length: 8 }).map((_, index) => <tr key={index}><td colSpan={9} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-white/[0.04]" /></td></tr>) : records.length === 0 ? <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-white/25">No persistent demonstration records match these filters.</td></tr> : records.map((record, index) => (
                  <motion.tr key={record.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.015 }} className={record.flagged ? 'bg-red-500/[0.03]' : 'hover:bg-white/[0.02]'}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-white/40"><span className="flex items-center gap-1">{record.flagged && <AlertTriangle size={10} className="text-red-400" />}{record.id}</span></td>
                    <td className="whitespace-nowrap px-4 py-3"><span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: TYPE_COLORS[record.type] ?? '#C9A84C' }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: TYPE_COLORS[record.type] ?? '#C9A84C' }} />{record.type.replaceAll('_', ' ')}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-white/70">{displayUser(record)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-white">{displayAmount(record)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-white/50">{record.currency}</td>
                    <td className="whitespace-nowrap px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[record.status] ?? 'bg-white/10 text-white/30'}`}>{record.status}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-white/30">{record.reference}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-white/30">{record.createdAt ? new Date(record.createdAt).toLocaleString() : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button type="button" onClick={() => openEditor(record)} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20">
                        <Pencil size={11} /> Edit metadata
                      </button>
                    </td>
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

        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Edit transaction metadata">
            <div className="w-full max-w-xl rounded-2xl border border-primary/20 bg-[#0A0A0A] p-6 shadow-2xl shadow-black/60">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Correct transaction metadata</h2>
                  <p className="mt-1 font-mono text-xs text-white/35">{editing.id} · {editing.reference}</p>
                </div>
                <button type="button" onClick={() => setEditing(null)} disabled={saving} aria-label="Close editor" className="rounded-lg p-1.5 text-white/35 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"><X size={17} /></button>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Description</span>
                  <input value={editDescription} onChange={event => setEditDescription(event.target.value)} maxLength={300} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-primary/40" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Internal administration note</span>
                  <textarea value={editNote} onChange={event => setEditNote(event.target.value)} maxLength={500} rows={3} className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-primary/40" />
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3 text-sm text-white/70">
                  <input type="checkbox" checked={editFlagged} onChange={event => setEditFlagged(event.target.checked)} disabled={editing.status === 'frozen' && editing.flagged} className="h-4 w-4 accent-[#C9A84C]" />
                  Compliance review flag
                  {editing.status === 'frozen' && editing.flagged && <span className="ml-auto text-[11px] text-amber-300/70">Frozen records cannot be unflagged</span>}
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Correction reason (required)</span>
                  <textarea value={editReason} onChange={event => setEditReason(event.target.value)} maxLength={500} rows={3} placeholder="Explain why this administrative correction is required (minimum 10 characters)." className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-primary/40" />
                </label>
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2.5 text-xs leading-relaxed text-amber-100/60">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                Financial fields are deliberately immutable. This editor cannot alter amount, currency, ownership, reference, timestamps, idempotency data, or transaction status. Every correction records the previous and resulting metadata in the audit log.
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setEditing(null)} disabled={saving} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/55 transition-colors hover:bg-white/5 disabled:opacity-40">Cancel</button>
                <button type="button" onClick={() => void saveCorrection()} disabled={saving || editDescription.trim().length === 0 || editReason.trim().length < 10} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"><Save size={14} />{saving ? 'Saving…' : 'Save correction'}</button>
              </div>
            </div>
          </div>
        )}

        {createOpen && transfersOnly && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="create-transfer-title">
            <form onSubmit={event => { event.preventDefault(); void createPendingTransfer(); }} className="w-full max-w-2xl rounded-2xl border border-amber-300/20 bg-[#0A0A0A] p-6 shadow-2xl shadow-black/60">
              <div className="flex items-start justify-between gap-4"><div><h2 id="create-transfer-title" className="text-lg font-bold text-white">Create pending transfer instruction</h2><p className="mt-1 text-xs text-white/40">This records an operational instruction for review. It does not move or reserve money.</p></div><button type="button" onClick={() => setCreateOpen(false)} aria-label="Close transfer form" className="rounded-lg p-1.5 text-white/35 hover:bg-white/5 hover:text-white"><X size={17} /></button></div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-white/45">Customer ID</span><input name="customerId" required value={transferForm.userId} onChange={event => setTransferForm(current => ({ ...current, userId: event.target.value }))} placeholder="Customer record ID" autoComplete="off" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300/40" /></label>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-white/45">Transfer type</span><select name="transferType" value={transferForm.type} onChange={event => setTransferForm(current => ({ ...current, type: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-white"><option value="transfer">Internal transfer</option><option value="wire_transfer">Wire transfer</option></select></label>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-white/45">Amount</span><input name="amount" type="number" required min="0.01" step="0.01" value={transferForm.amount} onChange={event => setTransferForm(current => ({ ...current, amount: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none" /></label>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-white/45">Currency</span><select name="currency" value={transferForm.currency} onChange={event => setTransferForm(current => ({ ...current, currency: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-white">{['USD','EUR','GBP','CHF','JPY','CAD','AUD','SGD','AED','NGN'].map(currency => <option key={currency}>{currency}</option>)}</select></label>
              </div>
              <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-white/45">Description</span><input name="description" maxLength={300} value={transferForm.description} onChange={event => setTransferForm(current => ({ ...current, description: event.target.value }))} placeholder="Purpose or destination summary" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none" /></label>
              <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-white/45">Administration reason</span><textarea name="reason" required minLength={10} maxLength={500} rows={3} value={transferForm.note} onChange={event => setTransferForm(current => ({ ...current, note: event.target.value }))} placeholder="Explain why this instruction is being created (minimum 10 characters)." className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none" /></label>
              <div className="mt-4 flex gap-2 rounded-xl border border-sky-400/15 bg-sky-400/[0.05] p-3 text-xs leading-relaxed text-sky-100/60"><AlertTriangle size={14} className="mt-0.5 shrink-0" />The instruction will remain pending and provider-gated. It cannot become completed until compliance, ledger, payment-provider, reconciliation, and maker-checker gates are satisfied.</div>
              <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setCreateOpen(false)} disabled={creating} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/55">Cancel</button><button type="submit" disabled={creating || !transferForm.userId.trim() || Number(transferForm.amount) <= 0 || transferForm.note.trim().length < 10} className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-35"><Send size={14} />{creating ? 'Creating…' : 'Create pending instruction'}</button></div>
            </form>
          </div>
        )}
      </AdminLayout>
    </>
  );
}
