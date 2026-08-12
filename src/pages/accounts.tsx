import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CheckCircle, XCircle, Shield, Fingerprint, Camera,
  FileText, User, Building2, TrendingUp, DollarSign, Zap,
  ArrowRight, Star, CreditCard, Globe, Lock, ChevronRight,
  Minus
} from 'lucide-react';
import { trackConversion } from '@/lib/useAnalytics';
import { useABTest } from '@/lib/useABTest';
import AccountOpeningModal from '@/components/AccountOpeningModal';

const accountTypes = [
  {
    icon: User,
    name: 'Personal',
    tagline: 'For individuals',
    desc: 'Explore the everyday account, portfolio, and transfer experience in one workspace.',
    price: 'Platform access',
    color: '#C9A84C',
    accentClass: 'from-primary/20 to-primary/5',
    features: [
      { text: 'Multi-currency account (50+ currencies)', included: true  },
      { text: 'Crypto wallet (50+ assets)',              included: true  },
      { text: '1 virtual debit card',                   included: true  },
      { text: 'International transfer workflow',       included: true  },
      { text: 'Basic investment tools',                 included: true  },
      { text: 'Metal physical card',                    included: false },
      { text: 'Priority support',                       included: false },
      { text: 'Dedicated account manager',              included: false },
    ],
  },
  {
    icon: TrendingUp,
    name: 'Savings',
    tagline: 'Goal-based planning',
    desc: 'Explore savings goals, automated rules, and projected returns using sample data.',
    price: 'Platform access',
    color: '#10B981',
    highlight: true,
    accentClass: 'from-emerald-500/20 to-emerald-500/5',
    features: [
      { text: 'Illustrative return projections',       included: true  },
      { text: 'Multi-currency goal tracking',          included: true  },
      { text: 'No minimum balance required',           included: true  },
      { text: 'Withdrawal workflow',                    included: true  },
      { text: 'Auto-save rules & round-ups',           included: true  },
      { text: 'Savings goals & tracking',              included: true  },
      { text: 'Deposits currently unavailable',               included: true  },
      { text: 'Dedicated savings manager',             included: false },
    ],
  },
  {
    icon: Building2,
    name: 'Business',
    tagline: 'For companies',
    desc: 'Explore multi-user access, expense workflows, and proposed API integrations.',
    price: 'Platform access',
    color: '#627EEA',
    accentClass: 'from-blue-500/20 to-blue-500/5',
    features: [
      { text: 'Up to 10 team member seats',            included: true },
      { text: 'Expense management & approvals',        included: true },
      { text: 'Full REST API access',                  included: true },
      { text: 'Bulk payment processing',               included: true },
      { text: 'Accounting integrations (Xero, QB)',    included: true },
      { text: 'Custom virtual cards per team',         included: true },
      { text: 'Dedicated business manager',            included: true },
      { text: 'Custom transfer limits',                included: true },
    ],
  },
];

const kycSteps = [
  { icon: User,        step: '01', title: 'Create Your Profile',      desc: 'Enter your email and set a secure password to access the platform workspace.',                       color: '#C9A84C' },
  { icon: Camera,      step: '02', title: 'Review KYC Flow',   desc: 'Explore the identity-verification journey. A contracted KYC provider is required before launch.',  color: '#627EEA' },
  { icon: Fingerprint, step: '03', title: 'Security Preferences',     desc: 'Review the biometric interface; native biometric login is not currently active.',                  color: '#10B981' },
  { icon: DollarSign,  step: '04', title: 'Explore Sample Data',      desc: 'Use sample balances and transactions. Funding and money movement are currently unavailable.',       color: '#9945FF' },
];

const trustBadges = [
  { icon: Shield,      label: 'Funding Safeguard', desc: 'Deposits currently unavailable',    color: '#C9A84C' },
  { icon: Fingerprint, label: 'Biometric Interface', desc: 'Native activation pending',       color: '#627EEA' },
  { icon: FileText,    label: 'Launch Gated',      desc: 'Approvals required',         color: '#10B981' },
  { icon: Zap,         label: 'Guided Setup',      desc: 'Platform workflow',                 color: '#9945FF' },
  { icon: Lock,        label: 'Secure Sessions',   desc: 'Protected account access', color: '#EC4899' },
  { icon: Globe,       label: 'Multi-Currency',    desc: 'Prototype coverage',        color: '#F7931A' },
  { icon: CreditCard,  label: 'Virtual Cards',     desc: 'Issuance not yet available',        color: '#14B8A6' },
  { icon: Star,        label: 'Responsive UI',     desc: 'Published web experience',          color: '#F0D080' },
];

const testimonials = [
  { name: 'Personal Experience', role: 'Illustrative scenario', text: 'See balances, cards, transfers, and spending insights together in a guided account experience.', rating: 5 },
  { name: 'Business Experience', role: 'Illustrative scenario', text: 'Explore team access, expense controls, approval flows, and reporting before provider integrations go live.', rating: 5 },
  { name: 'Savings Experience', role: 'Illustrative scenario', text: 'Model goals and projected returns with sample data; no deposit or advertised yield is offered.', rating: 5 },
];

// Comparison table data
const comparisonRows = [
  { feature: 'Platform access', personal: 'Included', savings: 'Included', business: 'Included' },
  { feature: 'Currencies supported',  personal: '50+',        savings: '50+',         business: '50+' },
  { feature: 'Virtual cards',         personal: '1',          savings: '1',           business: 'Unlimited' },
  { feature: 'Physical metal card',   personal: null,         savings: null,          business: true },
  { feature: 'Return modelling',      personal: null,         savings: true,          business: null },
  { feature: 'Transfer workflows',           personal: true,         savings: true,          business: true },
  { feature: 'Team seats',            personal: null,         savings: null,          business: 'Up to 10' },
  { feature: 'API access',            personal: null,         savings: null,          business: true },
  { feature: 'Priority support',      personal: null,         savings: null,          business: true },
  { feature: 'Live deposits',         personal: null,         savings: null,          business: null },
];

function ComparisonCell({ value }: { value: string | boolean | null }) {
  if (value === null) return <Minus size={14} className="text-foreground/20 mx-auto" />;
  if (value === true) return <CheckCircle size={14} className="text-primary mx-auto" />;
  return <span className="text-xs text-foreground/60">{value}</span>;
}

// Hero account experience card
const heroStats = [
  { label: 'Total Balance', value: '$48,291.40', sub: '+2.4% this month', color: '#C9A84C' },
  { label: 'Projected Return', value: '$210.18', sub: 'Illustrative only', color: '#10B981' },
  { label: 'Transfers',     value: '12',         sub: 'This week',        color: '#627EEA' },
];

export default function AccountsPage() {
  const [selectedType, setSelectedType] = useState('Savings');
  const [showComparison, setShowComparison] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPlan, setModalPlan] = useState<'Personal' | 'Savings' | 'Business'>('Personal');
  const location = useLocation();

  function openModal(plan: string) {
    const safePlan = (['Personal', 'Savings', 'Business'].includes(plan) ? plan : 'Personal') as 'Personal' | 'Savings' | 'Business';
    setModalPlan(safePlan);
    setModalOpen(true);
  }

  // A/B test: plan card CTA button copy
  // control  → "Open {Plan} Account"
  // action   → "Get Started — Free"
  // social   → "Join 2M+ Members"
  const planCTA = useABTest(
    'plan-card-cta',
    ['control', 'action', 'social'] as const,
    location.pathname
  );
  function getPlanCTALabel(planName: string): string {
    if (planCTA.variant === 'action') return 'Get Started — Free';
    if (planCTA.variant === 'social') return 'Explore the Platform';
    return `Open ${planName} Account`;
  }

  return (
    <>
      <Helmet>
        <title>Open an Account — Personal, Savings & Business | CGC</title>
        <meta name="description" content="Explore City Gate Capital personal, savings, and business account experiences using sample balances and guided workflows." />
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
      <section className="relative pt-36 pb-24 overflow-hidden">
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
                Choose the Right Profile,<br />
                <span className="text-gold-shimmer">Using Sample Data</span>
              </h1>
              <p className="text-lg text-foreground/50 mb-8 leading-relaxed max-w-lg">
                Compare account experiences using sample data. Financial account activation, deposits, card issuance and money movement require completed verification and approved providers.
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
                    <span className="text-xs text-emerald-400 font-medium">Sample profile</span>
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

      {/* ── Account Type Cards ───────────────────────────────────────── */}
      <section id="accounts" className="py-20 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-4xl font-bold text-foreground tracking-tight mb-3">
                Explore a Proposed <span className="text-gold-gradient">Profile</span>
              </h2>
              <p className="text-foreground/55 max-w-md mx-auto text-sm">Compare illustrative profile concepts. No bank account, deposit, card, or financial service is opened.</p>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {accountTypes.map((type, i) => (
              <motion.div
                key={type.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                onClick={() => setSelectedType(type.name)}
                whileHover={{ y: -4 }}
                className={`relative rounded-3xl p-7 cursor-pointer transition-all duration-300 ${
                  type.highlight
                    ? 'border border-primary/40'
                    : selectedType === type.name
                      ? 'glass-card border border-primary/30'
                      : 'glass-card gradient-border hover:border-primary/20'
                }`}
                style={
                  type.highlight
                    ? { background: 'linear-gradient(160deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04), rgba(10,10,10,0.9))', boxShadow: '0 0 40px rgba(16,185,129,0.08)' }
                    : {}
                }
              >
                {type.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-black whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
                    Best Rate
                  </div>
                )}

                {/* Icon + name */}
                <div className="flex items-start justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: `${type.color}15`, border: `1px solid ${type.color}25` }}>
                    <type.icon size={22} style={{ color: type.color }} />
                  </div>
                  {selectedType === type.name && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: type.color }}>
                      <CheckCircle size={13} className="text-black" />
                    </div>
                  )}
                </div>

                <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: type.color }}>{type.tagline}</p>
                <h3 className="text-xl font-bold text-foreground mb-1">{type.name}</h3>
                <p className="text-2xl font-bold mb-3" style={{ color: type.color }}>{type.price}</p>
                <p className="text-sm text-foreground/55 leading-relaxed mb-6">{type.desc}</p>

                <ul className="space-y-2.5 mb-8">
                  {type.features.map(f => (
                    <li key={f.text} className={`flex items-start gap-2.5 text-xs leading-relaxed ${f.included ? 'text-foreground/65' : 'text-foreground/22'}`}>
                      {f.included
                        ? <CheckCircle size={12} className="shrink-0 mt-0.5" style={{ color: type.color }} />
                        : <XCircle size={12} className="shrink-0 mt-0.5 text-foreground/18" />
                      }
                      {f.text}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => {
                    planCTA.convert({ plan: type.name.toLowerCase() });
                    trackConversion('plan_selected', location.pathname, { plan: type.name.toLowerCase(), ab_variant: planCTA.variant });
                    openModal(type.name);
                  }}
                  className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                    type.highlight
                      ? 'text-black'
                      : 'glass border border-primary/20 text-foreground hover:border-primary/40 hover:bg-primary/5'
                  }`}
                  style={type.highlight ? { background: 'linear-gradient(135deg, #C9A84C, #F0D080)' } : {}}
                >
                  {getPlanCTALabel(type.name)}
                </button>
              </motion.div>
            ))}
          </div>

          {/* Compare toggle */}
          <div className="text-center mt-8">
            <button
              onClick={() => setShowComparison(v => !v)}
              className="inline-flex items-center gap-2 text-sm text-foreground/40 hover:text-primary transition-colors"
            >
              {showComparison ? 'Hide' : 'Show'} full comparison
              <ChevronRight size={14} className={`transition-transform ${showComparison ? 'rotate-90' : ''}`} />
            </button>
          </div>
        </div>
      </section>

      {/* ── Comparison Table ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showComparison && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35 }}
            className="overflow-hidden"
          >
            <div className="py-16 bg-[#060606]">
              <div className="container mx-auto px-4 md:px-6">
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-bold text-foreground tracking-tight">
                    Full <span className="text-gold-gradient">Comparison</span>
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px]">
                    <thead>
                      <tr>
                        <th className="text-left py-4 pr-6 text-xs text-foreground/55 uppercase tracking-widest font-semibold w-1/3">Feature</th>
                        {accountTypes.map(t => (
                          <th key={t.name} className="py-4 px-3 text-center">
                            <div className="inline-flex flex-col items-center gap-1">
                              <span className="text-sm font-bold text-foreground">{t.name}</span>
                              <span className="text-xs font-semibold" style={{ color: t.color }}>{t.price}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map((row, i) => (
                        <tr
                          key={row.feature}
                          className={`border-t border-primary/8 ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
                        >
                          <td className="py-3.5 pr-6 text-sm text-foreground/50">{row.feature}</td>
                          <td className="py-3.5 px-3 text-center"><ComparisonCell value={row.personal} /></td>
                          <td className="py-3.5 px-3 text-center"><ComparisonCell value={row.savings} /></td>
                          <td className="py-3.5 px-3 text-center"><ComparisonCell value={row.business} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── KYC Steps ────────────────────────────────────────────────── */}
      <section className="py-28">
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

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="py-24 pb-40 md:pb-24 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative glass-card rounded-3xl p-12 md:p-16 gradient-border text-center overflow-hidden"
            style={{ boxShadow: 'var(--gold-glow)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-primary/20 rounded-tl-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-primary/20 rounded-br-3xl pointer-events-none" />
            <h2 className="text-4xl font-bold text-foreground mb-5 tracking-tight relative">
              Ready to <span className="text-gold-gradient">Get Started?</span>
            </h2>
            <p className="text-foreground/55 mb-8 max-w-md mx-auto relative text-sm leading-relaxed">
              Create a platform profile to explore the interface. Financial account activation remains subject to verification, provider availability and applicable approvals.
            </p>
            <div className="flex flex-wrap justify-center gap-4 relative">
              <button onClick={() => { trackConversion('signup_started', location.pathname, { source: 'bottom_cta' }); openModal(selectedType); }} className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-black overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                <span className="relative">Create Platform Profile</span>
                <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" />
              </button>
              <Link to="/contact" className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-medium text-foreground/60 glass border border-primary/20 hover:border-primary/40 hover:text-foreground transition-colors">
                Talk to Sales
              </Link>
            </div>
          </motion.div>
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
