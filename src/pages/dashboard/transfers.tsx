/**
 * /dashboard/transfers — Transfer history + Transfer Wizard entry point
 * Shows all transactions with filters, and a "New Transfer" button that
 * opens the 6-step Transfer Wizard modal.
 */
import { useState, useEffect, type ElementType } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Send, ArrowDownLeft, ArrowUpRight, RefreshCw,
  DollarSign, Search, ChevronRight, ChevronLeft,
  Loader2, Activity, Eye, EyeOff, X, Check, AlertCircle,
  CheckCircle, User, ShieldCheck, Banknote, Copy,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';
import { newIdempotencyKey } from '@/lib/idempotency';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tx {
  id:          string;
  type:        string;
  status:      string;
  amount:      number;
  currency:    string;
  description: string;
  reference:   string;
  createdAt:   string;
}

interface BalanceData {
  primaryCurrency: string;
  primaryAmount:   number;
  currencies: { currency: string; amount: number; usdEquivalent: number }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', CHF: '🇨🇭', CAD: '🇨🇦',
  AUD: '🇦🇺', JPY: '🇯🇵', SGD: '🇸🇬', AED: '🇦🇪', NGN: '🇳🇬',
};

const TX_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400',
  approved:  'bg-emerald-500/10 text-emerald-400',
  pending:   'bg-amber-500/10 text-amber-400',
  processing:'bg-blue-500/10 text-blue-400',
  failed:    'bg-red-500/10 text-red-400',
  rejected:  'bg-red-500/10 text-red-400',
  frozen:    'bg-blue-500/10 text-blue-400',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number, currency: string): string {
  try { return amount.toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

function isCredit(type: string): boolean {
  return ['deposit', 'manual_credit', 'refund', 'crypto_sell'].includes(type);
}

function txMeta(type: string): { Icon: ElementType; color: string; label: string } {
  switch (type) {
    case 'transfer': case 'wire_transfer': return { Icon: Send, color: '#C9A84C', label: 'Transfer' };
    case 'crypto_buy': return { Icon: RefreshCw, color: '#627EEA', label: 'Crypto Buy' };
    case 'crypto_sell': return { Icon: RefreshCw, color: '#10B981', label: 'Crypto Sell' };
    case 'deposit': case 'manual_credit': return { Icon: ArrowDownLeft, color: '#10B981', label: 'Deposit' };
    case 'refund': return { Icon: ArrowDownLeft, color: '#10B981', label: 'Refund' };
    case 'withdrawal': case 'manual_debit': return { Icon: ArrowUpRight, color: '#EF4444', label: 'Withdrawal' };
    case 'fee': return { Icon: DollarSign, color: '#EF4444', label: 'Fee' };
    default: return { Icon: DollarSign, color: '#C9A84C', label: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) };
  }
}

function PV({ value, privacy, className = '' }: { value: string; privacy: boolean; className?: string }) {
  return privacy
    ? <span className={`font-mono tracking-widest select-none ${className}`}>••••••</span>
    : <span className={className}>{value}</span>;
}

// ── Transfer Wizard ───────────────────────────────────────────────────────────

type WizardStep = 'account' | 'recipient' | 'amount' | 'review' | 'otp' | 'confirmation';

interface WizardState {
  fromCurrency: string;
  recipientName: string;
  recipientAccount: string;
  recipientBank: string;
  recipientCountry: string;
  amount: string;
  note: string;
  otp: string;
}

const WIZARD_STEPS: { id: WizardStep; label: string; icon: ElementType }[] = [
  { id: 'account',      label: 'Account',    icon: Banknote },
  { id: 'recipient',    label: 'Recipient',  icon: User },
  { id: 'amount',       label: 'Amount',     icon: DollarSign },
  { id: 'review',       label: 'Review',     icon: ShieldCheck },
  { id: 'otp',          label: 'Verify',     icon: ShieldCheck },
  { id: 'confirmation', label: 'Done',       icon: CheckCircle },
];

function TransferWizard({
  onClose, balanceData, token,
}: { onClose: () => void; balanceData: BalanceData | null; token: string | null }) {
  const [step, setStep]       = useState<WizardStep>('account');
  const [state, setState]     = useState<WizardState>({
    fromCurrency: balanceData?.primaryCurrency ?? 'USD',
    recipientName: '', recipientAccount: '', recipientBank: '',
    recipientCountry: '', amount: '', note: '', otp: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [txRef, setTxRef]           = useState('');

  const stepIdx = WIZARD_STEPS.findIndex(s => s.id === step);
  const currencies = balanceData?.currencies ?? [];
  const selectedBal = currencies.find(c => c.currency === state.fromCurrency);

  function update(patch: Partial<WizardState>) {
    setState(prev => ({ ...prev, ...patch }));
    setError('');
  }

  function next() {
    const steps: WizardStep[] = ['account', 'recipient', 'amount', 'review', 'otp', 'confirmation'];
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
  }

  function back() {
    const steps: WizardStep[] = ['account', 'recipient', 'amount', 'review', 'otp', 'confirmation'];
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
  }

  async function submitTransfer() {
    if (!token) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/users/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': newIdempotencyKey() },
        body: JSON.stringify({
          fromCurrency:     state.fromCurrency,
          recipientName:    state.recipientName,
          recipientAccount: state.recipientAccount,
          recipientBank:    state.recipientBank,
          recipientCountry: state.recipientCountry,
          amount:           parseFloat(state.amount),
          note:             state.note,
          otp:              state.otp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Transfer failed');
      setTxRef(data.reference ?? data.id ?? 'CGC-' + Date.now());
      setStep('confirmation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "w-full bg-white/4 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-primary/50 transition-colors";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32, scale: 0.97 }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-lg rounded-3xl border border-white/8 overflow-hidden"
        style={{ background: 'rgba(10,10,10,0.99)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
          <div>
            <p className="text-sm font-semibold text-foreground">New Transfer</p>
            <p className="text-[10px] text-foreground/30">Step {stepIdx + 1} of {WIZARD_STEPS.length}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-0 px-6 py-3 border-b border-white/5 overflow-x-auto">
          {WIZARD_STEPS.map((s, i) => {
            const done    = i < stepIdx;
            const current = i === stepIdx;
            return (
              <div key={s.id} className="flex items-center gap-0 shrink-0">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                  current ? 'text-primary' : done ? 'text-emerald-400' : 'text-foreground/25'
                }`}>
                  {done ? <Check size={10} /> : <s.icon size={10} />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < WIZARD_STEPS.length - 1 && (
                  <div className={`w-4 h-px mx-1 ${done ? 'bg-emerald-400/40' : 'bg-white/10'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[280px]">
          {error && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {/* Step: Account */}
          {step === 'account' && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Select source account</p>
                <p className="text-xs text-foreground/35 mb-4">Choose the currency you want to send from</p>
              </div>
              <div className="flex flex-col gap-2">
                {currencies.length === 0 ? (
                  <p className="text-xs text-foreground/30 text-center py-6">No funded accounts available</p>
                ) : currencies.map(c => (
                  <button key={c.currency} onClick={() => update({ fromCurrency: c.currency })}
                    className="flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left"
                    style={{
                      background: state.fromCurrency === c.currency ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.02)',
                      borderColor: state.fromCurrency === c.currency ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.07)',
                    }}>
                    <span className="text-xl">{CURRENCY_FLAGS[c.currency] ?? '💱'}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{c.currency}</p>
                      <p className="text-xs text-foreground/35">Available: {c.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} {c.currency}</p>
                    </div>
                    {state.fromCurrency === c.currency && <Check size={14} className="text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Recipient */}
          {step === 'recipient' && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Recipient details</p>
                <p className="text-xs text-foreground/35 mb-4">Enter the beneficiary's banking information</p>
              </div>
              <input className={inputCls} placeholder="Full name" value={state.recipientName} onChange={e => update({ recipientName: e.target.value })} />
              <input className={inputCls} placeholder="Account number / IBAN" value={state.recipientAccount} onChange={e => update({ recipientAccount: e.target.value })} />
              <input className={inputCls} placeholder="Bank name" value={state.recipientBank} onChange={e => update({ recipientBank: e.target.value })} />
              <input className={inputCls} placeholder="Country" value={state.recipientCountry} onChange={e => update({ recipientCountry: e.target.value })} />
            </div>
          )}

          {/* Step: Amount */}
          {step === 'amount' && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Transfer amount</p>
                <p className="text-xs text-foreground/35 mb-4">
                  Available: {selectedBal ? `${selectedBal.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${state.fromCurrency}` : '—'}
                </p>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40 text-sm font-semibold">{state.fromCurrency}</span>
                <input
                  className={`${inputCls} pl-16 text-xl font-bold`}
                  type="number" min="0" step="0.01"
                  placeholder="0.00"
                  value={state.amount}
                  onChange={e => update({ amount: e.target.value })}
                />
              </div>
              <textarea
                className={`${inputCls} resize-none`} rows={2}
                placeholder="Transfer note (optional)"
                value={state.note}
                onChange={e => update({ note: e.target.value })}
              />
            </div>
          )}

          {/* Step: Review */}
          {step === 'review' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-foreground mb-1">Review transfer</p>
              {[
                { label: 'From',      value: `${state.fromCurrency} account` },
                { label: 'To',        value: state.recipientName },
                { label: 'Account',   value: state.recipientAccount },
                { label: 'Bank',      value: state.recipientBank },
                { label: 'Country',   value: state.recipientCountry },
                { label: 'Amount',    value: `${state.amount} ${state.fromCurrency}` },
                { label: 'Note',      value: state.note || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <span className="text-xs text-foreground/35">{label}</span>
                  <span className="text-xs font-medium text-foreground/80">{value}</span>
                </div>
              ))}
              <div className="mt-2 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
                <p className="text-xs text-amber-400">Please verify all details before confirming. Transfers cannot be reversed once processed.</p>
              </div>
            </div>
          )}

          {/* Step: OTP */}
          {step === 'otp' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)' }}>
                <ShieldCheck size={24} style={{ color: '#C9A84C' }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground mb-1">Verification required</p>
                <p className="text-xs text-foreground/35">Enter the OTP sent to your registered email or phone</p>
              </div>
              <input
                className={`${inputCls} text-center text-2xl font-bold tracking-[0.3em] max-w-[200px]`}
                type="text" maxLength={6} placeholder="000000"
                value={state.otp}
                onChange={e => update({ otp: e.target.value.replace(/\D/g, '') })}
              />
              <p className="text-xs text-foreground/25">Didn't receive it? <button className="text-primary hover:underline">Resend OTP</button></p>
            </div>
          )}

          {/* Step: Confirmation */}
          {step === 'confirmation' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <CheckCircle size={28} className="text-emerald-400" />
              </motion.div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Transfer submitted</p>
                <p className="text-xs text-foreground/35">Your transfer is being processed and will be completed within 1–3 business days.</p>
              </div>
              {txRef && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/4 border border-white/8">
                  <span className="text-xs text-foreground/40">Ref:</span>
                  <span className="text-xs font-mono text-foreground/70">{txRef}</span>
                  <button onClick={() => navigator.clipboard?.writeText(txRef)} className="text-foreground/30 hover:text-foreground transition-colors">
                    <Copy size={11} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'confirmation' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/6">
            <button onClick={back} disabled={stepIdx === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-foreground/40 hover:text-foreground disabled:opacity-20 transition-colors">
              <ChevronLeft size={13} /> Back
            </button>
            {step === 'otp' ? (
              <button onClick={submitTransfer} disabled={submitting || state.otp.length < 4}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.25)' }}>
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Confirm Transfer
              </button>
            ) : (
              <button
                onClick={next}
                disabled={
                  (step === 'account'    && !state.fromCurrency) ||
                  (step === 'recipient'  && (!state.recipientName || !state.recipientAccount)) ||
                  (step === 'amount'     && (!state.amount || parseFloat(state.amount) <= 0))
                }
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110 disabled:opacity-40"
                style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.25)' }}>
                Continue <ChevronRight size={13} />
              </button>
            )}
          </div>
        )}
        {step === 'confirmation' && (
          <div className="px-6 py-4 border-t border-white/6 flex justify-center">
            <button onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
              style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.25)' }}>
              Done
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function TransfersPage() {
  const { customer, token, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [privacy, setPrivacy]         = useState(false);
  const [wizardOpen, setWizardOpen]   = useState(false);
  const [allTx, setAllTx]             = useState<Tx[]>([]);
  const [txLoading, setTxLoading]     = useState(true);
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [search, setSearch]           = useState('');
  const [typeFilter, setTypeFilter]   = useState<string>('all');
  const [page, setPage]               = useState(0);

  useEffect(() => { setPrivacy(localStorage.getItem('cgc_privacy_mode') === 'true'); }, []);
  useEffect(() => {
    if (!loading && !customer) navigate('/login?reason=session_expired', { replace: true });
  }, [customer, loading, navigate]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch('/api/users/transactions?limit=500', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch('/api/users/balance',                { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
    ]).then(([txData, balData]) => {
      if (txData?.transactions) setAllTx(txData.transactions);
      if (balData) setBalanceData(balData);
    }).catch(() => {}).finally(() => setTxLoading(false));
  }, [token]);

  // Open wizard if ?action=new
  useEffect(() => {
    if (searchParams.get('action') === 'new') setWizardOpen(true);
  }, [searchParams]);

  const filtered = allTx.filter(tx => {
    const matchType = typeFilter === 'all' || tx.type === typeFilter || (typeFilter === 'credit' && isCredit(tx.type)) || (typeFilter === 'debit' && !isCredit(tx.type));
    const matchSearch = !search || tx.description?.toLowerCase().includes(search.toLowerCase()) || tx.reference?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading || !customer) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <>
      <Helmet>
        <title>Transfers — City Gate Capital</title>
        <meta name="description" content="Send money, view transfer history and manage your transactions at City Gate Capital." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/transfers" />
      </Helmet>

      <AnimatePresence>
        {wizardOpen && (
          <TransferWizard onClose={() => setWizardOpen(false)} balanceData={balanceData} token={token} />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
            <Link to="/dashboard" className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/50 hover:text-foreground transition-colors">
              <ArrowLeft size={15} />
            </Link>
            <div className="flex items-center gap-2.5">
              <Send size={16} style={{ color: '#C9A84C' }} />
              <h1 className="text-sm font-semibold text-foreground">Transfers</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => { const next = !privacy; setPrivacy(next); localStorage.setItem('cgc_privacy_mode', String(next)); }}
                className="w-9 h-9 rounded-xl border flex items-center justify-center transition-all"
                style={{ background: privacy ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', borderColor: privacy ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.08)', color: privacy ? '#C9A84C' : 'rgba(255,255,255,0.4)' }}
              >
                {privacy ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <button
                onClick={() => setWizardOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.2)' }}>
                <Send size={13} /> New Transfer
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30" />
              <input
                className="w-full bg-white/4 border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-primary/40 transition-colors"
                placeholder="Search transactions…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto">
              {[
                { id: 'all',      label: 'All' },
                { id: 'credit',   label: 'Credits' },
                { id: 'debit',    label: 'Debits' },
                { id: 'transfer', label: 'Transfers' },
                { id: 'deposit',  label: 'Deposits' },
              ].map(f => (
                <button key={f.id} onClick={() => { setTypeFilter(f.id); setPage(0); }}
                  className="shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: typeFilter === f.id ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.03)',
                    color: typeFilter === f.id ? '#C9A84C' : 'rgba(255,255,255,0.35)',
                    border: typeFilter === f.id ? '1px solid rgba(201,168,76,0.25)' : '1px solid rgba(255,255,255,0.06)',
                  }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction list */}
          <div className="rounded-2xl border border-white/6 overflow-hidden" style={{ background: 'rgba(255,255,255,0.01)' }}>
            {txLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-foreground/25" /></div>
            ) : paginated.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-foreground/20">
                <Activity size={28} />
                <p className="text-sm">{search || typeFilter !== 'all' ? 'No matching transactions' : 'No transactions yet'}</p>
              </div>
            ) : paginated.map((tx, i) => {
              const { Icon, color, label } = txMeta(tx.type);
              const positive = isCredit(tx.type);
              const statusCls = TX_STATUS_COLORS[tx.status] ?? 'bg-zinc-800 text-zinc-400';
              return (
                <div key={tx.id}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-white/[0.025] transition-colors ${i < paginated.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${color}12`, border: `1px solid ${color}22` }}>
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground/80 truncate">
                      {tx.description || label}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-[11px] text-foreground/30">
                        {new Date(tx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${statusCls}`}>{tx.status}</span>
                      {tx.reference && (
                        <span className="text-[10px] text-foreground/20 font-mono hidden sm:inline">{tx.reference}</span>
                      )}
                    </div>
                  </div>
                  <PV
                    value={`${positive ? '+' : '−'}${fmt(Math.abs(Number(tx.amount ?? 0)), tx.currency ?? 'USD')}`}
                    privacy={privacy}
                    className={`text-sm font-semibold tabular-nums shrink-0 ${positive ? 'text-emerald-400' : 'text-foreground/60'}`}
                  />
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-foreground/30">{filtered.length} transactions · Page {page + 1} of {totalPages}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="w-8 h-8 rounded-xl bg-white/4 border border-white/6 flex items-center justify-center text-foreground/35 hover:text-foreground disabled:opacity-20 transition-colors">
                  <ChevronLeft size={13} />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                  className="w-8 h-8 rounded-xl bg-white/4 border border-white/6 flex items-center justify-center text-foreground/35 hover:text-foreground disabled:opacity-20 transition-colors">
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
