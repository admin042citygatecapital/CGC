/**
 * CgcLogo — Centralized City Gate Capital logo component.
 *
 * All logo placements across the platform import from here.
 * Brand images are bundled with the application so they remain available in
 * standalone deployments without the Airo media-slot service.
 *
 * Usage:
 *   <CgcLogo size={44} />                  — emblem only (circular)
 *   <CgcLogo size={44} withWordmark />      — emblem + "City Gate / Capital" text
 *   <CgcLogo size={44} variant="horizontal" /> — full horizontal lockup from slot
 */


// ── Slot URLs (served by the media slot system) ──────────────────────────────
const LOGO_HORIZONTAL = '/assets/brand/city-gate-capital-horizontal.png';
const LOGO_SQUARE     = '/assets/brand/city-gate-capital-seal.png';
const LOGO_VERTICAL   = '/assets/brand/city-gate-capital-seal.png';
const LOGO_FAVICON    = '/assets/brand/city-gate-capital-favicon.png';

export { LOGO_FAVICON,LOGO_HORIZONTAL,LOGO_SQUARE,LOGO_VERTICAL };

// ── Component ────────────────────────────────────────────────────────────────

interface CgcLogoProps {
  /** Height in px for the emblem/square mark. Width is always auto. */
  size?: number;
  /** Show the "City Gate / Capital" wordmark beside the emblem. */
  withWordmark?: boolean;
  /**
   * Which slot to render:
   *  - "square"     → circular emblem mark only (default)
   *  - "horizontal" → full horizontal lockup
   *  - "vertical"   → vertical lockup
   */
  variant?: 'square' | 'horizontal' | 'vertical';
  className?: string;
  imgClassName?: string;
  /** Alt text override */
  alt?: string;
  /** Glow effect around the emblem */
  glow?: boolean;
}

export default function CgcLogo({
  size = 44,
  withWordmark = false,
  variant = 'square',
  className = '',
  imgClassName = '',
  alt = 'City Gate Capital',
  glow = true,
}: CgcLogoProps) {
  const src =
    variant === 'horizontal' ? LOGO_HORIZONTAL :
    variant === 'vertical'   ? LOGO_VERTICAL   :
    LOGO_SQUARE;

  const isHorizontal = variant === 'horizontal';

  return (
    <div className={`flex items-center gap-2.5 shrink-0 ${className}`}>
      <div className="relative shrink-0">
        {glow && (
          <div
            className="absolute inset-0 rounded-full blur-md opacity-40 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #D4AF37 0%, transparent 70%)' }}
          />
        )}
        <img
          src={src}
          alt={alt}
          width={isHorizontal ? undefined : size}
          height={isHorizontal ? undefined : size}
          className={`relative object-contain shrink-0 ${
            isHorizontal ? 'h-auto w-auto max-h-[56px]' : 'w-auto'
          } ${imgClassName}`}
          style={{
            height: `${size}px`,
            ...(glow ? { filter: 'drop-shadow(0 0 8px rgba(212,175,55,0.45))' } : {}),
          }}
        />
      </div>

      {/* Wordmark — only shown when withWordmark=true AND not using horizontal slot */}
      {withWordmark && !isHorizontal && (
        <div className="flex flex-col leading-none">
          <span
            className="text-foreground font-bold text-base tracking-tight"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            City Gate
          </span>
          <span className="text-gold-gradient text-xs font-semibold tracking-[0.15em] uppercase">
            Capital
          </span>
        </div>
      )}
    </div>
  );
}
