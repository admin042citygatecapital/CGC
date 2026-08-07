/**
 * /dashboard/trading/analytics — Portfolio Analytics
 * P&L charts, trade history, win/loss stats, asset breakdown, streaks
 */
import { useCustomerAuth } from '@/lib/customerAuth';
import { usePrivacy } from '@/lib/usePrivacy';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
Activity,
AlertTriangle,
ArrowLeft,
Award,
BarChart2,
ChevronDown,
ChevronUp,
DollarSign,
Loader2,
RefreshCw,
Target,
TrendingDown,
TrendingUp,
Zap
} from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback,useEffect,useState } from 'react';
import { Link } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalyticsSummary {
  totalTrades: number; openPositions: number; winRate: number;
  profitFactor: number | null; avgWin: number; avgLoss: number;
  totalProfit: number; totalLoss: number; netPnl: number;
  unrealisedPnl: number; maxWinStreak: number; currentStreak: number;
  bestTrade:  { symbol: string; pnl: number; executedAt: string } | null;
  worstTrade: { symbol: string; pnl: number; executedAt: string } | null;
}

interface DailyPnl   { date: string; pnl: number; }
interface AssetBreak { assetClass: string; trades: number; pnl: number; volume: number; }
interface SymbolBreak { symbol: string; trades: number; pnl: number; volume: number; winRate: number; }
interface Trade {
  id: string; symbol: string; assetClass: string; side: string;
  quantity: number; price: number; pnl: number; fee: number; executedAt: string;
}

interface Analytics {
  summary:         AnalyticsSummary;
  dailyPnl:        DailyPnl[];
  assetBreakdown:  AssetBreak[];
  symbolBreakdown: SymbolBreak[];
  recentTrades:    Trade[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GOLD    = '#C9A84C';
const EMERALD = '#10B981';
const RED     = '#EF4444';
const BLUE    = '#627EEA';

const ASSET_COLORS: Record<string, string> = {
  crypto: '#F7931A', forex: BLUE, stock: EMERALD, commodity: GOLD, etf: '#9945FF',
};

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}
function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)    return n.toFixed(4);
  return n.toFixed(6);
}

// ── Bar Chart (daily P&L) ─────────────────────────────────────────────────────

function DailyPnlChart({ data }: { data: DailyPnl[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => Math.abs(d.pnl)), 1);
  const W = 600; const H = 100;
  const barW = W / data.length - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
      {data.map((d, i) => {
        const h = (Math.abs(d.pnl) / max) * (H / 2);
        const up = d.pnl >= 0;
        const x = i * (W / data.length);
        return (
          <motion.rect
            key={d.date} x={x} y={H / 2} width={barW} height={1}
            fill={up ? EMERALD : RED} opacity={0.7} rx="1"
            animate={{ y: up ? H / 2 - h : H / 2, height: Math.max(h, 1) }}
            transition={{ duration: 0.4, delay: i * 0.02, ease: 'easeOut' }}
          />
        );
      })}
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
    </svg>
  );
}

// ── Cumulative P&L curve ──────────────────────────────────────────────────────

function CumulativePnlChart({ data }: { data: DailyPnl[] }) {
  if (!data.length) return null;
  // Build cumulative series
  let running = 0;
  const series = data.map(d => { running += d.pnl; return running; });
  const min = Math.min(...series, 0);
  const max = Math.max(...series, 0.01);
  const range = max - min || 1;
  const W = 600; const H = 120;
  const pts = series.map((v, i) =>
    `${(i / (series.length - 1)) * W},${H - ((v - min) / range) * (H - 8) - 4}`
  );
  const linePts = pts.join(' ');
  const fillPts = `0,${H} ${linePts} ${W},${H}`;
  const finalUp = (series[series.length - 1] ?? 0) >= 0;
  const color   = finalUp ? EMERALD : RED;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Zero line */}
      {min < 0 && max > 0 && (
        <line
          x1={0} y1={H - ((0 - min) / range) * (H - 8) - 4}
          x2={W} y2={H - ((0 - min) / range) * (H - 8) - 4}
          stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" strokeDasharray="4 4"
        />
      )}
      <polygon points={fillPts} fill="url(#cumGrad)" />
      <polyline points={linePts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* Last dot */}
      {pts.length > 0 && (() => {
        const last = pts[pts.length - 1].split(',');
        return <circle cx={last[0]} cy={last[1]} r="3" fill={color} />;
      })()}
    </svg>
  );
}

// ── Max Drawdown chart ────────────────────────────────────────────────────────

function DrawdownChart({ data }: { data: DailyPnl[] }) {
  if (!data.length) return null;
  let running = 0; let peak = 0;
  const drawdowns = data.map(d => {
    running += d.pnl;
    if (running > peak) peak = running;
    return peak > 0 ? ((running - peak) / peak) * 100 : 0;
  });
  const minDd = Math.min(...drawdowns, -0.01);
  const W = 600; const H = 60;
  const pts = drawdowns.map((v, i) =>
    `${(i / (drawdowns.length - 1)) * W},${H - ((v - minDd) / (-minDd || 1)) * (H - 4) - 2}`
  );
  const fillPts = `0,${H} ${pts.join(' ')} ${W},${H}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} preserveAspectRatio="none">
      <polygon points={fillPts} fill="rgba(239,68,68,0.08)" />
      <polyline points={pts.join(' ')} fill="none" stroke={RED} strokeWidth="1"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}

// ── Stat Tile ─────────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color: string; icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/3 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
      </div>
      <span className="text-xl font-bold text-white font-mono">{value}</span>
      {sub && <span className="text-[10px] text-white/30">{sub}</span>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { token } = useCustomerAuth();
  const { privacy } = usePrivacy();

  const [data, setData]       = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [tab, setTab]         = useState<'overview' | 'trades' | 'assets'>('overview');
  const [tradeFilter, setTradeFilter] = useState<'all' | 'win' | 'loss'>('all');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/users/trading/analytics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load analytics');
      setData(await res.json() as Analytics);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  const pv = (v: string) => privacy ? '••••••' : v;

  const filteredTrades = (data?.recentTrades ?? []).filter(t => {
    if (tradeFilter === 'win')  return t.pnl > 0;
    if (tradeFilter === 'loss') return t.pnl < 0;
    return true;
  });

  return (
    <>
      <Helmet>
        <title>Portfolio Analytics — City Gate Capital</title>
        <meta name="description" content="Detailed P&L analytics, trade history and performance stats on City Gate Capital." />
        <meta name="robots" content="noindex,nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/trading/analytics" />
      </Helmet>

      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <h1 className="sr-only">Portfolio Analytics — City Gate Capital</h1>
        {/* Header */}
        <div className="sticky top-0 z-20 border-b border-white/8 bg-[#0A0A0A]/95 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link to="/dashboard/trading" className="p-1.5 rounded-lg hover:bg-white/8 transition-colors text-white/40 hover:text-white">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2 flex-1">
              <BarChart2 className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-white text-sm">Portfolio Analytics</span>
            </div>
            <button onClick={load} className="p-2 rounded-xl hover:bg-white/8 transition-colors text-white/30 hover:text-white">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link to="/dashboard/trading/trades"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/[0.08] text-white/50 hover:text-white hover:border-white/[0.15] transition-all">
              <Activity className="w-3.5 h-3.5" /> Trade History
            </Link>
          </div>

          {/* Tabs */}
          <div className="max-w-5xl mx-auto px-4 flex gap-1 border-t border-white/5">
            {([
              { key: 'overview', label: 'Overview' },
              { key: 'trades',   label: 'Trade History' },
              { key: 'assets',   label: 'Asset Breakdown' },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-all ${
                  tab === t.key ? 'border-amber-400 text-amber-400' : 'border-transparent text-white/40 hover:text-white/70'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/8 p-6 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
              <button onClick={load} className="ml-auto text-xs text-red-400 underline">Retry</button>
            </div>
          ) : !data ? null : (

            <>
              {/* ── Overview tab ── */}
              {tab === 'overview' && (
                <div className="space-y-5">
                  {/* KPI grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    <StatTile label="Net P&L"       value={pv(fmtUsd(s?.netPnl ?? 0))}         color={(s?.netPnl ?? 0) >= 0 ? EMERALD : RED}  icon={(s?.netPnl ?? 0) >= 0 ? TrendingUp : TrendingDown} />
                    <StatTile label="Win Rate"      value={pv(`${s?.winRate ?? 0}%`)}            color={GOLD}    icon={Target} sub={`${s?.totalTrades ?? 0} trades`} />
                    <StatTile label="Profit Factor" value={pv(s?.profitFactor != null ? s.profitFactor.toFixed(2) : 'N/A')} color={BLUE} icon={Activity} />
                    <StatTile label="Unrealised"    value={pv(fmtUsd(s?.unrealisedPnl ?? 0))}   color={(s?.unrealisedPnl ?? 0) >= 0 ? EMERALD : RED} icon={DollarSign} sub={`${s?.openPositions ?? 0} open`} />
                    <StatTile label="Avg Win"       value={pv(`$${(s?.avgWin ?? 0).toFixed(2)}`)}  color={EMERALD} icon={ChevronUp} />
                    <StatTile label="Avg Loss"      value={pv(`$${(s?.avgLoss ?? 0).toFixed(2)}`)} color={RED}     icon={ChevronDown} />
                    <StatTile label="Win Streak"    value={pv(String(s?.maxWinStreak ?? 0))}     color={GOLD}    icon={Award} sub={`Current: ${s?.currentStreak ?? 0}`} />
                    <StatTile label="Total Profit"  value={pv(`$${(s?.totalProfit ?? 0).toFixed(2)}`)} color={EMERALD} icon={Zap} />
                  </div>

                  {/* Best / Worst trades */}
                  {(s?.bestTrade || s?.worstTrade) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {s.bestTrade && (
                        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Award className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-semibold text-emerald-400">Best Trade</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-white">{s.bestTrade.symbol}</span>
                            <span className="text-sm font-mono font-bold text-emerald-400">
                              {pv(`+$${(s.bestTrade.pnl ?? 0).toFixed(2)}`)}
                            </span>
                          </div>
                          <span className="text-[10px] text-white/30">{fmtDate(s.bestTrade.executedAt)}</span>
                        </div>
                      )}
                      {s.worstTrade && (
                        <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            <span className="text-xs font-semibold text-red-400">Worst Trade</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-white">{s.worstTrade.symbol}</span>
                            <span className="text-sm font-mono font-bold text-red-400">
                              {pv(`$${(s.worstTrade.pnl ?? 0).toFixed(2)}`)}
                            </span>
                          </div>
                          <span className="text-[10px] text-white/30">{fmtDate(s.worstTrade.executedAt)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cumulative P&L curve */}
                  <div className="rounded-2xl border border-white/8 bg-white/2 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-semibold text-white">Cumulative P&L</span>
                      </div>
                      <span className={`text-xs font-mono font-semibold ${(s?.netPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pv(fmtUsd(s?.netPnl ?? 0))}
                      </span>
                    </div>
                    {data.dailyPnl.every(d => d.pnl === 0) ? (
                      <div className="py-8 text-center text-white/20 text-xs">No closed trades yet</div>
                    ) : (
                      <>
                        <CumulativePnlChart data={data.dailyPnl} />
                        <div className="flex justify-between text-[10px] text-white/20 mt-2">
                          <span>{data.dailyPnl[0]?.date}</span>
                          <span>{data.dailyPnl[data.dailyPnl.length - 1]?.date}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Daily P&L bars */}
                  <div className="rounded-2xl border border-white/8 bg-white/2 p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart2 className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold text-white">Daily P&L — Last 30 Days</span>
                    </div>
                    {data.dailyPnl.every(d => d.pnl === 0) ? (
                      <div className="py-8 text-center text-white/20 text-xs">No closed trades yet</div>
                    ) : (
                      <>
                        <DailyPnlChart data={data.dailyPnl} />
                        <div className="flex justify-between text-[10px] text-white/20 mt-2">
                          <span>{data.dailyPnl[0]?.date}</span>
                          <span>{data.dailyPnl[data.dailyPnl.length - 1]?.date}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Max Drawdown */}
                  {!data.dailyPnl.every(d => d.pnl === 0) && (
                    <div className="rounded-2xl border border-red-400/15 bg-red-400/3 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="text-sm font-semibold text-white">Max Drawdown</span>
                        </div>
                        <span className="text-xs text-white/30">Peak-to-trough decline</span>
                      </div>
                      <DrawdownChart data={data.dailyPnl} />
                    </div>
                  )}

                  {/* Symbol breakdown */}
                  {data.symbolBreakdown.length > 0 && (
                    <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/6 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-semibold text-white">Top Symbols by Volume</span>
                      </div>
                      <div className="divide-y divide-white/5">
                        {data.symbolBreakdown.map(sym => {
                          const pnlUp = sym.pnl >= 0;
                          return (
                            <div key={sym.symbol} className="flex items-center gap-3 px-4 py-3">
                              <span className="text-sm font-semibold text-white w-24 shrink-0">{sym.symbol}</span>
                              <div className="flex-1 min-w-0">
                                <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{
                                    width: `${Math.min((sym.volume / (data.symbolBreakdown[0]?.volume || 1)) * 100, 100)}%`,
                                    background: ASSET_COLORS[sym.symbol.includes('USD') ? 'crypto' : 'stock'] ?? GOLD,
                                  }} />
                                </div>
                              </div>
                              <span className="text-xs text-white/40 w-16 text-right">{sym.trades} trades</span>
                              <span className={`text-xs font-mono font-semibold w-20 text-right ${pnlUp ? 'text-emerald-400' : 'text-red-400'}`}>
                                {pv(fmtUsd(sym.pnl))}
                              </span>
                              <span className="text-xs text-white/30 w-12 text-right">{sym.winRate}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Trade History tab ── */}
              {tab === 'trades' && (
                <div className="space-y-4">
                  {/* Filter */}
                  <div className="flex gap-2">
                    {(['all', 'win', 'loss'] as const).map(f => (
                      <button key={f} onClick={() => setTradeFilter(f)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
                          tradeFilter === f ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' : 'bg-white/5 text-white/40 hover:bg-white/10'
                        }`}>
                        {f === 'all' ? 'All Trades' : f === 'win' ? '✓ Winners' : '✗ Losers'}
                      </button>
                    ))}
                    <span className="ml-auto text-xs text-white/25 self-center">{filteredTrades.length} trades</span>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                    {filteredTrades.length === 0 ? (
                      <div className="py-12 text-center text-white/20 text-sm">No trades found</div>
                    ) : (
                      <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
                        {filteredTrades.map(t => {
                          const pnlUp = t.pnl >= 0;
                          return (
                            <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                t.side === 'buy' ? 'bg-emerald-400/10' : 'bg-red-400/10'
                              }`}>
                                {t.side === 'buy'
                                  ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                  : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-white">{t.symbol}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                                    t.side === 'buy' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-red-400/15 text-red-400'
                                  }`}>{t.side.toUpperCase()}</span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/8 text-white/40 capitalize">{t.assetClass}</span>
                                </div>
                                <span className="text-[10px] text-white/25">
                                  {t.quantity} @ ${fmtPrice(t.price)} · {fmtDate(t.executedAt)}
                                  {t.fee > 0 && ` · Fee: $${t.fee.toFixed(4)}`}
                                </span>
                              </div>
                              {t.pnl !== 0 && (
                                <span className={`text-sm font-mono font-semibold ${pnlUp ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {pv(fmtUsd(t.pnl))}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Asset Breakdown tab ── */}
              {tab === 'assets' && (
                <div className="space-y-4">
                  {data.assetBreakdown.length === 0 ? (
                    <div className="rounded-2xl border border-white/8 bg-white/2 py-12 text-center text-white/20 text-sm">
                      No closed trades yet
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {data.assetBreakdown.map(a => {
                        const pnlUp = a.pnl >= 0;
                        const col = ASSET_COLORS[a.assetClass] ?? GOLD;
                        return (
                          <motion.div key={a.assetClass}
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            className="rounded-2xl border p-4 space-y-3"
                            style={{ borderColor: `${col}25`, background: `${col}06` }}>
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: col }} />
                              <span className="text-sm font-semibold text-white capitalize">{a.assetClass}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <div className="text-white/30">Trades</div>
                                <div className="text-white font-mono mt-0.5">{a.trades}</div>
                              </div>
                              <div>
                                <div className="text-white/30">Volume</div>
                                <div className="text-white font-mono mt-0.5">{pv(fmtUsd(a.volume).replace('+', ''))}</div>
                              </div>
                              <div className="col-span-2">
                                <div className="text-white/30">Net P&L</div>
                                <div className={`font-mono font-bold mt-0.5 ${pnlUp ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {pv(fmtUsd(a.pnl))}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
