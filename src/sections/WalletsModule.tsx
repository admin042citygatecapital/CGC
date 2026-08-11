/**
 * Wallets Module — homepage section
 *
 * Exports:
 *   WalletsSection  – multi-currency wallet UI + exchange rate card + feature bullets
 */
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, TrendingUp, RefreshCw, CreditCard, Globe, Bitcoin, Bell, Eye, Wallet,
} from 'lucide-react';
import { useHomepageContent } from '@/lib/homepageContentContext';
import { GlassCard, AnimatedBar } from '@/lib/homeShared';

// ── WalletsSection ────────────────────────────────────────────────────────────

export function WalletsSection() {
  const home = useHomepageContent();
  const featureBulletIcons = [Globe, Bitcoin, RefreshCw, CreditCard, Bell, Eye];
  const featureBulletColors = ['#10B981', '#F7931A', '#627EEA', '#C9A84C', '#9945FF', '#F0D080'];

  return (
    <section className="py-28 bg-[#060606]">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
              {home.wallet.eyebrow}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
              {home.wallet.headline1}<br />
              <span className="text-gold-gradient">{home.wallet.headlineAccent}</span>
            </h2>
            <p className="text-foreground/50 max-w-xl mx-auto leading-relaxed">{home.wallet.subheadline}</p>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Wallet UI mock */}
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <GlassCard className="rounded-3xl p-6 mb-4" glow>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs text-foreground/55 uppercase tracking-widest mb-0.5">Demonstration Wallet Balance</p>
                  <p className="text-3xl font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>$86,313</p>
                  <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1"><TrendingUp size={10} /> +$2,140 today</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Wallet size={22} className="text-primary" />
                </div>
              </div>

              <div className="space-y-2.5 mb-5">
                {[
                  { flag: '🇺🇸', currency: 'USD', name: 'US Dollar',    balance: '$42,500',   converted: '$42,500', color: '#10B981', pct: 49 },
                  { flag: '🇪🇺', currency: 'EUR', name: 'Euro',          balance: '€18,200',   converted: '$19,800', color: '#627EEA', pct: 23 },
                  { flag: '₿',   currency: 'BTC', name: 'Bitcoin',       balance: '0.182 BTC', converted: '$12,270', color: '#F7931A', pct: 14 },
                  { flag: '🇬🇧', currency: 'GBP', name: 'British Pound', balance: '£7,400',    converted: '$9,360',  color: '#C9A84C', pct: 11 },
                  { flag: 'Ξ',   currency: 'ETH', name: 'Ethereum',      balance: '0.63 ETH',  converted: '$2,383',  color: '#9945FF', pct: 3  },
                ].map((c, i) => (
                  <motion.div key={c.currency}
                    initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 + i * 0.07 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-primary/8 hover:border-primary/20 transition-colors group cursor-pointer">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: `${c.color}18`, color: c.color }}>
                      {c.flag}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-foreground">{c.currency}</p>
                        <p className="text-xs font-semibold text-foreground">{c.balance}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 mr-3">
                          <AnimatedBar pct={c.pct} color={c.color} delay={0.3 + i * 0.07} height="h-1" />
                        </div>
                        <p className="text-xs text-foreground/55 shrink-0">{c.converted}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: ArrowRight, label: 'Preview Send'     },
                  { icon: RefreshCw,  label: 'Preview Exchange' },
                  { icon: CreditCard, label: 'Preview Top Up'   },
                ].map(btn => (
                  <button key={btn.label} className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-primary/8 hover:bg-primary/15 transition-colors group">
                    <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                      <btn.icon size={13} className="text-primary" />
                    </div>
                    <span className="text-xs text-foreground/50 group-hover:text-foreground/70 transition-colors">{btn.label}</span>
                  </button>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="rounded-2xl p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <RefreshCw size={15} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-foreground/55 mb-0.5">Illustrative Exchange Rate</p>
                <p className="text-sm font-semibold text-foreground">1 USD = 0.9210 EUR</p>
              </div>
              <span className="text-xs text-emerald-400 font-medium">Sample rate</span>
            </GlassCard>
          </motion.div>

          {/* Feature list */}
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.15 }} className="space-y-4">
            {home.wallet.featureBullets.map((item, i) => {
              const WIcon = featureBulletIcons[i] ?? Globe;
              const color = featureBulletColors[i] ?? '#C9A84C';
              return (
                <motion.div key={item.id}
                  initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 + i * 0.08 }}
                  className="flex items-start gap-4 p-5 glass-card rounded-2xl gradient-border hover:border-primary/25 transition-colors group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110" style={{ background: `${color}15` }}>
                    <WIcon size={18} style={{ color }} />
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
              <Wallet size={16} className="relative" />
              <span className="relative">{home.wallet.ctaLabel}</span>
              <ArrowRight size={16} className="relative transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
