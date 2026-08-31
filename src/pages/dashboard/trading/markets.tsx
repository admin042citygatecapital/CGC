/**
 * /dashboard/trading/markets — Live Market Screener
 * Real-time prices, gainers, losers, trending, most active
 * Powered by the market data provider abstraction layer
 */
import { WsStatusBadge } from '@/components/WsStatusBadge';
import {
useMarketSearch,
useMarketSummary,
useTicker,
type AssetClass,
type Ticker,
} from '@/hooks/useMarketData';
import { useMarketWebSocket } from '@/lib/useMarketWebSocket';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
AlertCircle,
ArrowLeft,
ChevronDown,
ChevronUp,
Flame,
Globe,
Loader2,
RefreshCw,
Search,Star,StarOff,
TrendingDown,
TrendingUp
} from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)    return n.toFixed(4);
  return n.toFixed(6);
}
function fmtVol(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

const ASSET_CLASSES: { id: AssetClass | 'all'; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'crypto',    label: 'Crypto' },
  { id: 'stock',     label: 'Stocks' },
  { id: 'forex',     label: 'Forex' },
  { id: 'commodity', label: 'Commodities' },
  { id: 'etf',       label: 'ETFs' },
];

const DEFAULT_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
  'MATICUSDT', 'LTCUSDT', 'ATOMUSDT', 'UNIUSDT', 'AAVEUSDT',
];

const ASSET_COLOR: Record<string, string> = {
  crypto: '#F7931A', stock: '#10B981', forex: '#627EEA',
  commodity: '#C9A84C', etf: '#9945FF',
};

type SortKey = 'price' | 'changePct24h' | 'volume24h' | 'symbol';
type SortDir = 'asc' | 'desc';

// ── Ticker Row ────────────────────────────────────────────────────────────────

function TickerRow({
  ticker, watchlist, onToggleWatch, onSelect,
}: {
  ticker: Ticker;
  watchlist: Set<string>;
  onToggleWatch: (sym: string) => void;
  onSelect: (sym: string) => void;
}) {
  const up = ticker.changePct24h >= 0;
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="border-b border-white/5 hover:bg-white/3 transition-colors cursor-pointer group"
      onClick={() => onSelect(ticker.symbol)}
    >
      <td className="py-3 px-3">
        <button
          onClick={e => { e.stopPropagation(); onToggleWatch(ticker.symbol); }}
          className="text-white/20 hover:text-amber-400 transition-colors"
        >
          {watchlist.has(ticker.symbol)
            ? <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            : <StarOff className="w-3.5 h-3.5" />
          }
        </button>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: ASSET_COLOR[ticker.assetClass] ?? '#C9A84C' }} />
          <span className="font-semibold text-white text-sm">{ticker.symbol}</span>
        </div>
      </td>
      <td className="py-3 px-3 font-mono text-white text-sm text-right">
        ${fmtPrice(ticker.price)}
      </td>
      <td className={`py-3 px-3 font-mono text-sm text-right font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
        <span className="flex items-center justify-end gap-0.5">
          {up ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {Math.abs(ticker.changePct24h).toFixed(2)}%
        </span>
      </td>
      <td className="py-3 px-3 font-mono text-white/50 text-sm text-right hidden md:table-cell">
        {fmtVol(ticker.volume24h)}
      </td>
      <td className="py-3 px-3 text-right hidden lg:table-cell">
        <div className="flex items-center justify-end gap-1">
          <div className="w-16 h-1.5 bg-white/8 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${up ? 'bg-emerald-400' : 'bg-red-400'}`}
              style={{ width: `${Math.min(Math.abs(ticker.changePct24h) * 5, 100)}%` }}
            />
          </div>
        </div>
      </td>
      <td className="py-3 px-3 text-right">
        <Link
          to={`/dashboard/trading/chart?symbol=${ticker.symbol}`}
          onClick={e => e.stopPropagation()}
          className="text-xs px-2.5 py-1 rounded-lg bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 transition-colors opacity-0 group-hover:opacity-100"
        >
          Trade
        </Link>
      </td>
    </motion.tr>
  );
}

// ── Mini Ticker Card (gainers/losers/trending) ────────────────────────────────

function MiniCard({ ticker, label }: { ticker: Ticker; label?: string }) {
  const up = ticker.changePct24h >= 0;
  return (
    <Link to={`/dashboard/trading/chart?symbol=${ticker.symbol}`}>
      <div className="rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 p-3 transition-all cursor-pointer">
        {label && <div className="text-xs text-white/30 mb-1">{label}</div>}
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-white">{ticker.symbol}</div>
            <div className="text-xs text-white/40 mt-0.5">${fmtPrice(ticker.price)}</div>
          </div>
          <div className={`text-sm font-bold font-mono ${up ? 'text-emerald-400' : 'text-red-400'}`}>
            {up ? '+' : ''}{ticker.changePct24h.toFixed(2)}%
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MarketsPage() {
  const navigate = useNavigate();
  const [assetClass, setAssetClass] = useState<AssetClass>('crypto');
  const [sortKey, setSortKey]       = useState<SortKey>('volume24h');
  const [sortDir, setSortDir]       = useState<SortDir>('desc');
  const [watchlist, setWatchlist]   = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab]   = useState<'all' | 'watchlist' | 'gainers' | 'losers' | 'trending'>('all');
  const [searchOpen, setSearchOpen] = useState(false);

  const { tickers, loading, error, refetch } = useTicker(DEFAULT_SYMBOLS, 'crypto', 8000);
  const { summary, loading: summaryLoading }  = useMarketSummary('crypto', 30_000);
  const { results: searchResults, loading: searching, search } = useMarketSearch();

  // WS status for the live badge
  const { status: wsStatus, isLive, source } = useMarketWebSocket(DEFAULT_SYMBOLS, 8000);

  const toggleWatch = (sym: string) => {
    setWatchlist(prev => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <span className="text-white/20">↕</span>;
    return sortDir === 'desc' ? <ChevronDown className="w-3 h-3 text-amber-400" /> : <ChevronUp className="w-3 h-3 text-amber-400" />;
  };

  let displayTickers = [...tickers];
  if (activeTab === 'watchlist') displayTickers = displayTickers.filter(t => watchlist.has(t.symbol));
  if (activeTab === 'gainers')   displayTickers = summary?.gainers ?? displayTickers.filter(t => t.changePct24h > 0);
  if (activeTab === 'losers')    displayTickers = summary?.losers  ?? displayTickers.filter(t => t.changePct24h < 0);
  if (activeTab === 'trending')  displayTickers = summary?.trending ?? displayTickers;

  displayTickers.sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'symbol') return mul * a.symbol.localeCompare(b.symbol);
    return mul * ((a[sortKey] as number) - (b[sortKey] as number));
  });

  return (
    <>
      <Helmet>
        <title>Markets — City Gate Capital</title>
        <meta name="description" content="Browse live crypto, forex, stocks and commodity markets on City Gate Capital." />
        <link rel="canonical" href="https://citygate.capital/dashboard/trading/markets" />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <h1 className="sr-only">Markets — City Gate Capital</h1>

        {/* Header */}
        <div className="sticky top-0 z-20 border-b border-white/8 bg-[#0A0A0A]/95 backdrop-blur-xl px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <Link to="/dashboard/trading" className="p-1.5 rounded-lg hover:bg-white/8 transition-colors text-white/40 hover:text-white">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2 flex-1">
              <Globe className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-white text-sm">Market Screener</span>
              {!loading && (
                <WsStatusBadge status={wsStatus} isLive={isLive} source={source} />
              )}
            </div>
            <button
              onClick={() => setSearchOpen(v => !v)}
              className="p-2 rounded-xl bg-white/8 hover:bg-white/12 transition-colors"
            >
              <Search className="w-4 h-4 text-white/60" />
            </button>
            <button
              onClick={refetch}
              className="p-2 rounded-xl bg-white/8 hover:bg-white/12 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">

          {/* Search overlay */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-2xl border border-white/10 bg-[#111] p-4 space-y-3"
              >
                <div className="flex items-center gap-2 bg-white/8 rounded-xl px-3 py-2.5">
                  <Search className="w-4 h-4 text-white/30 shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search symbol or name…"
                    className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
                    onChange={e => search(e.target.value)}
                  />
                  {searching && <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />}
                </div>
                {searchResults.length > 0 && (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {searchResults.map(r => (
                      <button
                        key={r.symbol}
                        onClick={() => { navigate(`/dashboard/trading/chart?symbol=${r.symbol}`); setSearchOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/8 transition-colors text-left"
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: ASSET_COLOR[r.assetClass] ?? '#C9A84C' }} />
                        <div>
                          <div className="text-sm font-semibold text-white">{r.symbol}</div>
                          <div className="text-xs text-white/40">{r.name}</div>
                        </div>
                        {r.exchange && <span className="ml-auto text-xs text-white/25">{r.exchange}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Summary cards — gainers/losers/trending */}
          {!summaryLoading && summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-400">Top Gainers</span>
                </div>
                <div className="space-y-2">
                  {summary.gainers.slice(0, 3).map(t => <MiniCard key={t.symbol} ticker={t} />)}
                </div>
              </div>
              <div className="rounded-2xl border border-red-400/15 bg-red-400/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-semibold text-red-400">Top Losers</span>
                </div>
                <div className="space-y-2">
                  {summary.losers.slice(0, 3).map(t => <MiniCard key={t.symbol} ticker={t} />)}
                </div>
              </div>
              <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-400">Trending</span>
                </div>
                <div className="space-y-2">
                  {summary.trending.slice(0, 3).map(t => <MiniCard key={t.symbol} ticker={t} />)}
                </div>
              </div>
            </div>
          )}

          {/* Asset class filter */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {ASSET_CLASSES.map(ac => (
              <button
                key={ac.id}
                onClick={() => setAssetClass(ac.id === 'all' ? 'crypto' : ac.id as AssetClass)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  (ac.id === 'all' && assetClass === 'crypto') || assetClass === ac.id
                    ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
                    : 'bg-white/5 text-white/40 hover:text-white/70 border border-transparent'
                }`}
              >
                {ac.label}
              </button>
            ))}
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 border-b border-white/8">
            {(['all', 'watchlist', 'gainers', 'losers', 'trending'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-xs font-medium capitalize border-b-2 transition-all ${
                  activeTab === tab
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-white/40 hover:text-white/70'
                }`}
              >
                {tab === 'all' ? 'All Markets' : tab}
                {tab === 'watchlist' && watchlist.size > 0 && (
                  <span className="ml-1 px-1 rounded bg-amber-400/20 text-amber-400">{watchlist.size}</span>
                )}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/8 p-4 flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Table */}
          <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
            {loading && tickers.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              </div>
            ) : displayTickers.length === 0 ? (
              <div className="py-12 text-center text-white/30 text-sm">
                {activeTab === 'watchlist' ? 'No watchlisted symbols — click ☆ to add' : 'No data available'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/8 text-white/30">
                      <th className="py-2.5 px-3 w-8" />
                      <th className="py-2.5 px-3 text-left cursor-pointer hover:text-white/60" onClick={() => handleSort('symbol')}>
                        <span className="flex items-center gap-1">Symbol <SortIcon k="symbol" /></span>
                      </th>
                      <th className="py-2.5 px-3 text-right cursor-pointer hover:text-white/60" onClick={() => handleSort('price')}>
                        <span className="flex items-center justify-end gap-1">Price <SortIcon k="price" /></span>
                      </th>
                      <th className="py-2.5 px-3 text-right cursor-pointer hover:text-white/60" onClick={() => handleSort('changePct24h')}>
                        <span className="flex items-center justify-end gap-1">24h % <SortIcon k="changePct24h" /></span>
                      </th>
                      <th className="py-2.5 px-3 text-right hidden md:table-cell cursor-pointer hover:text-white/60" onClick={() => handleSort('volume24h')}>
                        <span className="flex items-center justify-end gap-1">Volume <SortIcon k="volume24h" /></span>
                      </th>
                      <th className="py-2.5 px-3 text-right hidden lg:table-cell">Momentum</th>
                      <th className="py-2.5 px-3 w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {displayTickers.map(t => (
                      <TickerRow
                        key={t.symbol}
                        ticker={t}
                        watchlist={watchlist}
                        onToggleWatch={toggleWatch}
                        onSelect={sym => navigate(`/dashboard/trading/chart?symbol=${sym}`)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Provider attribution */}
          <div className="text-center text-xs text-white/15 pb-4">
            Market data refreshes automatically when a configured source is available. Timestamps show the latest successful update.
          </div>
        </div>
      </div>
    </>
  );
}
