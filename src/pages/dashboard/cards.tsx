/**
 * /dashboard/cards — Virtual Card Management
 * Customer-only page. Shows all virtual cards, freeze/unfreeze,
 * reveal PAN/CVV, and request a new card.
 */
import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard, ChevronLeft, Snowflake,
  Loader2, ShieldCheck, XCircle,
  Clock, Wifi,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';

interface VirtualCard {
  id:             string;
  cardholderName: string;
  numberMasked:   string;
  expiry:         string;
  network:        string;
  status:         string;
  createdAt:      string;
}

function statusMeta(status: string) {
  switch (status) {
    case 'active':  return { label: 'Active',  icon: ShieldCheck, color: '#10B981' };
    case 'frozen':  return { label: 'Frozen',  icon: Snowflake,   color: '#627EEA' };
    case 'expired': return { label: 'Expired', icon: Clock,       color: '#6B7280' };
    default:        return { label: 'Inactive',icon: XCircle,     color: '#EF4444' };
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

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch('/api/users/cards', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.cards) setCards(data.cards.filter((c: VirtualCard) => c.status !== 'deleted'));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const activeCard = cards[activeIdx] ?? null;

  return (
    <>
      <Helmet>
        <title>Cards — City Gate Capital</title>
        <meta name="description" content="Review synthetic City Gate Capital card records. Card issuing and lifecycle controls are unavailable." />
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

          <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06]">
            <ShieldCheck size={15} className="text-amber-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-200">Read-only synthetic card records</p>
              <p className="text-[10px] text-amber-100/60 leading-relaxed mt-1">
                These are sample records, not issued cards or processor records. Full card numbers and CVVs are not loaded. Requests and lifecycle controls require a contracted issuer integration.
              </p>
            </div>
          </div>

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
                <p className="text-sm font-semibold text-foreground/70">No synthetic card records</p>
                <p className="text-xs text-foreground/30 mt-1">Card issuing is not available in this environment.</p>
              </div>
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
                        <p className="font-mono text-base tracking-[0.2em] text-white/90">
                          {activeCard.numberMasked}
                        </p>

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
                            <p className="text-xs font-semibold text-white/40 font-mono mt-0.5">Not loaded</p>
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
                        onClick={() => setActiveIdx(i)}
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

              {/* All cards list */}
              {cards.length > 1 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-[0.12em]">All Cards</p>
                  {cards.map((card, i) => {
                    const { label, icon: StatusIcon, color } = statusMeta(card.status);
                    return (
                      <button
                        key={card.id}
                        onClick={() => setActiveIdx(i)}
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
                          <p className="text-xs font-semibold text-foreground/80">{card.numberMasked}</p>
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
              This screen loads masked metadata only. Full card numbers and CVVs are not returned by the card-list API.
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
