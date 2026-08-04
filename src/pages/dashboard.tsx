import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  LogOut, CreditCard, ArrowUpRight, ArrowDownLeft, Globe,
  TrendingUp, Shield, Bell, Settings, ChevronRight,
  Send, ShoppingBag, Plane, Utensils, DollarSign, Bitcoin,
  MessageCircle,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';

// ── Constants ───────────────────────────────────────────────────────────────
const GOLD = '#C9A84C';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const QUICK_ACTIONS = [
  { icon: Send,          label: 'Send Money', href: '/transfers',       color: GOLD      },
  { icon: ArrowDownLeft, label: 'Add Funds',  href: '/accounts',        color: '#10B981' },
  { icon: Globe,         label: 'Exchange',   href: '/wallet',          color: '#627EEA' },
  { icon: CreditCard,    label: 'Cards',      href: '/digital-banking', color: '#9945FF' },
  { icon: MessageCircle, label: 'Support',    href: '/dashboard/support', color: '#F59E0B' },
];

// ── Types ────────────────────────────────────────────────────────────────────
interface Tx {
  id: string;
  description: string;
  amount: number;
  currency: string;
  createdAt: string;
  type: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function txIcon(type: string) {
  if (type === 'transfer' || type === 'wire_transfer') return Send;
  if (type === 'crypto_buy' || type === 'crypto_sell') return Bitcoin;
  if (type === 'deposit' || type === 'manual_credit' || type === 'refund') return ArrowDownLeft;
  if (type === 'shopping') return ShoppingBag;
  if (type === 'dining') return Utensils;
  if (type === 'travel') return Plane;
  return ArrowUpRight;
}

function txCategory(type: string) {
  if (type === 'crypto_buy' || type === 'crypto_sell') return 'Crypto';
  if (type === 'deposit' || type === 'manual_credit') return 'Deposit';
  if (type === 'refund') return 'Refund';
  if (type === 'transfer' || type === 'wire_transfer') return 'Transfer';
  if (type === 'withdrawal') return 'Withdrawal';
  if (type === 'shopping') return 'Shopping';
  if (type === 'dining') return 'Dining';
  if (type === 'travel') return 'Travel';
  return 'Transaction';
}

function txColor(type: string) {
  if (type === 'crypto_buy' || type === 'crypto_sell') return '#627EEA';
  if (type === 'deposit' || type === 'manual_credit' || type === 'refund') return '#10B981';
  if (type === 'travel') return '#627EEA';
  if (type === 'dining') return '#10B981';
  if (type === 'shopping') return '#F472B6';
  return GOLD;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function fmt(n: number, currency = 'USD') {
  return n.toLocaleString('en-US', {
    style: 'currency', currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / Math.abs(prev)) * 100;
}

// ── DebitCardSection Component ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function DebitCardSection({ name, cardLast4, cardType, accountTier, lastTx, spendCur }: {
  name: string; balance: number; cardLast4: string; cardType: string; accountTier: string; lastTx: any; spendCur: any;
}) {
  const [cardFlipped, setCardFlipped] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showCVV, setShowCVV] = useState(false);
  const [showFullNumber, setShowFullNumber] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const tierGradient =
    accountTier === 'savings'
      ? 'linear-gradient(135deg, #7B5C00 0%, #C9A84C 50%, #7B5C00 100%)'
      : accountTier === 'business'
      ? 'linear-gradient(135deg, #2a2a2a 0%, #8a8a8a 50%, #2a2a2a 100%)'
      : 'linear-gradient(135deg, #8B0000 0%, #DC143C 50%, #8B0000 100%)';

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = Math.max(-15, Math.min(15, ((e.clientY - rect.top) / rect.height - 0.5) * -30));
    const y = Math.max(-15, Math.min(15, ((e.clientX - rect.left) / rect.width - 0.5) * 30));
    setTilt({ x, y });
  }, []);

  const spendingThisMonth = spendCur?.monthlySpend ?? 0;
  const spendLimit = 5000;

  return (
    <div className="w-full mb-6">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ── Card Column ── */}
        <div className="flex-shrink-0 w-full lg:w-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm tracking-wide uppercase">My Cards</h3>
            <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded-full">1 of 1</span>
          </div>

          {/* 3D Card wrapper */}
          <div style={{ perspective: '1000px' }} className="w-full max-w-sm lg:max-w-md">
            <div
              ref={cardRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setTilt({ x: 0, y: 0 })}
              onClick={() => setCardFlipped(f => !f)}
              style={{
                transformStyle: 'preserve-3d' as any,
                transition: 'transform 0.6s',
                transform: cardFlipped
                  ? 'perspective(1000px) rotateY(180deg)'
                  : `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                cursor: 'pointer',
                position: 'relative',
                width: '100%',
                paddingTop: '62.5%',
              }}
            >
              {/* ── Front Face ── */}
              <div style={{
                backfaceVisibility: 'hidden' as any,
                WebkitBackfaceVisibility: 'hidden' as any,
                position: 'absolute', inset: 0,
                borderRadius: 16,
                background: tierGradient,
                boxShadow: '0 25px 50px rgba(0,0,0,0.5), 0 10px 20px rgba(0,0,0,0.3)',
                overflow: 'hidden',
              }}>
                {/* Glossy overlay */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%)',
                }} />
                {/* Card network logo */}
                <div style={{ position: 'absolute', top: 18, left: 20 }}>
                  {cardType === 'mastercard' ? (
                    <svg width="50" height="30" viewBox="0 0 50 30">
                      <circle cx="18" cy="15" r="13" fill="#EB001B" opacity="0.9"/>
                      <circle cx="32" cy="15" r="13" fill="#F79E1B" opacity="0.9"/>
                      <ellipse cx="25" cy="15" rx="7" ry="13" fill="#FF5F00" opacity="0.9"/>
                    </svg>
                  ) : (
                    <span style={{ fontStyle: 'italic', fontWeight: 900, color: 'white', fontSize: 22, letterSpacing: 1 }}>VISA</span>
                  )}
                </div>
                {/* EMV Chip */}
                <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)' }}>
                  <div style={{width:40,height:30,borderRadius:6,background:'linear-gradient(135deg,#d4af37,#f5e17a,#d4af37)',border:'1px solid #a88a20',display:'grid',gridTemplate:'repeat(3,1fr)/repeat(3,1fr)',gap:1,padding:3}}>
                    {Array(9).fill(0).map((_,i)=><div key={i} style={{background:'rgba(0,0,0,0.1)',borderRadius:1}}/>)}
                  </div>
                </div>
                {/* Frozen badge */}
                {frozen && (
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(59,130,246,0.85)', borderRadius: 8, padding: '6px 16px' }}>
                    <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>❄ FROZEN</span>
                  </div>
                )}
                {/* Card number */}
                <div style={{ position: 'absolute', bottom: 48, left: 20, right: 20, fontFamily: 'monospace', color: 'white', fontSize: 18, letterSpacing: '0.15em', fontWeight: 500 }}>
                  •••• •••• •••• {cardLast4 || '4821'}
                </div>
                {/* Bottom row */}
                <div style={{ position: 'absolute', bottom: 18, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, textTransform: 'uppercase' as any, letterSpacing: 1 }}>Cardholder</div>
                    <div style={{ color: 'white', fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>{(name || 'CARD HOLDER').toUpperCase()}</div>
                  </div>
                  <div style={{ textAlign: 'right' as any }}>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, textTransform: 'uppercase' as any, letterSpacing: 1 }}>Expires</div>
                    <div style={{ color: 'white', fontFamily: 'monospace', fontSize: 13 }}>12/27</div>
                  </div>
                </div>
              </div>

              {/* ── Back Face ── */}
              <div style={{
                backfaceVisibility: 'hidden' as any,
                WebkitBackfaceVisibility: 'hidden' as any,
                position: 'absolute', inset: 0,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                transform: 'rotateY(180deg)',
                overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: 24, left: 0, right: 0, height: '22%', background: '#111' }} />
                <button
                  onClick={(e) => { e.stopPropagation(); setCardFlipped(false); }}
                  style={{ position: 'absolute', top: 10, right: 14, color: 'rgba(255,255,255,0.6)', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Hide ✕
                </button>
                <div style={{ position: 'absolute', top: '42%', left: 20, right: 20 }}>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 8 }}>
                    Last used: {lastTx?.description ?? 'No transactions yet'}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as any }}>
                    <button onClick={(e) => { e.stopPropagation(); setFrozen(f => !f); }}
                      style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white', fontSize: 11, cursor: 'pointer' }}>
                      {frozen ? '🔓 Unfreeze' : '❄ Freeze'}
                    </button>
                    <button style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.5)', background: 'transparent', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>
                      Report Lost
                    </button>
                    <button style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(201,168,76,0.5)', background: 'transparent', color: '#C9A84C', fontSize: 11, cursor: 'pointer' }}>
                      Request New
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button disabled title="Coming soon"
              className="text-xs text-gray-500 border border-gray-700 rounded-lg px-3 py-1.5 cursor-not-allowed opacity-50">
              + Add Virtual Card
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">Click card to flip</p>
        </div>

        {/* ── Details Column ── */}
        <div className="flex-1 flex flex-col gap-4 w-full">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-semibold text-sm">Card Details</h4>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${frozen ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'}`}>
                {frozen ? 'Frozen' : 'Active'}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Card Type</span><span className="text-white">Virtual</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Issued</span><span className="text-white">Jan 2024</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Last Used</span><span className="text-white">{lastTx?.date ?? '--'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Network</span><span className="text-white capitalize">{cardType || 'Visa'}</span></div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Spending This Month</span>
                <span className="text-white">${spendingThisMonth.toLocaleString()} / $5,000</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-gradient-to-r from-red-700 to-red-400"
                  style={{ width: `${Math.min(100, (spendingThisMonth / spendLimit) * 100)}%` }} />
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-gray-500">Remaining</span>
                <span className="text-gray-300">${Math.max(0, spendLimit - spendingThisMonth).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <button onClick={() => setShowOverlay(true)}
            className="w-full py-2.5 rounded-xl border border-gray-600 text-white text-sm font-medium hover:border-gray-400 transition-colors">
            Card Options
          </button>
        </div>
      </div>

      {/* ── Card Options Overlay ── */}
      {showOverlay && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowOverlay(false)}>
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold text-lg">Card Options</h3>
              <button onClick={() => setShowOverlay(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                <div>
                  <div className="text-white text-sm font-medium">Card Number</div>
                  <div className="text-gray-400 text-xs font-mono mt-0.5">
                    {showFullNumber ? `4532 1234 5678 ${cardLast4}` : `•••• •••• •••• ${cardLast4}`}
                  </div>
                </div>
                <button onClick={() => setShowFullNumber(f => !f)} className="text-xs text-blue-400 hover:text-blue-300 ml-2">
                  {showFullNumber ? 'Hide' : 'View'}
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                <div>
                  <div className="text-white text-sm font-medium">CVV</div>
                  <div className="text-gray-400 text-xs font-mono mt-0.5">{showCVV ? '742' : '•••'}</div>
                  {showCVV && <div className="text-yellow-500 text-xs mt-0.5">Shown for 10 seconds</div>}
                </div>
                <button onClick={() => { setShowCVV(true); setTimeout(() => setShowCVV(false), 10000); }}
                  className="text-xs text-blue-400 hover:text-blue-300 ml-2" disabled={showCVV}>
                  {showCVV ? 'Shown' : 'View'}
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                <div>
                  <div className="text-white text-sm font-medium">{frozen ? 'Unfreeze Card' : 'Freeze Card'}</div>
                  <div className="text-gray-400 text-xs mt-0.5">{frozen ? 'Card is currently frozen' : 'Temporarily block all transactions'}</div>
                </div>
                <button onClick={() => setFrozen(f => !f)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${frozen ? 'bg-blue-600' : 'bg-gray-600'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${frozen ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
              <button className="w-full p-3 bg-gray-800 rounded-xl text-red-400 text-sm font-medium hover:bg-red-900/20 transition-colors text-left">
                🚨 Report Lost / Stolen
              </button>
              <button className="w-full p-3 rounded-xl border border-yellow-600/50 text-yellow-400 text-sm font-medium hover:border-yellow-500 transition-colors text-left">
                📦 Order Replacement Card
              </button>
              <button className="w-full p-3 bg-gray-800 rounded-xl text-white text-sm font-medium hover:bg-gray-700 transition-colors text-left">
                🔐 Change PIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bar Chart (SVG) ───────────────────────────────────────────────────────────
function BarChart({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1);
  const CH = 160;
  const barFrac = 0.55;
  const n = values.length;
  const colW = 100 / n;

  return (
    <svg viewBox={`0 0 100 ${CH + 24}`} className="w-full" preserveAspectRatio="none" style={{ height: 210 }}>
      {[0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1="0" y1={CH - f * CH} x2="100" y2={CH - f * CH}
          stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" />
      ))}

      {values.map((val, i) => {
        const x = i * colW + (colW * (1 - barFrac)) / 2;
        const bw = colW * barFrac;
        const bh = (val / max) * CH;
        const by = CH - bh;

        return (
          <g key={i}>
            <rect x={x} y={0} width={bw} height={CH} rx="1.5"
              fill="rgba(255,255,255,0.03)" />
            {val > 0 && (
              <>
                <defs>
                  <linearGradient id={`bar-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOLD} stopOpacity="0.95" />
                    <stop offset="100%" stopColor={GOLD} stopOpacity="0.45" />
                  </linearGradient>
                </defs>
                <rect x={x} y={by} width={bw} height={bh} rx="1.5"
                  fill={`url(#bar-${i})`} />
              </>
            )}
            <text x={x + bw / 2} y={CH + 16}
              textAnchor="middle"
              fill="rgba(255,255,255,0.28)"
              fontSize="4.5"
              fontFamily="ui-sans-serif, system-ui, sans-serif">
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, pct, icon: Icon, iconColor, suffix,
}: {
  label: string; value: string; pct: number | null;
  icon: React.ElementType; iconColor: string; suffix?: string;
}) {
  const isUp = (pct ?? 0) >= 0;
  return (
    <div
      className="rounded-2xl p-5 border transition-all hover:border-white/20 hover:shadow-xl flex flex-col gap-3"
      style={{ background: '#111111', borderColor: `${GOLD}28` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-[0.12em] text-foreground/40 uppercase">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${iconColor}1A` }}>
          <Icon size={13} style={{ color: iconColor }} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none tracking-tight">
          {value}{suffix && <span className="text-lg text-foreground/50 ml-0.5">{suffix}</span>}
        </p>
      </div>
      {pct !== null ? (
        <div className={`flex items-center gap-1 text-[11px] font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {isUp ? <ArrowUpRight size={11} /> : <ArrowDownLeft size={11} />}
          <span>{Math.abs(pct).toFixed(1)}% vs last month</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-[11px] font-semibold text-foreground/25">
          <span>All time</span>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { customer, token, loading, logout } = useCustomerAuth();
  const navigate = useNavigate();
  const [allTx, setAllTx] = useState<Tx[]>([]);
  const [chartRange, setChartRange] = useState<'1M' | '3M' | '1Y'>('1Y');

  useEffect(() => {
    if (!loading && !customer) {
      navigate('/login?reason=session_expired', { replace: true });
    }
  }, [customer, loading, navigate]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/users/transactions?limit=200', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.transactions) setAllTx(data.transactions); })
      .catch(() => {});
  }, [token]);

  const stats = useMemo(() => {
    const now = new Date();
    const curM = now.getMonth();
    const curY = now.getFullYear();
    const prevDate = new Date(curY, curM - 1, 1);
    const prevM = prevDate.getMonth();
    const prevY = prevDate.getFullYear();

    const inMonth = (iso: string, m: number, y: number) => {
      const d = new Date(iso);
      return d.getMonth() === m && d.getFullYear() === y;
    };

    const spendCur  = allTx.filter(t => inMonth(t.createdAt, curM, curY)  && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const spendPrev = allTx.filter(t => inMonth(t.createdAt, prevM, prevY) && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

    const isCrypto = (t: Tx) => t.type === 'crypto_buy' || t.type === 'crypto_sell';
    const cryptoCur  = Math.max(0, allTx.filter(isCrypto).reduce((s, t) => s + t.amount, 0));
    const cryptoPrev = Math.max(0, allTx.filter(t => isCrypto(t) && !inMonth(t.createdAt, curM, curY)).reduce((s, t) => s + t.amount, 0));

    const totalIn  = allTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalOut = allTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const portfolioReturn = totalIn > 0 ? ((totalIn - totalOut) / totalIn) * 100 : 0;

    const thisMonthNet = allTx
      .filter(t => inMonth(t.createdAt, curM, curY))
      .reduce((s, t) => s + t.amount, 0);
    const balancePrev = (customer?.balance ?? 0) - thisMonthNet;

    return { spendCur, spendPrev, cryptoCur, cryptoPrev, portfolioReturn, balancePrev };
  }, [allTx, customer]);

  const chartData = useMemo(() => {
    const now = new Date();
    const monthCount = chartRange === '1M' ? 1 : chartRange === '3M' ? 3 : 12;

    if (chartRange === '1M') {
      const labels: string[] = [];
      const values: number[] = [];
      for (let w = 3; w >= 0; w--) {
        const weekEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - w * 7);
        const weekStart = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate() - 6);
        labels.push(`W${4 - w}`);
        const net = allTx
          .filter(t => {
            const d = new Date(t.createdAt);
            return d >= weekStart && d <= weekEnd && t.amount > 0;
          })
          .reduce((s, t) => s + t.amount, 0);
        values.push(net);
      }
      return { labels, values };
    }

    const labels: string[] = [];
    const values: number[] = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      labels.push(MONTHS[m]);
      const net = allTx
        .filter(t => {
          const td = new Date(t.createdAt);
          return td.getMonth() === m && td.getFullYear() === y && t.amount > 0;
        })
        .reduce((s, t) => s + t.amount, 0);
      values.push(net);
    }
    return { labels, values };
  }, [allTx, chartRange]);

  const allocation = useMemo(() => {
    const fiat   = customer?.balance ?? 0;
    const crypto = stats.cryptoCur;
    const total  = fiat + crypto;
    if (total === 0) return [
      { label: 'Fiat',   pct: 100, color: '#627EEA' },
      { label: 'Crypto', pct: 0,   color: GOLD      },
      { label: 'Stocks', pct: 0,   color: '#10B981' },
      { label: 'Cash',   pct: 0,   color: '#F472B6' },
    ];
    const cryptoPct = Math.round((crypto / total) * 100);
    const fiatPct   = 100 - cryptoPct;
    return [
      { label: 'Crypto', pct: cryptoPct, color: GOLD      },
      { label: 'Fiat',   pct: fiatPct,   color: '#627EEA' },
      { label: 'Stocks', pct: 0,         color: '#10B981' },
      { label: 'Cash',   pct: 0,         color: '#F472B6' },
    ];
  }, [stats, customer]);

  const spendCategories = useMemo(() => {
    const now   = new Date();
    const curM  = now.getMonth();
    const curY  = now.getFullYear();
    const cats  = { Travel: 0, Dining: 0, Shopping: 0 };

    allTx
      .filter(t => {
        const d = new Date(t.createdAt);
        return d.getMonth() === curM && d.getFullYear() === curY && t.amount < 0;
      })
      .forEach(t => {
        const desc = (t.description ?? '').toLowerCase();
        if (t.type === 'travel'   || desc.includes('travel') || desc.includes('flight') || desc.includes('hotel'))
          cats.Travel   += Math.abs(t.amount);
        else if (t.type === 'dining'   || desc.includes('dining') || desc.includes('restaurant') || desc.includes('food'))
          cats.Dining   += Math.abs(t.amount);
        else if (t.type === 'shopping' || desc.includes('shop') || desc.includes('store') || desc.includes('market'))
          cats.Shopping += Math.abs(t.amount);
      });

    return [
      { label: 'Travel',   icon: Plane,       color: '#627EEA', amount: cats.Travel   },
      { label: 'Dining',   icon: Utensils,    color: '#10B981', amount: cats.Dining   },
      { label: 'Shopping', icon: ShoppingBag, color: '#F472B6', amount: cats.Shopping },
    ];
  }, [allTx]);

  if (loading || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const firstName  = customer.name.split(' ')[0];
  const recentTx   = allTx.slice(0, 4);
  const balancePct = pctChange(customer.balance, stats.balancePrev);
  const spendPct   = pctChange(stats.spendCur, stats.spendPrev);
  const cryptoPct  = pctChange(stats.cryptoCur, stats.cryptoPrev);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <Helmet>
        <title>Dashboard — City Gate Capital</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <img src="/assets/IMG-20260519-WA0000.jpg" alt="City Gate Capital"
                className="h-8 w-auto object-contain shrink-0" />
              <div className="flex flex-col leading-none">
                <span className="text-foreground font-bold text-sm tracking-tight">City Gate</span>
                <span className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: GOLD }}>Capital</span>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <button
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-foreground/50 hover:text-foreground transition-colors"
                aria-label="Notifications">
                <Bell size={15} />
              </button>
              <button
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-foreground/50 hover:text-foreground transition-colors"
                aria-label="Settings">
                <Settings size={15} />
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-foreground/50 hover:text-foreground hover:bg-white/5 transition-colors ml-1">
                <LogOut size={14} />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── Main ───────────────────────────────────────────────────────── */}
        <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">

          {/* Welcome */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Good day, <span style={{ color: GOLD }}>{firstName}</span>
            </h1>
            <p className="text-foreground/40 text-sm mt-1">Here's your financial overview</p>
          </motion.div>

          {/* KYC / status banner */}
          {customer.status !== 'active' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
              <Shield size={17} className="text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-300">
                  {customer.status === 'pending_kyc'      && 'Identity verification required'}
                  {customer.status === 'pending_approval' && 'Account awaiting approval'}
                </p>
                <Link to="/accounts"
                  className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors mt-0.5 inline-block">
                  Complete verification →
                </Link>
              </div>
            </motion.div>
          )}

          {/* ── 4 Stat Cards ─────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="TOTAL BALANCE"    value={fmt(customer.balance)}              pct={balancePct} icon={DollarSign} iconColor={GOLD}      />
            <StatCard label="MONTHLY SPEND"    value={fmt(stats.spendCur)}                pct={spendPct}   icon={CreditCard} iconColor="#F472B6"    />
            <StatCard label="CRYPTO VALUE"     value={fmt(stats.cryptoCur)}               pct={cryptoPct}  icon={Bitcoin}    iconColor="#627EEA"    />
            <StatCard label="PORTFOLIO RETURN" value={stats.portfolioReturn.toFixed(2)} suffix="%" pct={null} icon={TrendingUp} iconColor="#10B981" />
          </motion.div>

          {/* ── Debit Card Section ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */}
          <DebitCardSection
            name={customer?.name ?? ''}
            balance={customer?.balance ?? 0}
            cardLast4="4821"
            cardType="visa"
            accountTier="personal"
            spendCur={stats}
            lastTx={allTx[0]}
          />

          {/* ── Quick Actions strip ───────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.09 }}
            className="flex items-center gap-3 flex-wrap">
            {QUICK_ACTIONS.map(({ icon: Icon, label, href, color }) => (
              <Link key={label} to={href}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 transition-all group">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${color}1E` }}>
                  <Icon size={13} style={{ color }} />
                </div>
                <span className="text-xs font-medium text-foreground/55 group-hover:text-foreground transition-colors whitespace-nowrap">
                  {label}
                </span>
              </Link>
            ))}
          </motion.div>

          {/* ── Portfolio Chart + Asset Allocation ───────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.11 }}
            className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4"
            style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,320px)' }}>

            <div className="rounded-2xl border p-6 flex flex-col"
              style={{ background: '#111111', borderColor: `${GOLD}28` }}>
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h2 className="text-base font-bold text-foreground">Portfolio Performance</h2>
                <div className="flex rounded-lg overflow-hidden border border-white/10">
                  {(['1M', '3M', '1Y'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setChartRange(r)}
                      className="px-3.5 py-1.5 text-xs font-semibold transition-all"
                      style={{
                        background: chartRange === r ? GOLD : 'transparent',
                        color:      chartRange === r ? '#000' : 'rgba(255,255,255,0.35)',
                      }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <BarChart values={chartData.values} labels={chartData.labels} />
              </div>
            </div>

            <div className="rounded-2xl border p-6 flex flex-col gap-5"
              style={{ background: '#111111', borderColor: `${GOLD}28`, minWidth: 260 }}>

              <div>
                <h2 className="text-base font-bold text-foreground mb-4">Asset Allocation</h2>
                <div className="space-y-3.5">
                  {allocation.map(({ label, pct, color }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-foreground/60">{label}</span>
                        <span className="text-xs text-foreground/35">{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-px" style={{ background: `${GOLD}18` }} />

              <div className="flex-1">
                <div className="flex items-center justify-between mb-3.5">
                  <h3 className="text-sm font-bold text-foreground">Top Spending</h3>
                  <Link to="/transfers" className="text-[10px] font-medium text-foreground/35 hover:text-foreground/60 transition-colors">
                    View All
                  </Link>
                </div>
                <div className="space-y-3">
                  {spendCategories.map(({ label, icon: Icon, color, amount }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}1E` }}>
                        <Icon size={13} style={{ color }} />
                      </div>
                      <span className="text-sm text-foreground/65 flex-1">{label}</span>
                      <span className="text-sm font-semibold" style={{ color: GOLD }}>{fmt(amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Recent Transactions ───────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.14 }}>

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-foreground">Recent Transactions</h2>
              <Link to="/transfers"
                className="text-xs font-semibold flex items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: GOLD }}>
                View All Transactions <ChevronRight size={12} />
              </Link>
            </div>

            {recentTx.length === 0 ? (
              <div className="py-10 text-center text-sm text-foreground/30 rounded-2xl border"
                style={{ borderColor: `${GOLD}1A`, background: '#111111' }}>
                No transactions yet
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4
                              overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0
                              [&]:flex [&]:gap-4 sm:[&]:grid sm:[&]:flex-none">
                {recentTx.map(tx => {
                  const Icon     = txIcon(tx.type);
                  const color    = txColor(tx.type);
                  const positive = tx.amount > 0;
                  return (
                    <div key={tx.id}
                      className="shrink-0 w-60 sm:w-auto rounded-2xl border p-4 transition-all hover:border-white/18 hover:shadow-lg"
                      style={{ background: '#111111', borderColor: `${GOLD}20` }}>
                      <div className="flex items-start justify-between mb-3.5">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ background: `${color}18`, border: `1px solid ${color}2A` }}>
                          <Icon size={15} style={{ color }} />
                        </div>
                        <span className={`text-sm font-bold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                          {positive ? '+' : ''}{fmt(tx.amount, tx.currency ?? 'USD')}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground truncate mb-1">{tx.description}</p>
                      <p className="text-[11px] text-foreground/35">{txCategory(tx.type)} · {timeAgo(tx.createdAt)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

        </main>
      </div>
    </>
  );
}
