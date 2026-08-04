/**
 * /dashboard/wallets — Wallet Overview
 *
 * This account model is a single fiat balance in one primary currency plus
 * admin-configured crypto deposit addresses (see wallet-overview/GET.ts) —
 * there is no multi-currency sub-wallet ledger, no banking/trading/
 * investment split, and no internal-transfer-between-wallets or portfolio
 * P&L endpoint anywhere in this codebase. This page shows only what the
 * backend actually tracks, with quick links to the real Transfers,
 * Deposits, and Trading Hub pages for everything else.
 */
import { useState, useEffect, useCallback } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft, Wallet, Eye, EyeOff, ArrowDownLeft, ArrowUpRight,
  Send, Loader2, Activity, ArrowRightLeft, LineChart,
  ChevronRight, Bitcoin,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';

interface WalletOverview {
  balance: number;
  currency: string;
  depositAddresses: Array<{ symbol: string; name: string; network: string; address: string }>;
  recentTransactions: Tx[];
  recentTransactionsTotal: number;
}

interface Tx {
  id: string; type: string; status: string; amount: number;
  currency: string; description: string; reference: string; createdAt: string;
}

function fmt(amount: number, currency: string): string {
  try { return amount.toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

function isCredit(type: string): boolean {
  return ['deposit', 'manual_credit', 'refund', 'crypto_sell'].includes(type);
}

function PV({ value, privacy, className = '' }: { value: string; privacy: boolean; className?: string }) {
  return privacy ? <span className={`font-mono tracking-widest select-none ${className}`}>••••••</span> : <span className={className}>{value}</span>;
}

export default function WalletsPage() {
  const { customer, token, loading } = useCustomerAuth();
  const navigate = useNavigate();

  const [privacy, setPrivacy] = useState(false);
  const [overview, setOverview] = useState<WalletOverview | null>(null);
  const [ovLoading, setOvLoading] = useState(true);
  const [ovError, setOvError] = useState('');

  useEffect(() => { setPrivacy(localStorage.getItem('cgc_privacy_mode') === 'true'); }, []);
  useEffect(() => {
    if (!loading && !customer) navigate('/login?reason=session_expired', { replace: true });
  }, [customer, loading, navigate]);

  const loadOverview = useCallback(async () => {
    if (!token) return;
    setOvLoading(true); setOvError('');
    try {
      const res = await fetch('/api/users/wallet-overview', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load wallet overview');
      setOverview(await res.json());
    } catch (err) {
      setOvError(err instanceof Error ? err.message : 'Failed to load wallet overview');
    } finally {
      setOvLoading(false);
    }
  }, [token]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  if (loading || !customer) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  const addresses = overview?.depositAddresses.filter(a => a.address) ?? [];

  return (
    <>
      <Helmet>
        <title>Wallet — City Gate Capital</title>
        <meta name="description" content="View your City Gate Capital balance, deposit addresses, and recent activity." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/wallets" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
            <Link to="/dashboard" className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/50 hover:text-foreground transition-colors">
              <ArrowLeft size={15} />
            </Link>
            <div className="flex items-center gap-2.5">
              <Wallet size={16} style={{ color: '#C9A84C' }} />
              <h1 className="text-sm font-semibold text-foreground">Wallet</h1>
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

        <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-6">

          {ovError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{ovError}</div>
          )}

          {/* Balance hero */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-white/8 p-6"
            style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(10,10,10,0.95) 60%)' }}>
            <p className="text-xs text-foreground/35 uppercase tracking-[0.12em] mb-2">Total Balance</p>
            {ovLoading ? (
              <div className="h-10 flex items-center"><Loader2 size={20} className="animate-spin text-foreground/25" /></div>
            ) : (
              <PV value={fmt(overview?.balance ?? 0, overview?.currency ?? 'USD')} privacy={privacy} className="text-3xl font-bold text-foreground" />
            )}

            <div className="mt-6 grid grid-cols-3 gap-2">
              <Link to="/dashboard/deposits" className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                <ArrowDownLeft size={16} className="text-emerald-400" />
                <span className="text-[11px] font-semibold text-foreground/70">Deposit</span>
              </Link>
              <Link to="/dashboard/transfers" className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                <Send size={16} style={{ color: '#C9A84C' }} />
                <span className="text-[11px] font-semibold text-foreground/70">Transfer</span>
              </Link>
              <Link to="/dashboard/trading" className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                <LineChart size={16} className="text-blue-400" />
                <span className="text-[11px] font-semibold text-foreground/70">Trade</span>
              </Link>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deposit addresses */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="rounded-2xl border border-white/6 overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.01)' }}>
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Crypto Deposit Addresses</p>
                  <p className="text-xs text-foreground/35 mt-0.5">{addresses.length} available</p>
                </div>
                <Link to="/dashboard/deposits" className="text-xs text-primary hover:underline flex items-center gap-1">
                  View all <ChevronRight size={11} />
                </Link>
              </div>
              {ovLoading ? (
                <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-foreground/25" /></div>
              ) : addresses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-foreground/20">
                  <Bitcoin size={20} />
                  <p className="text-xs">No deposit addresses configured</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {addresses.slice(0, 4).map(a => (
                    <div key={a.symbol} className="flex items-center justify-between px-5 py-3">
                      <span className="text-xs font-semibold text-foreground/80">{a.symbol}</span>
                      <span className="text-[10px] text-foreground/30">{a.network}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Recent activity */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
              className="rounded-2xl border border-white/6 overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.01)' }}>
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Recent Activity</p>
                <Link to="/dashboard/transfers" className="text-xs text-primary hover:underline flex items-center gap-1">
                  View all <ChevronRight size={11} />
                </Link>
              </div>
              {ovLoading ? (
                <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-foreground/25" /></div>
              ) : !overview?.recentTransactions?.length ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-foreground/20">
                  <Activity size={20} />
                  <p className="text-xs">No transactions yet</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {overview.recentTransactions.map(tx => {
                    const positive = isCredit(tx.type);
                    return (
                      <div key={tx.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: positive ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${positive ? 'rgba(16,185,129,0.22)' : 'rgba(255,255,255,0.08)'}` }}>
                          {positive ? <ArrowDownLeft size={13} className="text-emerald-400" /> : <ArrowUpRight size={13} className="text-foreground/50" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground/80 truncate">{tx.description || tx.type}</p>
                          <p className="text-[10px] text-foreground/30">{new Date(tx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                        </div>
                        <PV
                          value={`${positive ? '+' : '−'}${fmt(Math.abs(Number(tx.amount ?? 0)), tx.currency ?? 'USD')}`}
                          privacy={privacy}
                          className={`text-xs font-semibold tabular-nums shrink-0 ${positive ? 'text-emerald-400' : 'text-foreground/60'}`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>

          <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.015]">
            <ArrowRightLeft size={13} className="text-foreground/20 mt-0.5 shrink-0" />
            <p className="text-[10px] text-foreground/25 leading-relaxed">
              Need to move funds between currencies or convert crypto? Use the Trading Hub for live conversions.
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
