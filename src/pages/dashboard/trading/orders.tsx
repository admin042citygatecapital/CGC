/**
 * /dashboard/trading/orders — Order Management + Spot Trading Panel
 * Open orders, full order history, cancel pending orders,
 * embedded spot trading panel (Market / Limit / Stop)
 */
import { useTicker } from '@/hooks/useMarketData';
import { VirtualList } from '@/lib/VirtualList';
import { useBackgroundSync } from '@/lib/backgroundSync';
import { useCustomerAuth } from '@/lib/customerAuth';
import { usePrivacy } from '@/lib/usePrivacy';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
AlertTriangle,
ArrowLeft,BookOpen,
CheckCircle,
ChevronDown,
Clock,
Loader2,
RefreshCw,
ShieldAlert,Target,
XCircle,
Zap
} from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useCallback,useEffect,useState } from 'react';
import { Link } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TradingOrder {
  id: string; symbol: string; assetClass: string; side: string;
  type: string; quantity: number; filledQty: number; price?: number;
  stopPrice?: number; status: string; currency: string; leverage: number;
  createdAt: string; updatedAt: string; filledAt?: string;
  stopLoss?: number; takeProfit?: number; note?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SPOT_SYMBOLS = [
  { symbol: 'BTCUSDT', label: 'BTC' },
  { symbol: 'ETHUSDT', label: 'ETH' },
  { symbol: 'SOLUSDT', label: 'SOL' },
  { symbol: 'BNBUSDT', label: 'BNB' },
  { symbol: 'XRPUSDT', label: 'XRP' },
];

function fmt(n: number, d = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
function fmtPrice(n: number): string {
  if (n >= 1000) return fmt(n, 2);
  if (n >= 1)    return fmt(n, 4);
  return fmt(n, 6);
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:          { label: 'Pending',   color: '#F59E0B', icon: Clock },
  open:             { label: 'Open',      color: '#627EEA', icon: Clock },
  filled:           { label: 'Filled',    color: '#10B981', icon: CheckCircle },
  partially_filled: { label: 'Partial',   color: '#F59E0B', icon: Clock },
  cancelled:        { label: 'Cancelled', color: '#6B7280', icon: XCircle },
  rejected:         { label: 'Rejected',  color: '#EF4444', icon: XCircle },
  expired:          { label: 'Expired',   color: '#6B7280', icon: XCircle },
};

const ASSET_COLORS: Record<string, string> = {
  crypto: '#F7931A', forex: '#627EEA', stock: '#10B981', commodity: '#C9A84C', etf: '#9945FF',
};

// ── Spot Trading Panel ────────────────────────────────────────────────────────

function SpotTradingPanel({ token, onOrderPlaced }: { token: string; onOrderPlaced: () => void }) {
  const [symbol, setSymbol]     = useState('BTCUSDT');
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
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { tickers } = useTicker([symbol], 'crypto', 5000);
  const currentPrice = tickers[0]?.price ?? 0;
  const priceChange  = tickers[0]?.changePct24h ?? 0;
  const up = priceChange >= 0;

  const qty     = parseFloat(quantity) || 0;
  const lev     = parseInt(leverage) || 1;
  const fillPx  = type === 'market' ? currentPrice : (parseFloat(price) || currentPrice);
  const notional = qty * fillPx * lev;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qty || qty <= 0) { setError('Enter a valid quantity'); return; }
    setLoading(true); setError(null);
    try {
      const body: Record<string, unknown> = {
        symbol, assetClass: 'crypto', side, type, quantity: qty, currency: 'USD', leverage: lev,
      };
      if (type !== 'market' && price) body.price = parseFloat(price);
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
      setQuantity(''); setPrice(''); setStopLoss(''); setTakeProfit('');
      setTimeout(() => { setSuccess(false); onOrderPlaced(); }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Order failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-white">Spot Trading</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Symbol selector */}
        <div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {SPOT_SYMBOLS.map(s => (
              <button key={s.symbol} onClick={() => setSymbol(s.symbol)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  symbol === s.symbol ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
          {currentPrice > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-lg font-bold font-mono text-white">${fmtPrice(currentPrice)}</span>
              <span className={`text-xs font-mono font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                {up ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Buy / Sell */}
          <div className="grid grid-cols-2 gap-2">
            {(['buy', 'sell'] as const).map(s => (
              <button key={s} type="button" onClick={() => setSide(s)}
                className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  side === s
                    ? s === 'buy'
                      ? 'bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.25)]'
                      : 'bg-red-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.25)]'
                    : 'bg-white/8 text-white/50 hover:bg-white/12'
                }`}>
                {s === 'buy' ? '↑ Buy / Long' : '↓ Sell / Short'}
              </button>
            ))}
          </div>

          {/* Order type */}
          <div className="grid grid-cols-3 gap-1.5">
            {(['market', 'limit', 'stop'] as const).map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`py-2 rounded-xl text-xs font-medium capitalize transition-all ${
                  type === t ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}>
                {t}
              </button>
            ))}
          </div>

          {/* Quantity */}
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Quantity</label>
            <input type="number" step="any" min="0" value={quantity}
              onChange={e => setQuantity(e.target.value)} placeholder="0.00"
              className="w-full bg-white/8 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-mono placeholder-white/20 focus:outline-none focus:border-amber-400/50" />
          </div>

          {/* Limit / Stop price */}
          {type !== 'market' && (
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">
                {type === 'limit' ? 'Limit Price' : 'Stop Price'} (USD)
              </label>
              <input type="number" step="any" min="0" value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder={`$${fmtPrice(currentPrice)}`}
                className="w-full bg-white/8 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-mono placeholder-white/20 focus:outline-none focus:border-amber-400/50" />
            </div>
          )}

          {/* Advanced toggle */}
          <button type="button" onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            Advanced (SL/TP · Leverage)
          </button>

          {showAdvanced && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-white/40 mb-1.5 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-red-400" /> Stop Loss
                  </label>
                  <input type="number" step="any" min="0" value={stopLoss}
                    onChange={e => setStopLoss(e.target.value)} placeholder="Optional"
                    className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono placeholder-white/20 focus:outline-none focus:border-red-400/50" />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1.5 flex items-center gap-1">
                    <Target className="w-3 h-3 text-emerald-400" /> Take Profit
                  </label>
                  <input type="number" step="any" min="0" value={takeProfit}
                    onChange={e => setTakeProfit(e.target.value)} placeholder="Optional"
                    className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono placeholder-white/20 focus:outline-none focus:border-emerald-400/50" />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 flex items-center justify-between">
                  <span>Leverage</span>
                  <span className="text-amber-400 font-mono">{lev}x</span>
                </label>
                <input type="range" min="1" max="100" step="1" value={leverage}
                  onChange={e => setLeverage(e.target.value)} className="w-full accent-amber-400" />
                <div className="flex justify-between text-xs text-white/20 mt-1">
                  <span>1x</span><span>25x</span><span>50x</span><span>100x</span>
                </div>
              </div>
            </div>
          )}

          {/* Notional */}
          {qty > 0 && (
            <div className="rounded-xl bg-white/5 border border-white/8 px-4 py-2.5 flex justify-between text-xs">
              <span className="text-white/40">Notional Value</span>
              <span className="text-white font-mono font-semibold">${fmt(notional)}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-400/10 border border-red-400/20 px-4 py-2.5 flex items-center gap-2 text-xs text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading || success}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              success
                ? 'bg-emerald-500 text-white'
                : side === 'buy'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                  : 'bg-red-500 hover:bg-red-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.2)]'
            } disabled:opacity-60`}>
            {loading  ? <Loader2 className="w-4 h-4 animate-spin" /> :
             success  ? <><CheckCircle className="w-4 h-4" /> Order Placed!</> :
             <><Zap className="w-4 h-4" /> Place {type.charAt(0).toUpperCase() + type.slice(1)} Order</>
            }
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Order Card ────────────────────────────────────────────────────────────────

function OrderCard({ order, onCancel, privacy, cancelling }: {
  order: TradingOrder; onCancel: (id: string) => void;
  privacy: boolean; cancelling: boolean;
}) {
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const canCancel  = ['pending', 'open'].includes(order.status);
  const fillPct    = order.quantity > 0 ? (order.filledQty / order.quantity) * 100 : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-3"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0"
            style={{ background: `${ASSET_COLORS[order.assetClass] ?? '#C9A84C'}20` }}>
            {order.side === 'buy' ? '↑' : '↓'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white text-sm">{order.symbol}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                order.side === 'buy' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-red-400/15 text-red-400'
              }`}>
                {order.side.toUpperCase()}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-white/8 text-white/50 capitalize">
                {order.type.replace('_', ' ')}
              </span>
              {order.leverage > 1 && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400">
                  {order.leverage}x
                </span>
              )}
            </div>
            <div className="text-xs text-white/30 mt-0.5">{fmtDate(order.createdAt)}</div>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusIcon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
          <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <div className="text-white/30">Quantity</div>
          <div className="text-white font-mono mt-0.5">
            {privacy ? '••••' : fmt(order.quantity, 4)}
          </div>
        </div>
        <div>
          <div className="text-white/30">Price</div>
          <div className="text-white font-mono mt-0.5">
            {order.type === 'market' ? 'Market' : (order.price ? `$${fmt(order.price, 4)}` : '—')}
          </div>
        </div>
        {order.stopLoss && (
          <div>
            <div className="text-white/30">Stop Loss</div>
            <div className="text-red-400 font-mono mt-0.5">${fmt(order.stopLoss, 4)}</div>
          </div>
        )}
        {order.takeProfit && (
          <div>
            <div className="text-white/30">Take Profit</div>
            <div className="text-emerald-400 font-mono mt-0.5">${fmt(order.takeProfit, 4)}</div>
          </div>
        )}
      </div>

      {/* Fill progress for partial */}
      {order.status === 'partially_filled' && (
        <div>
          <div className="flex justify-between text-xs text-white/40 mb-1">
            <span>Filled</span>
            <span>{fillPct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${fillPct}%` }} />
          </div>
        </div>
      )}

      {/* Cancel button */}
      {canCancel && (
        <div className="flex justify-end pt-1">
          <button
            onClick={() => onCancel(order.id)}
            disabled={cancelling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-400/30 text-red-400 text-xs font-medium hover:bg-red-400/10 transition-colors disabled:opacity-50"
          >
            {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
            Cancel Order
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { token } = useCustomerAuth();
  const { privacy } = usePrivacy();

  const [orders, setOrders]       = useState<TradingOrder[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [tab, setTab]             = useState<'open' | 'all'>('open');
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/users/trading/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load orders');
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  // Background sync — refreshes orders every 20s, pauses when tab is hidden
  useBackgroundSync(
    `trading-orders-${token ?? 'anon'}`,
    async () => {
      if (!token) return null;
      const res = await fetch('/api/users/trading/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    20_000,
    (data: unknown) => {
      if (data && typeof data === 'object' && 'orders' in data) {
        setOrders((data as { orders: TradingOrder[] }).orders ?? []);
        setRefreshing(false);
      }
    },
  );

  const handleCancel = async (orderId: string) => {
    if (!token) return;
    setCancelling(orderId);
    try {
      const res = await fetch('/api/users/trading/orders/cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) throw new Error('Cancel failed');
      load(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to cancel');
    } finally {
      setCancelling(null);
    }
  };

  const openOrders = orders.filter(o => ['pending', 'open', 'partially_filled'].includes(o.status));
  const displayOrders = tab === 'open' ? openOrders : orders;

  return (
    <>
      <Helmet>
        <title>Orders — City Gate Capital</title>
        <meta name="description" content="Manage your open and historical trading orders on City Gate Capital." />
        <link rel="canonical" href="https://citygate.capital/dashboard/trading/orders" />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <h1 className="sr-only">Orders — City Gate Capital</h1>
        {/* Header */}
        <div className="border-b border-white/8 bg-[#0A0A0A]/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link to="/dashboard/trading" className="text-white/40 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="w-px h-5 bg-white/10" />
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                <span className="font-semibold text-white text-sm">Orders</span>
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
              <Link to="/dashboard/trading/chart"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400/15 text-amber-400 text-xs font-medium hover:bg-amber-400/25 transition-colors">
                <Zap className="w-3.5 h-3.5" />
                New Order
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="max-w-4xl mx-auto px-4 md:px-6">
            <div className="flex gap-1">
              {[
                { key: 'open', label: 'Open', count: openOrders.length },
                { key: 'all',  label: 'All Orders', count: orders.length },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setTab(key as 'open' | 'all')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
                    tab === key ? 'border-amber-400 text-amber-400' : 'border-transparent text-white/40 hover:text-white/70'
                  }`}
                >
                  {label}
                  <span className={`text-xs px-1.5 rounded-full ${
                    tab === key ? 'bg-amber-400/20 text-amber-400' : 'bg-white/8 text-white/30'
                  }`}>{count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 flex flex-col lg:flex-row gap-6">
          {/* Orders list */}
          <div className="flex-1 min-w-0">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/8 p-6 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
              <button onClick={() => load()} className="ml-auto text-xs text-red-400 underline">Retry</button>
            </div>
          )}

          {!loading && !error && (
            <AnimatePresence mode="popLayout">
              {displayOrders.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-20 text-center"
                >
                  <BookOpen className="w-12 h-12 text-white/15 mx-auto mb-4" />
                  <p className="text-white/40 text-sm">
                    {tab === 'open' ? 'No open orders' : 'No orders yet'}
                  </p>
                  <p className="text-white/20 text-xs mt-1">Use the trading panel to place your first order</p>
                </motion.div>
              ) : (
                <VirtualList
                  items={displayOrders}
                  rowHeight={88}
                  overscan={4}
                  className="max-h-[600px]"
                  emptyState={
                    <div className="py-20 text-center">
                      <BookOpen className="w-12 h-12 text-white/15 mx-auto mb-4" />
                      <p className="text-white/40 text-sm">
                        {tab === 'open' ? 'No open orders' : 'No orders yet'}
                      </p>
                      <p className="text-white/20 text-xs mt-1">Use the trading panel to place your first order</p>
                    </div>
                  }
                  renderRow={(order) => (
                    <div className="pb-3">
                      <OrderCard
                        key={order.id}
                        order={order}
                        onCancel={handleCancel}
                        privacy={privacy}
                        cancelling={cancelling === order.id}
                      />
                    </div>
                  )}
                />
              )}
            </AnimatePresence>
          )}
          </div>

          {/* Spot trading panel */}
          {token && (
            <div className="w-full lg:w-80 shrink-0">
              <div className="sticky top-20">
                <SpotTradingPanel token={token} onOrderPlaced={() => load(true)} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
