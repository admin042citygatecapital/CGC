import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  ArrowRight, Globe, Zap, DollarSign, Shield, RefreshCw, Send,
  CheckCircle, Clock, TrendingUp, Star, ArrowDownLeft, ArrowUpRight,
  Loader2, AlertCircle, Info, ChevronDown,
} from 'lucide-react';
import { trackConversion } from '@/lib/useAnalytics';
import { useCustomerAuth } from '@/lib/customerAuth';
import { newIdempotencyKey } from '@/lib/idempotency';

const corridors = [
  { from: '🇺🇸 USD', to: '🇬🇧 GBP', fee: 'Example', time: 'Not live', volume: 'Illustrative' },
  { from: '🇺🇸 USD', to: '🇪🇺 EUR', fee: 'Example', time: 'Not live', volume: 'Illustrative' },
  { from: '🇬🇧 GBP', to: '🇮🇳 INR', fee: 'Example', time: 'Not live', volume: 'Illustrative' },
  { from: '🇺🇸 USD', to: '🇯🇵 JPY', fee: 'Example', time: 'Not live', volume: 'Illustrative' },
  { from: '🇪🇺 EUR', to: '🇦🇺 AUD', fee: 'Example', time: 'Not live', volume: 'Illustrative' },
  { from: '🇺🇸 USD', to: '🇦🇪 AED', fee: 'Example', time: 'Not live', volume: 'Illustrative' },
  { from: '🇺🇸 USD', to: '🇨🇦 CAD', fee: 'Example', time: 'Not live', volume: 'Illustrative' },
  { from: '🇬🇧 GBP', to: '🇦🇺 AUD', fee: 'Example', time: 'Not live', volume: 'Illustrative' },
  { from: '🇪🇺 EUR', to: '🇨🇭 CHF', fee: 'Example', time: 'Not live', volume: 'Illustrative' },
];

const transferTypes = [
  { icon: Zap,        title: 'Transfer Simulation',  desc: 'Preview a proposed internal-transfer flow. No money is moved.',                                      color: '#C9A84C', time: 'Not live' },
  { icon: Globe,      title: 'Wire Prototype',       desc: 'Explore proposed international-wire fields without sending an instruction to a bank.',                  color: '#627EEA', time: 'Not live' },
  { icon: RefreshCw,  title: 'Schedule Prototype',   desc: 'Preview recurring-transfer controls using demonstration data.',                                        color: '#10B981', time: 'Demo' },
  { icon: TrendingUp, title: 'Bulk Flow Prototype',  desc: 'Explore a proposed multi-recipient workflow without creating payments.',                                color: '#9945FF', time: 'Demo' },
];

const testimonials = [
  { name: 'Personal Transfer', role: 'Illustrative scenario', text: 'Explore how a future user could prepare a cross-border transfer after approved providers are connected.', rating: 5 },
  { name: 'Currency Conversion', role: 'Illustrative scenario', text: 'Compare a proposed USD-to-JPY flow using indicative values without executing an exchange.', rating: 5 },
  { name: 'Business Payments', role: 'Illustrative scenario', text: 'Review a proposed bulk-payment workflow without creating supplier payments.', rating: 5 },
];

type ActiveTab = 'send' | 'deposit' | 'withdraw';

interface FeeConfig {
  flatFeeUSD: number;
  percentageFee: number;
  minFeeUSD: number;
  maxFeeUSD: number;
  withdrawalFlatFeeUSD: number;
  withdrawalPercentageFee: number;
}

function calcFee(amount: number, cfg: FeeConfig, type: 'transfer' | 'withdrawal'): number {
  let fee = type === 'withdrawal' ? cfg.withdrawalFlatFeeUSD : cfg.flatFeeUSD;
  const pct = type === 'withdrawal' ? cfg.withdrawalPercentageFee : cfg.percentageFee;
  if (pct > 0) fee += amount * (pct / 100);
  if (cfg.minFeeUSD > 0) fee = Math.max(fee, cfg.minFeeUSD);
  if (cfg.maxFeeUSD > 0) fee = Math.min(fee, cfg.maxFeeUSD);
  return Math.round(fee * 100) / 100;
}

export default function TransfersPage() {
  const { customer, token } = useCustomerAuth();
  const location = useLocation();
  const financialOperationsUnavailable = import.meta.env.VITE_PLATFORM_MODE !== 'live';

  // Determine initial tab from URL hash or query
  const params = new URLSearchParams(location.search);
  const initTab = (params.get('tab') as ActiveTab) || 'send';
  const [activeTab, setActiveTab] = useState<ActiveTab>(initTab);

  // Fee config from server
  const [feeConfig, setFeeConfig] = useState<FeeConfig>({
    flatFeeUSD: 0.99, percentageFee: 0, minFeeUSD: 0.99, maxFeeUSD: 0,
    withdrawalFlatFeeUSD: 1.99, withdrawalPercentageFee: 0.5,
  });

  useEffect(() => {
    fetch('/api/settings/rates')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.fees) setFeeConfig(d.fees); })
      .catch(() => {});
  }, []);

  // ── Send Money form ──────────────────────────────────────────────────────────
  const [sendForm, setSendForm] = useState({ recipient: '', amount: '', currency: 'USD', note: '' });
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);

  const sendAmount = parseFloat(sendForm.amount) || 0;
  const sendFee    = sendAmount > 0 ? calcFee(sendAmount, feeConfig, 'transfer') : 0;
  const sendTotal  = sendAmount + sendFee;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSendError('');
    if (!sendForm.recipient.trim()) { setSendError('Recipient is required.'); return; }
    if (!sendForm.amount || sendAmount <= 0) { setSendError('Enter a valid amount.'); return; }
    if (!token) { setSendError('Please log in to send money.'); return; }
    setSendBusy(true);
    try {
      const res = await fetch('/api/users/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': newIdempotencyKey() },
        body: JSON.stringify(sendForm),
      });
      const data = await res.json();
      if (!res.ok) { setSendError(data.error ?? 'Transfer failed.'); return; }
      setSendSuccess(true);
      trackConversion('transfer_initiated', '/transfers', { currency: sendForm.currency });
    } catch { setSendError('Network error. Please try again.'); }
    finally { setSendBusy(false); }
  }

  // ── Deposit form ─────────────────────────────────────────────────────────────
  const [depForm, setDepForm] = useState({ amount: '', method: 'bank_wire', note: '' });
  const [depError, setDepError] = useState('');
  const [depSuccess, setDepSuccess] = useState(false);
  const [depBusy, setDepBusy] = useState(false);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    setDepError('');
    const amt = parseFloat(depForm.amount);
    if (!depForm.amount || isNaN(amt) || amt <= 0) { setDepError('Enter a valid amount.'); return; }
    if (!token) { setDepError('Please log in to deposit funds.'); return; }
    setDepBusy(true);
    try {
      const res = await fetch('/api/users/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': newIdempotencyKey() },
        body: JSON.stringify(depForm),
      });
      const data = await res.json();
      if (!res.ok) { setDepError(data.error ?? 'Deposit request failed.'); return; }
      setDepSuccess(true);
    } catch { setDepError('Network error. Please try again.'); }
    finally { setDepBusy(false); }
  }

  // ── Withdraw form ────────────────────────────────────────────────────────────
  const [wdForm, setWdForm] = useState({ amount: '', destination: '', destinationType: 'bank', note: '' });
  const [wdError, setWdError] = useState('');
  const [wdSuccess, setWdSuccess] = useState(false);
  const [wdBusy, setWdBusy] = useState(false);

  const wdAmount = parseFloat(wdForm.amount) || 0;
  const wdFee    = wdAmount > 0 ? calcFee(wdAmount, feeConfig, 'withdrawal') : 0;
  const wdTotal  = wdAmount + wdFee;

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setWdError('');
    if (!wdForm.amount || wdAmount <= 0) { setWdError('Enter a valid amount.'); return; }
    if (!wdForm.destination.trim()) { setWdError('Destination is required.'); return; }
    if (!token) { setWdError('Please log in to withdraw.'); return; }
    setWdBusy(true);
    try {
      const res = await fetch('/api/users/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': newIdempotencyKey() },
        body: JSON.stringify(wdForm),
      });
      const data = await res.json();
      if (!res.ok) { setWdError(data.error ?? 'Withdrawal request failed.'); return; }
      setWdSuccess(true);
    } catch { setWdError('Network error. Please try again.'); }
    finally { setWdBusy(false); }
  }

  const isLoggedIn = !!customer;

  return (
    <>
      <Helmet>
        <title>Transfers — Send, Deposit & Withdraw | CGC</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="description" content="Preview proposed transfer, deposit, and withdrawal interfaces using demonstration data. Live money movement is unavailable." />
        <link rel="canonical" href="https://citygate.capital/transfers" />
        <meta property="og:title" content="Transfers — Send, Deposit & Withdraw" />
        <meta property="og:description" content="A demonstration of proposed transfer, deposit, and withdrawal interfaces. No live financial transactions are available." />
        <meta property="og:url" content="https://citygate.capital/transfers" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Transfers — Send, Deposit & Withdraw | City Gate Capital" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:creator" content="@CityGateCapital" />
        <meta name="twitter:title" content="Transfers — City Gate Capital" />
        <meta name="twitter:description" content="Preview proposed transfer, deposit, and withdrawal experiences using demonstration data. No funds are moved." />
        <meta name="twitter:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': 'https://citygate.capital/transfers#webpage',
          name: 'Transfers — Send, Deposit & Withdraw | City Gate Capital',
          url: 'https://citygate.capital/transfers',
          description: 'Preview proposed transfer, deposit, and withdrawal experiences using demonstration data. No funds are moved.',
          isPartOf: { '@id': 'https://citygate.capital/#website' },
          about: { '@id': 'https://citygate.capital/#organization' },
          mainEntity: {
            '@type': 'WebApplication',
            name: 'City Gate Capital Transfer Experience Preview',
            description: 'A non-transactional product demonstration of proposed money-transfer interfaces.',
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'Web',
          },
        }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://citygate.capital/' },
            { '@type': 'ListItem', position: 2, name: 'Transfers', item: 'https://citygate.capital/transfers' },
          ],
        }) }} />
      </Helmet>

      {/* Hero */}
      <section className="relative min-h-[52vh] flex items-center overflow-hidden bg-[#0A0A0A]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#C9A84C]/8 via-transparent to-[#627EEA]/8" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(201,168,76,0.06),transparent_60%)]" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/20 text-[#C9A84C] text-xs font-medium tracking-widest uppercase mb-6">
              <Zap size={12} /> Money Movement
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Move Money<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C9A84C] to-[#E8C97A]">Preview the Journey</span>
            </h1>
            <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10">
              Explore proposed transfer, deposit, and withdrawal journeys using demonstration records. No real funds or assets can be moved.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#C9A84C] text-black font-semibold hover:bg-[#E8C97A] transition-colors">
                Get Started <ArrowRight size={16} />
              </Link>
              <Link to="/accounts" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/20 text-white hover:border-[#C9A84C]/50 transition-colors">
                View Accounts
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Money Movement Panel */}
      <section className="py-16 bg-[#0A0A0A]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Tab selector */}
          <div className="flex rounded-xl overflow-hidden border border-white/10 mb-8">
            {([
              { id: 'send',     label: 'Send Money',  icon: Send          },
              { id: 'deposit',  label: 'Add Funds',   icon: ArrowDownLeft },
              { id: 'withdraw', label: 'Withdraw',    icon: ArrowUpRight  },
            ] as { id: ActiveTab; label: string; icon: React.ElementType }[]).map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all ${
                  activeTab === t.id
                    ? 'bg-[#C9A84C] text-black'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <t.icon size={15} />
                {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ── SEND MONEY ── */}
            {activeTab === 'send' && (
              <motion.div key="send" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8">
                  <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                    <Send size={18} className="text-[#C9A84C]" /> Send Money
                  </h2>

                  {!isLoggedIn && (
                    <div className="mb-6 p-4 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-start gap-3">
                      <Info size={16} className="text-[#C9A84C] mt-0.5 shrink-0" />
                      <p className="text-sm text-white/70">
                        <Link to="/login" className="text-[#C9A84C] hover:underline font-medium">Log in</Link> or{' '}
                        <Link to="/register" className="text-[#C9A84C] hover:underline font-medium">create an account</Link> to send money.
                      </p>
                    </div>
                  )}

                  {sendSuccess ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={32} className="text-emerald-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">Transfer Sent!</h3>
                      <p className="text-white/60 text-sm mb-6">Your transfer of ${sendAmount.toFixed(2)} has been processed successfully.</p>
                      <button onClick={() => { setSendSuccess(false); setSendForm({ recipient: '', amount: '', currency: 'USD', note: '' }); }}
                        className="px-6 py-2.5 rounded-lg bg-[#C9A84C] text-black font-medium hover:bg-[#E8C97A] transition-colors text-sm">
                        Send Another
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSend} className="space-y-5">
                      <div>
                        <label className="block text-sm text-white/60 mb-1.5">Recipient (email or account number)</label>
                        <input
                          type="text"
                          value={sendForm.recipient}
                          onChange={e => setSendForm(f => ({ ...f, recipient: e.target.value }))}
                          placeholder="name@example.com or account number"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/50 transition-colors text-sm"
                        />
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="block text-sm text-white/60 mb-1.5">Amount</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={sendForm.amount}
                            onChange={e => setSendForm(f => ({ ...f, amount: e.target.value }))}
                            placeholder="0.00"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/50 transition-colors text-sm"
                          />
                        </div>
                        <div className="w-28">
                          <label className="block text-sm text-white/60 mb-1.5">Currency</label>
                          <div className="relative">
                            <select
                              value={sendForm.currency}
                              onChange={e => setSendForm(f => ({ ...f, currency: e.target.value }))}
                              className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-white focus:outline-none focus:border-[#C9A84C]/50 transition-colors text-sm pr-7"
                            >
                              {['USD','EUR','GBP','BTC','ETH','USDT','SOL'].map(c => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
                            </select>
                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-white/60 mb-1.5">Note (optional)</label>
                        <input
                          type="text"
                          value={sendForm.note}
                          onChange={e => setSendForm(f => ({ ...f, note: e.target.value }))}
                          placeholder="What's this for?"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/50 transition-colors text-sm"
                        />
                      </div>

                      {/* Fee breakdown */}
                      {sendAmount > 0 && (
                        <div className="bg-white/3 border border-white/8 rounded-lg p-4 space-y-2 text-sm">
                          <div className="flex justify-between text-white/60">
                            <span>Amount</span><span className="text-white">${sendAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-white/60">
                            <span>Transfer fee</span><span className="text-white">${sendFee.toFixed(2)}</span>
                          </div>
                          <div className="border-t border-white/10 pt-2 flex justify-between font-semibold">
                            <span className="text-white/80">Total deducted</span>
                            <span className="text-[#C9A84C]">${sendTotal.toFixed(2)}</span>
                          </div>
                          {customer && (
                            <div className="flex justify-between text-white/50 text-xs">
                              <span>Your balance</span>
                              <span className={sendTotal > customer.balance ? 'text-red-400' : 'text-emerald-400'}>
                                ${customer.balance.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {sendError && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                          <AlertCircle size={15} className="mt-0.5 shrink-0" /> {sendError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={financialOperationsUnavailable || sendBusy || !isLoggedIn}
                        className="w-full py-3.5 rounded-lg bg-[#C9A84C] text-black font-semibold hover:bg-[#E8C97A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {sendBusy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        {financialOperationsUnavailable ? 'Live transfers unavailable' : sendBusy ? 'Processing…' : 'Send Money'}
                      </button>
                    </form>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── DEPOSIT ── */}
            {activeTab === 'deposit' && (
              <motion.div key="deposit" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8">
                  <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                    <ArrowDownLeft size={18} className="text-emerald-400" /> Add Funds
                  </h2>

                  {!isLoggedIn && (
                    <div className="mb-6 p-4 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-start gap-3">
                      <Info size={16} className="text-[#C9A84C] mt-0.5 shrink-0" />
                      <p className="text-sm text-white/70">
                        <Link to="/login" className="text-[#C9A84C] hover:underline font-medium">Log in</Link> or{' '}
                        <Link to="/register" className="text-[#C9A84C] hover:underline font-medium">create a demonstration profile</Link> to explore this interface.
                      </p>
                    </div>
                  )}

                  {depSuccess ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={32} className="text-emerald-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">Demonstration Record Created</h3>
                      <p className="text-white/60 text-sm mb-2">No deposit was submitted and no money was received.</p>
                      <p className="text-white/40 text-xs mb-6">This record cannot be credited, withdrawn, or transferred.</p>
                      <button onClick={() => { setDepSuccess(false); setDepForm({ amount: '', method: 'bank_wire', note: '' }); }}
                        className="px-6 py-2.5 rounded-lg bg-[#C9A84C] text-black font-medium hover:bg-[#E8C97A] transition-colors text-sm">
                        New Request
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleDeposit} className="space-y-5">
                      <div>
                        <label className="block text-sm text-white/60 mb-1.5">Deposit Method</label>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { id: 'bank_wire', label: 'Bank Wire', desc: '1–3 business days' },
                            { id: 'crypto',    label: 'Crypto',    desc: 'Preview only'       },
                          ].map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setDepForm(f => ({ ...f, method: m.id }))}
                              className={`p-4 rounded-lg border text-left transition-all ${
                                depForm.method === m.id
                                  ? 'border-[#C9A84C]/60 bg-[#C9A84C]/10'
                                  : 'border-white/10 bg-white/3 hover:border-white/20'
                              }`}
                            >
                              <div className="text-sm font-medium text-white">{m.label}</div>
                              <div className="text-xs text-white/40 mt-0.5">{m.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-white/60 mb-1.5">Amount (USD)</label>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={depForm.amount}
                          onChange={e => setDepForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder="0.00"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/50 transition-colors text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/60 mb-1.5">Reference / Note (optional)</label>
                        <input
                          type="text"
                          value={depForm.note}
                          onChange={e => setDepForm(f => ({ ...f, note: e.target.value }))}
                          placeholder="Transaction reference or note"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/50 transition-colors text-sm"
                        />
                      </div>

                      {depForm.method === 'bank_wire' && (
                        <div className="bg-white/3 border border-white/8 rounded-lg p-4 text-sm space-y-1.5">
                          <p className="text-white/60 font-medium mb-2 flex items-center gap-1.5"><Info size={13} /> No Wire Instructions Issued</p>
                          <div className="flex justify-between"><span className="text-white/40">Bank provider</span><span className="text-white">Not contracted</span></div>
                          <div className="flex justify-between"><span className="text-white/40">Account</span><span className="text-white font-mono">Not issued</span></div>
                          <div className="flex justify-between"><span className="text-white/40">SWIFT</span><span className="text-white font-mono">Not issued</span></div>
                          <div className="flex justify-between"><span className="text-white/40">IBAN</span><span className="text-white font-mono">Not issued</span></div>
                          <p className="text-amber-400/80 text-xs pt-1">Do not send funds. This page does not provide payment instructions.</p>
                        </div>
                      )}

                      {depError && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                          <AlertCircle size={15} className="mt-0.5 shrink-0" /> {depError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={financialOperationsUnavailable || depBusy || !isLoggedIn}
                        className="w-full py-3.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {depBusy ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownLeft size={16} />}
                        {financialOperationsUnavailable ? 'Live deposits unavailable' : depBusy ? 'Submitting…' : 'Submit Deposit Request'}
                      </button>
                    </form>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── WITHDRAW ── */}
            {activeTab === 'withdraw' && (
              <motion.div key="withdraw" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8">
                  <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                    <ArrowUpRight size={18} className="text-red-400" /> Withdraw Funds
                  </h2>

                  {!isLoggedIn && (
                    <div className="mb-6 p-4 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-start gap-3">
                      <Info size={16} className="text-[#C9A84C] mt-0.5 shrink-0" />
                      <p className="text-sm text-white/70">
                        <Link to="/login" className="text-[#C9A84C] hover:underline font-medium">Log in</Link> or{' '}
                        <Link to="/register" className="text-[#C9A84C] hover:underline font-medium">create an account</Link> to withdraw funds.
                      </p>
                    </div>
                  )}

                  {wdSuccess ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 rounded-full bg-blue-500/15 flex items-center justify-center mx-auto mb-4">
                        <Clock size={32} className="text-blue-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">Withdrawal Submitted</h3>
                      <p className="text-white/60 text-sm mb-2">Your withdrawal request is being processed.</p>
                      <p className="text-white/40 text-xs mb-6">Estimated arrival: 1–3 business days.</p>
                      <button onClick={() => { setWdSuccess(false); setWdForm({ amount: '', destination: '', destinationType: 'bank', note: '' }); }}
                        className="px-6 py-2.5 rounded-lg bg-[#C9A84C] text-black font-medium hover:bg-[#E8C97A] transition-colors text-sm">
                        New Withdrawal
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleWithdraw} className="space-y-5">
                      <div>
                        <label className="block text-sm text-white/60 mb-1.5">Withdrawal Method</label>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { id: 'bank',   label: 'Bank Account', desc: '1–3 business days' },
                            { id: 'crypto', label: 'Crypto Wallet', desc: 'Preview only'      },
                          ].map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setWdForm(f => ({ ...f, destinationType: m.id, destination: '' }))}
                              className={`p-4 rounded-lg border text-left transition-all ${
                                wdForm.destinationType === m.id
                                  ? 'border-[#C9A84C]/60 bg-[#C9A84C]/10'
                                  : 'border-white/10 bg-white/3 hover:border-white/20'
                              }`}
                            >
                              <div className="text-sm font-medium text-white">{m.label}</div>
                              <div className="text-xs text-white/40 mt-0.5">{m.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-white/60 mb-1.5">Amount (USD)</label>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={wdForm.amount}
                          onChange={e => setWdForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder="0.00"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/50 transition-colors text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/60 mb-1.5">
                          {wdForm.destinationType === 'crypto' ? 'Crypto Wallet Address' : 'Bank Account / IBAN'}
                        </label>
                        <input
                          type="text"
                          value={wdForm.destination}
                          onChange={e => setWdForm(f => ({ ...f, destination: e.target.value }))}
                          placeholder={wdForm.destinationType === 'crypto' ? '0x... or bc1...' : 'IBAN or account number'}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/50 transition-colors text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/60 mb-1.5">Note (optional)</label>
                        <input
                          type="text"
                          value={wdForm.note}
                          onChange={e => setWdForm(f => ({ ...f, note: e.target.value }))}
                          placeholder="Reference or note"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/50 transition-colors text-sm"
                        />
                      </div>

                      {/* Fee breakdown */}
                      {wdAmount > 0 && (
                        <div className="bg-white/3 border border-white/8 rounded-lg p-4 space-y-2 text-sm">
                          <div className="flex justify-between text-white/60">
                            <span>Amount</span><span className="text-white">${wdAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-white/60">
                            <span>Withdrawal fee</span><span className="text-white">${wdFee.toFixed(2)}</span>
                          </div>
                          <div className="border-t border-white/10 pt-2 flex justify-between font-semibold">
                            <span className="text-white/80">Total deducted</span>
                            <span className="text-[#C9A84C]">${wdTotal.toFixed(2)}</span>
                          </div>
                          {customer && (
                            <div className="flex justify-between text-white/50 text-xs">
                              <span>Your balance</span>
                              <span className={wdTotal > customer.balance ? 'text-red-400' : 'text-emerald-400'}>
                                ${customer.balance.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {wdError && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                          <AlertCircle size={15} className="mt-0.5 shrink-0" /> {wdError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={financialOperationsUnavailable || wdBusy || !isLoggedIn}
                        className="w-full py-3.5 rounded-lg bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {wdBusy ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}
                        {financialOperationsUnavailable ? 'Live withdrawals unavailable' : wdBusy ? 'Submitting…' : 'Submit Withdrawal Request'}
                      </button>
                    </form>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Transfer Types */}
      <section className="py-20 bg-[#0D0D0D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Preview Proposed Transfer Flows</h2>
            <p className="text-white/50 max-w-xl mx-auto">Explore non-transactional prototypes for internal, international, scheduled, and bulk-payment experiences.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {transferTypes.map((t, i) => (
              <motion.div key={t.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: t.color + '20' }}>
                  <t.icon size={22} style={{ color: t.color }} />
                </div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-3" style={{ background: t.color + '15', color: t.color }}>
                  <Clock size={10} /> {t.time}
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{t.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{t.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Corridors */}
      <section className="py-20 bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Popular Transfer Corridors</h2>
            <p className="text-white/50 max-w-xl mx-auto">Competitive rates on the world's most-used currency pairs.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {corridors.map((c, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-5 py-4 hover:border-[#C9A84C]/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-white">{c.from}</span>
                  <ArrowRight size={14} className="text-[#C9A84C]" />
                  <span className="text-sm font-medium text-white">{c.to}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-[#C9A84C]">{c.fee}</div>
                  <div className="text-xs text-white/40">{c.time}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-20 bg-[#0D0D0D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">Security Controls for the Transfer Preview</h2>
              <p className="text-white/50 mb-8 leading-relaxed">Account access uses protective controls, but this preview does not accept money or execute transfers. Provider security and monitoring must be validated before launch.</p>
              <div className="space-y-4">
                {[
                  { icon: Shield, text: 'Protected account sessions and access controls' },
                  { icon: CheckCircle, text: 'Transaction monitoring required before launch' },
                  { icon: Globe, text: 'Preview only — provider approval required' },
                  { icon: DollarSign, text: 'Demonstration funds — not insured' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/15 flex items-center justify-center shrink-0">
                      <item.icon size={15} className="text-[#C9A84C]" />
                    </div>
                    <span className="text-white/70 text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Live Countries', value: '0' },
                { label: 'Prototype Currencies', value: '50+' },
                { label: 'Funds Moved', value: '$0' },
                { label: 'Settlement', value: 'Off' },
              ].map((s, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                  <div className="text-3xl font-bold text-[#C9A84C] mb-1">{s.value}</div>
                  <div className="text-sm text-white/50">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Illustrative Transfer Scenarios</h2>
            <p className="text-white/50">These examples are product scenarios, not customer testimonials.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => <Star key={j} size={14} className="text-[#C9A84C] fill-[#C9A84C]" />)}
                </div>
                <p className="text-white/70 text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <div className="text-sm font-semibold text-white">{t.name}</div>
                  <div className="text-xs text-white/40">{t.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#0D0D0D]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">Explore the Transfer Experience</h2>
          <p className="text-white/50 mb-10">Create a preview profile to explore the interface. Deposits, withdrawals, and live transfers are unavailable.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/register" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#C9A84C] text-black font-semibold hover:bg-[#E8C97A] transition-colors">
              Create Preview Profile <ArrowRight size={16} />
            </Link>
            <Link to="/support" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-white/20 text-white hover:border-[#C9A84C]/50 transition-colors">
              Contact Support
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
