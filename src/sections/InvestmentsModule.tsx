/**
 * Investments Module — homepage section
 *
 * Exports:
 *   InvestmentsSection  – account type cards + banking identifiers panel
 */
import { motion } from 'motion/react';
import {
  Globe, TrendingUp, BarChart3, Bitcoin, Lock, RefreshCw, Shield, Eye,
  CheckCircle, Wallet,
} from 'lucide-react';
import { GlassCard } from '@/lib/homeShared';

// ── InvestmentsSection ────────────────────────────────────────────────────────

export function InvestmentsSection() {
  return (
    <section className="py-16 md:py-28 bg-[#060606] relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-[0.04] blur-[120px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, #C9A84C 0%, transparent 70%)' }} />

      <div className="container mx-auto px-4 md:px-6 relative">
        <div className="text-center mb-10 md:mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-4 md:mb-5">
              Account Management
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 md:mb-5 tracking-tight">
              Every account type,{' '}
              <span className="text-gold-gradient">one platform</span>
            </h2>
            <p className="text-sm md:text-base text-foreground/50 max-w-xl mx-auto leading-relaxed px-2 md:px-0">
              Manage checking, savings, investments, and crypto wallets alongside your IBAN, SWIFT, and beneficiaries — all from a single, unified dashboard.
            </p>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-start">
          {/* Account type cards */}
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              {[
                {
                  icon: Wallet,
                  label: 'Checking Account Preview',
                  desc: 'Explore proposed everyday account, card, and balance screens using demonstration data.',
                  color: '#C9A84C',
                  badge: 'Preview',
                },
                {
                  icon: TrendingUp,
                  label: 'Savings Account',
                  desc: 'Savings-goal demonstrations with automated round-ups and projected-return modelling.',
                  color: '#10B981',
                  badge: 'Preview',
                },
                {
                  icon: BarChart3,
                  label: 'Investment Account',
                  desc: 'Stocks, ETFs, and fractional shares with AI-powered portfolio rebalancing and tax-loss harvesting.',
                  color: '#627EEA',
                  badge: null,
                },
                {
                  icon: Bitcoin,
                  label: 'Crypto Wallets',
                  desc: 'Demonstration wallets for selected assets; live custody and trading are unavailable.',
                  color: '#F7931A',
                  badge: '50+ Assets',
                },
              ].map((acct, i) => (
                <motion.div key={acct.label}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5 }}
                  whileHover={{ y: -3 }}
                  className="group glass-card rounded-2xl p-5 gradient-border relative overflow-hidden cursor-default transition-all duration-300">
                  {acct.badge && (
                    <span className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${acct.color}20`, color: acct.color }}>
                      {acct.badge}
                    </span>
                  )}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110"
                    style={{ background: `${acct.color}15` }}>
                    <acct.icon size={18} style={{ color: acct.color }} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1.5" style={{ fontFamily: 'var(--font-heading)' }}>{acct.label}</h3>
                  <p className="text-xs text-foreground/45 leading-relaxed">{acct.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Banking identifiers + beneficiaries */}
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.15 }} className="space-y-4">
            <GlassCard className="rounded-3xl p-6" glow>
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs font-semibold text-foreground/55 uppercase tracking-widest">Account Details</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400/70">Active</span>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'IBAN',           value: 'Not issued',                  icon: Globe,     color: '#627EEA' },
                  { label: 'SWIFT / BIC',    value: 'Not issued',                  icon: RefreshCw, color: '#C9A84C' },
                  { label: 'Account Number', value: 'Not issued',                  icon: Lock,      color: '#10B981' },
                  { label: 'Routing Number', value: 'Not issued',                  icon: Shield,    color: '#9945FF' },
                ].map((row, i) => (
                  <motion.div key={row.label}
                    initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.07 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-primary/8 hover:border-primary/20 transition-colors group">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${row.color}15` }}>
                      <row.icon size={14} style={{ color: row.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-foreground/35 uppercase tracking-wide mb-0.5">{row.label}</p>
                      <p className="text-sm font-mono font-semibold text-foreground/80 truncate">{row.value}</p>
                    </div>
                    <Eye size={12} className="text-foreground/20 group-hover:text-primary/50 transition-colors shrink-0" />
                  </motion.div>
                ))}
              </div>
            </GlassCard>

            {/* Beneficiaries */}
            <GlassCard className="rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-foreground/55 uppercase tracking-widest">Saved Beneficiaries</p>
              </div>
              <div className="space-y-2.5">
                {[
                  { name: 'Sarah Mitchell', bank: 'Barclays UK',      flag: '🇬🇧', amount: '$2,400', verified: true  },
                  { name: 'Marco Rossi',    bank: 'Deutsche Bank DE', flag: '🇩🇪', amount: '$1,800', verified: true  },
                  { name: 'Aisha Al-Farsi', bank: 'Emirates NBD AE',  flag: '🇦🇪', amount: '$950',   verified: false },
                ].map((b, i) => (
                  <motion.div key={b.name}
                    initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.07 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-default">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm shrink-0">{b.flag}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-foreground/80 truncate">{b.name}</p>
                        {b.verified && <CheckCircle size={10} className="text-emerald-400 shrink-0" />}
                      </div>
                      <p className="text-[10px] text-foreground/35 truncate">{b.bank}</p>
                    </div>
                    <span className="text-xs font-mono text-foreground/50 shrink-0">{b.amount}</span>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
