/**
 * Shared layout primitives for homepage modules.
 * These are pure presentational components — NO virtual:content imports.
 *
 * GlassCard     – glass-card + gradient-border wrapper
 * AnimatedBar   – whileInView width-animated progress bar
 * StatBadge     – value + label tile with gold gradient
 * GoldButton    – gold gradient CTA link
 * OutlineButton – glass outline secondary link
 */
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { ElementType, ReactNode, CSSProperties } from 'react';

// ── GlassCard ─────────────────────────────────────────────────────────────────

export function GlassCard({
  children, className = '', glow = false, style,
}: {
  children: ReactNode; className?: string; glow?: boolean; style?: CSSProperties;
}) {
  return (
    <div
      className={`glass-card gradient-border ${className}`}
      style={glow ? { boxShadow: 'var(--gold-glow)', ...style } : style}
    >
      {children}
    </div>
  );
}

// ── AnimatedBar ───────────────────────────────────────────────────────────────

export function AnimatedBar({
  pct, color, delay = 0, height = 'h-1.5',
}: {
  pct: number; color: string; delay?: number; height?: string;
}) {
  return (
    <div className={`${height} rounded-full bg-white/5`}>
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true }}
        transition={{ delay, duration: 0.7, ease: 'easeOut' as const }}
        className={`${height} rounded-full`}
        style={{ background: color }}
      />
    </div>
  );
}

// ── StatBadge ─────────────────────────────────────────────────────────────────

export function StatBadge({ value, label, delay = 0 }: { value: string; label: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="glass-card rounded-2xl p-4 text-center gradient-border"
    >
      <p className="text-2xl font-bold text-gold-gradient mb-1" style={{ fontFamily: 'var(--font-heading)' }}>{value}</p>
      <p className="text-xs text-foreground/55 uppercase tracking-wide">{label}</p>
    </motion.div>
  );
}

// ── GoldButton ────────────────────────────────────────────────────────────────

export function GoldButton({
  to, icon: Icon, children, className = '',
}: {
  to: string; icon?: ElementType; children: ReactNode; className?: string;
}) {
  return (
    <Link
      to={to}
      className={`group relative inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-bold text-black overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
      {Icon && <Icon size={16} className="relative" />}
      <span className="relative">{children}</span>
      <ArrowRight size={16} className="relative transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

// ── OutlineButton ─────────────────────────────────────────────────────────────

export function OutlineButton({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-medium text-foreground/70 glass border-gold-glow hover:text-foreground transition-colors ${className}`}
    >
      {children}
    </Link>
  );
}
