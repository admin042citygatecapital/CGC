/**
 * /admin/cards — City Gate Capital Card Management
 *
 * All 7 capabilities:
 *  1. Issue Cards          — issue to any customer (Visa / Mastercard)
 *  2. Freeze Cards         — admin freeze toggle
 *  3. Unfreeze Cards       — same toggle
 *  4. Replace Cards        — retire old card, issue replacement
 *  5. Set Spending Limits  — daily USD cap per card
 *  6. Manage PIN           — set / reset 4-digit PIN
 *  7. View Card Activity   — per-card event log slide-out
 */
import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard, Search, RefreshCw, Plus, Snowflake, Repeat2,
  DollarSign, KeyRound, Activity, X, Loader2, AlertTriangle,
  CheckCircle, ChevronLeft, ChevronRight, Eye, EyeOff,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface AdminCard {
  id:             string;
  userId:         string;
  userName:       string;
  userEmail:      string;
  cardholderName: string;
  numberMasked:   string;
  expiry:         string;
  network:        string;
  status:         string;
  spendingLimit:  number | null;
  hasPin:         boolean;
  issuedByAdmin:  boolean;
  replacedById:   string | null;
  createdAt:      string;
  updatedAt:      string;
}

interface CardActivity {
  id:        string;
  cardId:    string;
  event:     string;
  amount?:   number;
  currency?: string;
  merchant?: string;
  adminId?:  string;
  meta?:     Record<string, unknown>;
  ts:        string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  active:   'bg-emerald-500/15 text-emerald-400',
  frozen:   'bg-blue-500/15 text-blue-400',
  deleted:  'bg-red-500/15 text-red-400',
  replaced: 'bg-white/10 text-white/30',
};

function CardChip() {
  return (
    <div className="w-7 h-5 rounded-sm border border-white/20 bg-gradient-to-br from-yellow-300/80 to-yellow-500/60 flex items-center justify-center">
      <div className="w-4 h-3.5 rounded-[1px] border border-yellow-600/40 grid grid-cols-2 gap-px p-px">
        {[...Array(4)].map((_, i) => <div key={i} className="bg-yellow-600/30 rounded-[1px]" />)}
      </div>
    </div>
  );
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
      className={`fixed top-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl ${
        ok ? 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400' : 'bg-red-500/15 border-red-500/20 text-red-400'
      }`}>
      {ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
      {msg}
    </motion.div>
  );
}

function ModalShell({ title, onClose, children, icon: Icon, iconColor = '#C9A84C', width = 'max-w-md' }: {
  title: string; onClose: () => void; children: React.ReactNode;
  icon?: React.ElementType; iconColor?: string; width?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.93, opacity: 0 }}
        className={`w-full ${width} rounded-2xl border border-white/8 overflow-hidden`}
        style={{ background: 'rgba(10,10,10,0.98)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            {Icon && <Icon size={15} style={{ color: iconColor }} />}
            <p className="text-white font-bold text-sm">{title}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue Card Modal
// ─────────────────────────────────────────────────────────────────────────────
function IssueCardModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [userId,  setUserId]  = useState('');
  const [network, setNetwork] = useState<'visa' | 'mastercard'>('visa');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function submit() {
    if (!userId.trim()) { setError('User ID is required'); return; }
    setLoading(true); setError('');
    const res = await fetch('/api/admin/cards/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ userId: userId.trim(), network }),
    });
    const d = await res.json();
    setLoading(false);
    if (res.ok) { onSuccess(d.message ?? 'Card issued'); onClose(); }
    else setError(d.error ?? 'Failed to issue card');
  }

  const inputCls = 'w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40';
  const labelCls = 'text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block';

  return (
    <ModalShell title="Issue New Card" onClose={onClose} icon={Plus} iconColor="#10B981">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
          <AlertTriangle size={13} /> {error}
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Customer User ID *</label>
          <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="usr_xxxxxxxxxxxxxxxx"
            className={inputCls} />
          <p className="text-white/20 text-[10px] mt-1">Find the ID from the Customer Management page.</p>
        </div>
        <div>
          <label className={labelCls}>Card Network</label>
          <div className="flex gap-2">
            {(['visa', 'mastercard'] as const).map(n => (
              <button key={n} onClick={() => setNetwork(n)}
                className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold capitalize transition-all ${
                  network === n
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-white/8 bg-white/[0.02] text-white/40 hover:bg-white/[0.05]'
                }`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/8 text-white/50 text-sm hover:bg-white/[0.04]">Cancel</button>
        <button onClick={submit} disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/30 flex items-center justify-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Issue Card
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Spending Limit Modal
// ─────────────────────────────────────────────────────────────────────────────
function SpendingLimitModal({ card, onClose, onSuccess }: { card: AdminCard; onClose: () => void; onSuccess: (msg: string) => void }) {
  const [limit,   setLimit]   = useState(card.spendingLimit != null ? String(card.spendingLimit) : '');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function submit() {
    const val = limit.trim() === '' ? null : parseFloat(limit);
    if (val !== null && (isNaN(val) || val < 0)) { setError('Enter a valid positive amount or leave blank to remove limit'); return; }
    setLoading(true); setError('');
    const res = await fetch('/api/admin/cards/spending-limit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ cardId: card.id, limitUsd: val }),
    });
    const d = await res.json();
    setLoading(false);
    if (res.ok) { onSuccess(d.message ?? 'Limit updated'); onClose(); }
    else setError(d.error ?? 'Failed to update limit');
  }

  return (
    <ModalShell title={`Spending Limit — ${card.numberMasked}`} onClose={onClose} icon={DollarSign} iconColor="#C9A84C">
      {error && <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4"><AlertTriangle size={13} />{error}</div>}
      <p className="text-white/40 text-xs mb-4">Set a daily spending cap in USD. Leave blank to remove the limit entirely.</p>
      <div>
        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Daily Limit (USD)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
          <input type="number" min="0" value={limit} onChange={e => setLimit(e.target.value)}
            placeholder="e.g. 500 — blank = unlimited"
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-8 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/8 text-white/50 text-sm hover:bg-white/[0.04]">Cancel</button>
        <button onClick={submit} disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-primary/20 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/30 flex items-center justify-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <DollarSign size={13} />}
          {limit.trim() === '' ? 'Remove Limit' : 'Set Limit'}
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PIN Modal
// ─────────────────────────────────────────────────────────────────────────────
function PinModal({ card, onClose, onSuccess }: { card: AdminCard; onClose: () => void; onSuccess: (msg: string) => void }) {
  const [pin,     setPin]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [show,    setShow]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function submit() {
    if (!/^\d{4}$/.test(pin)) { setError('PIN must be exactly 4 digits'); return; }
    if (pin !== confirm) { setError('PINs do not match'); return; }
    setLoading(true); setError('');
    const res = await fetch('/api/admin/cards/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ cardId: card.id, pin }),
    });
    const d = await res.json();
    setLoading(false);
    if (res.ok) { onSuccess(d.message ?? 'PIN updated'); onClose(); }
    else setError(d.error ?? 'Failed to update PIN');
  }

  const pinInputCls = 'w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm font-mono tracking-[0.4em] placeholder:text-white/20 placeholder:tracking-normal focus:outline-none focus:border-amber-500/40';

  return (
    <ModalShell title={`Set PIN — ${card.numberMasked}`} onClose={onClose} icon={KeyRound} iconColor="#F59E0B">
      {error && <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4"><AlertTriangle size={13} />{error}</div>}
      <p className="text-white/40 text-xs mb-4">
        {card.hasPin ? 'This card already has a PIN. Setting a new one will override it.' : 'Set a 4-digit PIN for this card.'}
      </p>
      <div className="space-y-3">
        <div>
          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">New PIN</label>
          <div className="relative">
            <input type={show ? 'text' : 'password'} maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••" className={pinInputCls} />
            <button onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              {show ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Confirm PIN</label>
          <input type={show ? 'text' : 'password'} maxLength={4} value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••" className={pinInputCls} />
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/8 text-white/50 text-sm hover:bg-white/[0.04]">Cancel</button>
        <button onClick={submit} disabled={loading || pin.length < 4}
          className="flex-1 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/30 flex items-center justify-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
          Set PIN
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Replace Confirm Modal
// ─────────────────────────────────────────────────────────────────────────────
function ReplaceModal({ card, onClose, onSuccess }: { card: AdminCard; onClose: () => void; onSuccess: (msg: string) => void }) {
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    const res = await fetch('/api/admin/cards/replace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ cardId: card.id }),
    });
    const d = await res.json();
    setLoading(false);
    if (res.ok) { onSuccess(d.message ?? 'Card replaced'); onClose(); }
    else onSuccess(d.error ?? 'Replacement failed');
  }

  return (
    <ModalShell title="Replace Card" onClose={onClose} icon={Repeat2} iconColor="#8B5CF6">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-500/8 border border-purple-500/20 mb-4">
        <AlertTriangle size={15} className="text-purple-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-purple-300 text-sm font-semibold">This will retire the current card.</p>
          <p className="text-purple-400/60 text-xs mt-0.5">
            Card <span className="font-mono text-purple-300">{card.numberMasked}</span> will be marked as replaced and a new card will be issued to <strong className="text-purple-300">{card.userName}</strong>.
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/8 text-white/50 text-sm hover:bg-white/[0.04]">Cancel</button>
        <button onClick={submit} disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 text-sm font-semibold hover:bg-purple-500/30 flex items-center justify-center gap-2">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Repeat2 size={13} />}
          Replace Card
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Drawer
// ─────────────────────────────────────────────────────────────────────────────
function ActivityDrawer({ card, onClose }: { card: AdminCard; onClose: () => void }) {
  const [activity, setActivity] = useState<CardActivity[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch(`/api/admin/cards/${card.id}/activity`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setActivity(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [card.id]);

  const EVENT_COLORS: Record<string, string> = {
    admin_issued:       '#10B981',
    admin_frozen:       '#627EEA',
    admin_unfrozen:     '#10B981',
    admin_replaced:     '#8B5CF6',
    spending_limit_set: '#C9A84C',
    admin_pin_set:      '#F59E0B',
    purchase:           '#06B6D4',
    declined:           '#EF4444',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="w-full max-w-sm h-full flex flex-col border-l border-white/8 overflow-hidden"
        style={{ background: 'rgba(10,10,10,0.99)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <div>
            <p className="text-white font-bold text-sm">Card Activity</p>
            <p className="text-white/30 text-xs font-mono">{card.numberMasked}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X size={16} /></button>
        </div>

        {/* Card mini-preview */}
        <div className="mx-4 my-3 rounded-2xl overflow-hidden shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(201,168,76,0.12) 0%, rgba(10,10,10,0.95) 50%, rgba(98,126,234,0.10) 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}>
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-white/60 text-[10px] uppercase tracking-widest">City Gate Capital</p>
              <p className="text-white font-mono text-sm mt-1">{card.numberMasked}</p>
              <p className="text-white/40 text-[10px] mt-0.5">{card.cardholderName} · {card.expiry}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <CardChip />
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[card.status] ?? 'bg-white/10 text-white/40'}`}>
                {card.status}
              </span>
            </div>
          </div>
        </div>

        {/* Activity list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-white/20" />
            </div>
          ) : activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-white/20">
              <Activity size={24} />
              <p className="text-sm">No activity recorded</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {activity.map(a => {
                const color = EVENT_COLORS[a.event] ?? '#6B7280';
                return (
                  <div key={a.id} className="flex items-start gap-2.5 py-2.5 border-b border-white/[0.04]">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white/70">{a.event.replace(/_/g, ' ')}</p>
                      {a.merchant && <p className="text-[10px] text-white/35">{a.merchant}</p>}
                      {a.amount != null && (
                        <p className="text-[10px] font-mono" style={{ color }}>
                          {a.amount > 0 ? '+' : ''}{a.amount} {a.currency ?? 'USD'}
                        </p>
                      )}
                      {a.adminId && <p className="text-[9px] text-white/20">Admin: {a.adminId}</p>}
                    </div>
                    <p className="text-[9px] text-white/20 shrink-0">{new Date(a.ts).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminCardsPage() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [cards,        setCards]        = useState<AdminCard[]>([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [pages,        setPages]        = useState(1);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatus]       = useState('');
  const [loading,      setLoading]      = useState(true);
  const [actionLoading,setAL]           = useState<string | null>(null);
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);

  // Modals
  const [issueOpen,    setIssueOpen]    = useState(false);
  const [limitCard,    setLimitCard]    = useState<AdminCard | null>(null);
  const [pinCard,      setPinCard]      = useState<AdminCard | null>(null);
  const [replaceCard,  setReplaceCard]  = useState<AdminCard | null>(null);
  const [activityCard, setActivityCard] = useState<AdminCard | null>(null);

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  // Pre-filter by userId from query param (linked from Customer Management)
  const userIdFilter = searchParams.get('userId') ?? '';

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchCards = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: '20' });
    if (search)       p.set('search', search);
    if (statusFilter) p.set('status', statusFilter);
    if (userIdFilter) p.set('userId', userIdFilter);
    const res = await fetch(`/api/admin/cards?${p}`, { headers: authHeaders() });
    if (res.ok) {
      const d = await res.json();
      setCards(d.data); setTotal(d.total); setPages(d.pages ?? Math.ceil(d.total / 20));
    }
    setLoading(false);
  }, [page, search, statusFilter, userIdFilter]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  async function doFreeze(card: AdminCard) {
    setAL(card.id + 'freeze');
    const res = await fetch('/api/admin/cards/freeze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ cardId: card.id }),
    });
    const d = await res.json();
    setAL(null);
    if (res.ok) {
      showToast(d.message ?? 'Card updated');
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, status: d.status } : c));
    } else showToast(d.error ?? 'Action failed', false);
  }

  // Stats
  const activeCount  = cards.filter(c => c.status === 'active').length;
  const frozenCount  = cards.filter(c => c.status === 'frozen').length;
  const limitedCount = cards.filter(c => c.spendingLimit != null).length;

  return (
    <>
      <Helmet>
        <title>Card Management — CGC Admin</title>
        <meta name="description" content="Issue, freeze, replace and manage all customer virtual cards." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/admin/cards" />
      </Helmet>
      <AdminLayout title="Card Management">

        {/* Toast */}
        <AnimatePresence>{toast && <Toast {...toast} />}</AnimatePresence>

        {/* ── Page header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-white text-xl font-bold">Card Management</h1>
            <p className="text-white/30 text-sm">
              {total.toLocaleString()} card{total !== 1 ? 's' : ''}
              {userIdFilter && <span className="ml-2 text-primary/60 text-xs">filtered by user</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {userIdFilter && (
              <Link to="/admin/cards" className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/40 text-xs hover:text-white transition-colors">
                <X size={11} /> Clear filter
              </Link>
            )}
            <button onClick={fetchCards}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/50 text-sm hover:text-white transition-colors">
              <RefreshCw size={13} />
            </button>
            <button onClick={() => setIssueOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)', color: '#000' }}>
              <Plus size={14} /> Issue Card
            </button>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Cards',     value: total,        color: '#C9A84C', icon: CreditCard },
            { label: 'Active',          value: activeCount,  color: '#10B981', icon: CheckCircle },
            { label: 'Frozen',          value: frozenCount,  color: '#627EEA', icon: Snowflake },
            { label: 'With Limit',      value: limitedCount, color: '#F59E0B', icon: DollarSign },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/5"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${s.color}15` }}>
                <s.icon size={14} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-white font-bold text-lg leading-none">{s.value}</p>
                <p className="text-white/30 text-[10px] mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search cardholder, last 4 digits, user ID..."
              className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
          </div>
          <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
            <option value="" className="bg-[#0A0A0A]">All Statuses</option>
            <option value="active"   className="bg-[#0A0A0A]">Active</option>
            <option value="frozen"   className="bg-[#0A0A0A]">Frozen</option>
            <option value="replaced" className="bg-[#0A0A0A]">Replaced</option>
            <option value="deleted"  className="bg-[#0A0A0A]">Deleted</option>
          </select>
        </div>

        {/* ── Cards table ── */}
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Card', 'Customer', 'Network', 'Status', 'Limit', 'PIN', 'Issued', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-white/25 text-[10px] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {loading ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 bg-white/[0.04] rounded animate-pulse" /></td></tr>
                )) : cards.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-14 text-center text-white/25 text-sm">No cards found</td></tr>
                ) : cards.map(card => (
                  <motion.tr key={card.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="hover:bg-white/[0.02] transition-colors">

                    {/* Card number */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-5 rounded-sm flex items-center justify-center shrink-0"
                          style={{ background: card.network === 'mastercard' ? '#EB001B22' : '#1A1F7122', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <CreditCard size={11} className="text-white/40" />
                        </div>
                        <div>
                          <p className="text-white/80 text-xs font-mono">{card.numberMasked}</p>
                          <p className="text-white/25 text-[9px]">Exp {card.expiry}</p>
                        </div>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3">
                      <Link to={`/admin/users`} className="group">
                        <p className="text-white/70 text-xs font-medium group-hover:text-primary transition-colors">{card.userName}</p>
                        <p className="text-white/30 text-[10px]">{card.userEmail}</p>
                      </Link>
                    </td>

                    {/* Network */}
                    <td className="px-4 py-3">
                      <span className="text-white/50 text-xs capitalize">{card.network}</span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[card.status] ?? 'bg-white/10 text-white/40'}`}>
                        {card.status}
                      </span>
                    </td>

                    {/* Spending limit */}
                    <td className="px-4 py-3">
                      <span className="text-white/50 text-xs font-mono">
                        {card.spendingLimit != null ? `$${card.spendingLimit.toLocaleString()}/day` : '—'}
                      </span>
                    </td>

                    {/* PIN */}
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${card.hasPin ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/8 text-white/25'}`}>
                        {card.hasPin ? 'Set' : 'None'}
                      </span>
                    </td>

                    {/* Issued */}
                    <td className="px-4 py-3 text-white/30 text-xs whitespace-nowrap">
                      {new Date(card.createdAt).toLocaleDateString()}
                      {card.issuedByAdmin && <span className="ml-1 text-primary/50 text-[9px]">admin</span>}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Freeze / Unfreeze */}
                        {(card.status === 'active' || card.status === 'frozen') && (
                          <button onClick={() => doFreeze(card)} disabled={!!actionLoading} title={card.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                              card.status === 'frozen'
                                ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25'
                                : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-blue-400'
                            }`}>
                            {actionLoading === card.id + 'freeze' ? <Loader2 size={11} className="animate-spin" /> : <Snowflake size={11} />}
                          </button>
                        )}
                        {/* Replace */}
                        {card.status !== 'deleted' && card.status !== 'replaced' && (
                          <button onClick={() => setReplaceCard(card)} title="Replace Card"
                            className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400/60 hover:text-purple-400 hover:bg-purple-500/20 transition-colors">
                            <Repeat2 size={11} />
                          </button>
                        )}
                        {/* Spending limit */}
                        <button onClick={() => setLimitCard(card)} title="Set Spending Limit"
                          className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary/50 hover:text-primary hover:bg-primary/20 transition-colors">
                          <DollarSign size={11} />
                        </button>
                        {/* PIN */}
                        <button onClick={() => setPinCard(card)} title="Manage PIN"
                          className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400/50 hover:text-amber-400 hover:bg-amber-500/20 transition-colors">
                          <KeyRound size={11} />
                        </button>
                        {/* Activity */}
                        <button onClick={() => setActivityCard(card)} title="View Activity"
                          className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.08] transition-colors">
                          <Activity size={11} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-white/25 text-xs">
              Showing {Math.min((page - 1) * 20 + 1, total)}–{Math.min(page * 20, total)} of {total.toLocaleString()}
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 disabled:opacity-30 hover:bg-white/[0.08]">
                <ChevronLeft size={12} />
              </button>
              <span className="flex items-center px-3 text-white/30 text-xs">{page} / {pages || 1}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
                className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 disabled:opacity-30 hover:bg-white/[0.08]">
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Modals ── */}
        <AnimatePresence>
          {issueOpen && (
            <IssueCardModal
              onClose={() => setIssueOpen(false)}
              onSuccess={msg => { showToast(msg); fetchCards(); }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {limitCard && (
            <SpendingLimitModal
              card={limitCard}
              onClose={() => setLimitCard(null)}
              onSuccess={msg => { showToast(msg); fetchCards(); }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {pinCard && (
            <PinModal
              card={pinCard}
              onClose={() => setPinCard(null)}
              onSuccess={msg => { showToast(msg); fetchCards(); }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {replaceCard && (
            <ReplaceModal
              card={replaceCard}
              onClose={() => setReplaceCard(null)}
              onSuccess={msg => { showToast(msg); fetchCards(); }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activityCard && (
            <ActivityDrawer
              card={activityCard}
              onClose={() => setActivityCard(null)}
            />
          )}
        </AnimatePresence>

      </AdminLayout>
    </>
  );
}
