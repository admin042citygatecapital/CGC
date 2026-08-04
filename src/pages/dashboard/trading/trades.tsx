/**
 * /dashboard/trading/trades — Trade History
 * Full executed trade log with P&L, filters, symbol search, CSV export
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Activity, RefreshCw, Loader2, TrendingUp, TrendingDown,
  Search, Filter, Download, AlertTriangle, ChevronUp, ChevronDown,
  X, BarChart2,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';
import { usePrivacy } from '@/lib/usePrivacy';
import { VirtualList } from '@/lib/VirtualList';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Trade {
  id: string; symbol: string; assetClass: string; side: 'buy' | 'sell';
  quantity: number; price: number; pnl: number; fee: number;
  executedAt: string; orderId?: string;
}

type SortKey = 'executedAt' | 'symbol' | 'pnl' | 'quantity' | 'price';
type SortDir = 'asc' | 'desc';
type FilterSide = 'all' | 'buy' | 'sell';
type FilterResult = 'all' | 'win' | 'loss';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GOLD    = '#C9A84C';
const EMERALD = '#10B981';
const RED     = '#EF4444';
const BLUE    = '#627EEA';

const ASSET_COLORS: Record<string, string> = {
  crypto: '#F7931A', forex: BLUE, stock: EMERALD, commodity: GOLD, etf: '#9945FF',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number, d = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPrice(n: number): string {
  if (n >= 1000) return fmt(n, 2);
  if (n >= 1)    return fmt(n, 4);
  return fmt(n, 6);
}
function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function exportCsv(trades: Trade[]) {
  const header = 'Date,Symbol,Asset Class,Side,Quantity,Price,P&L,Fee';
  const rows = trades.map(t =>
    [
      new Date(t.executedAt).toISOString(),
      t.symbol, t.assetClass, t.side,
      t.quantity, t.price,
      t.pnl.toFixed(4), t.fee.toFixed(4),
    ].join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `cgc-trades-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary bar
// ─────────────────────────────────────────────────────────────────────────────

function SummaryBar({ trades, privacy }: { trades: Trade[]; privacy: boolean }) {
  const totalPnl  = trades.reduce((s, t) => s + t.pnl, 0);
  const totalFees = trades.reduce((s, t) => s + t.fee, 0);
  const wins      = trades.filter(t => t.pnl > 0).length;
  const winRate   = trades.length > 0 ? ((wins / trades.length) * 100).toFixed(1) : '0.0';
  const pv = (v: string) => privacy ? '••••••' : v;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Net P&L',   value: pv(fmtUsd(totalPnl)),   color: totalPnl >= 0 ? EMERALD : RED },
        { label: 'Win Rate',  value: `${winRate}%`,           color: GOLD },
        { label: 'Total Fees', value: pv(`-$${totalFees.toFixed(2)}`), color: RED },
        { label: 'Trades',    value: String(trades.length),   color: BLUE },
      ].map(s => (
        <div key={s.label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">{s.label}</p>
          <p className="text-base font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Trade row
// ─────────────────────────────────────────────────────────────────────────────

function TradeRow({ trade, privacy }: { trade: Trade; privacy: boolean }) {
  const pnlUp  = trade.pnl >= 0;
  const acol   = ASSET_COLORS[trade.assetClass] ?? GOLD;
  const pv     = (v: string) => privacy ? '••••••' : v;

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors border-b border-white/[0.04] last:border-0">
      {/* Side icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
        trade.side === 'buy' ? 'bg-emerald-400/10 border border-emerald-400/15' : 'bg-red-400/10 border border-red-400/15'
      }`}>
        {trade.side === 'buy'
          ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
        }
      </div>

      {/* Symbol + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white">{trade.symbol}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
            trade.side === 'buy' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-red-400/15 text-red-400'
          }`}>{trade.side.toUpperCase()}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold capitalize"
            style={{ background: `${acol}15`, color: acol }}>
            {trade.assetClass}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-white/25 font-mono">
            {pv(trade.quantity.toFixed(6))} @ ${fmtPrice(trade.price)}
          </span>
          {trade.fee > 0 && (
            <span className="text-[10px] text-white/20">Fee: ${trade.fee.toFixed(4)}</span>
          )}
        </div>
      </div>

      {/* Date */}
      <div className="hidden sm:block text-right shrink-0">
        <p className="text-[10px] text-white/25">{fmtDate(trade.executedAt)}</p>
      </div>

      {/* P&L */}
      <div className="text-right shrink-0 min-w-[72px]">
        {trade.pnl !== 0 ? (
          <>
            <p className={`text-sm font-mono font-semibold ${pnlUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {pv(fmtUsd(trade.pnl))}
            </p>
            <p className={`text-[10px] ${pnlUp ? 'text-emerald-400/50' : 'text-red-400/50'}`}>
              {pnlUp ? 'Win' : 'Loss'}
            </p>
          </>
        ) : (
          <p className="text-xs text-white/20">—</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function TradesPage() {
  const { token } = useCustomerAuth();
  const { privacy } = usePrivacy();

  const [trades, setTrades]     = useState<Trade[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // Filters
  const [search, setSearch]     = useState('');
  const [filterSide, setFilterSide]     = useState<FilterSide>('all');
  const [filterResult, setFilterResult] = useState<FilterResult>('all');
  const [filterAsset, setFilterAsset]   = useState<string>('all');
  const [sortKey, setSortKey]   = useState<SortKey>('executedAt');
  const [sortDir, setSortDir]   = useState<SortDir>('desc');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/users/trading/history?limit=500', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load trade history');
      const data = await res.json() as { trades: Trade[] };
      setTrades(data.trades ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  // Unique asset classes
  const assetClasses = useMemo(() => {
    const set = new Set(trades.map(t => t.assetClass));
    return ['all', ...Array.from(set)];
  }, [trades]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    let list = [...trades];
    if (search)                     list = list.filter(t => t.symbol.toLowerCase().includes(search.toLowerCase()));
    if (filterSide !== 'all')       list = list.filter(t => t.side === filterSide);
    if (filterResult === 'win')     list = list.filter(t => t.pnl > 0);
    if (filterResult === 'loss')    list = list.filter(t => t.pnl < 0);
    if (filterAsset !== 'all')      list = list.filter(t => t.assetClass === filterAsset);

    list.sort((a, b) => {
      let av: number | string; let bv: number | string;
      switch (sortKey) {
        case 'executedAt': av = a.executedAt; bv = b.executedAt; break;
        case 'symbol':     av = a.symbol;     bv = b.symbol;     break;
        case 'pnl':        av = a.pnl;        bv = b.pnl;        break;
        case 'quantity':   av = a.quantity;   bv = b.quantity;   break;
        case 'price':      av = a.price;      bv = b.price;      break;
        default:           av = a.executedAt; bv = b.executedAt;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [trades, search, filterSide, filterResult, filterAsset, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronDown className="w-3 h-3 text-white/20" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-amber-400" />
      : <ChevronDown className="w-3 h-3 text-amber-400" />;
  };

  return (
    <>
      <Helmet>
        <title>Trade History — City Gate Capital</title>
        <meta name="description" content="Full executed trade history with P&L breakdown on City Gate Capital." />
        <meta name="robots" content="noindex,nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/trading/trades" />
      </Helmet>

      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <h1 className="sr-only">Trade History — City Gate Capital</h1>

        {/* ── Header ── */}
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0A0A0A]/95 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">
            <Link to="/dashboard/trading"
              className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-white/40 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: BLUE }} />
              <span className="text-sm font-semibold text-white">Trade History</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => void load()}
                className="p-2 rounded-xl hover:bg-white/6 transition-colors text-white/30 hover:text-white">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              {filtered.length > 0 && (
                <button onClick={() => exportCsv(filtered)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/[0.08] text-white/50 hover:text-white hover:border-white/[0.15] transition-all">
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              )}
              <Link to="/dashboard/trading/analytics"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/[0.08] text-white/50 hover:text-white hover:border-white/[0.15] transition-all">
                <BarChart2 className="w-3.5 h-3.5" /> Analytics
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 md:px-6 py-5 space-y-5">

          {/* ── Summary ── */}
          {!loading && trades.length > 0 && (
            <SummaryBar trades={filtered} privacy={privacy} />
          )}

          {/* ── Search + filters ── */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 focus-within:border-amber-400/30 transition-colors">
              <Search className="w-3.5 h-3.5 text-white/30 shrink-0" />
              <input
                type="text" value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search symbol…"
                className="flex-1 bg-transparent text-sm text-white placeholder-white/20 outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-white/30 hover:text-white transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                showFilters ? 'border-amber-400/30 bg-amber-400/10 text-amber-400' : 'border-white/[0.08] text-white/40 hover:text-white'
              }`}>
              <Filter className="w-3.5 h-3.5" />
              Filters
              {(filterSide !== 'all' || filterResult !== 'all' || filterAsset !== 'all') && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          </div>

          {/* ── Filter panel ── */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Side */}
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Side</p>
                      <div className="flex gap-1.5">
                        {(['all', 'buy', 'sell'] as FilterSide[]).map(f => (
                          <button key={f} onClick={() => setFilterSide(f)}
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${
                              filterSide === f ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' : 'bg-white/[0.04] text-white/30 hover:bg-white/[0.08]'
                            }`}>
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Result */}
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Result</p>
                      <div className="flex gap-1.5">
                        {(['all', 'win', 'loss'] as FilterResult[]).map(f => (
                          <button key={f} onClick={() => setFilterResult(f)}
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${
                              filterResult === f ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' : 'bg-white/[0.04] text-white/30 hover:bg-white/[0.08]'
                            }`}>
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Asset class */}
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Asset Class</p>
                      <div className="flex flex-wrap gap-1.5">
                        {assetClasses.map(cls => (
                          <button key={cls} onClick={() => setFilterAsset(cls)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                              filterAsset === cls ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' : 'bg-white/[0.04] text-white/30 hover:bg-white/[0.08]'
                            }`}>
                            {cls}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Reset */}
                  {(filterSide !== 'all' || filterResult !== 'all' || filterAsset !== 'all') && (
                    <button onClick={() => { setFilterSide('all'); setFilterResult('all'); setFilterAsset('all'); }}
                      className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1">
                      <X className="w-3 h-3" /> Clear filters
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Table ── */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.01]">
              <button onClick={() => toggleSort('symbol')} className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest">
                Symbol <SortIcon k="symbol" />
              </button>
              <button onClick={() => toggleSort('executedAt')} className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest">
                Date <SortIcon k="executedAt" />
              </button>
              <button onClick={() => toggleSort('quantity')} className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest">
                Qty / Price <SortIcon k="quantity" />
              </button>
              <button onClick={() => toggleSort('pnl')} className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest">
                P&L <SortIcon k="pnl" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: GOLD }} />
              </div>
            ) : error ? (
              <div className="flex items-center gap-3 p-6">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
                <button onClick={() => void load()} className="ml-auto text-xs text-red-400 underline">Retry</button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/20">
                <Activity className="w-8 h-8" />
                <p className="text-sm">{trades.length === 0 ? 'No trades yet' : 'No trades match your filters'}</p>
                {trades.length === 0 && (
                  <Link to="/dashboard/trading/spot"
                    className="text-xs mt-1 hover:text-white/50 transition-colors" style={{ color: GOLD }}>
                    Start trading →
                  </Link>
                )}
              </div>
            ) : (
              <VirtualList
                items={filtered}
                rowHeight={72}
                overscan={6}
                className="max-h-[600px]"
                emptyState={
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/20">
                    <Activity className="w-8 h-8" />
                    <p className="text-sm">No trades match your filters</p>
                  </div>
                }
                renderRow={(trade) => (
                  <TradeRow trade={trade} privacy={privacy} />
                )}
              />
            )}

            {/* Footer */}
            {!loading && filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[10px] text-white/25">
                  Showing {filtered.length} of {trades.length} trades
                </span>
                <button onClick={() => exportCsv(filtered)}
                  className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
