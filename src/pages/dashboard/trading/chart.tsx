/**
 * /dashboard/trading/chart — Price Chart + Order Placement + Alerts
 * Candlestick chart, live price, place market/limit/stop orders,
 * set price alerts, view order book, OHLC indicators
 */
import { useState, useEffect, useCallback } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, RefreshCw, Loader2,
  AlertTriangle, ChevronDown, Zap, ShieldAlert, Target,
  CheckCircle, LineChart, BarChart2, Bell, BellRing, Star,
  StarOff, X, ChevronRight,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';
import { useTicker, useCandles, useOrderBook, type CandleInterval } from '@/hooks/useMarketData';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Candle { t: number; o: number; h: number; l: number; c: number; v: number; }

interface PriceAlert {
  id: string; symbol: string; targetPrice: number;
  condition: 'above' | 'below'; status: string;
  triggered?: boolean; currentPrice?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, d = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPrice(n: number): string {
  if (n >= 1000) return fmt(n, 2);
  if (n >= 1)    return fmt(n, 4);
  return fmt(n, 6);
}
function fmtVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

const ASSET_COLORS: Record<string, string> = {
  crypto: '#F7931A', forex: '#627EEA', stock: '#10B981', commodity: '#C9A84C', etf: '#9945FF',
};

const POPULAR_SYMBOLS = [
  { symbol: 'BTC/USD', assetClass: 'crypto' },
  { symbol: 'ETH/USD', assetClass: 'crypto' },
  { symbol: 'EUR/USD', assetClass: 'forex' },
  { symbol: 'AAPL',    assetClass: 'stock' },
  { symbol: 'NVDA',    assetClass: 'stock' },
  { symbol: 'XAU/USD', assetClass: 'commodity' },
  { symbol: 'SPY',     assetClass: 'etf' },
];

// ── Alert Set Modal ───────────────────────────────────────────────────────────

function AlertSetModal({ symbol, currentPrice, onClose, onSave }: {
  symbol: string; currentPrice: number;
  onClose: () => void;
  onSave: (targetPrice: number, condition: 'above' | 'below') => void;
}) {
  const [targetPrice, setTargetPrice] = useState(currentPrice.toFixed(2));
  const [condition, setCondition]     = useState<'above' | 'below'>('above');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 32 }}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-white">Set Alert — {symbol}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/8 px-4 py-2.5 flex justify-between text-xs">
          <span className="text-white/40">Current Price</span>
          <span className="text-white font-mono">${fmtPrice(currentPrice)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['above', 'below'] as const).map(c => (
            <button key={c} onClick={() => setCondition(c)}
              className={`py-2.5 rounded-xl text-sm font-semibold capitalize transition-all ${
                condition === c
                  ? c === 'above' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/30' : 'bg-red-500/20 text-red-400 border border-red-400/30'
                  : 'bg-white/5 text-white/40 hover:bg-white/10'
              }`}>
              {c === 'above' ? '↑ Above' : '↓ Below'}
            </button>
          ))}
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Target Price (USD)</label>
          <div className="flex items-center gap-2 bg-white/8 border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-amber-400/50">
            <span className="text-white/30 text-sm">$</span>
            <input type="number" step="any" min="0" value={targetPrice}
              onChange={e => setTargetPrice(e.target.value)}
              className="flex-1 bg-transparent text-white text-sm font-mono outline-none" />
          </div>
        </div>
        <button
          onClick={() => { const tp = parseFloat(targetPrice); if (tp > 0) { onSave(tp, condition); onClose(); } }}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
          style={{ background: 'rgba(201,168,76,0.18)', border: '1px solid rgba(201,168,76,0.28)', color: '#C9A84C' }}>
          <Bell className="w-4 h-4" /> Set Alert
        </button>
      </motion.div>
    </div>
  );
}

// ── Mini Candlestick Chart ────────────────────────────────────────────────────

function CandleChart({ candles, color, alertLines = [] }: { candles: Candle[]; color: string; alertLines?: { price: number; condition: string }[] }) {
  if (!candles.length) return null;
  const W = 600; const H = 200;
  const prices = candles.flatMap(c => [c.h, c.l]);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const candleW = Math.max(2, (W / candles.length) - 1);

  const toY = (p: number) => H - ((p - minP) / range) * H;

  // Line path for close prices
  const linePath = candles.map((c, i) => {
    const x = (i / (candles.length - 1)) * W;
    const y = toY(c.c);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={`${linePath} L ${W} ${H} L 0 ${H} Z`} fill="url(#chartGrad)" />
      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" />
      {/* Candles */}
      {candles.map((c, i) => {
        const x  = (i / (candles.length - 1)) * W;
        const up = c.c >= c.o;
        const clr = up ? '#10B981' : '#EF4444';
        const bodyTop    = toY(Math.max(c.o, c.c));
        const bodyBottom = toY(Math.min(c.o, c.c));
        const bodyH      = Math.max(1, bodyBottom - bodyTop);
        return (
          <g key={i}>
            <line x1={x} y1={toY(c.h)} x2={x} y2={toY(c.l)} stroke={clr} strokeWidth="0.8" opacity="0.6" />
            <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={clr} opacity="0.8" rx="0.5" />
          </g>
        );
      })}
      {/* Alert lines */}
      {alertLines.map((al, i) => {
        const y = toY(al.price);
        if (y < 0 || y > H) return null;
        const lineColor = al.condition === 'above' ? '#10B981' : '#EF4444';
        return (
          <g key={i}>
            <line x1={0} y1={y} x2={W} y2={y} stroke={lineColor} strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
            <rect x={W - 60} y={y - 8} width={58} height={14} fill={lineColor} opacity="0.2" rx="2" />
            <text x={W - 4} y={y + 4} textAnchor="end" fill={lineColor} fontSize="8" opacity="0.9">
              ${al.price.toFixed(2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Order Form ────────────────────────────────────────────────────────────────

function OrderForm({ symbol, assetClass, currentPrice, token, onSuccess }: {
  symbol: string; assetClass: string; currentPrice: number;
  token: string; onSuccess: () => void;
}) {
  const [side, setSide]         = useState<'buy' | 'sell'>('buy');
  const [type, setType]         = useState<'market' | 'limit' | 'stop'>('market');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice]       = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [leverage, setLeverage] = useState('1');
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const qty    = parseFloat(quantity) || 0;
  const lev    = parseInt(leverage) || 1;
  const fillPx = type === 'market' ? currentPrice : (parseFloat(price) || currentPrice);
  const notional = qty * fillPx * lev;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qty || qty <= 0) { setError('Enter a valid quantity'); return; }
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        symbol, assetClass, side, type, quantity: qty, currency: 'USD', leverage: lev,
      };
      if (type === 'limit' && price) body.price = parseFloat(price);
      if (type === 'stop' && price) body.stopPrice = parseFloat(price);
      if (stopLoss)   body.stopLoss   = parseFloat(stopLoss);
      if (takeProfit) body.takeProfit = parseFloat(takeProfit);

      const res = await fetch('/api/users/trading/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Order failed');
      setSuccess(true);
      setQuantity('');
      setPrice('');
      setStopLoss('');
      setTakeProfit('');
      setTimeout(() => { setSuccess(false); onSuccess(); }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Order failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Buy / Sell toggle */}
      <div className="grid grid-cols-2 gap-2">
        {(['buy', 'sell'] as const).map(s => (
          <button
            key={s} type="button"
            onClick={() => setSide(s)}
            className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
              side === s
                ? s === 'buy'
                  ? 'bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.3)]'
                  : 'bg-red-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.3)]'
                : 'bg-white/8 text-white/50 hover:bg-white/12'
            }`}
          >
            {s === 'buy' ? '↑ Buy / Long' : '↓ Sell / Short'}
          </button>
        ))}
      </div>

      {/* Order type */}
      <div className="grid grid-cols-3 gap-1.5">
        {(['market', 'limit', 'stop'] as const).map(t => (
          <button
            key={t} type="button"
            onClick={() => setType(t)}
            className={`py-2 rounded-xl text-xs font-medium transition-all capitalize ${
              type === t ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' : 'bg-white/5 text-white/40 hover:bg-white/10'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Quantity */}
      <div>
        <label className="text-xs text-white/40 mb-1.5 block">Quantity</label>
        <input
          type="number" step="any" min="0" value={quantity}
          onChange={e => setQuantity(e.target.value)}
          placeholder="0.00"
          className="w-full bg-white/8 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-mono placeholder-white/20 focus:outline-none focus:border-amber-400/50"
        />
      </div>

      {/* Limit / Stop price */}
      {type !== 'market' && (
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">
            {type === 'limit' ? 'Limit Price' : 'Stop Price'} (USD)
          </label>
          <input
            type="number" step="any" min="0" value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder={`$${fmtPrice(currentPrice)}`}
            className="w-full bg-white/8 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-mono placeholder-white/20 focus:outline-none focus:border-amber-400/50"
          />
        </div>
      )}

      {/* SL / TP */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-white/40 mb-1.5 block flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-red-400" /> Stop Loss
          </label>
          <input
            type="number" step="any" min="0" value={stopLoss}
            onChange={e => setStopLoss(e.target.value)}
            placeholder="Optional"
            className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono placeholder-white/20 focus:outline-none focus:border-red-400/50"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1.5 block flex items-center gap-1">
            <Target className="w-3 h-3 text-emerald-400" /> Take Profit
          </label>
          <input
            type="number" step="any" min="0" value={takeProfit}
            onChange={e => setTakeProfit(e.target.value)}
            placeholder="Optional"
            className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono placeholder-white/20 focus:outline-none focus:border-emerald-400/50"
          />
        </div>
      </div>

      {/* Leverage */}
      <div>
        <label className="text-xs text-white/40 mb-1.5 flex items-center justify-between">
          <span>Leverage</span>
          <span className="text-amber-400 font-mono">{lev}x</span>
        </label>
        <input
          type="range" min="1" max="100" step="1" value={leverage}
          onChange={e => setLeverage(e.target.value)}
          className="w-full accent-amber-400"
        />
        <div className="flex justify-between text-xs text-white/20 mt-1">
          <span>1x</span><span>25x</span><span>50x</span><span>100x</span>
        </div>
      </div>

      {/* Notional */}
      {qty > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/8 px-4 py-3 flex justify-between text-xs">
          <span className="text-white/40">Notional Value</span>
          <span className="text-white font-mono font-semibold">${fmt(notional)}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-400/10 border border-red-400/20 px-4 py-2.5 flex items-center gap-2 text-xs text-red-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || success}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
          success
            ? 'bg-emerald-500 text-white'
            : side === 'buy'
              ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.25)]'
              : 'bg-red-500 hover:bg-red-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.25)]'
        } disabled:opacity-60`}
      >
        {loading  ? <Loader2 className="w-4 h-4 animate-spin" /> :
         success  ? <><CheckCircle className="w-4 h-4" /> Order Placed!</> :
         <><Zap className="w-4 h-4" /> Place {type.charAt(0).toUpperCase() + type.slice(1)} Order</>
        }
      </button>
    </form>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ChartPage() {
  const { token } = useCustomerAuth();
  const [searchParams] = useSearchParams();

  const [symbol, setSymbol]     = useState(searchParams.get('symbol') ?? 'BTCUSDT');
  const [assetClass, setAssetClass] = useState('crypto');
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const [candleInterval, setCandleInterval] = useState<CandleInterval>('1h');
  const [showOrderBook, setShowOrderBook]   = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alerts, setAlerts]     = useState<PriceAlert[]>([]);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  // ── Live data hooks ────────────────────────────────────────────────────────
  const { tickers, loading, error } = useTicker([symbol], 'crypto', 5000);
  const marketData = tickers[0] ?? null;

  const { candles: rawCandles, loading: candlesLoading } = useCandles(
    symbol, candleInterval, 200, 'crypto', 30000
  );
  const candles: Candle[] = rawCandles.map(c => ({
    t: c.time, o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume,
  }));

  const { orderBook, loading: obLoading } = useOrderBook(
    showOrderBook ? symbol : '',
    20, 'crypto', 3000
  );

  // Load alerts and watchlist status
  const loadAlerts = useCallback(async () => {
    if (!token) return;
    try {
      const [aRes, wRes] = await Promise.all([
        fetch('/api/users/trading/alerts',    { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/users/trading/watchlist', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (aRes.ok) {
        const d = await aRes.json() as { alerts: PriceAlert[] };
        setAlerts((d.alerts ?? []).filter(a => a.symbol === symbol));
      }
      if (wRes.ok) {
        const d = await wRes.json() as { watchlist: { symbol: string }[] };
        setInWatchlist((d.watchlist ?? []).some(w => w.symbol === symbol));
      }
    } catch { /* silent */ }
  }, [token, symbol]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const handleSymbolSelect = (sym: string, cls: string) => {
    setSymbol(sym);
    setAssetClass(cls);
    setShowSymbolPicker(false);
  };

  const handleSetAlert = async (targetPrice: number, condition: 'above' | 'below') => {
    if (!token) return;
    try {
      await fetch('/api/users/trading/alerts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', symbol, assetClass, targetPrice, condition }),
      });
      loadAlerts();
    } catch { /* silent */ }
  };

  const handleToggleWatchlist = async () => {
    if (!token) return;
    setWatchlistLoading(true);
    try {
      await fetch('/api/users/trading/watchlist', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: inWatchlist ? 'remove' : 'add', symbol, assetClass }),
      });
      setInWatchlist(v => !v);
    } catch { /* silent */ } finally {
      setWatchlistLoading(false);
    }
  };

  const acColor = ASSET_COLORS[assetClass] ?? '#C9A84C';
  const up = (marketData?.changePct24h ?? 0) >= 0;
  const symbolAlerts = alerts.filter(a => a.status === 'active');
  const triggeredAlerts = alerts.filter(a => a.triggered);

  return (
    <>
      <Helmet>
        <title>{symbol} Chart — City Gate Capital</title>
        <meta name="description" content={`Live ${symbol} price chart and order placement on City Gate Capital.`} />
        <link rel="canonical" href="https://citygate.capital/dashboard/trading/chart" />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
        <h1 className="sr-only">{symbol} Price Chart — City Gate Capital</h1>

        {/* Alert modal */}
        <AnimatePresence>
          {showAlertModal && marketData && (
            <AlertSetModal
              symbol={symbol}
              currentPrice={marketData.price}
              onClose={() => setShowAlertModal(false)}
              onSave={handleSetAlert}
            />
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="border-b border-white/8 bg-[#0A0A0A]/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
            <Link to="/dashboard/trading" className="text-white/40 hover:text-white transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-px h-5 bg-white/10 shrink-0" />

            {/* Symbol selector */}
            <button
              onClick={() => setShowSymbolPicker(v => !v)}
              className="flex items-center gap-2 hover:bg-white/8 rounded-xl px-3 py-2 transition-colors"
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: acColor }} />
              <span className="font-bold text-white">{symbol}</span>
              <ChevronDown className="w-4 h-4 text-white/40" />
            </button>

            {/* Live price */}
            {marketData && (
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold font-mono text-white">
                  ${fmtPrice(marketData.price)}
                </span>
                <span className={`text-sm font-mono font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                  {up ? '+' : ''}{marketData.changePct24h.toFixed(2)}%
                </span>
                <span className="text-xs text-white/30 hidden sm:inline">
                  Vol: {fmtVol(marketData.volume24h)}
                </span>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {/* Watchlist toggle */}
              <button onClick={handleToggleWatchlist} disabled={watchlistLoading}
                className={`p-2 rounded-xl transition-all ${inWatchlist ? 'text-amber-400 bg-amber-400/15' : 'text-white/30 hover:text-white/60 hover:bg-white/8'}`}
                title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}>
                {inWatchlist ? <Star className="w-4 h-4 fill-amber-400" /> : <StarOff className="w-4 h-4" />}
              </button>
              {/* Alert button */}
              <button onClick={() => setShowAlertModal(true)}
                className={`p-2 rounded-xl transition-all relative ${symbolAlerts.length > 0 ? 'text-amber-400 bg-amber-400/15' : 'text-white/30 hover:text-white/60 hover:bg-white/8'}`}
                title="Set price alert">
                {triggeredAlerts.length > 0 ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                {symbolAlerts.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 text-black text-[8px] font-bold flex items-center justify-center">
                    {symbolAlerts.length}
                  </span>
                )}
              </button>
              {/* Interval selector */}
              <div className="flex gap-1">
                {([
                  { label: '15m', val: '15m' as CandleInterval },
                  { label: '1H',  val: '1h'  as CandleInterval },
                  { label: '4H',  val: '4h'  as CandleInterval },
                  { label: '1D',  val: '1d'  as CandleInterval },
                ] as const).map(({ label, val }) => (
                  <button
                    key={val}
                    onClick={() => setCandleInterval(val)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      candleInterval === val ? 'bg-amber-400/20 text-amber-400' : 'text-white/30 hover:text-white/60'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Order book toggle */}
              <button
                onClick={() => setShowOrderBook(v => !v)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  showOrderBook ? 'bg-amber-400/20 text-amber-400' : 'text-white/30 hover:text-white/60'
                }`}
              >
                Book
              </button>
              <button
                disabled={candlesLoading}
                className="p-2 rounded-xl hover:bg-white/8 transition-colors text-white/50 hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 ${candlesLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Symbol picker dropdown */}
        <AnimatePresence>
          {showSymbolPicker && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute top-16 left-0 right-0 z-30 bg-[#111] border-b border-white/10 shadow-2xl"
            >
              <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
                <div className="text-xs text-white/30 mb-3 font-medium">Popular Instruments</div>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_SYMBOLS.map(({ symbol: sym, assetClass: cls }) => (
                    <button
                      key={sym}
                      onClick={() => handleSymbolSelect(sym, cls)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        symbol === sym ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' : 'bg-white/8 text-white/70 hover:bg-white/12'
                      }`}
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: ASSET_COLORS[cls] }} />
                      {sym}
                    </button>
                  ))}
                </div>
                <Link
                  to="/dashboard/trading/markets"
                  onClick={() => setShowSymbolPicker(false)}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Browse all markets <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 py-4 flex flex-col lg:flex-row gap-4">
          {/* Chart area */}
          <div className="flex-1 min-w-0 space-y-4">
            {loading && (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              </div>
            )}
            {error && !loading && (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/8 p-6 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
            {!loading && !error && candles.length > 0 && (
              <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
                  <LineChart className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-white">{symbol} — Price Chart</span>
                  <span className="text-xs text-white/30 ml-auto">
                    {candleInterval} candles
                  </span>
                </div>
                <div className="h-64 sm:h-80 p-4">
                  <CandleChart
                    candles={candles}
                    color={acColor}
                    alertLines={symbolAlerts.map(a => ({ price: a.targetPrice, condition: a.condition }))}
                  />
                </div>
                {/* OHLC summary */}
                {candles.length > 0 && (() => {
                  const last = candles[candles.length - 1];
                  return (
                    <div className="px-4 pb-4 grid grid-cols-4 gap-3">
                      {[
                        { label: 'Open',  value: fmtPrice(last.o) },
                        { label: 'High',  value: fmtPrice(last.h) },
                        { label: 'Low',   value: fmtPrice(last.l) },
                        { label: 'Close', value: fmtPrice(last.c) },
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center">
                          <div className="text-xs text-white/30">{label}</div>
                          <div className="text-xs font-mono text-white mt-0.5">${value}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Market stats */}
            {marketData && !loading && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '24h Change', value: `${up ? '+' : ''}${marketData.changePct24h.toFixed(2)}%`, color: up ? '#10B981' : '#EF4444' },
                  { label: '24h Volume', value: `$${fmtVol(marketData.volume24h)}`, color: '#C9A84C' },
                  { label: 'Live Price', value: `$${fmtPrice(marketData.price)}`, color: acColor },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-white/3 p-4 text-center">
                    <div className="text-xs text-white/30 mb-1">{label}</div>
                    <div className="text-sm font-mono font-bold" style={{ color }}>{value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Active alerts for this symbol */}
            {symbolAlerts.length > 0 && (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-amber-400/15 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-amber-400">Active Alerts</span>
                  <Link to="/dashboard/trading/watchlist" className="ml-auto text-xs text-amber-400/60 hover:text-amber-400 flex items-center gap-0.5 transition-colors">
                    Manage <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="divide-y divide-amber-400/10">
                  {symbolAlerts.map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        a.condition === 'above' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-red-400/15 text-red-400'
                      }`}>
                        {a.condition === 'above' ? '↑ ABOVE' : '↓ BELOW'}
                      </span>
                      <span className="text-sm font-mono text-white">${fmtPrice(a.targetPrice)}</span>
                      {a.triggered && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-400 font-semibold animate-pulse ml-auto">TRIGGERED</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order Book */}
            {showOrderBook && (
              <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-white">Order Book</span>
                  {obLoading && <Loader2 className="w-3 h-3 text-white/30 animate-spin ml-auto" />}
                </div>
                {orderBook ? (
                  <div className="grid grid-cols-2 divide-x divide-white/8">
                    {/* Bids */}
                    <div className="p-3">
                      <div className="text-xs text-emerald-400 font-medium mb-2">Bids</div>
                      <div className="space-y-0.5">
                        {orderBook.bids.slice(0, 10).map((b, i) => (
                          <div key={i} className="flex justify-between text-xs font-mono">
                            <span className="text-emerald-400">${b.price.toFixed(2)}</span>
                            <span className="text-white/40">{b.quantity.toFixed(4)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Asks */}
                    <div className="p-3">
                      <div className="text-xs text-red-400 font-medium mb-2">Asks</div>
                      <div className="space-y-0.5">
                        {orderBook.asks.slice(0, 10).map((a, i) => (
                          <div key={i} className="flex justify-between text-xs font-mono">
                            <span className="text-red-400">${a.price.toFixed(2)}</span>
                            <span className="text-white/40">{a.quantity.toFixed(4)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-white/30 text-xs">Loading order book…</div>
                )}
              </div>
            )}
          </div>

          {/* Order panel */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="rounded-2xl border border-white/8 bg-white/3 p-5 sticky top-20">
              <div className="flex items-center gap-2 mb-5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-white text-sm">Place Order</span>
                <span className="text-xs text-white/30 ml-auto">{symbol}</span>
              </div>
              {token && marketData ? (
                <OrderForm
                  symbol={symbol}
                  assetClass={assetClass}
                  currentPrice={marketData.price}
                  token={token}
                  onSuccess={() => loadAlerts()}
                />
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
