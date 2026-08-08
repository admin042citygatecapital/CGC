/**
 * /dashboard/deposits — Deposit instructions & history
 */
import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft, ArrowDownLeft, Copy, Check, Banknote,
  Bitcoin, Eye, EyeOff, Loader2, Activity,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';

interface Tx {
  id: string; type: string; status: string; amount: number;
  currency: string; description: string; reference: string; createdAt: string;
}

function fmt(amount: number, currency: string): string {
  try { return amount.toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

function PV({ value, privacy, className = '' }: { value: string; privacy: boolean; className?: string }) {
  return privacy ? <span className={`font-mono tracking-widest select-none ${className}`}>••••••</span> : <span className={className}>{value}</span>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-foreground/30 hover:text-foreground transition-colors shrink-0"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}

export default function DepositsPage() {
  const { customer, token, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const [privacy, setPrivacy] = useState(false);
  const [deposits, setDeposits] = useState<Tx[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [tab, setTab] = useState<'wire' | 'crypto'>('wire');

  useEffect(() => { setPrivacy(localStorage.getItem('cgc_privacy_mode') === 'true'); }, []);
  useEffect(() => {
    if (!loading && !customer) navigate('/login?reason=session_expired', { replace: true });
  }, [customer, loading, navigate]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/users/transactions?limit=200', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.transactions) {
          setDeposits(data.transactions.filter((t: Tx) => ['deposit', 'manual_credit', 'refund'].includes(t.type)));
        }
      }).catch(() => {}).finally(() => setTxLoading(false));
  }, [token]);

  if (loading || !customer) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  const accountId = customer.id.slice(-8).toUpperCase();

  const wireDetails = [
    { label: 'Bank Name',       value: 'City Gate Capital Bank' },
    { label: 'Account Name',    value: customer.name },
    { label: 'Account Number',  value: `CGC${accountId}` },
    { label: 'IBAN',            value: `GB${accountId}CGCB00000000` },
    { label: 'SWIFT / BIC',     value: 'Not issued — preview only' },
    { label: 'Sort Code',       value: '40-47-84' },
    { label: 'Reference',       value: `DEP-${accountId}` },
  ];

  const cryptoAddresses = [
    { currency: 'BTC',  address: `1CGC${accountId}xK2mP9qR`, network: 'Bitcoin' },
    { currency: 'ETH',  address: `0x${accountId}a4f2b8c3d1e5`, network: 'ERC-20' },
    { currency: 'USDT', address: `0x${accountId}a4f2b8c3d1e5`, network: 'ERC-20 / TRC-20' },
  ];

  return (
    <>
      <Helmet>
        <title>Deposits — City Gate Capital</title>
        <meta name="description" content="Deposit funds into your City Gate Capital account via wire transfer or cryptocurrency." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/deposits" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
            <Link to="/dashboard" className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/50 hover:text-foreground transition-colors">
              <ArrowLeft size={15} />
            </Link>
            <div className="flex items-center gap-2.5">
              <ArrowDownLeft size={16} className="text-emerald-400" />
              <h1 className="text-sm font-semibold text-foreground">Deposit Funds</h1>
            </div>
            <div className="ml-auto">
              <button
                onClick={() => { const next = !privacy; setPrivacy(next); localStorage.setItem('cgc_privacy_mode', String(next)); }}
                className="w-9 h-9 rounded-xl border flex items-center justify-center transition-all"
                style={{ background: privacy ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', borderColor: privacy ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.08)', color: privacy ? '#C9A84C' : 'rgba(255,255,255,0.4)' }}
              >
                {privacy ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 md:px-6 py-6">

          {/* Tab selector */}
          <div className="flex gap-1 mb-6 bg-white/3 rounded-xl p-1 w-fit">
            {[
              { id: 'wire' as const,   label: 'Wire Transfer', icon: Banknote },
              { id: 'crypto' as const, label: 'Cryptocurrency', icon: Bitcoin },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: tab === t.id ? 'rgba(201,168,76,0.12)' : 'transparent',
                  color: tab === t.id ? '#C9A84C' : 'rgba(255,255,255,0.35)',
                  border: tab === t.id ? '1px solid rgba(201,168,76,0.25)' : '1px solid transparent',
                }}>
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Deposit instructions */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/6 overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.01)' }}>
              <div className="px-5 py-4 border-b border-white/5">
                <p className="text-sm font-semibold text-foreground">
                  {tab === 'wire' ? 'Wire Transfer Details' : 'Crypto Deposit Addresses'}
                </p>
                <p className="text-xs text-foreground/35 mt-0.5">
                  {tab === 'wire'
                    ? 'Use these details to send a bank wire transfer to your account'
                    : 'Send cryptocurrency to your personal deposit addresses below'}
                </p>
              </div>

              {tab === 'wire' ? (
                <div className="divide-y divide-white/[0.04]">
                  {wireDetails.map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between px-5 py-3.5">
                      <span className="text-xs text-foreground/35 w-32 shrink-0">{label}</span>
                      <span className="text-xs font-mono text-foreground/70 flex-1 text-right mr-2">{value}</span>
                      <CopyButton text={value} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {cryptoAddresses.map(({ currency, address, network }) => (
                    <div key={currency} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-foreground">{currency}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400">{network}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white/3 rounded-xl px-3 py-2.5">
                        <span className="text-xs font-mono text-foreground/50 flex-1 truncate">{address}</span>
                        <CopyButton text={address} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="px-5 py-4 border-t border-white/5 bg-amber-500/4">
                <p className="text-xs text-amber-400/80">
                  {tab === 'wire'
                    ? 'Wire transfers typically take 1–3 business days. Always include your reference number.'
                    : 'Only send the matching cryptocurrency to each address. Sending wrong assets will result in permanent loss.'}
                </p>
              </div>
            </motion.div>

            {/* Deposit history */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="rounded-2xl border border-white/6 overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.01)' }}>
              <div className="px-5 py-4 border-b border-white/5">
                <p className="text-sm font-semibold text-foreground">Deposit History</p>
                <p className="text-xs text-foreground/35 mt-0.5">{deposits.length} deposits on record</p>
              </div>
              {txLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 size={18} className="animate-spin text-foreground/25" /></div>
              ) : deposits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-foreground/20">
                  <Activity size={22} />
                  <p className="text-xs">No deposits yet</p>
                </div>
              ) : deposits.slice(0, 15).map((tx, i) => (
                <div key={tx.id}
                  className={`flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.025] transition-colors ${i < Math.min(deposits.length, 15) - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.22)' }}>
                    <ArrowDownLeft size={13} className="text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground/80 truncate">{tx.description || 'Deposit'}</p>
                    <p className="text-[10px] text-foreground/30">
                      {new Date(tx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <PV
                    value={`+${fmt(Math.abs(Number(tx.amount ?? 0)), tx.currency ?? 'USD')}`}
                    privacy={privacy}
                    className="text-xs font-semibold text-emerald-400 tabular-nums"
                  />
                </div>
              ))}
            </motion.div>
          </div>
        </main>
      </div>
    </>
  );
}
