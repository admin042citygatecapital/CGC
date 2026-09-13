import { Helmet } from '@dr.pogodin/react-helmet';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Loader2,
  RefreshCw,
  Scale,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';

/**
 * Finance Controls — consolidation page for the financial-control primitives:
 * ledger balance adjustments (POST /api/admin/balance/adjust), the adjustment
 * audit history, the ledger-derived account registry and reconciliation status.
 * Every number shown comes from a live API response; no figures are derived,
 * estimated or synthesised on the client.
 */

interface BalanceTx {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: string;
  amount: number;
  previousBalance: number;
  newBalance: number;
  note: string;
  adminName: string;
  createdAt: string;
}
interface HistoryPayload { data: BalanceTx[]; total: number; page: number; limit: number }

interface LedgerAccount {
  id: string;
  userId: string;
  customerName?: string;
  customerEmail?: string;
  label: string;
  accountType: string;
  status: string;
  primaryCurrency: string;
  availableMinor: string;
  ledgerMinor: string;
  updatedAt: string;
}
interface LedgerTx {
  id: string;
  ownerUserId: string;
  reference: string;
  kind: string;
  status: string;
  currency: string;
  amountMinor: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  description: string;
  createdAt: string;
}
interface AccountsPayload { accounts: LedgerAccount[]; recentTransactions: LedgerTx[]; balanceMutationsAllowed: boolean }

interface ReconRun { id: string; reference: string; businessDate: string; status: string; matchedCount: number; exceptionCount: number; journalEntryCount: number; createdAt: string }
interface ReconOverview { runs: number; matched: number; unresolved: number; critical: number; ledgerIntegrityBreaks: number; matchedAmountMinor: string; lastRunAt?: string; financialOperationsLocked: boolean }
interface ReconPayload { runs: ReconRun[]; overview: ReconOverview }

interface AdjustmentResult { id: string; reference: string; status: string; direction: string; currency: string; amount: string; journalLines: number; createdAt: string }

const minor = (value: string | number): string =>
  (Number(value ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Mirrors the server's reference pattern: 6-64 characters, letters/digits/._-/ */
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{5,63}$/;
const newIdempotencyKey = (): string => `admin-adjust-${crypto.randomUUID()}`;

export default function AdminFinance() {
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [userIdFilter, setUserIdFilter] = useState('');
  const historyRequestSeq = useRef(0);

  const [ledger, setLedger] = useState<AccountsPayload | null>(null);
  const [ledgerError, setLedgerError] = useState('');
  const [ledgerLoading, setLedgerLoading] = useState(true);

  const [recon, setRecon] = useState<ReconPayload | null>(null);
  const [reconError, setReconError] = useState('');
  const [reconLoading, setReconLoading] = useState(true);

  const [form, setForm] = useState({
    accountId: '', direction: 'credit', amount: '', reference: '', reason: '', idempotencyKey: newIdempotencyKey(),
  });
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const loadHistory = useCallback(async () => {
    // Sequence guard: a slower response for an older filter/page must not overwrite a newer one.
    const requestId = ++historyRequestSeq.current;
    setHistoryLoading(true);
    setHistoryError('');
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (userIdFilter.trim()) params.set('userId', userIdFilter.trim());
    try {
      const response = await fetch(`/api/admin/balance/history?${params}`, { headers: authHeaders(), cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load the adjustment history.');
      if (requestId !== historyRequestSeq.current) return;
      setHistory(body);
    } catch (cause) {
      if (requestId !== historyRequestSeq.current) return;
      setHistoryError(cause instanceof Error ? cause.message : 'Unable to load the adjustment history.');
      setHistory(null);
    } finally {
      if (requestId === historyRequestSeq.current) setHistoryLoading(false);
    }
  }, [page, userIdFilter]);

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true);
    setLedgerError('');
    try {
      const response = await fetch('/api/admin/customer-accounts', { headers: authHeaders(), cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load the ledger registry.');
      setLedger({ accounts: body.accounts ?? [], recentTransactions: body.recentTransactions ?? [], balanceMutationsAllowed: body.balanceMutationsAllowed ?? false });
    } catch (cause) {
      setLedgerError(cause instanceof Error ? cause.message : 'Unable to load the ledger registry.');
      setLedger(null);
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  const loadRecon = useCallback(async () => {
    setReconLoading(true);
    setReconError('');
    try {
      const response = await fetch('/api/admin/reconciliation', { headers: authHeaders(), cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load reconciliation status.');
      setRecon({
        runs: body.runs ?? [],
        overview: body.overview ?? { runs: 0, matched: 0, unresolved: 0, critical: 0, ledgerIntegrityBreaks: 0, matchedAmountMinor: '0', financialOperationsLocked: true },
      });
    } catch (cause) {
      setReconError(cause instanceof Error ? cause.message : 'Unable to load reconciliation status.');
      setRecon(null);
    } finally {
      setReconLoading(false);
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);
  useEffect(() => { void loadLedger(); }, [loadLedger]);
  useEffect(() => { void loadRecon(); }, [loadRecon]);

  const amountValid = /^\d+(\.\d{1,2})?$/.test(form.amount.trim()) && Number(form.amount) > 0 && Number(form.amount) <= 10_000_000;
  const formValid = form.accountId.trim().length > 0
    && ['credit', 'debit'].includes(form.direction)
    && amountValid
    && REFERENCE_PATTERN.test(form.reference.trim())
    && form.reason.trim().length >= 10
    && form.idempotencyKey.trim().length >= 8 && form.idempotencyKey.trim().length <= 160;

  async function submitAdjustment() {
    if (!formValid) return;
    setPosting(true);
    setFormError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/balance/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': form.idempotencyKey.trim(), ...authHeaders() },
        body: JSON.stringify({
          accountId: form.accountId.trim(),
          direction: form.direction,
          amount: form.amount.trim(),
          reference: form.reference.trim(),
          reason: form.reason.trim(),
          idempotencyKey: form.idempotencyKey.trim(),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'The ledger adjustment was rejected.');
      const adjustment = body.adjustment as AdjustmentResult;
      setNotice(`Controlled adjustment ${adjustment.reference} posted: ${adjustment.amount} ${adjustment.currency} ${adjustment.direction === 'credit' ? 'credited' : 'debited'} (${adjustment.status}, ${adjustment.journalLines} journal lines).`);
      setForm(current => ({ ...current, amount: '', reference: '', reason: '', idempotencyKey: newIdempotencyKey() }));
      // Returning to page 1 re-runs loadHistory via the effect; reload manually only when
      // the page is already 1 (setPage is then a no-op and would not trigger it).
      setPage(1);
      if (page === 1) {
        await Promise.all([loadHistory(), loadLedger()]);
      } else {
        await loadLedger();
      }
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'The ledger adjustment was rejected.');
    } finally {
      setPosting(false);
    }
  }

  const totalPages = history ? Math.max(1, Math.ceil(history.total / Math.max(1, history.limit))) : 1;

  return (
    <>
      <Helmet>
        <title>Finance Controls — CGC Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <AdminLayout title="Finance Controls">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Finance Controls</h1>
          <p className="text-sm text-white/35">Ledger adjustments, adjustment history and reconciliation status</p>
        </div>

        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#C9A84C]/20 bg-[#C9A84C]/[0.06] px-4 py-3">
          <Landmark size={16} className="mt-0.5 shrink-0 text-[#D8B85A]" />
          <div>
            <p className="text-sm font-semibold text-[#E8C96A]">Balances are ledger projections</p>
            <p className="mt-1 text-xs leading-relaxed text-[#E8C96A]/55">Customer balances are never edited directly. Every change is a balanced double-entry journal posted to the isolated ledger, with an intent audit record written before posting. Debits require sufficient available funds; the maximum adjustment is 10,000,000.00 per posting.</p>
          </div>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {([
            ['Ledger accounts', ledger?.accounts.length ?? 0, 'From the account registry', ledgerLoading],
            ['Legacy adjustment records', history?.total ?? 0, 'Legacy balance adjustment store', historyLoading],
            ['Matched (last run)', recon?.overview.matched ?? 0, 'Reconciliation matching', reconLoading],
            ['Open breaks', recon?.overview.unresolved ?? 0, 'Unresolved reconciliation exceptions', reconLoading],
          ] as Array<[string, number, string, boolean]>).map(([label, value, hint, loading]) => (
            <article key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/35">{label}</p>
              {loading
                ? <div className="mt-3 h-7 w-20 animate-pulse rounded bg-white/[0.06]" />
                : <p className="mt-2 text-2xl font-bold text-white">{value.toLocaleString()}</p>}
              <p className="mt-1 text-[11px] text-white/25">{hint}</p>
            </article>
          ))}
        </div>

        <section className="mb-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Post a controlled ledger adjustment</h2>
              <p className="mt-1 text-xs text-white/35">Credits and debits are posted as balanced journals against one account. The action is audited with the posting administrator, IP and correlation ID.</p>
            </div>
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">CRITICAL ACTION · LEDGER.WRITE</span>
          </div>

          <form
            onSubmit={event => { event.preventDefault(); void submitAdjustment(); }}
            className="mt-4 grid gap-4 lg:grid-cols-2"
          >
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Ledger account ID</span>
              <input value={form.accountId} onChange={event => setForm(current => ({ ...current, accountId: event.target.value }))} placeholder="Account ID from the registry below" autoComplete="off" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-primary/40" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Direction</span>
              <select value={form.direction} onChange={event => setForm(current => ({ ...current, direction: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-white outline-none">
                <option value="credit">Credit — increases the available balance</option>
                <option value="debit">Debit — decreases the available balance (requires sufficient funds)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Amount</span>
              <input value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} type="number" min="0.01" max="10000000" step="0.01" placeholder="0.00 — maximum 10,000,000.00" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-primary/40" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Controlled reference</span>
              <input value={form.reference} onChange={event => setForm(current => ({ ...current, reference: event.target.value.toUpperCase() }))} maxLength={64} placeholder="e.g. ADJ-2026-0001 (6-64 characters)" autoComplete="off" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-primary/40" />
            </label>
            <label className="block lg:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Adjustment reason (minimum 10 characters)</span>
              <textarea value={form.reason} onChange={event => setForm(current => ({ ...current, reason: event.target.value }))} maxLength={500} rows={3} placeholder="Explain the control reason for this adjustment. It is stored with the journal and audit intent record." className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-primary/40" />
            </label>
            <label className="block lg:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Idempotency key</span>
              <div className="flex gap-2">
                <input value={form.idempotencyKey} onChange={event => setForm(current => ({ ...current, idempotencyKey: event.target.value }))} maxLength={160} className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-xs text-white/70 outline-none transition-colors focus:border-primary/40" />
                <button type="button" onClick={() => setForm(current => ({ ...current, idempotencyKey: newIdempotencyKey() }))} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-white" aria-label="Regenerate idempotency key">Regenerate</button>
              </div>
              <span className="mt-1 block text-[11px] text-white/25">A repeated key replays the same posting instead of creating a duplicate journal.</span>
            </label>
            <div className="lg:col-span-2">
              <button type="submit" disabled={posting || !formValid} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40">
                {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {posting ? 'Posting…' : `Post ${form.direction === 'credit' ? 'credit' : 'debit'} adjustment`}
              </button>
              <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-100/50"><AlertTriangle size={12} className="mt-0.5 shrink-0" />Posting requires the ledger-adjust permission and a recent administrator sign-in. If the action is rejected with a recent-verification message, sign in again and retry.</p>
            </div>
          </form>
        </section>

        {notice && <div role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-200"><CheckCircle2 size={13} className="mt-0.5 shrink-0" /><span className="break-all">{notice}</span></div>}
        {formError && <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300"><AlertTriangle size={13} className="mt-0.5 shrink-0" /><span>{formError}</span></div>}

        <section className="mb-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Ledger registry</h2>
              <p className="mt-1 text-xs text-white/35">Ledger-derived account balances and recent journal postings. Use an account ID in the adjustment form above.</p>
            </div>
            <button type="button" onClick={() => void loadLedger()} className="rounded-lg border border-white/10 p-2 text-white/50 hover:text-white" aria-label="Refresh ledger registry"><RefreshCw size={14} /></button>
          </div>
          {ledgerError && <div role="alert" className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">{ledgerError}</div>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/5">{['Account', 'Customer', 'Type', 'Currency', 'Available', 'Status', ''].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white/30">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-white/[0.03]">
                {ledgerLoading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-white/25"><Loader2 size={16} className="mx-auto animate-spin" /></td></tr>
                  : !ledger || ledger.accounts.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-white/25">No ledger accounts are registered.</td></tr>
                    : ledger.accounts.map(account => (
                      <tr key={account.id} className="hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-white/50">{account.id}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-white/70">{account.customerName?.trim() || account.customerEmail?.trim() || account.userId}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-white/50">{account.label}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-white/50">{account.primaryCurrency}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-white">{minor(account.availableMinor)}</td>
                        <td className="whitespace-nowrap px-4 py-3"><span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-white/10 text-white/50">{account.status}</span></td>
                        <td className="whitespace-nowrap px-4 py-3"><button type="button" onClick={() => setForm(current => ({ ...current, accountId: account.id }))} className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20">Use ID</button></td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          <h3 className="mb-3 mt-6 text-sm font-semibold text-white">Recent ledger journals</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/5">{['Reference', 'Kind', 'Amount', 'Currency', 'Status', 'Description', 'Posted'].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white/30">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-white/[0.03]">
                {ledgerLoading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-white/25"><Loader2 size={16} className="mx-auto animate-spin" /></td></tr>
                  : !ledger || ledger.recentTransactions.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-white/25">No journals have been posted to the ledger yet.</td></tr>
                    : ledger.recentTransactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#E8C96A]">{tx.reference}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-white/60">{tx.kind.replaceAll('_', ' ')}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-white">{minor(tx.amountMinor)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-white/50">{tx.currency}</td>
                        <td className="whitespace-nowrap px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tx.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{tx.status}</span></td>
                        <td className="max-w-xs truncate px-4 py-3 text-xs text-white/40" title={tx.description}>{tx.description}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-white/30">{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Balance adjustment history</h2>
              <p className="mt-1 text-xs text-white/35">Immutable record of manual credit and debit entries with the resulting balance movement.</p>
            </div>
            <div className="flex items-center gap-2">
              <input value={userIdFilter} onChange={event => { setUserIdFilter(event.target.value); setPage(1); }} placeholder="Filter by customer ID" className="w-56 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-xs text-white outline-none placeholder:text-white/20" />
              <button type="button" onClick={() => void loadHistory()} className="rounded-lg border border-white/10 p-2 text-white/50 hover:text-white" aria-label="Refresh adjustment history"><RefreshCw size={14} /></button>
            </div>
          </div>
          {historyError && <div role="alert" className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">{historyError}</div>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/5">{['ID', 'Type', 'Customer', 'Amount', 'Previous', 'New', 'Administrator', 'Reason', 'Date'].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white/30">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-white/[0.03]">
                {historyLoading ? Array.from({ length: 5 }).map((_, index) => <tr key={index}><td colSpan={9} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-white/[0.04]" /></td></tr>)
                  : !history || history.data.length === 0 ? <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-white/25">No balance adjustments have been recorded.</td></tr>
                    : history.data.map(tx => (
                      <tr key={tx.id} className="hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-white/40">{tx.id}</td>
                        <td className="whitespace-nowrap px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tx.type === 'manual_credit' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{tx.type.replaceAll('_', ' ')}</span></td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-white/70">{tx.userName?.trim() || tx.userEmail?.trim() || tx.userId}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-white">{Number(tx.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-white/40">{Number(tx.previousBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-white/40">{Number(tx.newBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-white/50">{tx.adminName}</td>
                        <td className="max-w-xs truncate px-4 py-3 text-xs text-white/40" title={tx.note}>{tx.note}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-white/30">{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {history && history.total > (history.limit ?? 25) && (
            <div className="mt-3 flex items-center justify-between border-t border-white/5 px-2 pt-3">
              <p className="text-xs text-white/30">Page {history.page ?? page} of {totalPages} · {history.total} records</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={(history.page ?? page) === 1} aria-label="Previous page" className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-white/40 disabled:opacity-30"><ChevronLeft size={13} /></button>
                <button type="button" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={(history.page ?? page) >= totalPages} aria-label="Next page" className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-white/40 disabled:opacity-30"><ChevronRight size={13} /></button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Reconciliation status</h2>
              <p className="mt-1 text-xs text-white/35">Three-way match between provider instructions, transaction records and journal snapshots. Runs and exceptions are managed on the reconciliation page.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void loadRecon()} className="rounded-lg border border-white/10 p-2 text-white/50 hover:text-white" aria-label="Refresh reconciliation status"><RefreshCw size={14} /></button>
              <a href="/admin/reconciliation" className="rounded-lg border border-[#C9A84C]/20 px-3 py-2 text-xs text-[#E8C96A] hover:bg-[#C9A84C]/10">Open reconciliation</a>
            </div>
          </div>
          {reconError && <div role="alert" className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">{reconError}</div>}
          {reconLoading ? <div className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
            : !recon ? <p className="py-6 text-center text-sm text-white/25">Reconciliation status is unavailable.</p>
              : <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {([
                    ['Control runs', recon.overview.runs, 'text-[#D8B85A]'],
                    ['Matched', recon.overview.matched, 'text-emerald-300'],
                    ['Open breaks', recon.overview.unresolved, 'text-amber-300'],
                    ['Critical', recon.overview.critical, 'text-red-300'],
                    ['Ledger integrity breaks', recon.overview.ledgerIntegrityBreaks, 'text-blue-300'],
                  ] as Array<[string, number, string]>).map(([label, value, colour]) => (
                    <article key={label} className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
                      <p className={`text-2xl font-bold ${colour}`}>{value.toLocaleString()}</p>
                      <p className="mt-1 text-xs text-white/35">{label}</p>
                    </article>
                  ))}
                </div>
                {recon.overview.lastRunAt && <p className="mt-3 text-xs text-white/30">Last control run: {new Date(recon.overview.lastRunAt).toLocaleString()}</p>}
                {recon.overview.financialOperationsLocked && (
                  <div className="mt-3 flex gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-3 text-xs text-emerald-200/70">
                    <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                    Financial operations remain locked at the server. Neither this page nor the reconciliation workflow can move live money.
                  </div>
                )}
                <div className="mt-4 space-y-2">
                  <h3 className="text-sm font-semibold text-white">Latest runs</h3>
                  {recon.runs.length === 0
                    ? <p className="py-6 text-center text-sm text-white/30">No reconciliation run has been generated.</p>
                    : recon.runs.slice(0, 3).map(run => (
                      <article key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm text-[#E8C96A]">{run.reference}</span>
                            <span className="rounded-full border px-2 py-0.5 text-[10px] text-white/50">{run.status.replaceAll('_', ' ')}</span>
                          </div>
                          <p className="mt-1 text-xs text-white/40">{run.businessDate} · {run.matchedCount} matched · {run.exceptionCount} breaks · {run.journalEntryCount} journals</p>
                        </div>
                        <Scale size={16} className="text-white/25" />
                      </article>
                    ))}
                </div>
              </>}
        </section>
      </AdminLayout>
    </>
  );
}
