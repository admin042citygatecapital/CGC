/**
 * /dashboard/trading/spot — Full-page Spot Trading Terminal
 * Market / Limit / Stop orders · SL/TP · Leverage · Paper-trading order book
 * Live price feed · Position sizing · Risk calculator
 */
import { useTicker, type Ticker } from '@/hooks/useMarketData';
import { fmtFixed as fmt, fmtPrice, fmtCompactUsd as fmtUsd } from '@/lib/fmt';
import { useCustomerAuth } from '@/lib/customerAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
Activity,
AlertTriangle,
ArrowLeft,
BarChart2,BookOpen,
CheckCircle,
ChevronDown,ChevronUp,
DollarSign,
Info,
Loader2,
ShieldAlert,Target,
X,
Zap
} from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useEffect,useRef,useState } from 'react';
import { Link,useSearchParams } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GOLD    = '#C9A84C';
const EMERALD = '#10B981';
const RED     = '#EF4444';
const BLUE    = '#627EEA';

const SYMBOLS = [
  { symbol: 'BTCUSDT',  label: 'BTC/USDT',  assetClass: 'crypto' },
  { symbol: 'ETHUSDT',  label: 'ETH/USDT',  assetClass: 'crypto' },
  { symbol: 'SOLUSDT',  label: 'SOL/USDT',  assetClass: 'crypto' },
  { symbol: 'BNBUSDT',  label: 'BNB/USDT',  assetClass: 'crypto' },
  { symbol: 'XRPUSDT',  label: 'XRP/USDT',  assetClass: 'crypto' },
  { symbol: 'ADAUSDT',  label: 'ADA/USDT',  assetClass: 'crypto' },
  { symbol: 'DOGEUSDT', label: 'DOGE/USDT', assetClass: 'crypto' },
  { symbol: 'AVAXUSDT', label: 'AVAX/USDT', assetClass: 'crypto' },
];

const LEVERAGE_PRESETS = [1, 2, 5, 10, 20, 50, 100];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Order book mock (replace with real WS feed when available)
// ─────────────────────────────────────────────────────────────────────────────

function generateOrderBook(midPrice: number) {
  const asks: { price: number; qty: number; total: number }[] = [];
  const bids: { price: number; qty: number; total: number }[] = [];
  let askTotal = 0; let bidTotal = 0;
  for (let i = 1; i <= 8; i++) {
    const spread = midPrice * 0.0001 * i;
    const qty = parseFloat((Math.random() * 2 + 0.1).toFixed(4));
    askTotal += qty;
    asks.push({ price: midPrice + spread, qty, total: askTotal });
  }
  for (let i = 1; i <= 8; i++) {
    const spread = midPrice * 0.0001 * i;
    const qty = parseFloat((Math.random() * 2 + 0.1).toFixed(4));
    bidTotal += qty;
    bids.push({ price: midPrice - spread, qty, total: bidTotal });
  }
  return { asks: asks.reverse(), bids };
}

// ─────────────────────────────────────────────────────────────────────────────
// Price ticker display
// ─────────────────────────────────────────────────────────────────────────────

// Receives the ticker fetched once by SpotTradingPage — subscribing to market
// data again here would open a duplicate REST poller and SSE connection for
// the same symbol.
function PriceTicker({ ticker }: { ticker: Ticker | null }) {
  const t   = ticker;
  const up  = (t?.changePct24h ?? 0) >= 0;
  const prevRef = useRef(t?.price ?? 0);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (!t) return;
    if (t.price > prevRef.current) setFlash('up');
    else if (t.price < prevRef.current) setFlash('down');
    prevRef.current = t.price;
    const id = setTimeout(() => setFlash(null), 400);
    return () => clearTimeout(id);
  }, [t]);

  return (
    <div className="flex items-baseline gap-3">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={t?.price ?? 0}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.15 }}
          className="text-3xl font-bold font-mono tabular-nums transition-colors"
          style={{ color: flash === 'up' ? EMERALD : flash === 'down' ? RED : 'white' }}
        >
          ${t ? fmtPrice(t.price) : '—'}
        </motion.span>
      </AnimatePresence>
      {t && (
        <span className={`text-sm font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
          {up ? '+' : ''}{t.changePct24h.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Order book panel
// ─────────────────────────────────────────────────────────────────────────────

type BookLevel = { price: number; qty: number; total: number };

function OrderBook({ midPrice, onPriceClick }: { midPrice: number; onPriceClick: (p: number) => void }) {
  // Random rows are built only in effects, never in the first render — a
  // server-rendered pass would otherwise disagree with the hydrated markup.
  // midPrice is read through a ref by the interval so a moving quote rebuilds
  // the book immediately without recreating the timer (which could starve it).
  const midRef = useRef(midPrice);
  const [book, setBook] = useState<{ asks: BookLevel[]; bids: BookLevel[] } | null>(null);

  useEffect(() => {
    midRef.current = midPrice;
    setBook(generateOrderBook(midPrice));
  }, [midPrice]);

  useEffect(() => {
    const id = setInterval(() => setBook(generateOrderBook(midRef.current)), 2000);
    return () => clearInterval(id);
  }, []);

  // No quote yet — show an inert placeholder instead of a synthetic book
  // centred on a meaningless $0 midpoint.
  if (midPrice <= 0 || !book) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <Activity className="w-4 h-4" style={{ color: GOLD }} />
          <span className="text-sm font-semibold text-white">Order Book</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-md border border-white/10 text-white/40 uppercase tracking-wide font-semibold">Simulated</span>
        </div>
        <div className="p-6 text-center text-xs text-white/30">Live quote unavailable — depth appears once the price feed connects.</div>
      </div>
    );
  }

  const maxTotal = Math.max(
    book.asks[0]?.total ?? 1,
    book.bids[book.bids.length - 1]?.total ?? 1,
  );

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <Activity className="w-4 h-4" style={{ color: GOLD }} />
        <span className="text-sm font-semibold text-white">Order Book</span>
        {/* The book is synthesised locally until a real depth feed is wired —
            it must be labelled so customers never read it as live market data. */}
        <span className="text-[9px] px-1.5 py-0.5 rounded-md border border-white/10 text-white/40 uppercase tracking-wide font-semibold">Simulated</span>
      </div>
      <div className="p-3 space-y-0.5">
        {/* Header */}
        <div className="grid grid-cols-3 text-[10px] text-white/25 px-1 pb-1">
          <span>Price (USD)</span>
          <span className="text-center">Amount</span>
          <span className="text-right">Total</span>
        </div>
        {/* Asks (sell orders) — reversed so lowest ask is closest to mid */}
        {(book?.asks ?? []).map((a, i) => (
          <button key={i} onClick={() => onPriceClick(a.price)}
            className="relative w-full grid grid-cols-3 text-xs px-1 py-0.5 rounded hover:bg-red-400/5 transition-colors group">
            <div className="absolute inset-0 rounded" style={{ background: `rgba(239,68,68,0.04)`, width: `${(a.total / maxTotal) * 100}%` }} />
            <span className="relative text-red-400 font-mono tabular-nums">{fmtPrice(a.price)}</span>
            <span className="relative text-white/50 text-center font-mono">{a.qty.toFixed(4)}</span>
            <span className="relative text-white/30 text-right font-mono">{a.total.toFixed(3)}</span>
          </button>
        ))}
        {/* Spread */}
        <div className="flex items-center justify-center gap-2 py-1.5 border-y border-white/[0.05] my-1">
          <span className="text-xs font-bold text-white">${fmtPrice(midPrice)}</span>
          <span className="text-[10px] text-white/25">
            Spread: ${((book?.asks[book.asks.length - 1]?.price ?? midPrice) - (book?.bids[0]?.price ?? midPrice)).toFixed(2)}
          </span>
        </div>
        {/* Bids (buy orders) */}
        {(book?.bids ?? []).map((b, i) => (
          <button key={i} onClick={() => onPriceClick(b.price)}
            className="relative w-full grid grid-cols-3 text-xs px-1 py-0.5 rounded hover:bg-emerald-400/5 transition-colors">
            <div className="absolute inset-0 rounded" style={{ background: `rgba(16,185,129,0.04)`, width: `${(b.total / maxTotal) * 100}%` }} />
            <span className="relative text-emerald-400 font-mono tabular-nums">{fmtPrice(b.price)}</span>
            <span className="relative text-white/50 text-center font-mono">{b.qty.toFixed(4)}</span>
            <span className="relative text-white/30 text-right font-mono">{b.total.toFixed(3)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk calculator
// ─────────────────────────────────────────────────────────────────────────────

function RiskCalc({
  qty, entryPrice, stopLoss, takeProfit, leverage, side,
}: {
  qty: number; entryPrice: number; stopLoss: number; takeProfit: number;
  leverage: number; side: 'buy' | 'sell';
}) {
  if (!qty || !entryPrice) return null;
  const notional  = qty * entryPrice;
  const margin    = notional / leverage;

  // Levels must sit on the side of entry that the order direction implies:
  // a long loses below entry and takes profit above it; a short mirrors that.
  const slOnSide  = side === 'buy' ? stopLoss < entryPrice : stopLoss > entryPrice;
  const tpOnSide  = side === 'buy' ? takeProfit > entryPrice : takeProfit < entryPrice;
  const slUsable  = stopLoss > 0 && slOnSide;
  const tpUsable  = takeProfit > 0 && tpOnSide;
  const slDist    = slUsable ? Math.abs(entryPrice - stopLoss) : 0;
  const tpDist    = tpUsable ? Math.abs(takeProfit - entryPrice) : 0;
  // PnL estimates scale with leverage to match the server's position math.
  const slPnl     = slUsable ? -slDist * qty * leverage : null;
  const tpPnl     = tpUsable ?  tpDist * qty * leverage : null;
  const rr        = slDist > 0 && tpDist > 0 ? (tpDist / slDist).toFixed(2) : null;
  const slHint    = stopLoss > 0 && !slOnSide
    ? `For a ${side === 'buy' ? 'long' : 'short'} position, the stop-loss should be ${side === 'buy' ? 'below' : 'above'} the entry price.`
    : null;
  const tpHint    = takeProfit > 0 && !tpOnSide
    ? `For a ${side === 'buy' ? 'long' : 'short'} position, the take-profit should be ${side === 'buy' ? 'above' : 'below'} the entry price.`
    : null;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Info className="w-3 h-3 text-white/30" />
        <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Risk Summary</span>
      </div>
      {(slHint || tpHint) && (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/5 px-2.5 py-2">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
          <div className="text-[10px] leading-relaxed text-amber-200/80">
            {slHint && <p>{slHint}</p>}
            {tpHint && <p>{tpHint}</p>}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-white/30">Notional</p>
          <p className="text-white font-mono font-semibold">${fmt(notional)}</p>
        </div>
        <div>
          <p className="text-white/30">Margin Required</p>
          <p className="text-white font-mono font-semibold">${fmt(margin)}</p>
        </div>
        {slPnl !== null && (
          <div>
            <p className="text-white/30">Max Loss (SL)</p>
            <p className="text-red-400 font-mono font-semibold">{fmtUsd(slPnl)}</p>
          </div>
        )}
        {tpPnl !== null && (
          <div>
            <p className="text-white/30">Target Profit (TP)</p>
            <p className="text-emerald-400 font-mono font-semibold">{fmtUsd(tpPnl)}</p>
          </div>
        )}
        {rr && (
          <div className="col-span-2">
            <p className="text-white/30">Risk / Reward</p>
            <p className="font-mono font-semibold" style={{ color: parseFloat(rr) >= 2 ? EMERALD : parseFloat(rr) >= 1 ? GOLD : RED }}>
              1 : {rr}
            </p>
          </div>
        )}
      </div>
      <p className="text-[9px] text-white/20">Estimates scale with leverage and exclude fees and slippage.</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function SpotTradingPage() {
  const { token, customer } = useCustomerAuth();
  const [searchParams] = useSearchParams();

  // Symbol
  const [symbol, setSymbol] = useState(searchParams.get('symbol') ?? 'BTCUSDT');
  // An unknown ?symbol= (e.g. a stale shared link) must not silently trade as
  // another market — the form stays visible but submission is blocked below.
  const symbolMeta = SYMBOLS.find(s => s.symbol === symbol) ?? null;

  // Order form
  const [side, setSide]         = useState<'buy' | 'sell'>('buy');
  const [type, setType]         = useState<'market' | 'limit' | 'stop'>('market');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice]       = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Submission state
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  // Server-confirmed outcome only: status comes from the order record and
  // fillPrice (when present) is the price the server recorded in its ledger.
  const [lastOrder, setLastOrder] = useState<{
    symbol: string; side: string; qty: number; status: string; fillPrice?: number;
  } | null>(null);

  // Available quote-currency balance for the quick-size buttons. It is the
  // same balance shown on the dashboard — never an assumed figure.
  const availableQuote = Number(customer?.balance ?? 0) || 0;

  // Live price
  const { tickers } = useTicker([symbol], 'crypto', 3000);
  const currentPrice = tickers[0]?.price ?? 0;
  const change24h    = tickers[0]?.changePct24h ?? 0;
  const high24h      = tickers[0]?.high24h ?? 0;
  const low24h       = tickers[0]?.low24h ?? 0;
  const vol24h       = tickers[0]?.volume24h ?? 0;
  const up           = change24h >= 0;

  const qty      = parseFloat(quantity) || 0;
  const fillPx   = type === 'market' ? currentPrice : (parseFloat(price) || currentPrice);
  const slVal    = parseFloat(stopLoss) || 0;
  const tpVal    = parseFloat(takeProfit) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbolMeta) { setError('Unknown market — pick a symbol from the list'); return; }
    if (!qty || qty <= 0) { setError('Enter a valid quantity'); return; }
    // Never submit an order the server would have to price itself: a missing
    // quote or an unstated level would fabricate an execution price.
    if (type === 'market' && !(currentPrice > 0)) {
      setError('Live quote unavailable — wait for the price feed and try again');
      return;
    }
    if (type === 'limit' && !(parseFloat(price) > 0)) { setError('Enter a valid limit price'); return; }
    if (type === 'stop'  && !(parseFloat(price) > 0)) { setError('Enter a valid stop price'); return; }
    if (!token) { setError('Not authenticated'); return; }
    setLoading(true); setError(null);
    try {
      const body: Record<string, unknown> = {
        symbol, assetClass: symbolMeta.assetClass, side, type,
        quantity: qty, currency: 'USD', leverage,
      };
      // Limit orders carry their own price; stop orders send the trigger as
      // stopPrice, which is what the server validates and stores separately.
      if (type === 'limit') body.price     = parseFloat(price);
      if (type === 'stop')  body.stopPrice = parseFloat(price);
      if (stopLoss)   body.stopLoss   = parseFloat(stopLoss);
      if (takeProfit) body.takeProfit = parseFloat(takeProfit);

      const res = await fetch('/api/users/trading/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as {
        order?: { id: string; status: string };
        fillPrice?: number;
        error?: string;
      };
      if (!res.ok || !data.order) throw new Error(data.error ?? 'Order failed');

      setLastOrder({
        symbol, side, qty,
        status: data.order.status,
        fillPrice: data.fillPrice,
      });
      setSuccess(true);
      setQuantity(''); setPrice(''); setStopLoss(''); setTakeProfit('');
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Order failed');
    } finally {
      setLoading(false);
    }
  };

  const selectSymbol = (next: string) => {
    if (next === symbol) return;
    setSymbol(next);
    // Quantity and price levels are instrument-specific — stale values from
    // the previous market must not ride into the next order.
    setQuantity(''); setPrice(''); setStopLoss(''); setTakeProfit('');
  };

  const fmtVol = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  return (
    <>
      <Helmet>
        <title>Spot Trading — City Gate Capital</title>
        <meta name="description" content="Place market, limit and stop orders on City Gate Capital's spot trading terminal." />
        <meta name="robots" content="noindex,nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/trading/spot" />
      </Helmet>

      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <h1 className="sr-only">Spot Trading Terminal — City Gate Capital</h1>

        {/* ── Header ── */}
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0A0A0A]/95 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">
            <Link to="/dashboard/trading"
              className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-white/40 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" style={{ color: GOLD }} />
              <span className="text-sm font-semibold text-white">Spot Trading</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link to="/dashboard/trading/orders"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/[0.08] text-white/50 hover:text-white hover:border-white/[0.15] transition-all">
                <BookOpen className="w-3.5 h-3.5" /> Orders
              </Link>
              <Link to="/dashboard/trading/chart"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/[0.08] text-white/50 hover:text-white hover:border-white/[0.15] transition-all">
                <BarChart2 className="w-3.5 h-3.5" /> Chart
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 md:px-6 py-5">

          {/* ── Symbol selector strip ── */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none">
            {SYMBOLS.map(s => (
              <button key={s.symbol} onClick={() => selectSymbol(s.symbol)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                  symbol === s.symbol
                    ? 'border-amber-400/40 bg-amber-400/10 text-amber-400'
                    : 'border-white/[0.07] bg-white/[0.02] text-white/40 hover:text-white/70 hover:border-white/[0.12]'
                }`}>
                {s.label}
              </button>
            ))}
          </div>

          {/* ── Price header ── */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-xs text-white/30 mb-1">
                  {symbolMeta ? symbolMeta.label : `${symbol} — unknown market`}
                </p>
                <PriceTicker ticker={tickers[0] ?? null} />
              </div>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-white/30 mb-0.5">24h High</p>
                  <p className="text-emerald-400 font-mono font-semibold">${high24h > 0 ? fmtPrice(high24h) : '—'}</p>
                </div>
                <div>
                  <p className="text-white/30 mb-0.5">24h Low</p>
                  <p className="text-red-400 font-mono font-semibold">${low24h > 0 ? fmtPrice(low24h) : '—'}</p>
                </div>
                <div>
                  <p className="text-white/30 mb-0.5">24h Volume</p>
                  <p className="text-white font-mono font-semibold">{vol24h > 0 ? fmtVol(vol24h) : '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Main grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* ── Order form (5 cols) ── */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ color: GOLD }} />
                  <span className="text-sm font-semibold text-white">Place Order</span>
                </div>

                <div className="p-4">
                  {/* Success banner */}
                  <AnimatePresence>
                    {success && lastOrder && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="mb-4 rounded-xl bg-emerald-400/10 border border-emerald-400/20 px-4 py-3 flex items-center gap-3"
                      >
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-emerald-400">
                            {lastOrder.status === 'filled' ? 'Order Filled' : 'Order Accepted'}
                          </p>
                          <p className="text-[10px] text-emerald-400/60">
                            {lastOrder.side.toUpperCase()} {lastOrder.qty} {lastOrder.symbol}
                            {lastOrder.status === 'filled' && lastOrder.fillPrice
                              ? ` — filled at $${fmtPrice(lastOrder.fillPrice)}`
                              : ' — open, awaiting fill (see Orders)'}
                          </p>
                        </div>
                        <button onClick={() => setSuccess(false)} className="text-emerald-400/50 hover:text-emerald-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Buy / Sell */}
                    <div className="grid grid-cols-2 gap-2">
                      {(['buy', 'sell'] as const).map(s => (
                        <button key={s} type="button" onClick={() => setSide(s)}
                          className={`py-3 rounded-xl text-sm font-bold transition-all ${
                            side === s
                              ? s === 'buy'
                                ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                                : 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.25)]'
                              : 'bg-white/[0.06] text-white/40 hover:bg-white/[0.10]'
                          }`}>
                          {s === 'buy' ? '↑ Buy / Long' : '↓ Sell / Short'}
                        </button>
                      ))}
                    </div>

                    {/* Order type */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['market', 'limit', 'stop'] as const).map(t => (
                        <button key={t} type="button" onClick={() => setType(t)}
                          className={`py-2.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                            type === t
                              ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
                              : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] border border-transparent'
                          }`}>
                          {t}
                        </button>
                      ))}
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="text-xs text-white/40 mb-1.5 flex items-center justify-between">
                        <span>Quantity</span>
                        {currentPrice > 0 && qty > 0 && (
                          <span className="text-white/25 font-mono">${fmt(qty * currentPrice)}</span>
                        )}
                      </label>
                      <div className="flex items-center gap-2 bg-white/[0.06] border border-white/[0.10] rounded-xl px-4 py-2.5 focus-within:border-amber-400/40 transition-colors">
                        <input type="number" step="any" min="0" value={quantity}
                          onChange={e => setQuantity(e.target.value)} placeholder="0.00000"
                          className="flex-1 bg-transparent text-white text-sm font-mono outline-none placeholder-white/20" />
                        <span className="text-white/30 text-xs font-semibold shrink-0">
                          {symbol.replace('USDT', '')}
                        </span>
                      </div>
                      {/* Quick % buttons — sized from the customer's actual
                          quote balance (the dashboard figure), never an
                          assumed amount. Disabled while the balance or the
                          quote is unknown. */}
                      <div className="mt-2">
                        <p className="text-[9px] text-white/20 mb-1">
                          {availableQuote > 0
                            ? `Quick size from available quote balance: $${fmt(availableQuote)}`
                            : 'Quote balance unavailable — quick sizing disabled'}
                        </p>
                        <div className="flex gap-1.5">
                          {[25, 50, 75, 100].map(pct => (
                            <button key={pct} type="button"
                              onClick={() => {
                                if (currentPrice > 0 && availableQuote > 0) {
                                  setQuantity(((availableQuote * pct / 100) / currentPrice).toFixed(6));
                                }
                              }}
                              disabled={availableQuote <= 0 || currentPrice <= 0}
                              className="flex-1 py-1 rounded-lg text-[10px] font-semibold bg-white/[0.04] text-white/30 hover:bg-white/[0.08] hover:text-white/60 transition-colors disabled:opacity-40 disabled:pointer-events-none">
                              {pct}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Limit / Stop price */}
                    {type !== 'market' && (
                      <div>
                        <label className="text-xs text-white/40 mb-1.5 block">
                          {type === 'limit' ? 'Limit Price' : 'Stop Price'} (USD)
                        </label>
                        <div className="flex items-center gap-2 bg-white/[0.06] border border-white/[0.10] rounded-xl px-4 py-2.5 focus-within:border-amber-400/40 transition-colors">
                          <span className="text-white/30 text-sm">$</span>
                          <input type="number" step="any" min="0" value={price}
                            onChange={e => setPrice(e.target.value)}
                            placeholder={currentPrice > 0 ? fmtPrice(currentPrice) : '0.00'}
                            className="flex-1 bg-transparent text-white text-sm font-mono outline-none placeholder-white/20" />
                          {currentPrice > 0 && (
                            <button type="button" onClick={() => setPrice(String(currentPrice))}
                              className="text-[10px] px-2 py-0.5 rounded-lg font-semibold"
                              style={{ color: GOLD, background: `${GOLD}15` }}>
                              Mid
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Advanced toggle */}
                    <button type="button" onClick={() => setShowAdvanced(v => !v)}
                      className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors w-full">
                      {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>Advanced — SL / TP / Leverage</span>
                    </button>

                    <AnimatePresence>
                      {showAdvanced && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                          className="space-y-3 overflow-hidden"
                        >
                          {/* SL / TP */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-white/40 mb-1.5 flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3 text-red-400" /> Stop Loss
                              </label>
                              <div className="flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-2 focus-within:border-red-400/40 transition-colors">
                                <span className="text-white/20 text-xs">$</span>
                                <input type="number" step="any" min="0" value={stopLoss}
                                  onChange={e => setStopLoss(e.target.value)} placeholder="Optional"
                                  className="flex-1 bg-transparent text-white text-xs font-mono outline-none placeholder-white/20" />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-white/40 mb-1.5 flex items-center gap-1">
                                <Target className="w-3 h-3 text-emerald-400" /> Take Profit
                              </label>
                              <div className="flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-2 focus-within:border-emerald-400/40 transition-colors">
                                <span className="text-white/20 text-xs">$</span>
                                <input type="number" step="any" min="0" value={takeProfit}
                                  onChange={e => setTakeProfit(e.target.value)} placeholder="Optional"
                                  className="flex-1 bg-transparent text-white text-xs font-mono outline-none placeholder-white/20" />
                              </div>
                            </div>
                          </div>

                          {/* Leverage */}
                          <div>
                            <label className="text-xs text-white/40 mb-2 flex items-center justify-between">
                              <span>Leverage</span>
                              <span className="font-mono font-bold" style={{ color: leverage > 10 ? RED : leverage > 5 ? GOLD : EMERALD }}>
                                {leverage}x
                              </span>
                            </label>
                            {/* Preset buttons */}
                            <div className="flex gap-1.5 mb-2">
                              {LEVERAGE_PRESETS.map(lv => (
                                <button key={lv} type="button" onClick={() => setLeverage(lv)}
                                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                    leverage === lv
                                      ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
                                      : 'bg-white/[0.04] text-white/30 hover:bg-white/[0.08]'
                                  }`}>
                                  {lv}x
                                </button>
                              ))}
                            </div>
                            <input type="range" min="1" max="100" step="1" value={leverage}
                              onChange={e => setLeverage(parseInt(e.target.value))}
                              className="w-full accent-amber-400" />
                            <div className="flex justify-between text-[10px] text-white/20 mt-0.5">
                              <span>1x</span><span>25x</span><span>50x</span><span>75x</span><span>100x</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Risk calculator */}
                    {qty > 0 && fillPx > 0 && (
                      <RiskCalc
                        qty={qty} entryPrice={fillPx}
                        stopLoss={slVal} takeProfit={tpVal}
                        leverage={leverage} side={side}
                      />
                    )}

                    {/* Error */}
                    {error && (
                      <div className="rounded-xl bg-red-400/10 border border-red-400/20 px-4 py-2.5 flex items-center gap-2 text-xs text-red-300">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
                      </div>
                    )}

                    {/* Submit — also blocked while the market is unknown so a
                        stale ?symbol= link can never place an order. */}
                    <button type="submit" disabled={loading || success || !qty || !symbolMeta}
                      className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                        success
                          ? 'bg-emerald-500 text-white'
                          : side === 'buy'
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_24px_rgba(16,185,129,0.2)]'
                            : 'bg-red-500 hover:bg-red-400 text-white shadow-[0_0_24px_rgba(239,68,68,0.2)]'
                      }`}>
                      {loading  ? <Loader2 className="w-4 h-4 animate-spin" /> :
                       success  ? <><CheckCircle className="w-4 h-4" /> Order Placed!</> :
                       <><Zap className="w-4 h-4" />
                         {side === 'buy' ? 'Buy' : 'Sell'} {symbol.replace('USDT', '')} — {type.charAt(0).toUpperCase() + type.slice(1)}
                       </>
                      }
                    </button>
                  </form>
                </div>
              </div>

              {/* Quick links */}
              <div className="grid grid-cols-2 gap-2">
                <Link to="/dashboard/trading/orders"
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-sm text-white/50 hover:text-white">
                  <BookOpen className="w-4 h-4" style={{ color: GOLD }} />
                  <span>My Orders</span>
                </Link>
                <Link to="/dashboard/trading/trades"
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-sm text-white/50 hover:text-white">
                  <Activity className="w-4 h-4" style={{ color: BLUE }} />
                  <span>Trade History</span>
                </Link>
              </div>
            </div>

            {/* ── Order book (3 cols) ── */}
            <div className="lg:col-span-3">
              <OrderBook
                midPrice={currentPrice > 0 ? currentPrice : 0}
                onPriceClick={(p) => {
                  // Numeric value only — locale-grouped display strings must
                  // never reach the numeric input state.
                  if (type !== 'market') setPrice(String(p));
                }}
              />
            </div>

            {/* ── Market stats (4 cols) ── */}
            <div className="lg:col-span-4 space-y-4">
              {/* Market summary */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4" style={{ color: BLUE }} />
                  <span className="text-sm font-semibold text-white">Market Stats</span>
                </div>
                {[
                  { label: 'Last Price',  value: currentPrice > 0 ? `$${fmtPrice(currentPrice)}` : '—', color: up ? EMERALD : RED },
                  { label: '24h Change',  value: `${up ? '+' : ''}${change24h.toFixed(2)}%`, color: up ? EMERALD : RED },
                  { label: '24h High',    value: high24h > 0 ? `$${fmtPrice(high24h)}` : '—', color: EMERALD },
                  { label: '24h Low',     value: low24h > 0 ? `$${fmtPrice(low24h)}` : '—', color: RED },
                  { label: '24h Volume',  value: vol24h > 0 ? fmtVol(vol24h) : '—', color: 'white' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between text-xs">
                    <span className="text-white/30">{row.label}</span>
                    <span className="font-mono font-semibold" style={{ color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Order type info */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Info className="w-4 h-4 text-white/30" />
                  <span className="text-sm font-semibold text-white">Order Types</span>
                </div>
                {[
                  { type: 'Market', desc: 'Execute immediately at the best available price. The final fill price may differ from the last quoted price.' },
                  { type: 'Limit',  desc: 'Set a specific price. Order fills only when market reaches your price or better.' },
                  { type: 'Stop',   desc: 'Trigger a market order when price hits your stop level. Used for stop-loss entries.' },
                ].map(info => (
                  <div key={info.type} className={`p-3 rounded-xl border transition-all ${
                    type === info.type.toLowerCase()
                      ? 'border-amber-400/30 bg-amber-400/5'
                      : 'border-white/[0.05] bg-white/[0.01]'
                  }`}>
                    <p className="text-xs font-semibold text-white mb-0.5">{info.type}</p>
                    <p className="text-[10px] text-white/30 leading-relaxed">{info.desc}</p>
                  </div>
                ))}
              </div>

              {/* Navigation */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-2">
                <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">Quick Nav</p>
                {[
                  { to: '/dashboard/trading/chart',     icon: BarChart2,  label: 'Live Chart',        color: GOLD   },
                  { to: '/dashboard/trading/watchlist', icon: Activity,   label: 'Watchlist',         color: BLUE   },
                  { to: '/dashboard/trading/analytics', icon: DollarSign, label: 'Portfolio Analytics', color: EMERALD },
                  { to: '/dashboard/trading/orders',    icon: BookOpen,   label: 'Order History',     color: '#9945FF' },
                ].map(({ to, icon: Icon, label, color }) => (
                  <Link key={to} to={to}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <span className="text-sm text-white/50 group-hover:text-white transition-colors">{label}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-white/20 ml-auto -rotate-90" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
