/**
 * /dashboard/deposits — Crypto deposit addresses, claim form & history
 *
 * There is no bank-wire account (IBAN/SWIFT/etc.) configured anywhere in
 * this codebase — only admin-configured crypto deposit addresses
 * (walletStore.ts) exist. Showing fabricated wire details or invented
 * crypto addresses would risk real users sending funds to an address
 * nobody controls, so wire deposits are routed to Support instead of
 * displaying made-up bank details.
 */
import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft, ArrowDownLeft, Copy, Check, Bitcoin, Eye, EyeOff,
  Loader2, Activity, AlertCircle, CheckCircle2, MessageCircle,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';

interface Tx {
  id: string; type: string; status: string; amount: number;
  currency: string; description: string; reference: string; createdAt: string;
}

interface DepositAddress {
  symbol: string; name: string; network: string; address: string;
  minDeposit: number; confirmations: number;
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
  const [addresses, setAddresses] = useState<DepositAddress[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  const [claimSymbol, setClaimSymbol] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimTxHash, setClaimTxHash] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => { setPrivacy(localStorage.getItem('cgc_privacy_mode') === 'true'); }, []);
  useEffect(() => {
    if (!loading && !customer) navigate('/login?reason=session_expired', { replace: true });
  }, [customer, loading, navigate]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch('/api/users/transactions?limit=200', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch('/api/users/wallet-overview', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
    ]).then(([txData, walletData]) => {
      if (txData?.transactions) {
        setDeposits(txData.transactions.filter((t: Tx) => ['deposit', 'manual_credit', 'refund'].includes(t.type)));
      }
      if (walletData?.depositAddresses) {
        const addrs = walletData.depositAddresses.filter((w: DepositAddress) => w.address);
        setAddresses(addrs);
        if (addrs.length > 0) setClaimSymbol(addrs[0].symbol);
      }
    }).catch(() => {}).finally(() => setTxLoading(false));
  }, [token]);

  async function submitClaim() {
    if (!token || !claimSymbol || claiming) return;
    const amt = parseFloat(claimAmount);
    if (!amt || amt <= 0) { setClaimMsg({ text: 'Enter a valid amount', ok: false }); return; }
    setClaiming(true); setClaimMsg(null);
    try {
      const res = await fetch('/api/users/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbol: claimSymbol, amount: amt, txHash: claimTxHash || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setClaimMsg({ text: 'Deposit submitted — pending admin review.', ok: true });
        setClaimAmount(''); setClaimTxHash('');
      } else {
        setClaimMsg({ text: data.error ?? 'Failed to submit deposit', ok: false });
      }
    } catch {
      setClaimMsg({ text: 'Network error. Please try again.', ok: false });
    } finally {
      setClaiming(false);
    }
  }

  if (loading || !customer) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <>
      <Helmet>
        <title>Deposits — City Gate Capital</title>
        <meta name="description" content="Deposit funds into your City Gate Capital account via cryptocurrency." />
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

          <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.015] mb-6">
            <MessageCircle size={13} className="text-foreground/20 mt-0.5 shrink-0" />
            <p className="text-[10px] text-foreground/25 leading-relaxed">
              Bank wire deposits are arranged individually — <Link to="/dashboard/support" className="text-primary hover:underline">contact support</Link> for wire instructions. Cryptocurrency deposits below are self-service.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/6 overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.01)' }}>
              <div className="px-5 py-4 border-b border-white/5">
                <p className="text-sm font-semibold text-foreground">Crypto Deposit Addresses</p>
                <p className="text-xs text-foreground/35 mt-0.5">Send cryptocurrency to your account's deposit addresses below</p>
              </div>

              {txLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 size={18} className="animate-spin text-foreground/25" /></div>
              ) : addresses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-foreground/20 px-5 text-center">
                  <Bitcoin size={22} />
                  <p className="text-xs">No deposit addresses are configured yet. Contact support for assistance.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {addresses.map(({ symbol, name, network, address, minDeposit }) => (
                    <div key={symbol} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-foreground">{symbol} <span className="text-xs font-normal text-foreground/30">{name}</span></p>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400">{network}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white/3 rounded-xl px-3 py-2.5">
                        <span className="text-xs font-mono text-foreground/50 flex-1 truncate">{address}</span>
                        <CopyButton text={address} />
                      </div>
                      <p className="text-[10px] text-foreground/25 mt-1.5">Minimum deposit: {minDeposit} {symbol}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="px-5 py-4 border-t border-white/5 bg-amber-500/4">
                <p className="text-xs text-amber-400/80">
                  Only send the matching cryptocurrency to each address. Sending the wrong asset will result in permanent loss.
                </p>
              </div>
            </motion.div>

            <div className="flex flex-col gap-6">
              {/* Claim form */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
                className="rounded-2xl border border-white/6 overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.01)' }}>
                <div className="px-5 py-4 border-b border-white/5">
                  <p className="text-sm font-semibold text-foreground">Already sent a deposit?</p>
                  <p className="text-xs text-foreground/35 mt-0.5">Let us know so we can confirm and credit it</p>
                </div>
                <div className="p-5 flex flex-col gap-3">
                  {claimMsg && (
                    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs ${claimMsg.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                      {claimMsg.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                      {claimMsg.text}
                    </div>
                  )}
                  <select value={claimSymbol} onChange={e => setClaimSymbol(e.target.value)}
                    className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-xs text-foreground/80 focus:outline-none cursor-pointer appearance-none">
                    {addresses.map(a => <option key={a.symbol} value={a.symbol} style={{ background: '#0a0a0a' }}>{a.symbol}</option>)}
                  </select>
                  <input value={claimAmount} onChange={e => setClaimAmount(e.target.value)} type="number" min="0" step="any"
                    placeholder="Amount sent"
                    className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-xs text-foreground/80 placeholder-foreground/20 focus:outline-none focus:border-primary/40" />
                  <input value={claimTxHash} onChange={e => setClaimTxHash(e.target.value)}
                    placeholder="Transaction hash (optional)"
                    className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-xs font-mono text-foreground/80 placeholder-foreground/20 focus:outline-none focus:border-primary/40" />
                  <button onClick={submitClaim} disabled={claiming || addresses.length === 0}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                    style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.25)' }}>
                    {claiming ? <Loader2 size={13} className="animate-spin" /> : null}
                    Notify Us
                  </button>
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
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-foreground/30">
                          {new Date(tx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-foreground/30">{tx.status}</span>
                      </div>
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
          </div>
        </main>
      </div>
    </>
  );
}
