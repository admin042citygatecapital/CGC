/**
 * PremiumCard — City Gate Capital luxury debit card visual.
 *
 * Features:
 *  - Deep crimson-to-black gradient with gold accents (brand "Red Card")
 *  - Mouse-tracking 3-D tilt via CSS perspective + rotateX/Y
 *  - Holographic shimmer layer that follows the cursor
 *  - Embossed EMV chip (SVG)
 *  - Contactless wave icon
 *  - Frozen overlay (blue ice tint + snowflake)
 *  - Stacked "depth" cards behind the front face (hero variant)
 *  - Floating cashback notification (hero variant)
 */

import { Snowflake } from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useCallback,useRef,useState } from 'react';

// ── EMV Chip SVG ──────────────────────────────────────────────────────────────

function ChipSvg() {
  return (
    <svg width="44" height="34" viewBox="0 0 44 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="43" height="33" rx="5.5" fill="url(#chipGrad)" stroke="rgba(201,168,76,0.4)" strokeWidth="1"/>
      {/* Horizontal lines */}
      <line x1="0" y1="11" x2="44" y2="11" stroke="rgba(201,168,76,0.25)" strokeWidth="0.8"/>
      <line x1="0" y1="23" x2="44" y2="23" stroke="rgba(201,168,76,0.25)" strokeWidth="0.8"/>
      {/* Vertical lines */}
      <line x1="15" y1="0" x2="15" y2="34" stroke="rgba(201,168,76,0.25)" strokeWidth="0.8"/>
      <line x1="29" y1="0" x2="29" y2="34" stroke="rgba(201,168,76,0.25)" strokeWidth="0.8"/>
      {/* Centre contact pad */}
      <rect x="15.5" y="11.5" width="13" height="11" rx="1.5" fill="rgba(201,168,76,0.15)" stroke="rgba(201,168,76,0.35)" strokeWidth="0.8"/>
      <defs>
        <linearGradient id="chipGrad" x1="0" y1="0" x2="44" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2A2618"/>
          <stop offset="50%" stopColor="#1C1A14"/>
          <stop offset="100%" stopColor="#0E0D0A"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Contactless icon ──────────────────────────────────────────────────────────

function ContactlessIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="none"/>
      <path d="M8.5 8.5C9.9 7.1 11.9 6.5 14 7" stroke="rgba(201,168,76,0.5)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M6.5 6.5C9 4 13 3.5 16 5.5" stroke="rgba(201,168,76,0.35)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M10.5 10.5C11.3 9.7 12.6 9.5 13.5 10" stroke="rgba(201,168,76,0.65)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <circle cx="12" cy="12.5" r="1.2" fill="rgba(201,168,76,0.8)"/>
    </svg>
  );
}

// ── Visa-style network mark ───────────────────────────────────────────────────

function NetworkMark() {
  return (
    <div className="flex items-center gap-0.5">
      <div className="w-7 h-7 rounded-full opacity-90" style={{ background: 'radial-gradient(circle at 40% 50%, #C9A84C, #8B6914)' }} />
      <div className="w-7 h-7 rounded-full -ml-3 opacity-70" style={{ background: 'radial-gradient(circle at 60% 50%, #F0D080, #C9A84C)' }} />
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PremiumCardProps {
  /** Card number — masked string e.g. "•••• •••• •••• 4291" */
  numberMasked?: string;
  cardholderName?: string;
  expiry?: string;
  /** 'active' | 'frozen' | any string */
  status?: string;
  /** 'hero' = stacked depth cards + floating notification; 'grid' = standalone card */
  variant?: 'hero' | 'grid';
  /** Called when Freeze / Unfreeze button is clicked (grid variant) */
  onFreeze?: () => void;
  /** Called when Delete button is clicked (grid variant) */
  onDelete?: () => void;
  freezing?: boolean;
  deleting?: boolean;
  className?: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PremiumCard({
  numberMasked = '•••• •••• •••• 4291',
  cardholderName = 'ALEX MORGAN',
  expiry = '12/28',
  status = 'active',
  variant = 'hero',
  onFreeze,
  onDelete,
  freezing = false,
  deleting = false,
  className = '',
}: PremiumCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [shimmer, setShimmer] = useState({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);

  const isFrozen = status === 'frozen';

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);   // -1 … +1
    const dy = (e.clientY - cy) / (rect.height / 2);  // -1 … +1
    setTilt({ x: dy * -12, y: dx * 14 });             // rotateX, rotateY
    setShimmer({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setHovered(false);
  }, []);

  const cardFace = (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: '900px',
        transformStyle: 'preserve-3d',
      }}
      className="relative w-full"
    >
      <motion.div
        animate={{
          rotateX: tilt.x,
          rotateY: tilt.y,
          scale: hovered ? 1.03 : 1,
        }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        style={{ transformStyle: 'preserve-3d' }}
        className="relative h-52 rounded-2xl overflow-hidden cursor-pointer select-none"
      >
        {/* ── Base gradient — deep crimson to near-black ── */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #1A0A0A 0%, #2D0F0F 25%, #1C0808 50%, #0E0505 75%, #080303 100%)',
          }}
        />

        {/* ── Subtle red sheen overlay ── */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(160deg, rgba(180,20,20,0.18) 0%, transparent 55%, rgba(100,10,10,0.12) 100%)',
          }}
        />

        {/* ── Gold edge shimmer (top) ── */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.6), rgba(240,208,128,0.8), rgba(201,168,76,0.6), transparent)' }} />
        {/* ── Gold edge shimmer (bottom) ── */}
        <div className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.3), rgba(201,168,76,0.5), rgba(201,168,76,0.3), transparent)' }} />

        {/* ── Holographic shimmer layer (follows cursor) ── */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          style={{
            background: `radial-gradient(ellipse 55% 45% at ${shimmer.x}% ${shimmer.y}%, rgba(201,168,76,0.18) 0%, rgba(180,20,20,0.08) 40%, transparent 70%)`,
          }}
        />

        {/* ── Diagonal texture lines ── */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(201,168,76,1) 0px, rgba(201,168,76,1) 1px, transparent 1px, transparent 8px)',
          }}
        />

        {/* ── Frozen overlay ── */}
        <AnimatePresence>
          {isFrozen && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl"
              style={{ background: 'rgba(10,30,60,0.55)', backdropFilter: 'blur(2px)' }}
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-blue-400/40"
                style={{ background: 'rgba(59,130,246,0.15)' }}>
                <Snowflake size={15} className="text-blue-300" />
                <span className="text-blue-300 text-xs font-bold tracking-widest uppercase">Frozen</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Card content ── */}
        <div className="relative z-10 h-full flex flex-col justify-between p-5">
          {/* Top row */}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] font-medium tracking-[0.2em] uppercase"
                style={{ color: 'rgba(201,168,76,0.55)' }}>City Gate Capital</p>
              <p className="text-[11px] font-bold tracking-[0.15em] mt-0.5"
                style={{ color: '#C9A84C' }}>ELITE METAL</p>
            </div>
            <div className="flex items-center gap-2">
              <ContactlessIcon size={20} />
              <NetworkMark />
            </div>
          </div>

          {/* EMV Chip */}
          <div className="mt-1">
            <ChipSvg />
          </div>

          {/* Card number + details */}
          <div>
            <p className="text-[15px] font-mono tracking-[0.22em] mb-3.5"
              style={{ color: 'rgba(240,208,128,0.85)', textShadow: '0 1px 8px rgba(201,168,76,0.3)' }}>
              {numberMasked}
            </p>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[8px] uppercase tracking-[0.15em] mb-0.5"
                  style={{ color: 'rgba(201,168,76,0.4)' }}>Card Holder</p>
                <p className="text-[12px] font-semibold tracking-wider"
                  style={{ color: 'rgba(240,208,128,0.9)' }}>{cardholderName}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] uppercase tracking-[0.15em] mb-0.5"
                  style={{ color: 'rgba(201,168,76,0.4)' }}>Expires</p>
                <p className="text-[12px] font-semibold"
                  style={{ color: 'rgba(240,208,128,0.9)' }}>{expiry}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] uppercase tracking-[0.15em] mb-0.5"
                  style={{ color: 'rgba(201,168,76,0.4)' }}>CVV</p>
                <p className="text-[12px] font-semibold font-mono"
                  style={{ color: 'rgba(240,208,128,0.9)' }}>•••</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Outer glow border ── */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(201,168,76,0.28), 0 0 40px rgba(180,20,20,0.25), 0 0 80px rgba(201,168,76,0.08)' }} />
      </motion.div>
    </div>
  );

  // ── Hero variant: stacked depth + floating notification ───────────────────

  if (variant === 'hero') {
    return (
      <div className={`relative w-80 ${className}`}>
        {/* Depth card — back */}
        <div className="absolute top-10 left-10 right-0 h-52 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #120606, #1A0808)',
            border: '1px solid rgba(201,168,76,0.12)',
            transform: 'rotate(7deg)',
            opacity: 0.35,
          }} />
        {/* Depth card — mid */}
        <div className="absolute top-5 left-5 right-0 h-52 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #180808, #220C0C)',
            border: '1px solid rgba(201,168,76,0.18)',
            transform: 'rotate(3.5deg)',
            opacity: 0.55,
          }} />

        {/* Front card */}
        <div className="relative" style={{ filter: 'drop-shadow(0 20px 60px rgba(180,20,20,0.35)) drop-shadow(0 8px 24px rgba(201,168,76,0.15))' }}>
          {cardFace}
        </div>

        {/* Floating cashback notification */}
        <motion.div
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-7 -right-7 rounded-xl px-4 py-3 border shadow-2xl"
          style={{
            background: 'rgba(14,10,6,0.92)',
            borderColor: 'rgba(201,168,76,0.25)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(201,168,76,0.08)',
          }}
        >
          <p className="text-[10px] mb-0.5" style={{ color: 'rgba(201,168,76,0.5)' }}>Cashback earned</p>
          <p className="text-sm font-bold" style={{ color: '#C9A84C' }}>+$24.80</p>
        </motion.div>

        {/* Floating security badge */}
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
          className="absolute -top-5 -left-5 rounded-xl px-3 py-2 border shadow-xl"
          style={{
            background: 'rgba(14,10,6,0.92)',
            borderColor: 'rgba(201,168,76,0.2)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.7)' }}>🔒 Secured</p>
        </motion.div>
      </div>
    );
  }

  // ── Grid variant: card + action buttons ──────────────────────────────────

  return (
    <div className={`space-y-2 ${className}`}>
      <div style={{ filter: `drop-shadow(0 12px 40px rgba(180,20,20,0.3)) drop-shadow(0 4px 16px rgba(201,168,76,0.1)) ${isFrozen ? 'grayscale(0.7)' : ''}` }}>
        {cardFace}
      </div>
      {(onFreeze || onDelete) && (
        <div className="flex gap-2">
          {onFreeze && (
            <button
              onClick={onFreeze}
              disabled={freezing}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors border ${
                isFrozen
                  ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border-blue-500/20'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 border-white/10'
              }`}
            >
              {freezing
                ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                : <Snowflake size={12} />}
              {isFrozen ? 'Unfreeze' : 'Freeze'}
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={deleting}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
            >
              {deleting
                ? <span className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
