/**
 * /dashboard/analytics — Enhanced Customer Portfolio Analytics
 * Improved: net worth trend line, spending heatmap, category drill-down,
 * top merchants, day-of-week breakdown, period comparison.
 */
import { Helmet } from '@dr.pogodin/react-helmet';
import { fmtCurrency as fmtUsd, fmtCompactUsd } from '@/lib/fmt';
import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  BarChart2, ArrowLeft, TrendingUp, TrendingDown,
  ArrowDownLeft, ArrowUpRight, Send, DollarSign,
  Loader2, Calendar, Activity, Eye, EyeOff,
  PieChart, Zap, Clock,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';
import { usePrivacy } from '@/lib/usePrivacy';

interface Tx {
  id: string; type: string; status: string; amount: number;
  currency: string; description: string; reference: string; createdAt: string;
}
interface CurrencyBalance { currency: string; amount: number; usdEquivalent: number; }
interface BalanceData { primaryCurrency: string; primaryAmount: number; totalUsd: number; currencies: CurrencyBalance[]; }

const CURRENCY_COLORS: Record<string, string> = {
  USD:'#C9A84C', EUR:'#627EEA', GBP:'#10B981', BTC:'#F7931A',
  ETH:'#627EEA', USDT:'#26A17B', BNB:'#F3BA2F', SOL:'#9945FF',
  CHF:'#EF4444', CAD:'#FF6B35', AUD:'#00B4D8', NGN:'#4ECDC4',
};
const SPEND_COLORS = ['#C9A84C','#627EEA','#10B981','#EF4444','#9945FF','#F7931A','#EC4899'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function isCredit(type: string): boolean {
  return ['deposit','manual_credit','refund','crypto_sell'].includes(type);
}
// Balance summaries never show a leading '+' on positive amounts.
const fmtCompact = (n: number): string => fmtCompactUsd(n, false);

type Period = '7d'|'30d'|'90d'|'1y';
const PERIOD_DAYS: Record<Period,number> = { '7d':7,'30d':30,'90d':90,'1y':365 };

function PV({ value, privacy, className='' }: { value: string; privacy: boolean; className?: string }) {
  return privacy
    ? <span className={`font-mono tracking-widest select-none ${className}`}>••••••</span>
    : <span className={className}>{value}</span>;
}

// Mini sparkline SVG
function Sparkline({ values, color, h=40, w=120 }: { values: number[]; color: string; h?: number; w?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const pts = values.map((v,i) => `${(i/(values.length-1))*w},${h-((v-min)/range)*(h-4)-2}`);
  const first = pts[0].split(','), last = pts[pts.length-1].split(',');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="overflow-visible">
      <defs>
        <linearGradient id={`sg${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M${first[0]},${h} L${pts.join(' ')} L${last[0]},${h} Z`} fill={`url(#sg${color.replace('#','')})`} />
      <polyline points={pts.join(' ')} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function DashboardAnalyticsPage() {
  const { token } = useCustomerAuth();
  const { privacy, toggle: togglePrivacy } = usePrivacy();
  const [txList,      setTxList]      = useState<Tx[]>([]);
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [period,      setPeriod]      = useState<Period>('30d');
  const [activeTab,   setActiveTab]   = useState<'overview'|'spending'|'allocation'|'heatmap'>('overview');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch('/api/users/transactions?limit=1000', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch('/api/users/balance',                 { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
    ]).then(([txData, balData]) => {
      if (txData?.transactions) setTxList(txData.transactions);
      if (balData) setBalanceData(balData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  const filteredTx = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - PERIOD_DAYS[period]);
    return txList.filter(t => new Date(t.createdAt) >= cutoff);
  }, [txList, period]);

  const stats = useMemo(() => {
    let totalIn = 0, totalOut = 0;
    for (const tx of filteredTx) {
      const amt = Number(tx.amount ?? 0);
      if (isCredit(tx.type)) totalIn += amt; else totalOut += amt;
    }
    return { totalIn, totalOut, net: totalIn - totalOut, count: filteredTx.length };
  }, [filteredTx]);

  // Net worth sparkline (running balance over all time)
  const netWorthSparkline = useMemo(() => {
    if (txList.length === 0) return [];
    const sorted = [...txList].reverse();
    let running = 0;
    const pts: number[] = [];
    for (const tx of sorted) {
      const amt = Number(tx.amount ?? 0);
      if (isCredit(tx.type)) running += amt; else running -= amt;
      pts.push(Math.max(0, running));
    }
    if (pts.length <= 40) return pts;
    const step = pts.length / 40;
    return Array.from({ length: 40 }, (_, i) => pts[Math.floor(i * step)]);
  }, [txList]);

  const netWorthTrend = useMemo(() => {
    if (netWorthSparkline.length < 2) return 0;
    const first = netWorthSparkline[0], last = netWorthSparkline[netWorthSparkline.length - 1];
    if (!first) return 0;
    return ((last - first) / first) * 100;
  }, [netWorthSparkline]);

  // Monthly bar chart (last 6 months)
  const monthlyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d   = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const monthTx = txList.filter(t => { const dt = new Date(t.createdAt); return dt >= d && dt < end; });
      const inflow  = monthTx.filter(t => isCredit(t.type)).reduce((s,t) => s + Number(t.amount ?? 0), 0);
      const outflow = monthTx.filter(t => !isCredit(t.type)).reduce((s,t) => s + Number(t.amount ?? 0), 0);
      return { label: MONTHS[d.getMonth()], inflow, outflow };
    });
  }, [txList]);
  const maxBar = useMemo(() => Math.max(...monthlyData.flatMap(m => [m.inflow, m.outflow]), 1), [monthlyData]);

  // Spending by category
  const spendByType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of filteredTx) {
      if (!isCredit(tx.type)) {
        const key = tx.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        map[key] = (map[key] ?? 0) + Number(tx.amount ?? 0);
      }
    }
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0, 7);
  }, [filteredTx]);
  const totalSpend = spendByType.reduce((s,[,v]) => s + v, 0) || 1;

  // Day-of-week heatmap
  const dowData = useMemo(() => {
    const counts = Array(7).fill(0);
    const amounts = Array(7).fill(0);
    for (const tx of filteredTx) {
      const dow = new Date(tx.createdAt).getDay();
      counts[dow]++;
      amounts[dow] += Number(tx.amount ?? 0);
    }
    const maxAmt = Math.max(...amounts, 1);
    return DAYS.map((label, i) => ({ label, count: counts[i], amount: amounts[i], pct: amounts[i] / maxAmt }));
  }, [filteredTx]);

  // Hour-of-day heatmap
  const hourData = useMemo(() => {
    const amounts = Array(24).fill(0);
    for (const tx of filteredTx) {
      const h = new Date(tx.createdAt).getHours();
      amounts[h] += Number(tx.amount ?? 0);
    }
    const maxAmt = Math.max(...amounts, 1);
    return amounts.map((amount, h) => ({ h, amount, pct: amount / maxAmt }));
  }, [filteredTx]);

  // Top descriptions
  const topDescriptions = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    for (const tx of filteredTx) {
      if (!isCredit(tx.type) && tx.description) {
        const key = tx.description;
        if (!map[key]) map[key] = { count: 0, total: 0 };
        map[key].count++;
        map[key].total += Number(tx.amount ?? 0);
      }
    }
    return Object.entries(map).sort((a,b) => b[1].total - a[1].total).slice(0, 5);
  }, [filteredTx]);

  return (
    <>
      <Helmet>
        <title>Analytics — City Gate Capital</title>
        <meta name="description" content="View your City Gate Capital portfolio analytics: cash flow, spending breakdown, and currency allocation." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/analytics" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <h1 className="sr-only">Portfolio Analytics</h1>
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link to="/dashboard" className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors">
              <ArrowLeft size={15} />
            </Link>
            <div className="flex items-center gap-2">
              <BarChart2 size={15} style={{ color: '#EC4899' }} />
              <span className="text-sm font-semibold text-foreground">Analytics</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={togglePrivacy}
                className="w-8 h-8 rounded-xl border flex items-center justify-center transition-all"
                style={{ background: privacy ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', borderColor: privacy ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.08)', color: privacy ? '#C9A84C' : 'rgba(255,255,255,0.4)' }}>
                {privacy ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              {/* Period selector */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/6">
                {(['7d','30d','90d','1y'] as Period[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                    style={{ background: period === p ? 'rgba(236,72,153,0.15)' : 'transparent', color: period === p ? '#EC4899' : 'rgba(255,255,255,0.3)' }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-foreground/20" /></div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">

            {/* ── Net worth trend ─────────────────────────────────────── */}
            {netWorthSparkline.length > 1 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-3xl border border-white/6"
                style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.05) 0%, rgba(10,10,10,0.8) 100%)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[10px] text-foreground/35 uppercase tracking-wider">Net Worth Trend</p>
                    <PV value={fmtUsd(balanceData?.totalUsd ?? 0)} privacy={privacy} className="text-2xl font-bold text-foreground mt-0.5" />
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${netWorthTrend >= 0 ? 'bg-emerald-500/12 text-emerald-400' : 'bg-red-500/12 text-red-400'}`}>
                    {netWorthTrend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {netWorthTrend >= 0 ? '+' : ''}{netWorthTrend.toFixed(1)}%
                  </div>
                </div>
                <Sparkline values={netWorthSparkline} color="#C9A84C" h={56} w={500} />
              </motion.div>
            )}

            {/* ── Summary KPIs ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total In',     value: fmtCompact(stats.totalIn),  icon: ArrowDownLeft, color: '#10B981' },
                { label: 'Total Out',    value: fmtCompact(stats.totalOut), icon: ArrowUpRight,  color: '#EF4444' },
                { label: 'Net Flow',     value: fmtCompact(stats.net),      icon: stats.net >= 0 ? TrendingUp : TrendingDown, color: stats.net >= 0 ? '#10B981' : '#EF4444' },
                { label: 'Transactions', value: String(stats.count),        icon: Activity,      color: '#C9A84C' },
              ].map(({ label, value, icon: Icon, color }) => (
                <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-2 p-4 rounded-2xl border border-white/6"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                    style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                    <Icon size={13} style={{ color }} />
                  </div>
                  <div>
                    <p className="text-[10px] text-foreground/30">{label}</p>
                    <PV value={value} privacy={privacy} className="text-sm font-bold text-foreground/90 tabular-nums" />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* ── Tab navigation ──────────────────────────────────────── */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/6">
              {([
                { id: 'overview',    label: 'Cash Flow',  icon: BarChart2 },
                { id: 'spending',    label: 'Spending',   icon: Send },
                { id: 'allocation',  label: 'Allocation', icon: PieChart },
                { id: 'heatmap',     label: 'Activity',   icon: Zap },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold transition-all"
                  style={{
                    background: activeTab === id ? 'rgba(236,72,153,0.12)' : 'transparent',
                    color: activeTab === id ? '#EC4899' : 'rgba(255,255,255,0.3)',
                  }}>
                  <Icon size={11} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* ── Overview: Monthly bar chart ─────────────────────────── */}
            {activeTab === 'overview' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="p-5 rounded-3xl border border-white/6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-2 mb-5">
                  <Calendar size={13} className="text-foreground/30" />
                  <p className="text-xs font-semibold text-foreground/60">Monthly Cash Flow</p>
                  <div className="ml-auto flex items-center gap-3">
                    {[{ color: '#10B981', label: 'In' }, { color: '#EF4444', label: 'Out' }].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                        <span className="text-[10px] text-foreground/30">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-end gap-2 h-32">
                  {monthlyData.map(({ label, inflow, outflow }) => (
                    <div key={label} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end gap-0.5 h-24">
                        <div className="flex-1 rounded-t-md transition-all hover:opacity-80"
                          style={{ height: `${(inflow/maxBar)*100}%`, background: 'rgba(16,185,129,0.55)', minHeight: inflow > 0 ? 2 : 0 }}
                          title={`In: ${fmtCompact(inflow)}`} />
                        <div className="flex-1 rounded-t-md transition-all hover:opacity-80"
                          style={{ height: `${(outflow/maxBar)*100}%`, background: 'rgba(239,68,68,0.55)', minHeight: outflow > 0 ? 2 : 0 }}
                          title={`Out: ${fmtCompact(outflow)}`} />
                      </div>
                      <p className="text-[9px] text-foreground/25">{label}</p>
                    </div>
                  ))}
                </div>
                {/* Net per month */}
                <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-6 gap-2">
                  {monthlyData.map(({ label, inflow, outflow }) => {
                    const net = inflow - outflow;
                    return (
                      <div key={label} className="flex flex-col items-center gap-0.5">
                        <p className="text-[9px] text-foreground/25">{label}</p>
                        <PV value={fmtCompact(net)} privacy={privacy}
                          className={`text-[10px] font-semibold tabular-nums ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── Spending breakdown ──────────────────────────────────── */}
            {activeTab === 'spending' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
                {spendByType.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-foreground/20">
                    <Send size={24} /><p className="text-xs">No spending data in this period</p>
                  </div>
                ) : (
                  <>
                    <div className="p-5 rounded-3xl border border-white/6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <p className="text-xs font-semibold text-foreground/60 mb-4">Spending by Type</p>
                      {/* Donut-style allocation bar */}
                      <div className="flex h-3 rounded-full overflow-hidden gap-px mb-5">
                        {spendByType.map(([type, amount], i) => (
                          <div key={type} className="h-full rounded-full transition-all"
                            style={{ width: `${(amount/totalSpend)*100}%`, background: SPEND_COLORS[i] ?? '#888' }}
                            title={`${type}: ${fmtCompact(amount)}`} />
                        ))}
                      </div>
                      <div className="flex flex-col gap-3">
                        {spendByType.map(([type, amount], i) => (
                          <div key={type} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SPEND_COLORS[i] ?? '#888' }} />
                                <span className="text-xs text-foreground/60">{type}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <PV value={fmtCompact(amount)} privacy={privacy} className="text-xs font-semibold text-foreground/80 tabular-nums" />
                                <span className="text-[10px] text-foreground/25 w-8 text-right">{((amount/totalSpend)*100).toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${(amount/totalSpend)*100}%` }}
                                transition={{ duration: 0.6, delay: i * 0.08 }}
                                className="h-full rounded-full" style={{ background: SPEND_COLORS[i] ?? '#888' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top descriptions */}
                    {topDescriptions.length > 0 && (
                      <div className="p-5 rounded-3xl border border-white/6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <p className="text-xs font-semibold text-foreground/60 mb-3">Top Transactions</p>
                        <div className="flex flex-col gap-2">
                          {topDescriptions.map(([desc, { count, total }]) => (
                            <div key={desc} className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-foreground/70 truncate">{desc}</p>
                                <p className="text-[10px] text-foreground/30">{count} transaction{count !== 1 ? 's' : ''}</p>
                              </div>
                              <PV value={fmtCompact(total)} privacy={privacy} className="text-xs font-semibold text-foreground/60 tabular-nums shrink-0 ml-3" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* ── Portfolio allocation ────────────────────────────────── */}
            {activeTab === 'allocation' && balanceData && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="p-5 rounded-3xl border border-white/6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign size={13} className="text-foreground/30" />
                  <p className="text-xs font-semibold text-foreground/60">Portfolio Allocation</p>
                  <PV value={`${fmtUsd(balanceData.totalUsd)} total`} privacy={privacy} className="ml-auto text-[10px] text-foreground/25" />
                </div>
                <div className="flex h-3 rounded-full overflow-hidden gap-px mb-5">
                  {balanceData.currencies.slice(0, 8).map(c => (
                    <div key={c.currency} className="h-full rounded-full"
                      style={{ width: `${(c.usdEquivalent/balanceData.totalUsd)*100}%`, background: CURRENCY_COLORS[c.currency] ?? '#888' }} />
                  ))}
                </div>
                <div className="flex flex-col gap-3">
                  {balanceData.currencies.slice(0, 8).map(c => (
                    <div key={c.currency} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: CURRENCY_COLORS[c.currency] ?? '#888' }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-foreground/60">{c.currency}</span>
                          <div className="flex items-center gap-2">
                            <PV value={fmtCompact(c.usdEquivalent)} privacy={privacy} className="text-xs font-semibold text-foreground/70 tabular-nums" />
                            <span className="text-[10px] text-foreground/25 w-8 text-right">{((c.usdEquivalent/balanceData.totalUsd)*100).toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(c.usdEquivalent/balanceData.totalUsd)*100}%` }}
                            transition={{ duration: 0.6 }} className="h-full rounded-full"
                            style={{ background: CURRENCY_COLORS[c.currency] ?? '#888' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Activity heatmap ────────────────────────────────────── */}
            {activeTab === 'heatmap' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
                {/* Day of week */}
                <div className="p-5 rounded-3xl border border-white/6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar size={13} className="text-foreground/30" />
                    <p className="text-xs font-semibold text-foreground/60">Activity by Day of Week</p>
                  </div>
                  <div className="flex gap-2">
                    {dowData.map(({ label, count, amount, pct }) => (
                      <div key={label} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full h-20 rounded-xl flex items-end justify-center pb-1 transition-all"
                          style={{ background: `rgba(201,168,76,${0.05 + pct * 0.45})` }}
                          title={`${label}: ${count} txns, ${fmtCompact(amount)}`}>
                          <span className="text-[8px] text-foreground/40 font-mono">{count}</span>
                        </div>
                        <span className="text-[9px] text-foreground/30">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hour of day */}
                <div className="p-5 rounded-3xl border border-white/6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Clock size={13} className="text-foreground/30" />
                    <p className="text-xs font-semibold text-foreground/60">Activity by Hour</p>
                  </div>
                  <div className="flex gap-0.5 items-end h-16">
                    {hourData.map(({ h, amount, pct }) => (
                      <div key={h} className="flex-1 rounded-t-sm transition-all hover:opacity-80"
                        style={{ height: `${Math.max(pct * 100, 4)}%`, background: `rgba(236,72,153,${0.15 + pct * 0.6})` }}
                        title={`${h}:00 — ${fmtCompact(amount)}`} />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-foreground/20">12am</span>
                    <span className="text-[9px] text-foreground/20">6am</span>
                    <span className="text-[9px] text-foreground/20">12pm</span>
                    <span className="text-[9px] text-foreground/20">6pm</span>
                    <span className="text-[9px] text-foreground/20">11pm</span>
                  </div>
                </div>
              </motion.div>
            )}

            {filteredTx.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <BarChart2 size={24} className="text-foreground/15" />
                <p className="text-xs text-foreground/30">No transactions in this period</p>
              </div>
            )}

            <Link to="/dashboard" className="flex items-center gap-1.5 text-xs text-foreground/30 hover:text-foreground/60 transition-colors w-fit">
              <ArrowLeft size={12} />
              Back to Dashboard
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
