/**
 * LiveMarketsSection — homepage real-time market data panel
 *
 * Displays:
 *  - Top Gainers   (from /api/market/summary)
 *  - Top Losers
 *  - Trending
 *  - Live ticker strip (BTC/ETH/SOL/BNB/XRP/ADA)
 *  - WS connection status badge
 *  - Link to full markets page
 *
 * Data source: useMarketSummary (REST, 30s) + useMarketWebSocket (WS/REST, 3-8s)
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Flame, ArrowRight,
  BarChart2, Zap, RefreshCw, Globe,
} from 'lucide-react';
import { useMarketSummary } from '@/hooks/useMarketData';
import { useMarketWebSocket } from '@/lib/useMarketWebSocket';
import { WsStatusBadge } from '@/components/WsStatusBadge';

// ── Constants ─────────────────────────────────────────────────────────────────

const GOLD = '#C9A84C';

const ASSET_COLORS: Record<string, string> = {
  BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF', BNB: '#F3BA2F',
  XRP: '#346AA9', ADA: '#0033AD', DOGE: '#C2A633', AVAX: '#E84142',
  MATIC: '#8247E5', DOT: '#E6007A', LINK: '#2A5ADA', UNI: '#FF007A',
  USDT: '#26A17B', USDC: '#2775CA',
};

const TICKER_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT'];

type Tab = 'gainers' | 'losers' | 'trending';

// ── Helpers ───────────────────────────────────────────────────────────────────

function assetColor(symbol: string): string {
  const base = symbol.replace(/USDT$|USD$/, '').toUpperCase();
  return ASSET_COLORS[base] ?? GOLD;
}

function assetInitial(symbol: string): string {
  return symbol.replace(/USDT$|USD$/, '')[0]?.toUpperCase() ?? '?';
}

function formatPrice(n: number): string {
  if (n >= 10_000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (n >= 1)      return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 0.01)   return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

function formatVol(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface AssetRowProps {
  rank:   number;
  symbol: string;
  name?:  string;
  price:  number;
  change: number;
  volume?: number;
  delay?: number;
}

function AssetRow({ rank, symbol, name, price, change, volume, delay = 0 }: AssetRowProps) {
  const color = assetColor(symbol);
  const up    = change >= 0;
  const base  = symbol.replace(/USDT$|USD$/, '').toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.03] transition-colors group cursor-default"
    >
      {/* Rank */}
      <span className="text-[11px] font-bold text-white/20 w-4 shrink-0 text-center">{rank}</span>

      {/* Icon */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
      >
        {assetInitial(symbol)}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white/85 truncate">{base}</p>
        {name && <p className="text-[10px] text-white/30 truncate">{name}</p>}
      </div>

      {/* Volume */}
      {volume !== undefined && (
        <span className="text-[10px] text-white/25 hidden sm:block shrink-0">{formatVol(volume)}</span>
      )}

      {/* Price */}
      <div className="text-right shrink-0 min-w-[72px]">
        <p className="text-sm font-semibold text-white/80 tabular-nums">{formatPrice(price)}</p>
        <p className={`text-xs font-bold flex items-center justify-end gap-0.5 ${up ? 'text-emerald-400' : 'text-red-400'}`}>
          {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
          {up ? '+' : ''}{change.toFixed(2)}%
        </p>
      </div>
    </motion.div>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      className="flex items-center gap-3 px-4 py-3"
    >
      <div className="w-4 h-3 rounded bg-white/5 animate-pulse" />
      <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-16 rounded bg-white/5 animate-pulse" />
        <div className="h-2 w-10 rounded bg-white/[0.03] animate-pulse" />
      </div>
      <div className="space-y-1.5 text-right">
        <div className="h-3 w-16 rounded bg-white/5 animate-pulse ml-auto" />
        <div className="h-2 w-10 rounded bg-white/[0.03] animate-pulse ml-auto" />
      </div>
    </motion.div>
  );
}

// ── Mini ticker pill ──────────────────────────────────────────────────────────

function TickerPill({ symbol }: { symbol: string }) {
  const { tickers } = useMarketWebSocket([symbol], 8_000);
  const t = tickers.get(symbol);
  const color = assetColor(symbol);
  const base  = symbol.replace('USDT', '');

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl glass-card border border-white/[0.06] shrink-0">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
        style={{ background: `${color}20`, color }}
      >
        {base[0]}
      </div>
      <div>
        <p className="text-[10px] font-semibold text-white/60">{base}</p>
        <AnimatePresence mode="popLayout">
          <motion.p
            key={t?.priceStr ?? 'loading'}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className="text-xs font-bold text-white/90 tabular-nums"
          >
            {t?.priceStr ?? '—'}
          </motion.p>
        </AnimatePresence>
      </div>
      {t && (
        <span className={`text-[9px] font-bold ${t.up ? 'text-emerald-400' : 'text-red-400'}`}>
          {t.changeStr}
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function LiveMarketsSection() {
  const [activeTab, setActiveTab] = useState<Tab>('gainers');
  const { summary, loading } = useMarketSummary('crypto', 30_000);
  const { status, isLive, source } = useMarketWebSocket(TICKER_SYMBOLS, 8_000);

  const tabs: { key: Tab; label: string; icon: React.ElementType; color: string }[] = [
    { key: 'gainers',  label: 'Top Gainers',  icon: TrendingUp,   color: '#10b981' },
    { key: 'losers',   label: 'Top Losers',   icon: TrendingDown, color: '#f87171' },
    { key: 'trending', label: 'Trending',     icon: Flame,        color: GOLD      },
  ];

  const rows =
    activeTab === 'gainers'  ? (summary?.gainers  ?? []) :
    activeTab === 'losers'   ? (summary?.losers   ?? []) :
                               (summary?.trending ?? []);

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-[0.04] blur-[100px] pointer-events-none"
        style={{ background: `radial-gradient(ellipse, ${GOLD} 0%, transparent 70%)` }} />

      <div className="container mx-auto px-4 md:px-6 relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10"
        >
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 tracking-widest uppercase">
                Live Markets
              </span>
              <WsStatusBadge status={status} isLive={isLive} source={source} />
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight leading-tight">
              Real-time <span className="text-gold-gradient">market data</span>
            </h2>
            <p className="text-foreground/45 mt-3 max-w-lg leading-relaxed">
              Live prices across crypto, forex, and equities — powered by Coinbase, Kraken, and more.
              Updates every 3 seconds via WebSocket.
            </p>
          </div>
          <Link
            to="/dashboard/trading/markets"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors shrink-0"
          >
            <Globe size={14} />
            Full screener
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>

        {/* Live ticker pills */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-none"
        >
          {TICKER_SYMBOLS.map(sym => (
            <TickerPill key={sym} symbol={sym} />
          ))}
        </motion.div>

        {/* Main panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="glass-card rounded-3xl border border-white/[0.07] overflow-hidden"
        >
          {/* Tab bar */}
          <div className="flex border-b border-white/[0.06] px-2 pt-2">
            {tabs.map(tab => {
              const Icon    = tab.icon;
              const active  = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-colors rounded-t-xl ${
                    active ? 'text-white' : 'text-white/35 hover:text-white/60'
                  }`}
                >
                  <Icon size={13} style={{ color: active ? tab.color : undefined }} />
                  {tab.label}
                  {active && (
                    <motion.div
                      layoutId="market-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                      style={{ background: tab.color }}
                    />
                  )}
                </button>
              );
            })}

            {/* Refresh indicator */}
            <div className="ml-auto flex items-center pr-4">
              {loading ? (
                <RefreshCw size={12} className="text-white/20 animate-spin" />
              ) : (
                <span className="text-[10px] text-white/20">30s refresh</span>
              )}
            </div>
          </div>

          {/* Rows */}
          <div className="py-2">
            {/* Column headers */}
            <div className="flex items-center gap-3 px-4 py-1.5 mb-1">
              <span className="w-4 shrink-0" />
              <span className="w-8 shrink-0" />
              <span className="flex-1 text-[10px] font-semibold text-white/20 uppercase tracking-widest">Asset</span>
              <span className="text-[10px] font-semibold text-white/20 uppercase tracking-widest hidden sm:block w-16 text-right">Volume</span>
              <span className="text-[10px] font-semibold text-white/20 uppercase tracking-widest w-[72px] text-right">Price / 24h</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {loading ? (
                  Array.from({ length: 7 }).map((_, i) => (
                    <SkeletonRow key={i} delay={i * 0.04} />
                  ))
                ) : rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <BarChart2 className="w-10 h-10 text-white/10" />
                    <p className="text-sm text-white/25">Market data loading…</p>
                    <p className="text-xs text-white/15">Connecting to Coinbase · Kraken</p>
                  </div>
                ) : (
                  rows.slice(0, 8).map((row, i) => (
                    <AssetRow
                      key={row.symbol ?? i}
                      rank={i + 1}
                      symbol={row.symbol ?? ''}
                      name={row.name}
                      price={row.price ?? 0}
                      change={row.changePct24h ?? row.change24h ?? 0}
                      volume={row.volume24h}
                      delay={i * 0.04}
                    />
                  ))
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.05] px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] text-white/20">
              <Zap size={10} className="text-primary/50" />
              <span>Powered by Coinbase · Kraken · Alpha Vantage · Finnhub · Polygon · Twelve Data</span>
            </div>
            <Link
              to="/dashboard/trading/markets"
              className="text-[11px] font-semibold text-primary/70 hover:text-primary transition-colors flex items-center gap-1"
            >
              View all <ArrowRight size={10} />
            </Link>
          </div>
        </motion.div>

        {/* Bottom CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6"
        >
          {[
            { icon: TrendingUp,  color: '#10b981', label: 'Advanced Charts',   sub: 'Candlestick, OHLCV, indicators',  href: '/dashboard/trading/chart'   },
            { icon: BarChart2,   color: GOLD,      label: 'Order Book',        sub: 'Real-time bid/ask depth',          href: '/dashboard/trading/chart'   },
            { icon: Flame,       color: '#f87171', label: 'Market Screener',   sub: 'Filter by volume, change, cap',    href: '/dashboard/trading/markets' },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <Link
                key={i}
                to={item.href}
                className="group flex items-center gap-3 p-4 glass-card rounded-2xl border border-white/[0.06] hover:border-primary/20 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                  style={{ background: `${item.color}15` }}>
                  <Icon size={16} style={{ color: item.color }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/80">{item.label}</p>
                  <p className="text-[10px] text-white/30">{item.sub}</p>
                </div>
                <ArrowRight size={13} className="ml-auto text-white/15 group-hover:text-primary/50 transition-colors" />
              </Link>
            );
          })}
        </motion.div>

      </div>
    </section>
  );
}
