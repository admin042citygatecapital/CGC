import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CheckCircle, Shield, Fingerprint, Camera,
  FileText, User, DollarSign, Zap,
  ArrowRight, Star, CreditCard, Globe, Lock, ChevronRight
} from 'lucide-react';
import { trackConversion } from '@/lib/useAnalytics';
import AccountOpeningModal from '@/components/AccountOpeningModal';
import { HomepageContentProvider } from '@/lib/homepageContentContext';
import { DashboardPreview, FeaturesGrid } from '@/sections/BankingModule';
import { InvestmentsSection } from '@/sections/InvestmentsModule';

const kycSteps = [
  { icon: User,        step: '01', title: 'Create Your Profile',      desc: 'Enter your email and set a secure password to access the platform workspace.',                       color: '#C9A84C' },
  { icon: Camera,      step: '02', title: 'Verify Your Identity',     desc: 'Complete the required identity and eligibility review for your selected account.',                  color: '#627EEA' },
  { icon: Fingerprint, step: '03', title: 'Set Security Preferences', desc: 'Configure available account protection and sign-in controls.',                                       color: '#10B981' },
  { icon: DollarSign,  step: '04', title: 'Manage Your Accounts',     desc: 'View balances, transactions and available financial tools from one secure dashboard.',               color: '#9945FF' },
];

const trustBadges = [
  { icon: Shield,      label: 'Funding Safeguard', desc: 'Deposits currently unavailable',    color: '#C9A84C' },
  { icon: Fingerprint, label: 'Biometric Interface', desc: 'Native activation pending',       color: '#627EEA' },
  { icon: FileText,    label: 'Launch Gated',      desc: 'Approvals required',         color: '#10B981' },
  { icon: Zap,         label: 'Guided Setup',      desc: 'Platform workflow',                 color: '#9945FF' },
  { icon: Lock,        label: 'Secure Sessions',   desc: 'Protected account access', color: '#EC4899' },
  { icon: Globe,       label: 'Multi-Currency',    desc: 'Supported currency access', color: '#F7931A' },
  { icon: CreditCard,  label: 'Virtual Cards',     desc: 'Issuance not yet available',        color: '#14B8A6' },
  { icon: Star,        label: 'Responsive UI',     desc: 'Published web experience',          color: '#F0D080' },
];

const testimonials = [
  { name: 'Personal Banking', role: 'Connected account experience', text: 'See balances, cards, transfers, and spending insights together in one guided account experience.', rating: 5 },
  { name: 'Business Banking', role: 'Operational account controls', text: 'Organize team access, expense controls, approval flows, and reporting from one place.', rating: 5 },
  { name: 'Savings', role: 'Goal-led money management', text: 'Organize savings goals and monitor progress with clear account insights.', rating: 5 },
];

function AccountsPageContent() {
  const showRetiredPresentationSections = false;
  const [selectedType] = useState('Savings');
  const [showComparison, setShowComparison] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPlan, setModalPlan] = useState<'Personal' | 'Savings' | 'Business'>('Personal');
  const location = useLocation();

  function openModal(plan: string) {
    const safePlan = (['Personal', 'Savings', 'Business'].includes(plan) ? plan : 'Personal') as 'Personal' | 'Savings' | 'Business';
    setModalPlan(safePlan);
    setModalOpen(true);
  }

  return (
    <>
      <Helmet>
        <title>Open an Account — Personal, Savings & Business | CGC</title>
        <meta name="description" content="Explore City Gate Capital personal, savings, and business account experiences with connected financial tools and guided account management." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://citygate.capital/accounts" />
        <meta property="og:title" content="Open a Bank Account — Personal, Savings & Business" />
        <meta property="og:description" content="Explore personal, savings, and business account experiences on the City Gate Capital platform." />
        <meta property="og:url" content="https://citygate.capital/accounts" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Open a Bank Account — Personal, Savings & Business" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:creator" content="@CityGateCapital" />
        <meta name="twitter:title" content="Open a Bank Account — City Gate Capital" />
        <meta name="twitter:description" content="Explore personal, savings, and business account experiences on the City Gate Capital platform." />
        <meta name="twitter:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': 'https://citygate.capital/accounts#webpage',
          name: 'Open a Bank Account — City Gate Capital',
          url: 'https://citygate.capital/accounts',
          isPartOf: { '@id': 'https://citygate.capital/#website' },
          about: { '@id': 'https://citygate.capital/#organization' },
          mainEntity: {
            '@type': 'ItemList',
            name: 'City Gate Capital Account Types',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Personal account experience' },
              { '@type': 'ListItem', position: 2, name: 'Savings goals experience' },
              { '@type': 'ListItem', position: 3, name: 'Business account experience' },
            ],
          },
        }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://citygate.capital/' },
            { '@type': 'ListItem', position: 2, name: 'Accounts', item: 'https://citygate.capital/accounts' },
          ],
        }) }} />
      </Helmet>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      {showRetiredPresentationSections && (
      <section>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] opacity-[0.05] blur-[120px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, #C9A84C, transparent)' }} />

        <div className="container mx-auto px-4 md:px-6 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left copy */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-6 tracking-widest uppercase">
                Account Experiences
              </span>
              <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight tracking-tight">
                Accounts Designed<br />
                <span className="text-gold-shimmer">Around Your Ambition</span>
              </h1>
              <p className="text-lg text-foreground/50 mb-8 leading-relaxed max-w-lg">
                Compare personal, savings and business account experiences. Service activation depends on completed verification, eligibility and approved provider arrangements.
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-2 mb-10">
                {['Platform profile', 'KYC workflow', 'Funding pending', 'Secure access', 'Provider activation required'].map(tag => (
                  <span key={tag} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-primary bg-primary/10 border border-primary/20">
                    <CheckCircle size={10} />
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-4">
                <button onClick={() => { trackConversion('signup_started', location.pathname, { source: 'hero_cta' }); openModal(selectedType); }} className="group relative inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-bold text-black overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                  <span className="relative">Create Platform Profile</span>
                  <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" />
                </button>
                <button
                  onClick={() => setShowComparison(v => !v)}
                  className="inline-flex items-center gap-2 px-7 py-4 rounded-xl font-medium text-foreground/60 glass border border-primary/20 hover:border-primary/40 hover:text-foreground transition-colors text-sm"
                >
                  Compare Plans
                  <ChevronRight size={14} className={`transition-transform ${showComparison ? 'rotate-90' : ''}`} />
                </button>
              </div>
            </motion.div>

            {/* Right — account experience */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="hidden lg:block"
            >
              <div
                className="relative rounded-3xl p-7 overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(28,26,20,0.95), rgba(20,18,14,0.98))',
                  border: '1px solid rgba(201,168,76,0.25)',
                  boxShadow: 'var(--gold-glow)',
                }}
              >
                {/* Card header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs text-foreground/35 uppercase tracking-widest mb-0.5">City Gate Capital</p>
                    <p className="text-sm font-bold text-primary">Elite Savings Account</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-emerald-400 font-medium">Savings overview</span>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {heroStats.map(stat => (
                    <div key={stat.label} className="glass rounded-xl p-3">
                      <p className="text-[10px] text-foreground/35 mb-1">{stat.label}</p>
                      <p className="text-sm font-bold" style={{ color: stat.color }}>{stat.value}</p>
                      <p className="text-[10px] text-foreground/30 mt-0.5">{stat.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Mini bar chart */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-foreground/40">Savings Growth</p>
                    <p className="text-xs text-primary font-semibold">Illustrative return</p>
                  </div>
                  <div className="flex items-end gap-1 h-14">
                    {[40, 52, 48, 65, 58, 72, 68, 80, 75, 88, 84, 100].map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: 0.4 + i * 0.04, duration: 0.4 }}
                        style={{ originY: 1, height: `${h}%` }}
                        className={`flex-1 rounded-sm ${i === 11 ? 'bg-primary' : 'bg-primary/20'}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-foreground/20">Jun</span>
                    <span className="text-[9px] text-foreground/20">May</span>
                  </div>
                </div>

                {/* Recent transactions */}
                <div>
                  <p className="text-xs text-foreground/35 uppercase tracking-widest mb-3">Recent</p>
                  {[
                    { name: 'Interest Credit',  amount: '+$18.42', color: '#10B981' },
                    { name: 'Auto-Save Rule',   amount: '+$200.00', color: '#10B981' },
                    { name: 'Transfer Out',     amount: '-$500.00', color: '#EC4899' },
                  ].map(tx => (
                    <div key={tx.name} className="flex items-center justify-between py-2 border-b border-primary/5 last:border-0">
                      <span className="text-xs text-foreground/50">{tx.name}</span>
                      <span className="text-xs font-semibold" style={{ color: tx.color }}>{tx.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      )}

      <DashboardPreview compactTop />
      <FeaturesGrid />
      <InvestmentsSection />

      {/* ── KYC Steps ────────────────────────────────────────────────── */}
      {showRetiredPresentationSections && (
      <section>
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                KYC Verification
              </span>
              <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                Explore the <span className="text-gold-gradient">Verification Workflow</span>
              </h2>
              <p className="text-foreground/55 max-w-md mx-auto text-sm">Review the proposed identity-verification journey. Real document collection and approval remain disabled until a contracted provider and legal review are in place.</p>
            </motion.div>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {kycSteps.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative text-center"
              >
                {i < kycSteps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] right-[-40%] h-px bg-gradient-to-r from-primary/30 to-transparent" />
                )}
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 relative"
                  style={{ background: `${step.color}15`, border: `1px solid ${step.color}30` }}>
                  <step.icon size={24} style={{ color: step.color }} />
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: step.color }}>
                    <span className="text-black text-xs font-bold">{step.step}</span>
                  </div>
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-foreground/55 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ── Testimonials ─────────────────────────────────────────────── */}
      <section className="py-16 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-10">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-3xl font-bold text-foreground tracking-tight">
                What Our <span className="text-gold-gradient">Customers Say</span>
              </h2>
            </motion.div>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card rounded-2xl p-6 gradient-border"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} size={12} className="text-primary fill-primary" />
                  ))}
                </div>
                <p className="text-sm text-foreground/60 leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-foreground/55">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust Badges ─────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-10">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-3xl font-bold text-foreground tracking-tight">
                Built on <span className="text-gold-gradient">Trust</span>
              </h2>
            </motion.div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {trustBadges.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="glass-card rounded-2xl p-5 gradient-border text-center hover:border-primary/25 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-110"
                  style={{ background: `${item.color}15` }}>
                  <item.icon size={18} style={{ color: item.color }} />
                </div>
                <p className="text-sm font-semibold text-foreground mb-0.5">{item.label}</p>
                <p className="text-xs text-foreground/55">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mobile sticky CTA ────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden safe-bottom">
        <div className="bg-[rgba(10,10,10,0.95)] backdrop-blur-xl border-t border-primary/15 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-3">
          <button
            onClick={() => { trackConversion('signup_started', location.pathname, { source: 'mobile_sticky_cta' }); openModal(selectedType); }}
            className="flex-1 relative py-3.5 rounded-xl text-sm font-bold text-black text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
            <span className="relative">Create Platform Profile</span>
          </button>
          <Link
            to="/contact"
            className="px-4 py-3.5 rounded-xl text-sm font-medium text-foreground/60 glass border border-primary/20 hover:text-foreground transition-colors whitespace-nowrap"
          >
            Talk to Sales
          </Link>
        </div>
      </div>

      {/* ── Account Opening Modal ─────────────────────────────────────── */}
      <AccountOpeningModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialPlan={modalPlan}
      />
    </>
  );
}

const heroStats = [
  { label: 'Total Balance', value: '$48,291.40', sub: '+2.4% this month', color: '#C9A84C' },
  { label: 'Projected Return', value: '$210.18', sub: 'Illustrative only', color: '#10B981' },
  { label: 'Transfers',     value: '12',         sub: 'This week',        color: '#627EEA' },
];

export default function AccountsPage() {
  return <HomepageContentProvider><AccountsPageContent /></HomepageContentProvider>;
}
