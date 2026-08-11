/**
 * Trading Module — homepage section
 *
 * Exports:
 *   TradingSection  – live crypto asset table + feature bullets + CTA
 *
 * Props:
 *   livePrices  – Map<symbol, { price, change, up }> from useLiveTicker
 *                 Falls back to static placeholders when empty.
 */
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, TrendingUp, TrendingDown, Zap, Lock, PieChart,
  RefreshCw, Shield, Bitcoin,
} from 'lucide-react';
import { useHomepageContent } from '@/lib/homepageContentContext';
import { AnimatedBar } from '@/lib/homeShared';
import type { TickerItem } from '@/lib/useLiveTicker';

// ── Static fallback rows ──────────────────────────────────────────────────────

const STATIC_ASSETS = [
  { name: 'Bitcoin',  symbol: 'BTC',  wsKey: 'BTC/USD',  price: '$67,420', change: '+3.2%', up: true,  color: '#F7931A', bar: 72 },
  { name: 'Ethereum', symbol: 'ETH',  wsKey: 'ETH/USD',  price: '$3,840',  change: '+1.8%', up: true,  color: '#627EEA', bar: 55 },
  { name: 'Solana',   symbol: 'SOL',  wsKey: 'SOL/USD',  price: '$182.50', change: '-0.9%', up: false, color: '#9945FF', bar: 38 },
  { name: 'USDT',     symbol: 'USDT', wsKey: 'USDT',     price: '$1.00',   change: '0.0%',  up: true,  color: '#26A17B', bar: 20 },
  { name: 'BNB',      symbol: 'BNB',  wsKey: 'BNB/USD',  price: '$598',    change: '+2.1%', up: true,  color: '#F3BA2F', bar: 30 },
] as const;

// ── TradingSection ────────────────────────────────────────────────────────────

interface TradingSectionProps {
  livePrices?: TickerItem[];
}

export function TradingSection({ livePrices = [] }: TradingSectionProps) {
  const home = useHomepageContent();
  const featureBulletIcons  = [Zap, Lock, PieChart, RefreshCw, Shield];
  const featureBulletColors = ['#F7931A', '#627EEA', '#9945FF', '#26A17B', '#C9A84C'];

  // Build a lookup map from the live ticker array
  const priceMap = new Map<string, TickerItem>(livePrices.map(t => [t.symbol, t]));
  const hasLive  = priceMap.size > 0;

  return (
    <section className="py-28">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: live market table */}
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <div className="flex items-center gap-3 mb-6">
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 tracking-widest uppercase">
                {home.crypto.eyebrow}
              </span>
              {hasLive && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live market data · Paper trading only
                </span>
              )}
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight leading-tight">
              {home.crypto.headline1}<br />
              <span className="text-gold-gradient">{home.crypto.headlineAccent}</span>
            </h2>
            <p className="text-foreground/50 leading-relaxed mb-10 max-w-lg">{home.crypto.subheadline}</p>

            <div className="space-y-3">
              {STATIC_ASSETS.map((asset, i) => {
                const live   = priceMap.get(asset.wsKey);
                const price  = live?.price  ?? asset.price;
                const change = live?.change ?? asset.change;
                const up     = live?.up     ?? asset.up;

                return (
                  <motion.div key={asset.symbol}
                    initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 + i * 0.07 }}
                    className="glass-card rounded-2xl px-5 py-4 gradient-border flex items-center gap-4 hover:border-primary/25 transition-colors group">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: `${asset.color}20`, color: asset.color }}>
                      {asset.symbol[0]}
                    </div>
                    <div className="w-24 shrink-0">
                      <p className="text-sm font-semibold text-foreground">{asset.name}</p>
                      <p className="text-xs text-foreground/55">{asset.symbol}</p>
                    </div>
                    <div className="flex-1">
                      <AnimatedBar pct={asset.bar} color={asset.color} delay={0.4 + i * 0.07} height="h-1.5" />
                    </div>
                    <div className="text-right shrink-0 min-w-[80px]">
                      <AnimatePresence mode="popLayout">
                        <motion.p
                          key={price}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          transition={{ duration: 0.25 }}
                          className="text-sm font-semibold text-foreground tabular-nums"
                        >
                          {price}
                        </motion.p>
                      </AnimatePresence>
                      <p className={`text-xs font-medium flex items-center justify-end gap-0.5 ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                        {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {change}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Right: feature highlights */}
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.15 }} className="space-y-5">
            {home.crypto.featureBullets.map((item, i) => {
              const CIcon = featureBulletIcons[i] ?? Zap;
              const color = featureBulletColors[i] ?? '#C9A84C';
              return (
                <motion.div key={item.id}
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.08 }}
                  className="flex items-start gap-4 p-5 glass-card rounded-2xl gradient-border hover:border-primary/25 transition-colors group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110" style={{ background: `${color}15` }}>
                    <CIcon size={18} style={{ color }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">{item.title}</p>
                    <p className="text-xs text-foreground/50 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              );
            })}

            <Link to="/accounts" className="group relative inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-bold text-black overflow-hidden mt-2">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
              <Bitcoin size={16} className="relative" />
              <span className="relative">{home.crypto.ctaLabel}</span>
              <ArrowRight size={16} className="relative transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
