import { Helmet } from '@dr.pogodin/react-helmet';
import { Activity, ArrowDownLeft, ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Eye, EyeOff, Filter, Loader2, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCustomerAuth } from '@/lib/customerAuth';
import { useModalA11y } from '@/lib/useModalA11y';

interface Transaction {
  id: string; type: string; status: string; amount: number; currency: string;
  description: string; reference: string; createdAt: string;
}

interface TransactionResponse {
  transactions: Transaction[]; total: number; limit: number; offset: number;
}

const PAGE_SIZE = 20;
const CREDIT_TYPES = new Set(['deposit', 'manual_credit', 'refund', 'crypto_sell', 'internal_credit']);
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'SGD', 'AED', 'NGN', 'BTC', 'ETH', 'USDT', 'BNB', 'SOL'];
const STATUSES = ['pending', 'completed', 'failed', 'rejected', 'flagged', 'frozen'];
const CATEGORIES = ['deposit', 'withdrawal', 'transfer', 'wire_transfer', 'fee', 'refund', 'crypto_buy', 'crypto_sell', 'manual_credit', 'manual_debit'];

function isCredit(transaction: Transaction) { return CREDIT_TYPES.has(transaction.type); }
function label(value: string) { return value.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase()); }
function formatAmount(value: number, currency: string) {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Math.abs(value)); }
  catch { return `${currency} ${Math.abs(value).toFixed(2)}`; }
}
function statusClass(status: string) {
  if (['completed', 'approved'].includes(status)) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15';
  if (['pending', 'processing', 'under_review'].includes(status)) return 'bg-amber-500/10 text-amber-400 border-amber-500/15';
  if (['cancelled', 'reversed'].includes(status)) return 'bg-blue-500/10 text-blue-400 border-blue-500/15';
  return 'bg-red-500/10 text-red-400 border-red-500/15';
}

export default function TransactionsPage() {
  const { customer, loading } = useCustomerAuth();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [currency, setCurrency] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [privacy, setPrivacy] = useState(false);
  const [selected, setSelected] = useState<Transaction | null>(null);

  useEffect(() => { setPrivacy(localStorage.getItem('cgc_privacy_mode') === 'true'); }, []);
  useEffect(() => { setPage(1); }, [search, currency, status, category, from, to]);

  useEffect(() => {
    if (!customer) return;
    const abort = new AbortController();
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) });
    if (search.trim()) params.set('search', search.trim());
    if (currency) params.set('currency', currency);
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const timer = window.setTimeout(async () => {
      setBusy(true); setError('');
      try {
        const response = await fetch(`/api/users/transactions?${params}`, { credentials: 'same-origin', signal: abort.signal });
        if (!response.ok) throw new Error('Unable to load your transaction history.');
        const data = await response.json() as TransactionResponse;
        setRows(data.transactions ?? []); setTotal(data.total ?? 0);
      } catch (requestError) {
        if (!abort.signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Unable to load your transaction history.');
      } finally { if (!abort.signal.aborted) setBusy(false); }
    }, search ? 250 : 0);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [customer, page, search, currency, status, category, from, to]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = Boolean(search || currency || status || category || from || to);
  const dateLimits = useMemo(() => ({ fromMax: to || undefined, toMin: from || undefined }), [from, to]);
  function togglePrivacy() {
    const next = !privacy; setPrivacy(next); localStorage.setItem('cgc_privacy_mode', String(next));
  }
  function clearFilters() { setSearch(''); setCurrency(''); setStatus(''); setCategory(''); setFrom(''); setTo(''); }

  if (loading || !customer) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return <>
    <Helmet>
      <title>Transactions — City Gate Capital</title>
      <meta name="description" content="Search and review your City Gate Capital transaction history." />
      <meta name="robots" content="noindex, nofollow" />
      <link rel="canonical" href="https://citygate.capital/dashboard/transactions" />
    </Helmet>
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
        <div className="max-w-6xl mx-auto h-16 px-4 md:px-6 flex items-center gap-3">
          <Link to="/dashboard" aria-label="Back to dashboard" className="w-9 h-9 rounded-xl border border-white/8 bg-white/5 flex items-center justify-center text-white/45 hover:text-white"><ArrowLeft size={15} /></Link>
          <Activity size={16} className="text-primary" />
          <div className="flex-1"><h1 className="text-sm font-semibold">Transactions</h1><p className="text-[10px] text-white/30">Your account activity</p></div>
          <Link to="/dashboard/statements" className="hidden sm:inline-flex px-3 py-2 rounded-xl border border-white/8 text-xs text-white/55 hover:text-white">Statements</Link>
          <button type="button" onClick={togglePrivacy} aria-label={privacy ? 'Show transaction amounts' : 'Hide transaction amounts'} className="w-9 h-9 rounded-xl border border-white/8 bg-white/5 flex items-center justify-center text-white/45 hover:text-primary">{privacy ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <section className="rounded-2xl border border-white/6 bg-white/[0.02] p-4">
          <div className="grid gap-3 md:grid-cols-12">
            <label className="md:col-span-4 relative"><span className="sr-only">Search transactions</span><Search size={14} className="absolute left-3 top-3.5 text-white/25" /><input value={search} onChange={event => setSearch(event.target.value)} maxLength={100} placeholder="Search description or reference" className="w-full rounded-xl border border-white/8 bg-black/30 py-3 pl-9 pr-3 text-xs outline-none focus:border-primary/40" /></label>
            <FilterSelect labelText="Filter by currency" value={currency} onChange={setCurrency} values={CURRENCIES} empty="All currencies" />
            <FilterSelect labelText="Filter by status" value={status} onChange={setStatus} values={STATUSES} empty="All statuses" />
            <FilterSelect labelText="Filter by category" value={category} onChange={setCategory} values={CATEGORIES} empty="All categories" />
            <button type="button" onClick={clearFilters} disabled={!filtersActive} className="md:col-span-2 rounded-xl border border-white/8 px-3 py-3 text-xs text-white/50 disabled:opacity-30 hover:text-white flex items-center justify-center gap-2"><X size={13} /> Clear</button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-white/30">
            <Filter size={12} /><label>From <input type="date" value={from} max={dateLimits.fromMax} onChange={event => setFrom(event.target.value)} className="ml-1 rounded-lg border border-white/8 bg-black/30 px-2 py-1.5 text-white/55" /></label>
            <label>To <input type="date" value={to} min={dateLimits.toMin} onChange={event => setTo(event.target.value)} className="ml-1 rounded-lg border border-white/8 bg-black/30 px-2 py-1.5 text-white/55" /></label>
            <span className="ml-auto">{total} transaction{total === 1 ? '' : 's'}</span>
          </div>
        </section>

        <section className="rounded-2xl border border-white/6 overflow-hidden bg-white/[0.01]">
          {busy ? <div className="py-20 flex justify-center"><Loader2 size={20} className="animate-spin text-primary" /></div> : error ? <div className="py-16 text-center text-sm text-red-300">{error}</div> : rows.length === 0 ? <div className="py-20 flex flex-col items-center gap-3 text-white/25"><Activity size={28} /><p className="text-sm">No transactions found</p>{filtersActive && <button onClick={clearFilters} className="text-xs text-primary">Clear filters</button>}</div> : rows.map((transaction, index) => <TransactionRow key={transaction.id} transaction={transaction} privacy={privacy} last={index === rows.length - 1} onSelect={setSelected} />)}
        </section>

        {pageCount > 1 && <nav aria-label="Transaction pages" className="flex items-center justify-center gap-3">
          <button type="button" disabled={page === 1} onClick={() => setPage(value => Math.max(1, value - 1))} aria-label="Previous page" className="w-9 h-9 rounded-xl border border-white/8 flex items-center justify-center disabled:opacity-25"><ChevronLeft size={15} /></button>
          <span className="text-xs text-white/40">Page {page} of {pageCount}</span>
          <button type="button" disabled={page === pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))} aria-label="Next page" className="w-9 h-9 rounded-xl border border-white/8 flex items-center justify-center disabled:opacity-25"><ChevronRight size={15} /></button>
        </nav>}
      </main>
      {selected && <TransactionDetails transaction={selected} privacy={privacy} onClose={() => setSelected(null)} />}
    </div>
  </>;
}

function FilterSelect({ labelText, value, onChange, values, empty }: { labelText: string; value: string; onChange: (value: string) => void; values: string[]; empty: string }) {
  return <select aria-label={labelText} value={value} onChange={event => onChange(event.target.value)} className="md:col-span-2 rounded-xl border border-white/8 bg-[#0d0d0d] px-3 py-3 text-xs outline-none focus:border-primary/40"><option value="">{empty}</option>{values.map(option => <option key={option} value={option}>{label(option)}</option>)}</select>;
}

function TransactionRow({ transaction, privacy, last, onSelect }: { transaction: Transaction; privacy: boolean; last: boolean; onSelect: (transaction: Transaction) => void }) {
  const credit = isCredit(transaction); const Direction = credit ? ArrowDownLeft : ArrowUpRight;
  return <button type="button" onClick={() => onSelect(transaction)} className={`w-full text-left flex items-center gap-3 px-4 md:px-5 py-4 hover:bg-white/[0.025] ${last ? '' : 'border-b border-white/[0.045]'}`}>
    <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${credit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-primary/10 text-primary'}`}><Direction size={15} /></span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-white/80 truncate">{transaction.description || label(transaction.type)}</span><span className="block mt-1 text-[10px] text-white/30">{new Date(transaction.createdAt).toLocaleString()} · {transaction.reference || 'No reference'}</span></span>
    <span className={`hidden sm:inline-flex rounded-md border px-2 py-1 text-[9px] ${statusClass(transaction.status)}`}>{label(transaction.status)}</span>
    <span className={`text-sm font-semibold tabular-nums ${credit ? 'text-emerald-400' : 'text-white/65'}`}>{privacy ? '••••••' : `${credit ? '+' : '−'}${formatAmount(transaction.amount, transaction.currency)}`}</span>
  </button>;
}

function TransactionDetails({ transaction, privacy, onClose }: { transaction: Transaction; privacy: boolean; onClose: () => void }) {
  const dialogRef = useModalA11y(true, onClose);
  const details = [
    ['Amount', privacy ? '••••••' : `${isCredit(transaction) ? '+' : '−'}${formatAmount(transaction.amount, transaction.currency)}`],
    ['Status', label(transaction.status)], ['Category', label(transaction.type)],
    ['Date and time', new Date(transaction.createdAt).toLocaleString()],
    ['Reference', transaction.reference || 'Not provided'], ['Currency', transaction.currency],
  ];
  return <div ref={dialogRef} className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Transaction details" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}>
    <div className="w-full max-w-md rounded-3xl border border-primary/20 bg-[#0d0d0d] p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-widest text-primary">Transaction details</p><h2 className="mt-2 text-lg font-semibold">{transaction.description || label(transaction.type)}</h2></div><button type="button" onClick={onClose} aria-label="Close transaction details" className="w-8 h-8 rounded-lg border border-white/8 flex items-center justify-center text-white/40"><X size={14} /></button></div>
      <dl className="mt-6 divide-y divide-white/5 text-sm">{details.map(([term, value]) => <div key={term} className="flex justify-between gap-4 py-3"><dt className="text-white/35">{term}</dt><dd className="text-right text-white/75 break-all">{value}</dd></div>)}</dl>
    </div>
  </div>;
}
