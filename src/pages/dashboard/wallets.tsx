/**
 * /dashboard/wallets — Premium Wallet Dashboard (Redesign v2)
 *
 * Panels:
 *  ① Hero — Total Portfolio Value · all-time P&L · sparkline · 6 quick-action buttons
 *  ② Balance cards — Banking · Trading · Investment · Today P&L
 *  ③ Live ticker strip — WS-powered animated price pills
 *  ④ Left column — Asset Allocation donut · Currency Wallets · Open Positions
 *  ⑤ Right column — Portfolio Performance bar chart · Selected wallet detail · History tabs
 *  ⑥ Modals — Transfer · Deposit · Withdraw · Buy · Sell · Exchange
 */
import { Helmet } from '@dr.pogodin/react-helmet';
import { AnimatePresence,motion } from 'motion/react';
import {
useCallback,
useEffect,
useState,
type ElementType,type ReactNode
} from 'react';
import { Link,useNavigate } from 'react-router-dom';

import { useBackgroundSync } from '@/lib/backgroundSync';
import { useCustomerAuth } from '@/lib/customerAuth';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useMarketWebSocket } from '@/lib/useMarketWebSocket';
import { VirtualList } from '@/lib/VirtualList';
import {
Activity,
AlertCircle,
ArrowDownLeft,
ArrowLeft,
ArrowRightLeft,
ArrowUpRight,
BarChart2,
Check,
ChevronRight,
DollarSign,
Eye,EyeOff,
Globe,
History,
Loader2,
Minus,
PieChart,
Plus,
RefreshCw,Send,
ShoppingCart,
Star,
TrendingDown,
TrendingUp,
Wallet,
WifiOff,
X,
Zap
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Brand tokens
// ─────────────────────────────────────────────────────────────────────────────

const GOLD    = '#C9A84C';
const EMERALD = '#10B981';
const RED     = '#EF4444';
const BLUE    = '#627EEA';
const PURPLE  = '#9945FF';

// ─────────────────────────────────────────────────────────────────────────────
// Currency metadata
// ─────────────────────────────────────────────────────────────────────────────

const CCY_COLOR: Record<string, string> = {
  USD: GOLD, EUR: BLUE, GBP: EMERALD, BTC: '#F7931A',
  ETH: BLUE, USDT: '#26A17B', BNB: '#F3BA2F', SOL: PURPLE,
  CHF: RED, CAD: '#FF6B35', AUD: '#00B4D8', JPY: '#FF6B9D',
  SGD: '#4ECDC4', AED: '#45B7D1', NGN: '#00B4D8',
};
const CCY_FLAG: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', CHF: '🇨🇭', CAD: '🇨🇦',
  AUD: '🇦🇺', JPY: '🇯🇵', SGD: '🇸🇬', AED: '🇦🇪', NGN: '🇳🇬',
  BTC: '₿', ETH: 'Ξ', USDT: '₮', BNB: 'B', SOL: '◎',
};
const CRYPTO = new Set(['BTC', 'ETH', 'USDT', 'BNB', 'SOL']);

const ALLOC_COLOR: Record<string, string> = {
  crypto: '#F7931A', stock: EMERALD, forex: BLUE,
  fiat: GOLD, commodity: '#C9A84C', etf: PURPLE, other: '#555',
};

const WATCH_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT'];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CurrencyBalance { currency: string; amount: number; usdEquivalent: number; }
interface AllocationItem  { name: string; value: number; pct: number; }
interface RecentTrade {
  id: string; symbol: string; side: 'buy' | 'sell';
  quantity: number; price: number; pnl: number; executedAt: string;
}
interface Position {
  id: string; symbol: string; side: string;
  quantity: number; avgEntry: number; currentPrice: number;
  unrealisedPnl: number; pnlPct: number;
}
interface Tx {
  id: string; type: string; status: string;
  amount: number; currency: string; description: string;
  reference: string; createdAt: string;
}
interface WalletOverview {
  totalPortfolioValue: number;
  bankingBalance:      number;
  tradingBalance:      number;
  investmentBalance:   number;
  todayPnl:            number;
  todayPnlPct:         number;
  totalPnl:            number;
  unrealisedPnl:       number;
  realisedPnl:         number;
  openPositions:       number;
  openOrders:          number;
  winRate:             number;
  currencies:          CurrencyBalance[];
  allocation:          AllocationItem[];
  recentTrades:        RecentTrade[];
  positions:           Position[];
}

type QuickAction = 'deposit' | 'withdraw' | 'buy' | 'sell' | 'exchange';
type PerfPeriod  = '1D' | '1W' | '1M' | '3M';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number, currency = 'USD'): string {
  try {
    return n.toLocaleString('en-US', {
      style: 'currency', currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: CRYPTO.has(currency) ? 6 : 2,
    });
  } catch { return `${currency} ${n.toFixed(2)}`; }
}
function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}
function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)    return n.toFixed(4);
  return n.toFixed(6);
}
function isCredit(type: string): boolean {
  return ['deposit', 'manual_credit', 'refund', 'crypto_sell'].includes(type);
}
function txMeta(type: string): { Icon: ElementType; color: string } {
  switch (type) {
    case 'transfer': case 'wire_transfer': return { Icon: Send,          color: GOLD    };
    case 'crypto_buy': case 'crypto_sell': return { Icon: RefreshCw,     color: BLUE    };
    case 'deposit': case 'manual_credit':
    case 'refund':                         return { Icon: ArrowDownLeft,  color: EMERALD };
    default:                               return { Icon: ArrowUpRight,   color: RED     };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Privacy value
// ─────────────────────────────────────────────────────────────────────────────

function PV({ value, privacy, className = '' }: { value: string; privacy: boolean; className?: string }) {
  return privacy
    ? <span className={`font-mono tracking-widest select-none ${className}`}>••••••</span>
    : <span className={className}>{value}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sparkline SVG
// ─────────────────────────────────────────────────────────────────────────────

function Sparkline({ data, color, height = 40, fill = false }: {
  data: number[]; color: string; height?: number; fill?: boolean;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 200; const H = height;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 4) - 2}`
  );
  const linePts = pts.join(' ');
  const fillPts = `0,${H} ${linePts} ${W},${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {fill && (
        <polygon points={fillPts} fill={color} opacity="0.08" />
      )}
      <polyline points={linePts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      {pts.length > 0 && (() => {
        const last = pts[pts.length - 1].split(',');
        return <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />;
      })()}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated Donut
// ─────────────────────────────────────────────────────────────────────────────

function DonutChart({ items }: { items: AllocationItem[] }) {
  const r = 38; const cx = 50; const cy = 50;
  const circumference = 2 * Math.PI * r;
  const gap = 2; // gap between slices in px
  let offset = 0;
  const slices = items.map(item => {
    const dash  = Math.max(0, (item.pct / 100) * circumference - gap);
    const space = circumference - dash;
    const s = { ...item, dash, space, offset };
    offset += (item.pct / 100) * circumference;
    return s;
  });
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
      {slices.map((s, i) => (
        <motion.circle
          key={i} cx={cx} cy={cy} r={r}
          fill="none"
          stroke={ALLOC_COLOR[s.name] ?? '#555'}
          strokeWidth="10"
          strokeDasharray={`${s.dash} ${s.space}`}
          strokeDashoffset={-s.offset}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${s.dash} ${s.space}` }}
          transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
          opacity={0.9}
        />
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio Performance bar chart
// ─────────────────────────────────────────────────────────────────────────────

const PERF_SEED: Record<PerfPeriod, number[]> = {
  '1D': [100, 101.2, 100.8, 102.1, 101.5, 103.4, 102.8, 104.1, 103.6, 105.2, 104.7, 106.3],
  '1W': [100, 98.5, 101.2, 103.4, 102.1, 105.6, 107.2, 106.8, 108.4, 107.9, 110.1, 109.5],
  '1M': [100, 103, 101, 107, 105, 110, 108, 113, 111, 116, 114, 119],
  '3M': [100, 95, 102, 98, 108, 104, 112, 109, 118, 115, 122, 120],
};

function PerfChart({ period, color }: { period: PerfPeriod; color: string }) {
  const data = PERF_SEED[period];
  const min  = Math.min(...data);
  const max  = Math.max(...data);
  const range = max - min || 1;
  const H = 80;
  const barW = 14;
  const gap  = 4;
  const totalW = data.length * (barW + gap) - gap;

  return (
    <svg viewBox={`0 0 ${totalW} ${H}`} className="w-full" style={{ height: H }} preserveAspectRatio="none">
      {data.map((v, i) => {
        const barH = Math.max(4, ((v - min) / range) * (H - 8));
        const x    = i * (barW + gap);
        const y    = H - barH;
        const isLast = i === data.length - 1;
        return (
          <motion.rect
            key={`${period}-${i}`}
            x={x} y={y} width={barW} height={barH}
            rx="3"
            fill={isLast ? color : `${color}40`}
            initial={{ height: 0, y: H }}
            animate={{ height: barH, y }}
            transition={{ duration: 0.4, delay: i * 0.03, ease: 'easeOut' }}
          />
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live ticker pill
// ─────────────────────────────────────────────────────────────────────────────

function TickerPill({ symbol }: { symbol: string }) {
  const { tickers } = useMarketWebSocket([symbol], 8_000);
  const t    = tickers.get(symbol);
  const base = symbol.replace('USDT', '');
  const col  = CCY_COLOR[base] ?? GOLD;
  const up   = (t?.change24h ?? 0) >= 0;

  return (
    <Link
      to={`/dashboard/trading/chart?symbol=${symbol}`}
      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.07] hover:border-white/[0.14] bg-white/[0.03] hover:bg-white/[0.06] transition-all shrink-0 group"
    >
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
        style={{ background: `${col}20`, color: col }}>
        {base[0]}
      </div>
      <div>
        <p className="text-[10px] font-semibold text-white/50 group-hover:text-white/70 transition-colors">{base}</p>
        <AnimatePresence mode="popLayout">
          <motion.p
            key={t?.priceStr ?? 'loading'}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className="text-xs font-bold text-white tabular-nums"
          >
            {t?.priceStr ?? '—'}
          </motion.p>
        </AnimatePresence>
      </div>
      {t && (
        <span className={`text-[9px] font-bold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
          {up ? '+' : ''}{t.change24h.toFixed(2)}%
        </span>
      )}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Balance card
// ─────────────────────────────────────────────────────────────────────────────

function BalanceCard({
  label, value, sub, color, icon: Icon, privacy, loading, pulse,
}: {
  label: string; value: string; sub?: string;
  color: string; icon: ElementType; privacy: boolean;
  loading?: boolean; pulse?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl border border-white/[0.07] p-4 overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${color}08 0%, rgba(10,10,10,0.6) 100%)` }}
    >
      {/* Subtle glow */}
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl pointer-events-none"
        style={{ background: `${color}10` }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">{label}</span>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
            <Icon className="w-3.5 h-3.5" style={{ color }} />
          </div>
        </div>
        {loading ? (
          <div className="h-6 w-28 rounded-lg bg-white/5 animate-pulse" />
        ) : (
          <PV value={value} privacy={privacy} className="text-xl font-bold text-white block" />
        )}
        {sub && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {pulse && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
            <p className="text-[10px] text-white/30">{sub}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden ${className}`}>
      {children}
    </div>
  );
}
function PanelHeader({ icon: Icon, color = GOLD, title, right }: {
  icon: ElementType; color?: string; title: string; right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      {right}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Transfer modal
// ─────────────────────────────────────────────────────────────────────────────

function TransferModal({
  onClose, token, bankBalance, tradingBalance,
}: {
  onClose: () => void; token: string;
  bankBalance: number; tradingBalance: number;
}) {
  const [dir, setDir]       = useState<'bank_to_trading' | 'trading_to_bank'>('bank_to_trading');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState('');

  const maxAmt   = dir === 'bank_to_trading' ? bankBalance : tradingBalance;
  const fromLbl  = dir === 'bank_to_trading' ? 'Banking Wallet' : 'Trading Wallet';
  const toLbl    = dir === 'bank_to_trading' ? 'Trading Wallet' : 'Banking Wallet';

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0)  { setError('Enter a valid amount'); return; }
    if (amt > maxAmt)      { setError(`Insufficient balance. Max: $${maxAmt.toFixed(2)}`); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/users/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': newIdempotencyKey() },
        body: JSON.stringify({ type: 'internal_transfer', direction: dir, amount: amt, currency: 'USD' }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? 'Transfer failed');
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transfer failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.22 }}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111] p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}28` }}>
              <ArrowRightLeft className="w-4 h-4" style={{ color: GOLD }} />
            </div>
            <span className="font-semibold text-white">Transfer Funds</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="text-center py-8 space-y-3">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}
              className="w-16 h-16 rounded-full bg-emerald-400/15 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-emerald-400" />
            </motion.div>
            <p className="text-white font-semibold text-lg">Transfer Submitted</p>
            <p className="text-white/40 text-sm">${parseFloat(amount).toFixed(2)} from {fromLbl} → {toLbl}</p>
            <button onClick={onClose} className="mt-2 px-8 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}30`, color: GOLD }}>
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Direction toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-white/5">
              {(['bank_to_trading', 'trading_to_bank'] as const).map(d => (
                <button key={d} onClick={() => { setDir(d); setError(''); }}
                  className={`py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    dir === d ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
                  }`}>
                  {d === 'bank_to_trading' ? '🏦 Bank → Trading' : '📈 Trading → Bank'}
                </button>
              ))}
            </div>

            {/* Balance info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/4 border border-white/8 p-3">
                <p className="text-[10px] text-white/30 mb-1">From: {fromLbl}</p>
                <p className="text-base font-bold text-white">${maxAmt.toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-white/4 border border-white/8 p-3">
                <p className="text-[10px] text-white/30 mb-1">To: {toLbl}</p>
                <p className="text-base font-bold text-white/40">—</p>
              </div>
            </div>

            {/* Amount input */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Amount (USD)</label>
              <div className="flex items-center gap-2 bg-white/6 border border-white/10 rounded-xl px-4 py-3 focus-within:border-amber-400/40 transition-colors">
                <span className="text-white/30 text-sm font-semibold">$</span>
                <input type="number" min="0" step="0.01" value={amount}
                  onChange={e => { setAmount(e.target.value); setError(''); }}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-white text-sm font-mono outline-none placeholder-white/20" />
                <button onClick={() => setAmount(maxAmt.toFixed(2))}
                  className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors"
                  style={{ color: GOLD, background: `${GOLD}15` }}>
                  Max
                </button>
              </div>
              {error && (
                <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {error}
                </p>
              )}
            </div>

            <button onClick={submit} disabled={loading || !amount}
              className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}30`, color: GOLD }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
              {loading ? 'Processing…' : 'Transfer Now'}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick-action modal
// ─────────────────────────────────────────────────────────────────────────────

function QuickActionModal({ action, onClose }: {
  action: QuickAction; onClose: () => void;
}) {
  const navigate = useNavigate();
  const META: Record<QuickAction, { title: string; icon: ElementType; color: string; desc: string; route?: string }> = {
    deposit:  { title: 'Deposit Funds',  icon: ArrowDownLeft, color: EMERALD,  desc: 'Add funds via wire transfer, card, or crypto deposit.',       route: '/dashboard/deposits'         },
    withdraw: { title: 'Withdraw Funds', icon: ArrowUpRight,  color: RED,      desc: 'Withdraw to your linked bank account or external wallet.',    route: '/dashboard/transfers'        },
    buy:      { title: 'Buy Crypto',     icon: ShoppingCart,  color: GOLD,     desc: 'Purchase crypto assets directly from your banking balance.',  route: '/dashboard/trading/markets'  },
    sell:     { title: 'Sell Crypto',    icon: DollarSign,    color: BLUE,     desc: 'Sell positions and receive USD to your banking wallet.',      route: '/dashboard/trading/orders'   },
    exchange: { title: 'Exchange',       icon: RefreshCw,     color: PURPLE,   desc: 'Preview conversions between supported currencies.',           route: '/dashboard/exchange'         },
  };
  const m    = META[action];
  const Icon = m.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.22 }}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${m.color}18`, border: `1px solid ${m.color}28` }}>
              <Icon className="w-5 h-5" style={{ color: m.color }} />
            </div>
            <span className="font-semibold text-white text-base">{m.title}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-white/50 leading-relaxed">{m.desc}</p>
        {m.route && (
          <button onClick={() => { onClose(); navigate(m.route!); }}
            className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
            style={{ background: `${m.color}18`, border: `1px solid ${m.color}28`, color: m.color }}>
            <Icon className="w-4 h-4" />
            Continue to {m.title}
          </button>
        )}
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function WalletsPage() {
  const { customer, token, loading: authLoading } = useCustomerAuth();
  const navigate = useNavigate();

  // Privacy mode
  const [privacy, setPrivacy] = useState(false);
  useEffect(() => { setPrivacy(localStorage.getItem('cgc_privacy_mode') === 'true'); }, []);
  const togglePrivacy = () => {
    const next = !privacy;
    setPrivacy(next);
    localStorage.setItem('cgc_privacy_mode', String(next));
  };

  // Data
  const [overview, setOverview]     = useState<WalletOverview | null>(null);
  const [ovLoading, setOvLoading]   = useState(true);
  const [ovError, setOvError]       = useState('');
  const [allTx, setAllTx]           = useState<Tx[]>([]);
  const [txLoading, setTxLoading]   = useState(true);

  // UI state
  const [txTab, setTxTab]           = useState<'banking' | 'trading'>('banking');
  const [selectedCcy, setSelectedCcy] = useState<string | null>(null);
  const [perfPeriod, setPerfPeriod] = useState<PerfPeriod>('1M');
  const [modal, setModal]           = useState<QuickAction | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);

  // WS status for ticker strip
  const { status: wsStatus, isLive } = useMarketWebSocket(WATCH_SYMBOLS, 8_000);

  // Fake sparkline (replace with real historical endpoint when available)
  const sparkData = [100, 102, 98, 105, 103, 108, 106, 112, 110, 115, 113, 118];

  const loadOverview = useCallback(async () => {
    if (!token) return;
    setOvLoading(true); setOvError('');
    try {
      const res = await fetch('/api/users/wallet-overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load wallet data');
      const data = await res.json() as WalletOverview;
      setOverview(data);
      if (!selectedCcy && data.currencies.length > 0) setSelectedCcy(data.currencies[0].currency);
    } catch (e) {
      setOvError(e instanceof Error ? e.message : 'Failed');
    } finally { setOvLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadTx = useCallback(async () => {
    if (!token) return;
    setTxLoading(true);
    try {
      const res = await fetch('/api/users/transactions?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json() as { transactions: Tx[] };
        setAllTx(d.transactions ?? []);
      }
    } catch { /* silent */ } finally { setTxLoading(false); }
  }, [token]);

  useEffect(() => {
    if (!authLoading && !customer) navigate('/login?reason=session_expired', { replace: true });
  }, [customer, authLoading, navigate]);

  useEffect(() => { void loadOverview(); void loadTx(); }, [loadOverview, loadTx]);

  // Background sync — 30s, pauses when tab hidden
  useBackgroundSync(
    `wallet-overview-${token ?? 'anon'}`,
    async () => {
      if (!token) return null;
      const res = await fetch('/api/users/wallet-overview', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      return res.json();
    },
    30_000,
    (data: unknown) => {
      if (data && typeof data === 'object' && 'currencies' in data) setOverview(data as WalletOverview);
    },
  );

  if (authLoading || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  const todayUp    = (overview?.todayPnl ?? 0) >= 0;
  const totalUp    = (overview?.totalPnl ?? 0) >= 0;
  const selectedW  = overview?.currencies.find(c => c.currency === selectedCcy);
  const cColor     = selectedCcy ? (CCY_COLOR[selectedCcy] ?? '#888') : GOLD;
  const walletTx   = allTx.filter(t => !selectedCcy || t.currency === selectedCcy);

  return (
    <>
      <Helmet>
        <title>My Wallets — City Gate Capital</title>
        <meta name="description" content="Manage your multi-currency wallets, trading portfolio, and asset allocation at City Gate Capital." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/wallets" />
      </Helmet>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showTransfer && token && overview && (
          <TransferModal
            key="transfer"
            onClose={() => { setShowTransfer(false); void loadOverview(); }}
            token={token}
            bankBalance={overview.bankingBalance}
            tradingBalance={overview.tradingBalance}
          />
        )}
        {modal && token && (
          <QuickActionModal key={modal} action={modal} onClose={() => setModal(null)} />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-[#0A0A0A] text-white">

        {/* ── Sticky header ── */}
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0A0A0A]/95 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">
            <Link to="/dashboard"
              className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-white/40 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4" style={{ color: GOLD }} />
              <h1 className="text-sm font-semibold text-white">My Wallets</h1>
            </div>

            {/* WS status */}
            <div className="hidden sm:flex items-center gap-1.5 ml-2">
              {isLive
                ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[10px] text-emerald-400 font-semibold">Live</span></>
                : wsStatus === 'connecting'
                  ? <><RefreshCw className="w-3 h-3 text-amber-400 animate-spin" /><span className="text-[10px] text-amber-400 font-semibold">Connecting</span></>
                  : <><WifiOff className="w-3 h-3 text-white/20" /><span className="text-[10px] text-white/20 font-semibold">Polling</span></>
              }
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => { void loadOverview(); void loadTx(); }}
                className="p-2 rounded-xl hover:bg-white/6 transition-colors text-white/30 hover:text-white">
                <RefreshCw className={`w-3.5 h-3.5 ${ovLoading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={togglePrivacy}
                className="p-2 rounded-xl border transition-all"
                style={{
                  background:   privacy ? `${GOLD}12` : 'rgba(255,255,255,0.04)',
                  borderColor:  privacy ? `${GOLD}30` : 'rgba(255,255,255,0.08)',
                  color:        privacy ? GOLD : 'rgba(255,255,255,0.4)',
                }}>
                {privacy ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 md:px-6 py-5 space-y-5">

          {/* ── ① Hero card ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="relative rounded-2xl border border-white/[0.08] overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.09) 0%, rgba(10,10,10,0.97) 55%, rgba(99,126,234,0.07) 100%)' }}
          >
            {/* Decorative glows */}
            <div className="absolute top-0 left-1/4 w-72 h-36 rounded-full blur-3xl pointer-events-none opacity-40"
              style={{ background: `radial-gradient(circle, ${GOLD}18 0%, transparent 70%)` }} />
            <div className="absolute bottom-0 right-1/4 w-48 h-24 rounded-full blur-3xl pointer-events-none opacity-30"
              style={{ background: `radial-gradient(circle, ${BLUE}18 0%, transparent 70%)` }} />

            <div className="relative p-5 md:p-7">
              <div className="flex flex-col md:flex-row md:items-start gap-6">

                {/* Left: value + P&L */}
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">
                    Total Portfolio Value
                  </p>
                  {ovLoading ? (
                    <div className="h-12 w-52 rounded-xl bg-white/5 animate-pulse" />
                  ) : ovError ? (
                    <p className="text-red-400 text-sm flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" /> {ovError}
                    </p>
                  ) : (
                    <PV
                      value={fmt(overview?.totalPortfolioValue ?? 0)}
                      privacy={privacy}
                      className="text-4xl md:text-5xl font-bold text-white block"
                    />
                  )}

                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <span className={`flex items-center gap-1.5 text-sm font-semibold ${todayUp ? 'text-emerald-400' : 'text-red-400'}`}>
                      {todayUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      <PV value={`${todayUp ? '+' : ''}${fmtUsd(overview?.todayPnl ?? 0)} today`} privacy={privacy} />
                      <span className="text-xs opacity-70">({overview?.todayPnlPct?.toFixed(2) ?? '0.00'}%)</span>
                    </span>
                    <span className="text-white/15">·</span>
                    <span className={`text-xs font-mono ${totalUp ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                      <PV value={`${totalUp ? '+' : ''}${fmtUsd(overview?.totalPnl ?? 0)} all-time`} privacy={privacy} />
                    </span>
                  </div>
                </div>

                {/* Right: sparkline */}
                <div className="w-full md:w-48 h-16 opacity-70">
                  <Sparkline data={sparkData} color={todayUp ? EMERALD : RED} height={64} fill />
                </div>
              </div>

              {/* Quick-action buttons */}
              <div className="mt-6 grid grid-cols-3 sm:grid-cols-6 gap-2">
                {([
                  { id: 'deposit',  label: 'Deposit',  Icon: ArrowDownLeft,  color: EMERALD },
                  { id: 'withdraw', label: 'Withdraw', Icon: ArrowUpRight,   color: RED     },
                  { id: 'exchange', label: 'Exchange', Icon: RefreshCw,      color: PURPLE  },
                  { id: 'buy',      label: 'Buy',      Icon: Plus,           color: GOLD    },
                  { id: 'sell',     label: 'Sell',     Icon: Minus,          color: BLUE    },
                  { id: 'transfer', label: 'Transfer', Icon: ArrowRightLeft, color: '#F3BA2F' },
                ] as const).map(({ id, label, Icon, color }) => (
                  <motion.button
                    key={id}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => id === 'transfer' ? navigate('/dashboard/transfers') : setModal(id as QuickAction)}
                    className="flex flex-col items-center gap-2 py-3.5 rounded-xl border border-white/[0.07] hover:border-white/[0.14] bg-white/[0.03] hover:bg-white/[0.06] transition-all"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <span className="text-[10px] font-semibold text-white/50">{label}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── ② Balance cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <BalanceCard
              label="Banking Balance"
              value={fmtUsd(overview?.bankingBalance ?? 0)}
              sub={`${overview?.currencies.length ?? 0} currencies`}
              color={GOLD} icon={Wallet} privacy={privacy} loading={ovLoading}
            />
            <BalanceCard
              label="Trading Balance"
              value={fmtUsd(overview?.tradingBalance ?? 0)}
              sub={`${overview?.openPositions ?? 0} open positions`}
              color={BLUE} icon={BarChart2} privacy={privacy} loading={ovLoading} pulse
            />
            <BalanceCard
              label="Investment Balance"
              value={fmtUsd(overview?.investmentBalance ?? 0)}
              sub="Coming soon"
              color={PURPLE} icon={Star} privacy={privacy} loading={ovLoading}
            />
            <BalanceCard
              label="Today's P&L"
              value={`${todayUp ? '+' : ''}${fmtUsd(overview?.todayPnl ?? 0)}`}
              sub={`Win rate: ${overview?.winRate ?? 0}%`}
              color={todayUp ? EMERALD : RED}
              icon={todayUp ? TrendingUp : TrendingDown}
              privacy={privacy} loading={ovLoading} pulse={todayUp}
            />
          </div>

          {/* ── ③ Live ticker strip ── */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {WATCH_SYMBOLS.map(sym => <TickerPill key={sym} symbol={sym} />)}
          </div>

          {/* ── ④⑤ Main grid ── */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

            {/* ── Left column (4 cols) ── */}
            <div className="xl:col-span-4 space-y-4">

              {/* Asset Allocation */}
              <Panel>
                <PanelHeader icon={PieChart} title="Asset Allocation" />
                <div className="p-4">
                  {overview?.allocation && overview.allocation.length > 0 ? (
                    <div className="flex items-center gap-5">
                      <div className="w-28 h-28 shrink-0 relative">
                        <DonutChart items={overview.allocation} />
                        {/* Centre label */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <p className="text-[9px] text-white/30 uppercase tracking-widest">Total</p>
                          <PV
                            value={fmtUsd(overview.totalPortfolioValue)}
                            privacy={privacy}
                            className="text-[10px] font-bold text-white"
                          />
                        </div>
                      </div>
                      <div className="flex-1 space-y-2.5">
                        {overview.allocation.slice(0, 5).map(a => (
                          <div key={a.name} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ALLOC_COLOR[a.name] ?? '#555' }} />
                            <span className="text-xs text-white/50 capitalize flex-1">{a.name}</span>
                            <span className="text-xs font-mono font-semibold text-white/70">{a.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-white/20 text-xs">
                      <PieChart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No allocation data yet
                    </div>
                  )}
                </div>
              </Panel>

              {/* Currency Wallets */}
              <Panel>
                <PanelHeader
                  icon={Globe} title="Currencies"
                  right={<span className="text-[10px] text-white/25">{overview?.currencies.length ?? 0} wallets</span>}
                />
                {ovLoading ? (
                  <div className="p-3 space-y-2">
                    {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-white/3 animate-pulse" />)}
                  </div>
                ) : (overview?.currencies ?? []).length === 0 ? (
                  <div className="py-10 text-center text-white/20 text-xs">No wallets yet</div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {(overview?.currencies ?? []).map(c => {
                      const col      = CCY_COLOR[c.currency] ?? '#888';
                      const flag     = CCY_FLAG[c.currency];
                      const isCrypto = CRYPTO.has(c.currency);
                      const isSel    = selectedCcy === c.currency;
                      return (
                        <button key={c.currency} onClick={() => setSelectedCcy(c.currency)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                          style={{ background: isSel ? `${col}08` : undefined }}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm"
                            style={{ background: `${col}15`, border: `1px solid ${col}22` }}>
                            {flag && flag.length <= 2 ? flag : <span className="text-[10px] font-bold" style={{ color: col }}>{c.currency.slice(0,2)}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-white">{c.currency}</span>
                              {isCrypto && <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: `${BLUE}15`, color: BLUE }}>CRYPTO</span>}
                            </div>
                            <PV value={fmtUsd(c.usdEquivalent)} privacy={privacy} className="text-[10px] text-white/30" />
                          </div>
                          <div className="text-right">
                            <PV
                              value={c.amount.toLocaleString('en-US', { maximumFractionDigits: isCrypto ? 6 : 2 })}
                              privacy={privacy}
                              className="text-sm font-mono font-semibold text-white"
                            />
                          </div>
                          {isSel && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: col }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Panel>

              {/* Open Positions */}
              {(overview?.positions ?? []).length > 0 && (
                <Panel>
                  <PanelHeader
                    icon={Activity} color={BLUE} title="Open Positions"
                    right={
                      <Link to="/dashboard/trading" className="text-[10px] text-white/30 hover:text-white/60 flex items-center gap-0.5 transition-colors">
                        View all <ChevronRight className="w-3 h-3" />
                      </Link>
                    }
                  />
                  <div className="divide-y divide-white/[0.04]">
                    {(overview?.positions ?? []).slice(0, 5).map(p => {
                      const up = p.unrealisedPnl >= 0;
                      return (
                        <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-white">{p.symbol}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${p.side === 'buy' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-red-400/15 text-red-400'}`}>
                                {p.side.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-[10px] text-white/30">{p.quantity} @ ${fmtPrice(p.avgEntry)}</span>
                          </div>
                          <div className="text-right">
                            <PV
                              value={`${up ? '+' : ''}${fmtUsd(p.unrealisedPnl)}`}
                              privacy={privacy}
                              className={`text-xs font-mono font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}
                            />
                            <span className={`text-[10px] ${up ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
                              {up ? '+' : ''}{p.pnlPct.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              )}
            </div>

            {/* ── Right column (8 cols) ── */}
            <div className="xl:col-span-8 space-y-4">

              {/* Portfolio Performance */}
              <Panel>
                <PanelHeader
                  icon={BarChart2} title="Portfolio Performance"
                  right={
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${totalUp ? 'text-emerald-400' : 'text-red-400'}`}>
                        <PV value={`${totalUp ? '+' : ''}${fmtUsd(overview?.totalPnl ?? 0)}`} privacy={privacy} />
                      </span>
                      <Link to="/dashboard/trading/analytics" className="text-[10px] text-white/30 hover:text-white/60 flex items-center gap-0.5 transition-colors">
                        Analytics <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  }
                />
                <div className="p-4">
                  {/* Period selector */}
                  <div className="flex gap-1 mb-4">
                    {(['1D','1W','1M','3M'] as PerfPeriod[]).map(p => (
                      <button key={p} onClick={() => setPerfPeriod(p)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          perfPeriod === p ? 'text-white' : 'text-white/30 hover:text-white/60'
                        }`}
                        style={perfPeriod === p ? { background: `${GOLD}20`, color: GOLD, border: `1px solid ${GOLD}30` } : {}}>
                        {p}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div key={perfPeriod} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                      <PerfChart period={perfPeriod} color={totalUp ? EMERALD : RED} />
                    </motion.div>
                  </AnimatePresence>

                  {/* KPI row */}
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/[0.05]">
                    {[
                      { label: 'Unrealised P&L', value: fmtUsd(overview?.unrealisedPnl ?? 0), color: (overview?.unrealisedPnl ?? 0) >= 0 ? EMERALD : RED },
                      { label: 'Realised P&L',   value: fmtUsd(overview?.realisedPnl ?? 0),   color: (overview?.realisedPnl ?? 0) >= 0 ? EMERALD : RED },
                      { label: 'Open Orders',    value: String(overview?.openOrders ?? 0),     color: GOLD },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <p className="text-[10px] text-white/25 mb-1">{s.label}</p>
                        <span className="text-sm font-mono font-semibold" style={{ color: s.color }}>
                          <PV value={s.value} privacy={privacy} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              {/* Selected wallet detail */}
              <AnimatePresence mode="wait">
                {selectedW && (
                  <motion.div key={selectedW.currency}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-2xl border p-5"
                    style={{ background: `${cColor}06`, borderColor: `${cColor}20` }}
                  >
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0"
                        style={{ background: `${cColor}18`, border: `1px solid ${cColor}28` }}>
                        {CCY_FLAG[selectedW.currency] ?? selectedW.currency.slice(0,2)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-base font-bold text-white">{selectedW.currency}</span>
                          {CRYPTO.has(selectedW.currency) && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: `${BLUE}15`, color: BLUE }}>CRYPTO</span>
                          )}
                        </div>
                        <PV
                          value={`${selectedW.amount.toLocaleString('en-US', { maximumFractionDigits: CRYPTO.has(selectedW.currency) ? 6 : 2 })} ${selectedW.currency}`}
                          privacy={privacy}
                          className="text-2xl font-bold text-white block"
                        />
                        <p className="text-xs text-white/30 mt-0.5">
                          ≈ <PV value={fmtUsd(selectedW.usdEquivalent)} privacy={privacy} /> USD
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'Send',    Icon: Send,          route: `/dashboard/transfers?from=${selectedW.currency}`, color: cColor  },
                        { label: 'Deposit', Icon: ArrowDownLeft, route: '/dashboard/deposits',                              color: EMERALD },
                        { label: 'Buy',     Icon: ShoppingCart,  action: 'buy' as QuickAction,                              color: GOLD    },
                        { label: 'Sell',    Icon: DollarSign,    action: 'sell' as QuickAction,                             color: BLUE    },
                      ].map(({ label, Icon, route, action, color }) => (
                        route ? (
                          <Link key={label} to={route}
                            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                            style={{ background: `${color}15`, color, border: `1px solid ${color}22` }}>
                            <Icon className="w-3.5 h-3.5" /> {label}
                          </Link>
                        ) : (
                          <button key={label} onClick={() => setModal(action!)}
                            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                            style={{ background: `${color}15`, color, border: `1px solid ${color}22` }}>
                            <Icon className="w-3.5 h-3.5" /> {label}
                          </button>
                        )
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Transaction / Trading history */}
              <Panel>
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <div className="flex gap-1">
                    {(['banking', 'trading'] as const).map(tab => (
                      <button key={tab} onClick={() => setTxTab(tab)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          txTab === tab ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'
                        }`}>
                        {tab === 'banking' ? 'Banking Transactions' : 'Trading History'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedCcy && txTab === 'banking' && (
                      <span className="text-[10px] text-white/25">{selectedCcy} only</span>
                    )}
                    <History className="w-3.5 h-3.5 text-white/20" />
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={txTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    {txTab === 'banking' ? (
                      txLoading ? (
                        <div className="flex items-center justify-center py-10">
                          <Loader2 className="w-5 h-5 animate-spin text-white/20" />
                        </div>
                      ) : walletTx.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-white/20">
                          <History className="w-6 h-6" />
                          <p className="text-xs">No transactions yet</p>
                        </div>
                      ) : (
                        <VirtualList
                          items={walletTx}
                          rowHeight={64}
                          overscan={5}
                          className="max-h-96"
                          emptyState={
                            <div className="flex flex-col items-center justify-center py-12 gap-2 text-white/20">
                              <History className="w-6 h-6" />
                              <p className="text-xs">No transactions yet</p>
                            </div>
                          }
                          renderRow={(tx) => {
                            const { Icon, color: txColor } = txMeta(tx.type);
                            const positive = isCredit(tx.type);
                            return (
                              <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors border-b border-white/[0.04]">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                  style={{ background: `${txColor}12`, border: `1px solid ${txColor}20` }}>
                                  <Icon className="w-3.5 h-3.5" style={{ color: txColor }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white/80 truncate">
                                    {tx.description || tx.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-white/25">
                                      {new Date(tx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                                      tx.status === 'completed' || tx.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                                      tx.status === 'pending'   ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                                    }`}>{tx.status}</span>
                                  </div>
                                </div>
                                <PV
                                  value={`${positive ? '+' : '−'}${fmt(Math.abs(Number(tx.amount ?? 0)), tx.currency ?? 'USD')}`}
                                  privacy={privacy}
                                  className={`text-sm font-semibold font-mono tabular-nums ${positive ? 'text-emerald-400' : 'text-white/50'}`}
                                />
                              </div>
                            );
                          }}
                        />
                      )
                    ) : (
                      /* Trading history */
                      (overview?.recentTrades ?? []).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-white/20">
                          <Zap className="w-6 h-6" />
                          <p className="text-xs">No trades yet</p>
                          <Link to="/dashboard/trading/markets" className="text-xs mt-1 hover:text-white/50 transition-colors" style={{ color: GOLD }}>
                            Start trading →
                          </Link>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/[0.04] max-h-96 overflow-y-auto">
                          {(overview?.recentTrades ?? []).map(t => {
                            const pnlUp = t.pnl >= 0;
                            return (
                              <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                  t.side === 'buy' ? 'bg-emerald-400/10 border border-emerald-400/20' : 'bg-red-400/10 border border-red-400/20'
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
                                  </div>
                                  <span className="text-[10px] text-white/25">
                                    {t.quantity} @ ${fmtPrice(t.price)} · {new Date(t.executedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                  </span>
                                </div>
                                {t.pnl !== 0 && (
                                  <PV
                                    value={`${pnlUp ? '+' : ''}${fmtUsd(t.pnl)}`}
                                    privacy={privacy}
                                    className={`text-sm font-mono font-semibold ${pnlUp ? 'text-emerald-400' : 'text-red-400'}`}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}
                  </motion.div>
                </AnimatePresence>
              </Panel>

            </div>{/* end right column */}
          </div>{/* end main grid */}
        </main>
      </div>
    </>
  );
}
