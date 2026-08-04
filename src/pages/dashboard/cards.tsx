/**
 * /dashboard/cards — Virtual Card Management
 * Customer-only page. Shows all virtual cards, freeze/unfreeze,
 * reveal PAN/CVV, and request a new card.
 */
import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard, ChevronLeft, Eye, EyeOff, Snowflake, Zap,
  Plus, Copy, CheckCheck, Loader2, ShieldCheck, XCircle,
  Clock, Wifi,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';

interface VirtualCard {
  id:             string;
  cardholderName: string;
  number:         string;
  expiry:         string;
  cvv:            string;
  network:        string;
  status:         string;
  createdAt:      string;
}

function maskNumber(number: string): string {
  const digits = number.replace(/\D/g, '');
  return `•••• •••• •••• ${digits.slice(-4)}`;
}

function statusMeta(status: string) {
  switch (status) {
    case 'active':   return { label: 'Active',   icon: ShieldCheck, color: '#10B981' };
    case 'frozen':   return { label: 'Frozen',   icon: Snowflake,   color: '#627EEA' };
    case 'replaced': return { label: 'Replaced', icon: Clock,       color: '#6B7280' };
    default:         return { label: 'Inactive', icon: XCircle,     color: '#EF4444' };
  }
}

function CardChip() {
  return (
    <div className="w-8 h-6 rounded-sm border border-white/20 bg-gradient-to-br from-yellow-300/80 to-yellow-500/60 flex items-center justify-center">
      <div className="w-5 h-4 rounded-[2px] border border-yellow-600/40 grid grid-cols-2 gap-px p-px">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-yellow-600/30 rounded-[1px]" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardCardsPage() {
  const { token } = useCustomerAuth();
  const [cards,        setCards]        = useState<VirtualCard[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activeIdx,    setActiveIdx]    = useState(0);
  const [revealedNum,  setRevealedNum]  = useState<string | null>(null);
  const [revealedCvv,  setRevealedCvv]  = useState<string | null>(null);
  const [freezingId,   setFreezingId]   = useState<string | null>(null);
  const [copied,       setCopied]       = useState<string | null>(null);
  const [requesting,   setRequesting]   = useState(false);
  const [requestMsg,   setRequestMsg]   = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch('/api/users/cards', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.cards) setCards(data.cards.filter((c: VirtualCard) => c.status !== 'deleted'));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const handleFreezeToggle = useCallback(async (card: VirtualCard) => {
    if (!token || freezingId) return;
    setFreezingId(card.id);
    try {
      const res = await fetch('/api/users/cards/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cardId: card.id, freeze: card.status !== 'frozen' }),
      });
      if (res.ok) {
        const data = await res.json();
        setCards(prev => prev.map(c =>
          c.id === card.id ? { ...c, status: data.card?.status ?? (card.status === 'frozen' ? 'active' : 'frozen') } : c
        ));
        setRevealedNum(null);
        setRevealedCvv(null);
      }
    } catch { /* silent */ }
    finally { setFreezingId(null); }
  }, [token, freezingId]);

  const handleCopy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  }, []);

  const handleGenerateCard = useCallback(async () => {
    if (!token || requesting) return;
    setRequesting(true);
    setRequestMsg(null);
    try {
      const res = await fetch('/api/users/cards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.card) {
        setCards(prev => [...prev, data.card]);
        setActiveIdx(cards.length);
        setRequestMsg('New virtual card issued.');
      } else {
        setRequestMsg(data.error ?? 'Unable to issue a card at this time. Please contact support.');
      }
    } catch {
      setRequestMsg('Network error. Please try again.');
    } finally {
      setRequesting(false);
    }
  }, [token, requesting, cards.length]);

  const [physicalMsg, setPhysicalMsg] = useState<string | null>(null);
  const handleRequestPhysical = useCallback(async (card: VirtualCard) => {
    if (!token || requesting) return;
    setRequesting(true);
    setPhysicalMsg(null);
    try {
      const res = await fetch('/api/users/cards/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cardId: card.id }),
      });
      const data = await res.json();
      setPhysicalMsg(res.ok ? (data.message ?? 'Physical card request submitted.') : (data.error ?? 'Unable to submit request.'));
    } catch {
      setPhysicalMsg('Network error. Please try again.');
    } finally {
      setRequesting(false);
    }
  }, [token, requesting]);

  const activeCard = cards[activeIdx] ?? null;

  return (
    <>
      <Helmet>
        <title>Cards — City Gate Capital</title>
        <meta name="description" content="Manage your City Gate Capital virtual cards: view, freeze, unfreeze, and request new cards." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/cards" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        {/* Visually-hidden H1 for SEO checkers — page is noindex */}
        <h1 className="sr-only">Virtual Cards</h1>

        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link to="/dashboard" className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors">
              <ChevronLeft size={15} />
            </Link>
            <div className="flex items-center gap-2">
              <CreditCard size={15} style={{ color: '#C9A84C' }} />
              <span className="text-sm font-semibold text-foreground">Virtual Cards</span>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-foreground/20" />
            </div>
          ) : cards.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
                <CreditCard size={24} className="text-foreground/20" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground/70">No cards yet</p>
                <p className="text-xs text-foreground/30 mt-1">Request a virtual card to get started</p>
              </div>
              <button
                onClick={handleGenerateCard}
                disabled={requesting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={{ background: '#C9A84C', color: '#000' }}
              >
                {requesting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Get a Virtual Card
              </button>
              {requestMsg && (
                <p className="text-xs text-foreground/50 max-w-xs">{requestMsg}</p>
              )}
            </div>
          ) : (
            <>
              {/* Card carousel */}
              <div className="flex flex-col gap-4">
                <AnimatePresence mode="wait">
                  {activeCard && (
                    <motion.div
                      key={activeCard.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.25 }}
                      className="relative w-full aspect-[1.586/1] rounded-3xl overflow-hidden select-none"
                      style={{
                        background: `linear-gradient(135deg,
                          rgba(201,168,76,0.15) 0%,
                          rgba(10,10,10,0.95) 40%,
                          rgba(98,126,234,0.12) 100%)`,
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {/* Decorative circles */}
                      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-10"
                        style={{ background: 'radial-gradient(circle, #C9A84C, transparent)' }} />
                      <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full opacity-8"
                        style={{ background: 'radial-gradient(circle, #627EEA, transparent)' }} />

                      {/* Contactless icon */}
                      <div className="absolute top-5 right-5 opacity-30">
                        <Wifi size={18} className="text-white rotate-90" />
                      </div>

                      <div className="absolute inset-0 p-6 flex flex-col justify-between">
                        {/* Top row */}
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-white/30">City Gate Capital</p>
                            <p className="text-xs font-medium text-white/60 mt-0.5">{activeCard.network?.toUpperCase() ?? 'VIRTUAL'}</p>
                          </div>
                          <CardChip />
                        </div>

                        {/* Card number */}
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-base tracking-[0.2em] text-white/90">
                            {revealedNum === activeCard.id
                              ? activeCard.number.replace(/(.{4})/g, '$1 ').trim()
                              : maskNumber(activeCard.number)}
                          </p>
                          <button
                            onClick={() => setRevealedNum(r => r === activeCard.id ? null : activeCard.id)}
                            className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
                          >
                            {revealedNum === activeCard.id ? <EyeOff size={11} /> : <Eye size={11} />}
                          </button>
                          {revealedNum === activeCard.id && (
                            <button
                              onClick={() => handleCopy(activeCard.number, 'num')}
                              className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
                            >
                              {copied === 'num' ? <CheckCheck size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            </button>
                          )}
                        </div>

                        {/* Bottom row */}
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-[9px] text-white/30 uppercase tracking-widest">Card Holder</p>
                            <p className="text-xs font-semibold text-white/80 mt-0.5">{activeCard.cardholderName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] text-white/30 uppercase tracking-widest">Expires</p>
                            <p className="text-xs font-semibold text-white/80 mt-0.5">{activeCard.expiry}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] text-white/30 uppercase tracking-widest">CVV</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <p className="text-xs font-semibold text-white/80 font-mono">
                                {revealedCvv === activeCard.id ? activeCard.cvv : '•••'}
                              </p>
                              <button
                                onClick={() => setRevealedCvv(r => r === activeCard.id ? null : activeCard.id)}
                                className="w-4 h-4 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors"
                              >
                                {revealedCvv === activeCard.id ? <EyeOff size={9} /> : <Eye size={9} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Status badge */}
                      {(() => {
                        const { label, icon: StatusIcon, color } = statusMeta(activeCard.status);
                        return (
                          <div className="absolute top-5 left-5">
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-semibold"
                              style={{ background: `${color}22`, color, border: `1px solid ${color}33` }}>
                              <StatusIcon size={9} />
                              {label}
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Card selector dots */}
                {cards.length > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    {cards.map((c, i) => (
                      <button
                        key={c.id}
                        onClick={() => { setActiveIdx(i); setRevealedNum(null); setRevealedCvv(null); }}
                        className="rounded-full transition-all"
                        style={{
                          width: i === activeIdx ? 20 : 6,
                          height: 6,
                          background: i === activeIdx ? '#C9A84C' : 'rgba(255,255,255,0.15)',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Card actions */}
              {activeCard && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleFreezeToggle(activeCard)}
                    disabled={!!freezingId || activeCard.status === 'expired'}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border text-xs font-semibold transition-all disabled:opacity-40"
                    style={{
                      background: activeCard.status === 'frozen' ? 'rgba(98,126,234,0.12)' : 'rgba(255,255,255,0.04)',
                      borderColor: activeCard.status === 'frozen' ? 'rgba(98,126,234,0.3)' : 'rgba(255,255,255,0.08)',
                      color: activeCard.status === 'frozen' ? '#627EEA' : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {freezingId === activeCard.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : activeCard.status === 'frozen'
                        ? <><Zap size={13} /><span>Unfreeze</span></>
                        : <><Snowflake size={13} /><span>Freeze Card</span></>
                    }
                  </button>

                  <button
                    onClick={handleGenerateCard}
                    disabled={requesting}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-xs font-semibold transition-all"
                    style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)', color: '#C9A84C' }}
                  >
                    {requesting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    New Card
                  </button>
                </div>
              )}

              {activeCard && (
                <button
                  onClick={() => handleRequestPhysical(activeCard)}
                  disabled={requesting}
                  className="text-[11px] text-foreground/30 hover:text-foreground/60 transition-colors w-fit disabled:opacity-40"
                >
                  Request a physical card for this account →
                </button>
              )}
              {physicalMsg && (
                <div className="px-4 py-3 rounded-2xl text-xs text-foreground/60 border border-white/6 bg-white/[0.02]">
                  {physicalMsg}
                </div>
              )}

              {requestMsg && (
                <div className="px-4 py-3 rounded-2xl text-xs text-foreground/60 border border-white/6 bg-white/[0.02]">
                  {requestMsg}
                </div>
              )}

              {/* All cards list */}
              {cards.length > 1 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-[0.12em]">All Cards</p>
                  {cards.map((card, i) => {
                    const { label, icon: StatusIcon, color } = statusMeta(card.status);
                    return (
                      <button
                        key={card.id}
                        onClick={() => { setActiveIdx(i); setRevealedNum(null); setRevealedCvv(null); }}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left"
                        style={{
                          background: i === activeIdx ? 'rgba(201,168,76,0.06)' : 'rgba(255,255,255,0.02)',
                          borderColor: i === activeIdx ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.06)',
                        }}
                      >
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <CreditCard size={14} className="text-foreground/40" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground/80">{maskNumber(card.number)}</p>
                          <p className="text-[10px] text-foreground/30">{card.network?.toUpperCase()} · Expires {card.expiry}</p>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-semibold"
                          style={{ background: `${color}18`, color, border: `1px solid ${color}28` }}>
                          <StatusIcon size={9} />
                          {label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Security note */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.015]">
            <ShieldCheck size={14} className="text-foreground/25 mt-0.5 shrink-0" />
            <p className="text-[10px] text-foreground/30 leading-relaxed">
              Your card details are encrypted and never stored in plain text. CVV and full PAN are only shown when you explicitly reveal them and are never logged.
            </p>
          </div>

          {/* Back link */}
          <Link to="/dashboard" className="flex items-center gap-1.5 text-xs text-foreground/30 hover:text-foreground/60 transition-colors w-fit">
            <ChevronLeft size={12} />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </>
  );
}
