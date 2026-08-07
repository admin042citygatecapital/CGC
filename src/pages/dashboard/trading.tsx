/**
 * /dashboard/trading — Trading Hub
 * Portfolio overview, open positions, P&L summary, quick actions
 */
import { useBackgroundSync } from '@/lib/backgroundSync';
import { useCustomerAuth } from '@/lib/customerAuth';
import { prefetchTradingRoutes } from '@/lib/prefetchRoute';
import { usePrivacy } from '@/lib/usePrivacy';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
Activity,
AlertTriangle,
ArrowDownLeft,
BarChart2,
BookOpen,
ChevronRight,
DollarSign,
Eye,EyeOff,
Globe,
LineChart,
Loader2,
RefreshCw,
ShieldCheck,
Star,
Target,
TrendingDown,
TrendingUp,
Zap
} from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback,useEffect,useState } from 'react';
import { Link } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortfolioSummary {
  totalValue: number; totalCost: number;
  unrealisedPnl: number; realisedPnl: number; totalPnl: number;
  pnlPct: number; openPositions: number; closedPositions: number;
  openOrders: number; winRate: number; bestTrade: number;
  worstTrade: number; totalTrades: number; dailyPnl: number;
}

interface Position {
  id: string; symbol: string; assetClass: string; side: string;
  quantity: number; avgEntryPrice: number; currentPrice: number;
  unrealisedPnl: number; realisedPnl: number; status: string;
  openedAt: string; currency: string; leverage: number;
  stopLoss?: number; takeProfit?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtUSD(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}
function pnlColor(v: number): string {
  return v >= 0 ? 'text-emerald-400' : 'text-red-400';
}
function pnlBg(v: number): string {
  return v >= 0 ? 'bg-emerald-400/10 border-emerald-400/20' : 'bg-red-400/10 border-red-400/20';
}
function assetIcon(cls: string): string {
  const map: Record<string, string> = { crypto: '₿', forex: '💱', stock: '📈', commodity: '🪙', etf: '📊' };
  return map[cls] ?? '📊';
}
function assetColor(cls: string): string {
  const map: Record<string, string> = {
    crypto: '#F7931A', forex: '#627EEA', stock: '#10B981', commodity: '#C9A84C', etf: '#9945FF',
  };
  return map[cls] ?? '#C9A84C';
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color, privacy }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; privacy: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/8 bg-white/4 backdrop-blur-sm p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50 font-medium tracking-wide">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-white font-mono">
          {privacy ? <span className="tracking-widest select-none">••••••</span> : value}
        </div>
        {sub && <div className="text-xs text-white/40 mt-1">{sub}</div>}
      </div>
    </motion.div>
  );
}

// ── Position Row ──────────────────────────────────────────────────────────────

function PositionRow({ pos, privacy }: { pos: Position; privacy: boolean }) {
  const pnlPct = pos.avgEntryPrice > 0
    ? ((pos.currentPrice - pos.avgEntryPrice) / pos.avgEntryPrice) * 100 * (pos.side === 'sell' ? -1 : 1)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group"
    >
      {/* Asset icon */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
        style={{ background: `${assetColor(pos.assetClass)}20` }}>
        {assetIcon(pos.assetClass)}
      </div>

      {/* Symbol + side */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm">{pos.symbol}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            pos.side === 'buy' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-red-400/15 text-red-400'
          }`}>
            {pos.side.toUpperCase()}
          </span>
          {pos.leverage > 1 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 font-medium">
              {pos.leverage}x
            </span>
          )}
        </div>
        <div className="text-xs text-white/40 mt-0.5">
          {privacy ? '••••' : fmt(pos.quantity, 4)} @ {privacy ? '••••' : `$${fmt(pos.avgEntryPrice, 4)}`}
        </div>
      </div>

      {/* Current price */}
      <div className="text-right hidden sm:block">
        <div className="text-sm font-mono text-white/80">
          {privacy ? '••••' : `$${fmt(pos.currentPrice, pos.currentPrice < 1 ? 6 : 2)}`}
        </div>
        <div className="text-xs text-white/40">Current</div>
      </div>

      {/* P&L */}
      <div className="text-right min-w-[80px]">
        <div className={`text-sm font-mono font-semibold ${pnlColor(pos.unrealisedPnl)}`}>
          {privacy ? '••••' : (pos.unrealisedPnl >= 0 ? '+' : '') + fmtUSD(pos.unrealisedPnl)}
        </div>
        <div className={`text-xs font-mono ${pnlColor(pnlPct)}`}>
          {privacy ? '••' : `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TradingPage() {
  const { token } = useCustomerAuth();
  const { privacy, toggle: togglePrivacy } = usePrivacy();

  const [summary, setSummary]     = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/users/trading/portfolio', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load portfolio');
      const data = await res.json();
      setSummary(data.summary);
      setPositions(data.positions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Background sync: leader-election, visibility-aware, cross-tab dedup
  useBackgroundSync(
    'trading-hub',
    async () => {
      if (!token) return null;
      const res = await fetch('/api/users/trading/summary', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json() as Promise<{ summary: PortfolioSummary; positions: Position[] }>;
    },
    30_000,
    (data) => {
      if (!data) return;
      setSummary(data.summary);
      setPositions(data.positions ?? []);
    },
  );

  const openPositions = positions.filter(p => p.status === 'open');

  return (
    <>
      <Helmet>
        <title>Trading — City Gate Capital</title>
        <meta name="description" content="Your City Gate Capital trading hub — portfolio, positions and P&L." />
        <link rel="canonical" href="https://citygate.capital/dashboard/trading" />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <h1 className="sr-only">Trading Hub — City Gate Capital</h1>
        {/* Header */}
        <div className="border-b border-white/8 bg-[#0A0A0A]/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="text-white/40 hover:text-white transition-colors">
                <ArrowDownLeft className="w-5 h-5" />
              </Link>
              <div className="w-px h-5 bg-white/10" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-400/15 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Trading Hub</div>
                  <div className="text-xs text-white/40">City Gate Capital</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                className="p-2 rounded-xl hover:bg-white/8 transition-colors text-white/50 hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={togglePrivacy}
                className="p-2 rounded-xl hover:bg-white/8 transition-colors text-white/50 hover:text-white"
              >
                {privacy ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">

          {/* Quick Nav */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: 'Spot Trade', icon: Zap,        href: '/dashboard/trading/spot',      color: '#C9A84C' },
              { label: 'Markets',    icon: Globe,       href: '/dashboard/trading/markets',   color: '#627EEA' },
              { label: 'Chart',      icon: LineChart,   href: '/dashboard/trading/chart',     color: '#F7931A' },
              { label: 'Watchlist',  icon: Star,        href: '/dashboard/trading/watchlist', color: '#9945FF' },
              { label: 'Orders',     icon: BookOpen,    href: '/dashboard/trading/orders',    color: '#10B981' },
              { label: 'Trades',     icon: Activity,    href: '/dashboard/trading/trades',    color: '#627EEA' },
              { label: 'Analytics',  icon: BarChart2,   href: '/dashboard/trading/analytics', color: '#F7931A' },
              { label: 'Wallets',    icon: ShieldCheck, href: '/dashboard/wallets',           color: '#EF4444' },
            ].map(({ label, icon: Icon, href, color }) => (
              <Link key={label} to={href}
                onMouseEnter={prefetchTradingRoutes}
                className="flex flex-col items-center gap-2 p-3.5 rounded-2xl border border-white/8 bg-white/4 hover:bg-white/8 transition-all group"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${color}20` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <span className="text-[10px] font-semibold text-white/50 group-hover:text-white/80 transition-colors text-center">{label}</span>
              </Link>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/8 p-6 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
              <button onClick={() => load()} className="ml-auto text-xs text-red-400 hover:text-red-300 underline">Retry</button>
            </div>
          )}

          {/* Portfolio Stats */}
          {summary && !loading && (
            <>
              {/* P&L Banner */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border p-6 ${pnlBg(summary.unrealisedPnl)}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-white/50 font-medium mb-1">Portfolio Value</div>
                    <div className="text-3xl font-bold text-white font-mono">
                      {privacy ? '••••••••' : `$${fmt(summary.totalValue)}`}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-sm font-mono font-semibold ${pnlColor(summary.unrealisedPnl)}`}>
                        {privacy ? '••••' : `${summary.unrealisedPnl >= 0 ? '+' : ''}${fmtUSD(summary.unrealisedPnl)}`}
                      </span>
                      <span className={`text-xs font-mono ${pnlColor(summary.pnlPct)}`}>
                        {privacy ? '••' : `(${summary.pnlPct >= 0 ? '+' : ''}${summary.pnlPct.toFixed(2)}%)`}
                      </span>
                      <span className="text-xs text-white/30">unrealised</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {summary.unrealisedPnl >= 0
                      ? <TrendingUp className="w-10 h-10 text-emerald-400 opacity-60" />
                      : <TrendingDown className="w-10 h-10 text-red-400 opacity-60" />
                    }
                  </div>
                </div>
              </motion.div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Realised P&L"    value={fmtUSD(summary.realisedPnl)}   sub="All time"           icon={DollarSign}  color="#C9A84C" privacy={privacy} />
                <StatCard label="Daily P&L"       value={fmtUSD(summary.dailyPnl)}      sub="Today"              icon={Activity}    color="#627EEA" privacy={privacy} />
                <StatCard label="Win Rate"         value={`${summary.winRate}%`}          sub={`${summary.totalTrades} trades`} icon={Target} color="#10B981" privacy={false} />
                <StatCard label="Open Orders"      value={String(summary.openOrders)}    sub="Pending execution"  icon={Zap}         color="#9945FF" privacy={false} />
              </div>

              {/* Open Positions */}
              <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-white text-sm">Open Positions</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 font-mono">
                      {openPositions.length}
                    </span>
                  </div>
                  <Link to="/dashboard/trading/chart"
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
                    Trade <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>

                {openPositions.length === 0 ? (
                  <div className="py-12 text-center">
                    <BarChart2 className="w-10 h-10 text-white/15 mx-auto mb-3" />
                    <p className="text-white/40 text-sm">No open positions</p>
                    <Link to="/dashboard/trading/chart"
                      className="mt-3 inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                      Start trading <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5 px-2 py-2">
                    {openPositions.map(pos => (
                      <PositionRow key={pos.id} pos={pos} privacy={privacy} />
                    ))}
                  </div>
                )}
              </div>

              {/* Performance Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Best Trade',  value: fmtUSD(summary.bestTrade),  color: '#10B981', icon: TrendingUp },
                  { label: 'Worst Trade', value: fmtUSD(summary.worstTrade), color: '#EF4444', icon: TrendingDown },
                  { label: 'Total Trades',value: String(summary.totalTrades), color: '#C9A84C', icon: Activity },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-white/3 p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${color}20` }}>
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div>
                      <div className="text-xs text-white/40">{label}</div>
                      <div className="text-lg font-bold font-mono text-white mt-0.5">
                        {privacy && label !== 'Total Trades' ? '••••' : value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* CTA if no trades yet */}
          {summary && summary.totalTrades === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-8 text-center"
            >
              <ShieldCheck className="w-12 h-12 text-amber-400/60 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Ready to start trading?</h3>
              <p className="text-white/50 text-sm mb-6 max-w-md mx-auto">
                Access crypto, forex, stocks and commodities — all from your City Gate Capital account.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/dashboard/trading/markets"
                  className="px-6 py-2.5 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 transition-colors">
                  Browse Markets
                </Link>
                <Link to="/dashboard/trading/chart"
                  className="px-6 py-2.5 rounded-xl border border-white/15 text-white/80 font-medium text-sm hover:bg-white/8 transition-colors">
                  Open Chart
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
}
