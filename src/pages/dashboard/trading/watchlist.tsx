/**
 * /dashboard/trading/watchlist — Watchlist & Favorites with Price Alerts
 * Persistent watchlist, live prices, alert badges, add/remove/alert management
 */
import { useTicker,type AssetClass } from '@/hooks/useMarketData';
import { useCustomerAuth } from '@/lib/customerAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
ArrowLeft,
Bell,
BellRing,
Check,
ChevronDown,
ChevronUp,
Loader2,
Plus,
RefreshCw,
Star,
Trash2,
X,
Zap
} from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useCallback,useEffect,useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WatchlistEntry {
  id: string; symbol: string; assetClass: AssetClass;
  addedAt: string; alertPrice?: number; note?: string;
  price?: number; change24h?: number; volume24h?: number;
}

interface PriceAlert {
  id: string; symbol: string; assetClass: AssetClass;
  targetPrice: number; condition: 'above' | 'below';
  status: 'active' | 'triggered' | 'dismissed';
  note?: string; createdAt: string; triggeredAt?: string;
  currentPrice?: number; triggered?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GOLD    = '#C9A84C';
const EMERALD = '#10B981';
const BLUE    = '#627EEA';

const ASSET_COLORS: Record<string, string> = {
  crypto: '#F7931A', forex: BLUE, stock: EMERALD, commodity: GOLD, etf: '#9945FF',
};

const POPULAR: { symbol: string; assetClass: AssetClass }[] = [
  { symbol: 'BTCUSDT', assetClass: 'crypto' },
  { symbol: 'ETHUSDT', assetClass: 'crypto' },
  { symbol: 'SOLUSDT', assetClass: 'crypto' },
  { symbol: 'BNBUSDT', assetClass: 'crypto' },
  { symbol: 'XRPUSDT', assetClass: 'crypto' },
  { symbol: 'ADAUSDT', assetClass: 'crypto' },
  { symbol: 'DOGEUSDT', assetClass: 'crypto' },
  { symbol: 'AVAXUSDT', assetClass: 'crypto' },
];

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)    return n.toFixed(4);
  return n.toFixed(6);
}

// ── Add Symbol Modal ──────────────────────────────────────────────────────────

function AddSymbolModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (symbol: string, assetClass: AssetClass) => void;
}) {
  const [symbol, setSymbol]         = useState('');
  const [assetClass, setAssetClass] = useState<AssetClass>('crypto');

  const submit = () => {
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    onAdd(s, assetClass);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 32 }}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white">Add to Watchlist</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick picks */}
        <div>
          <p className="text-xs text-white/30 mb-2">Popular</p>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR.map(p => (
              <button key={p.symbol} onClick={() => { setSymbol(p.symbol); setAssetClass(p.assetClass); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  symbol === p.symbol ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' : 'bg-white/8 text-white/60 hover:bg-white/12'
                }`}>
                {p.symbol.replace('USDT', '')}
              </button>
            ))}
          </div>
        </div>

        {/* Custom symbol */}
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Symbol</label>
          <input
            autoFocus
            type="text" value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="e.g. BTCUSDT"
            className="w-full bg-white/8 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-mono placeholder-white/20 focus:outline-none focus:border-amber-400/50"
          />
        </div>

        {/* Asset class */}
        <div className="grid grid-cols-5 gap-1">
          {(['crypto', 'forex', 'stock', 'commodity', 'etf'] as AssetClass[]).map(cls => (
            <button key={cls} onClick={() => setAssetClass(cls)}
              className={`py-1.5 rounded-lg text-[10px] font-medium capitalize transition-all ${
                assetClass === cls ? 'bg-amber-400/20 text-amber-400' : 'bg-white/5 text-white/30 hover:bg-white/10'
              }`}>
              {cls}
            </button>
          ))}
        </div>

        <button onClick={submit} disabled={!symbol.trim()}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}30`, color: GOLD }}>
          <Plus className="w-4 h-4" /> Add to Watchlist
        </button>
      </motion.div>
    </div>
  );
}

// ── Alert Modal ───────────────────────────────────────────────────────────────

function AlertModal({ symbol, currentPrice, onClose, onSave }: {
  symbol: string; currentPrice: number;
  onClose: () => void;
  onSave: (targetPrice: number, condition: 'above' | 'below', note?: string) => void;
}) {
  const [targetPrice, setTargetPrice] = useState(currentPrice.toFixed(2));
  const [condition, setCondition]     = useState<'above' | 'below'>('above');
  const [note, setNote]               = useState('');

  const submit = () => {
    const tp = parseFloat(targetPrice);
    if (!tp || tp <= 0) return;
    onSave(tp, condition, note || undefined);
    onClose();
  };

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
            <span className="font-semibold text-white">Price Alert — {symbol}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/8 px-4 py-2.5 flex justify-between text-xs">
          <span className="text-white/40">Current Price</span>
          <span className="text-white font-mono">${fmtPrice(currentPrice)}</span>
        </div>

        {/* Condition */}
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

        {/* Target price */}
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Target Price (USD)</label>
          <div className="flex items-center gap-2 bg-white/8 border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-amber-400/50">
            <span className="text-white/30 text-sm">$</span>
            <input
              type="number" step="any" min="0"
              value={targetPrice}
              onChange={e => setTargetPrice(e.target.value)}
              className="flex-1 bg-transparent text-white text-sm font-mono outline-none"
            />
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Note (optional)</label>
          <input
            type="text" value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Support level"
            className="w-full bg-white/8 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-amber-400/50"
          />
        </div>

        <button onClick={submit} disabled={!targetPrice || parseFloat(targetPrice) <= 0}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}30`, color: GOLD }}>
          <Bell className="w-4 h-4" /> Set Alert
        </button>
      </motion.div>
    </div>
  );
}

// ── Watchlist Row ─────────────────────────────────────────────────────────────

function WatchlistRow({ entry, alerts, onRemove, onAlert, onTrade }: {
  entry: WatchlistEntry;
  alerts: PriceAlert[];
  onRemove: (symbol: string) => void;
  onAlert: (entry: WatchlistEntry) => void;
  onTrade: (symbol: string) => void;
}) {
  const up = (entry.change24h ?? 0) >= 0;
  const acol = ASSET_COLORS[entry.assetClass] ?? GOLD;
  const activeAlerts = alerts.filter(a => a.symbol === entry.symbol && a.status === 'active');
  const triggeredAlerts = alerts.filter(a => a.symbol === entry.symbol && a.triggered);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors group border-b border-white/5 last:border-0"
    >
      {/* Asset dot + symbol */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: acol }} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-white">{entry.symbol}</span>
            {triggeredAlerts.length > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-400 font-semibold animate-pulse">
                <BellRing className="w-2.5 h-2.5" /> ALERT
              </span>
            )}
            {activeAlerts.length > 0 && triggeredAlerts.length === 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/8 text-white/40">
                {activeAlerts.length} alert{activeAlerts.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <span className="text-[10px] text-white/25 capitalize">{entry.assetClass}</span>
        </div>
      </div>

      {/* Price */}
      <div className="text-right hidden sm:block">
        <div className="text-sm font-mono text-white">
          {entry.price ? `$${fmtPrice(entry.price)}` : '—'}
        </div>
        <div className={`text-[10px] font-mono flex items-center justify-end gap-0.5 ${up ? 'text-emerald-400' : 'text-red-400'}`}>
          {up ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          {entry.change24h !== undefined ? `${Math.abs(entry.change24h).toFixed(2)}%` : '—'}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onAlert(entry)}
          className="p-1.5 rounded-lg hover:bg-amber-400/15 text-white/30 hover:text-amber-400 transition-colors"
          title="Set price alert">
          <Bell className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onTrade(entry.symbol)}
          className="p-1.5 rounded-lg hover:bg-emerald-400/15 text-white/30 hover:text-emerald-400 transition-colors"
          title="Trade">
          <Zap className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onRemove(entry.symbol)}
          className="p-1.5 rounded-lg hover:bg-red-400/15 text-white/30 hover:text-red-400 transition-colors"
          title="Remove">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Alert Row ─────────────────────────────────────────────────────────────────

function AlertRow({ alert, onDismiss, onDelete }: {
  alert: PriceAlert;
  onDismiss: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isTriggered = alert.triggered || alert.status === 'triggered';
  const isDismissed = alert.status === 'dismissed';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 ${isDismissed ? 'opacity-40' : ''}`}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
        isTriggered ? 'bg-amber-400/20' : 'bg-white/8'
      }`}>
        {isTriggered
          ? <BellRing className="w-3.5 h-3.5 text-amber-400" />
          : <Bell className="w-3.5 h-3.5 text-white/40" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{alert.symbol}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
            alert.condition === 'above' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-red-400/15 text-red-400'
          }`}>
            {alert.condition === 'above' ? '↑ ABOVE' : '↓ BELOW'} ${fmtPrice(alert.targetPrice)}
          </span>
          {isTriggered && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-400 font-semibold animate-pulse">TRIGGERED</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {alert.currentPrice && (
            <span className="text-[10px] text-white/30 font-mono">Current: ${fmtPrice(alert.currentPrice)}</span>
          )}
          {alert.note && <span className="text-[10px] text-white/25">· {alert.note}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {isTriggered && !isDismissed && (
          <button onClick={() => onDismiss(alert.id)}
            className="p-1.5 rounded-lg hover:bg-white/8 text-white/30 hover:text-white transition-colors" title="Dismiss">
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={() => onDelete(alert.id)}
          className="p-1.5 rounded-lg hover:bg-red-400/15 text-white/30 hover:text-red-400 transition-colors" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WatchlistPage() {
  const { token } = useCustomerAuth();
  const navigate  = useNavigate();

  const [watchlist, setWatchlist]   = useState<WatchlistEntry[]>([]);
  const [alerts, setAlerts]         = useState<PriceAlert[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<'watchlist' | 'alerts'>('watchlist');
  const [showAdd, setShowAdd]       = useState(false);
  const [alertTarget, setAlertTarget] = useState<WatchlistEntry | null>(null);
  const [toast, setToast]           = useState<string | null>(null);

  // Live prices for watchlisted symbols
  const symbols = watchlist.map(w => w.symbol);
  const { tickers } = useTicker(symbols, 'crypto', 5000);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [wRes, aRes] = await Promise.all([
        fetch('/api/users/trading/watchlist', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/users/trading/alerts',    { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (wRes.ok) {
        const d = await wRes.json() as { watchlist: WatchlistEntry[] };
        setWatchlist(d.watchlist ?? []);
      }
      if (aRes.ok) {
        const d = await aRes.json() as { alerts: PriceAlert[] };
        setAlerts(d.alerts ?? []);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Merge live ticker prices into watchlist
  const enrichedWatchlist: WatchlistEntry[] = watchlist.map(w => {
    const t = tickers.find(tk => tk.symbol === w.symbol);
    return t ? { ...w, price: t.price, change24h: t.changePct24h, volume24h: t.volume24h } : w;
  });

  const handleAdd = async (symbol: string, assetClass: AssetClass) => {
    if (!token) return;
    try {
      await fetch('/api/users/trading/watchlist', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', symbol, assetClass }),
      });
      await load();
      showToast(`${symbol} added to watchlist`);
    } catch { /* silent */ }
  };

  const handleRemove = async (symbol: string) => {
    if (!token) return;
    try {
      await fetch('/api/users/trading/watchlist', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', symbol }),
      });
      setWatchlist(prev => prev.filter(w => w.symbol !== symbol));
      showToast(`${symbol} removed`);
    } catch { /* silent */ }
  };

  const handleCreateAlert = async (targetPrice: number, condition: 'above' | 'below', note?: string) => {
    if (!token || !alertTarget) return;
    try {
      await fetch('/api/users/trading/alerts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create', symbol: alertTarget.symbol,
          assetClass: alertTarget.assetClass, targetPrice, condition, note,
        }),
      });
      await load();
      showToast(`Alert set for ${alertTarget.symbol}`);
    } catch { /* silent */ }
  };

  const handleDismissAlert = async (id: string) => {
    if (!token) return;
    try {
      await fetch('/api/users/trading/alerts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', id }),
      });
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'dismissed' as const } : a));
    } catch { /* silent */ }
  };

  const handleDeleteAlert = async (id: string) => {
    if (!token) return;
    try {
      await fetch('/api/users/trading/alerts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch { /* silent */ }
  };

  const triggeredCount = alerts.filter(a => a.triggered && a.status === 'active').length;
  const activeAlerts   = alerts.filter(a => a.status === 'active');

  return (
    <>
      <Helmet>
        <title>Watchlist — City Gate Capital</title>
        <meta name="description" content="Track your favourite assets and manage price alerts on City Gate Capital." />
        <meta name="robots" content="noindex,nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/trading/watchlist" />
      </Helmet>

      {/* Modals */}
      <AnimatePresence>
        {showAdd && (
          <AddSymbolModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />
        )}
        {alertTarget && (
          <AlertModal
            symbol={alertTarget.symbol}
            currentPrice={alertTarget.price ?? 0}
            onClose={() => setAlertTarget(null)}
            onSave={handleCreateAlert}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-white/15 text-white text-sm font-medium shadow-2xl flex items-center gap-2"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <h1 className="sr-only">Watchlist & Price Alerts — City Gate Capital</h1>
        {/* Header */}
        <div className="sticky top-0 z-20 border-b border-white/8 bg-[#0A0A0A]/95 backdrop-blur-xl">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link to="/dashboard/trading" className="p-1.5 rounded-lg hover:bg-white/8 transition-colors text-white/40 hover:text-white">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2 flex-1">
              <Star className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-white text-sm">Watchlist & Alerts</span>
            </div>
            <button onClick={() => load()} className="p-2 rounded-xl hover:bg-white/8 transition-colors text-white/30 hover:text-white">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}28`, color: GOLD }}>
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {/* Tabs */}
          <div className="max-w-3xl mx-auto px-4 flex gap-1 border-t border-white/5">
            {([
              { key: 'watchlist', label: 'Watchlist', count: watchlist.length },
              { key: 'alerts',    label: 'Alerts',    count: activeAlerts.length, badge: triggeredCount },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all ${
                  tab === t.key ? 'border-amber-400 text-amber-400' : 'border-transparent text-white/40 hover:text-white/70'
                }`}>
                {t.label}
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-amber-400/20 text-amber-400' : 'bg-white/8 text-white/30'}`}>
                  {t.count}
                </span>
                {'badge' in t && t.badge > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-400 text-black font-bold animate-pulse">{t.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
            </div>
          ) : tab === 'watchlist' ? (
            <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
              {enrichedWatchlist.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <Star className="w-10 h-10 text-white/10 mx-auto" />
                  <p className="text-white/30 text-sm">Your watchlist is empty</p>
                  <button onClick={() => setShowAdd(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}28`, color: GOLD }}>
                    <Plus className="w-3.5 h-3.5" /> Add your first symbol
                  </button>
                </div>
              ) : (
                <AnimatePresence>
                  {enrichedWatchlist.map(entry => (
                    <WatchlistRow
                      key={entry.id}
                      entry={entry}
                      alerts={alerts}
                      onRemove={handleRemove}
                      onAlert={e => setAlertTarget(e)}
                      onTrade={sym => navigate(`/dashboard/trading/chart?symbol=${sym}`)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
              {alerts.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <Bell className="w-10 h-10 text-white/10 mx-auto" />
                  <p className="text-white/30 text-sm">No price alerts set</p>
                  <p className="text-white/20 text-xs">Add a symbol to your watchlist and set an alert</p>
                </div>
              ) : (
                <AnimatePresence>
                  {alerts.map(alert => (
                    <AlertRow
                      key={alert.id}
                      alert={alert}
                      onDismiss={handleDismissAlert}
                      onDelete={handleDeleteAlert}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
