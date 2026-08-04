import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Users, CreditCard, TrendingUp, TrendingDown,
  Bitcoin, DollarSign, HeadphonesIcon, CheckCircle, Clock,
  ArrowUpRight, ArrowDownRight, RefreshCw,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';

interface Stats {
  kpis: Record<string, { value: number; change: number; trend: string }>;
  dailyRevenue: { date: string; revenue: number; transactions: number; newUsers: number }[];
  cryptoBalances: { symbol: string; name: string; balance: number; usd: number; change: number }[];
  recentActivity: { id: string; type: string; user: string; amount: number; currency: string; ts: string; status: string }[];
}

function fmt(n: number | null | undefined, prefix = '') {
  const safe = Number(n ?? 0);
  if (safe >= 1_000_000) return `${prefix}${(safe / 1_000_000).toFixed(1)}M`;
  if (safe >= 1_000)     return `${prefix}${(safe / 1_000).toFixed(1)}k`;
  return `${prefix}${safe.toLocaleString()}`;
}

function safeMoney(value: number | null | undefined): string {
  return Number(value ?? 0).toLocaleString();
}



const TYPE_COLORS: Record<string, string> = {
  deposit: '#10B981', withdrawal: '#EF4444', transfer: '#627EEA',
  crypto_buy: '#F59E0B', crypto_sell: '#8B5CF6', fee: '#6B7280', refund: '#06B6D4',
  kyc_approved: '#10B981', account_created: '#C9A84C', fraud_alert: '#EF4444',
};

export default function AdminDashboard() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch('/api/admin/stats', { headers: authHeaders() });
      if (res.ok) setStats(await res.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => fetchStats(true), 30000);
    return () => clearInterval(id);
  }, [fetchStats]);

  const kpiCards = stats ? [
    { label: 'Total Users',          value: fmt(stats.kpis.totalUsers.value),          change: stats.kpis.totalUsers.change,          icon: Users,           color: '#C9A84C', sub: 'Registered accounts' },
    { label: 'Active Accounts',      value: fmt(stats.kpis.activeAccounts.value),      change: stats.kpis.activeAccounts.change,      icon: CheckCircle,     color: '#10B981', sub: 'Currently active' },
    { label: 'Pending KYC',          value: fmt(stats.kpis.pendingVerifications.value), change: stats.kpis.pendingVerifications.change, icon: Clock,           color: '#F59E0B', sub: 'Awaiting review' },
    { label: 'Total Deposits',       value: fmt(stats.kpis.totalDeposits.value, '$'),  change: stats.kpis.totalDeposits.change,       icon: TrendingUp,      color: '#10B981', sub: 'All time' },
    { label: 'Total Withdrawals',    value: fmt(stats.kpis.totalWithdrawals.value, '$'), change: stats.kpis.totalWithdrawals.change,  icon: TrendingDown,    color: '#EF4444', sub: 'All time' },
    { label: 'Crypto AUM',           value: fmt(stats.kpis.cryptoAUM.value, '$'),      change: stats.kpis.cryptoAUM.change,           icon: Bitcoin,         color: '#F59E0B', sub: 'Assets under management' },
    { label: 'Monthly Revenue',      value: fmt(stats.kpis.monthlyRevenue.value, '$'), change: stats.kpis.monthlyRevenue.change,      icon: DollarSign,      color: '#C9A84C', sub: 'This month' },
    { label: 'Open Tickets',         value: fmt(stats.kpis.openTickets.value),         change: stats.kpis.openTickets.change,         icon: HeadphonesIcon,  color: '#627EEA', sub: 'Support queue' },
  ] : [];

  const revenueData = stats?.dailyRevenue.slice(-14).map(d => d.revenue) ?? [];

  return (
    <>
      <Helmet>
        <title>Dashboard — City Gate Capital Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <AdminLayout title="Dashboard">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white text-xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>Overview</h1>
            <p className="text-white/30 text-sm mt-0.5">Real-time platform metrics</p>
          </div>
          <button onClick={() => fetchStats(true)} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/50 hover:text-white text-sm transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {kpiCards.map((card, i) => (
                <motion.div key={card.label}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-colors group"
                  style={{ background: 'rgba(255,255,255,0.025)' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: `${card.color}15` }}>
                      <card.icon size={16} style={{ color: card.color }} />
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-semibold ${card.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {card.change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {Math.abs(card.change)}%
                    </div>
                  </div>
                  <p className="text-white text-xl font-bold leading-none mb-1">{card.value}</p>
                  <p className="text-white/30 text-xs">{card.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid lg:grid-cols-3 gap-4 mb-6">
              {/* Revenue chart */}
              <div className="lg:col-span-2 rounded-2xl p-5 border border-white/5" style={{ background: 'rgba(255,255,255,0.025)' }}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-white font-semibold text-sm">Revenue (14 days)</h3>
                    <p className="text-white/30 text-xs mt-0.5">Daily platform revenue</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">{fmt(revenueData.reduce((a, b) => a + b, 0), '$')}</p>
                  </div>
                </div>
                {/* Bar chart */}
                <div className="flex items-end gap-1 h-32">
                  {stats?.dailyRevenue.slice(-14).map((d, i) => {
                    const maxRev = Math.max(...(stats?.dailyRevenue.slice(-14).map(x => x.revenue) ?? [1]));
                    const pct = (d.revenue / maxRev) * 100;
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="w-full rounded-t-sm transition-all duration-300 group-hover:opacity-100 opacity-70"
                          style={{ height: `${pct}%`, background: i === 13 ? 'linear-gradient(180deg, #C9A84C, #F0D080)' : 'rgba(201,168,76,0.3)' }} />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-white/20 text-[10px]">{stats?.dailyRevenue.slice(-14)[0]?.date.slice(5)}</span>
                  <span className="text-white/20 text-[10px]">{stats?.dailyRevenue.slice(-1)[0]?.date.slice(5)}</span>
                </div>
              </div>

              {/* Crypto balances */}
              <div className="rounded-2xl p-5 border border-white/5" style={{ background: 'rgba(255,255,255,0.025)' }}>
                <h3 className="text-white font-semibold text-sm mb-4">Crypto Holdings</h3>
                <div className="space-y-3">
                  {stats?.cryptoBalances.map(c => (
                    <div key={c.symbol} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-black shrink-0"
                        style={{ background: c.symbol === 'BTC' ? '#F7931A' : c.symbol === 'ETH' ? '#627EEA' : c.symbol === 'USDT' ? '#26A17B' : '#F3BA2F' }}>
                        {c.symbol.slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-white text-xs font-semibold">{c.symbol}</p>
                          <p className={`text-xs font-semibold ${c.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {c.change >= 0 ? '+' : ''}{c.change}%
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-white/30 text-[10px]">{safeMoney(c?.balance)} {c.symbol}</p>
                          <p className="text-white/60 text-[10px]">{fmt(c.usd, '$')}</p>
                        </div>
                        <div className="mt-1 h-1 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: `${(c.usd / (stats?.cryptoBalances.reduce((a, b) => a + b.usd, 0) ?? 1)) * 100}%`,
                            background: c.symbol === 'BTC' ? '#F7931A' : c.symbol === 'ETH' ? '#627EEA' : c.symbol === 'USDT' ? '#26A17B' : '#F3BA2F',
                          }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent activity */}
            <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)' }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h3 className="text-white font-semibold text-sm">Recent Activity</h3>
                <a href="/admin/transactions" className="text-xs text-primary hover:underline">View all</a>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {stats?.recentActivity.map((act, i) => (
                  <motion.div key={act.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${TYPE_COLORS[act.type] ?? '#C9A84C'}15` }}>
                      <CreditCard size={13} style={{ color: TYPE_COLORS[act.type] ?? '#C9A84C' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{act.user}</p>
                      <p className="text-white/30 text-[10px] capitalize">{act.type.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-xs font-semibold">{act.currency === 'BTC' || act.currency === 'ETH' ? Number(act?.amount ?? 0).toFixed(4) : `${safeMoney(act?.amount)}`} {act.currency}</p>
                      <p className="text-white/25 text-[10px]">{new Date(act.ts).toLocaleTimeString()}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      act.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                      act.status === 'pending'   ? 'bg-amber-500/15 text-amber-400' :
                      act.status === 'flagged'   ? 'bg-red-500/15 text-red-400' :
                      'bg-white/10 text-white/40'
                    }`}>{act.status}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </>
        )}
      </AdminLayout>
    </>
  );
}
