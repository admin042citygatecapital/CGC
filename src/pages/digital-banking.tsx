import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Check,
  Code2,
  CreditCard,
  FileChartColumn,
  Gift,
  Globe2,
  Handshake,
  Headphones,
  LockKeyhole,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { DEFAULT_ACCOUNT_PLANS, normalizeAccountPlans, type AccountPlanConfig } from '@/lib/accountPlans';

type PlanKey = 'standard' | 'premium' | 'elite';

interface Plan {
  key: PlanKey;
  name: string;
  eyebrow: string;
  price: string;
  period?: string;
  summary: string;
  builtFor: string;
  closing: string;
  cta: string;
  href: string;
  highlight?: boolean;
}

interface ComparisonFeature {
  icon: typeof WalletCards;
  name: string;
  description: string;
  plans: Record<PlanKey, string | boolean>;
}

const PLAN_PRESENTATION: Plan[] = [
  {
    key: 'standard',
    name: 'Standard',
    eyebrow: 'Start with the essentials',
    price: 'Free',
    summary: 'A simple, modern foundation for viewing and organising financial activity from one secure dashboard.',
    builtFor: 'Individuals beginning their digital financial journey and customers with straightforward financial needs.',
    closing: 'Simple. Digital. Essential.',
    cta: 'Explore Standard',
    href: '/register?product=digital-banking-standard',
  },
  {
    key: 'premium',
    name: 'Premium',
    eyebrow: 'More capability',
    price: '$9',
    period: '/ month',
    summary: 'Expanded visibility, flexibility and control for a more active financial life.',
    builtFor: 'Professionals, frequent travellers, entrepreneurs and customers who want more sophisticated tools.',
    closing: 'Powerful. Flexible. Intelligent.',
    cta: 'Explore Premium',
    href: '/register?product=digital-banking-premium',
    highlight: true,
  },
  {
    key: 'elite',
    name: 'Elite',
    eyebrow: 'A personalised experience',
    price: '$29',
    period: '/ month',
    summary: 'Premium digital capabilities combined with a higher-touch service experience.',
    builtFor: 'Executives, business owners and eligible professional clients with sophisticated financial requirements.',
    closing: 'Personalised. Advanced. Exclusive.',
    cta: 'Contact Elite Team',
    href: '/contact?service=elite-digital-banking',
  },
];

const comparisonFeatures: ComparisonFeature[] = [
  {
    icon: Globe2,
    name: 'Multi-Currency Experience',
    description: 'View and organise supported currencies in one connected experience.',
    plans: { standard: true, premium: 'Expanded', elite: 'Expanded' },
  },
  {
    icon: WalletCards,
    name: 'Digital Wallets',
    description: 'Organise supported wallet balances and financial activity.',
    plans: { standard: true, premium: 'Enhanced', elite: 'Enhanced' },
  },
  {
    icon: Send,
    name: 'Transfer Workflows',
    description: 'Access eligible transfer journeys and follow status updates.',
    plans: { standard: 'Essential', premium: 'Advanced', elite: 'Advanced' },
  },
  {
    icon: CreditCard,
    name: 'Smart Card Experience',
    description: 'Manage eligible virtual and physical card activity digitally.',
    plans: { standard: 'Virtual', premium: 'Virtual & physical', elite: 'Virtual & physical' },
  },
  {
    icon: SlidersHorizontal,
    name: 'Card & Spending Controls',
    description: 'Review transactions and use available security and spending controls.',
    plans: { standard: 'Essential', premium: 'Enhanced', elite: 'Enhanced' },
  },
  {
    icon: BarChart3,
    name: 'Financial Analytics',
    description: 'Understand balances, spending, income and account-performance trends.',
    plans: { standard: 'Smart insights', premium: 'Advanced insights', elite: 'Advanced insights' },
  },
  {
    icon: Sparkles,
    name: 'Portfolio & Market View',
    description: 'Follow supported positions, assets and market information.',
    plans: { standard: false, premium: true, elite: true },
  },
  {
    icon: Gift,
    name: 'Rewards & Benefits',
    description: 'Eligible programme benefits where supported and available.',
    plans: { standard: false, premium: true, elite: true },
  },
  {
    icon: Headphones,
    name: 'Customer Support',
    description: 'Help for eligible account and service enquiries.',
    plans: { standard: 'Email support', premium: 'Priority support', elite: 'Priority service levels' },
  },
  {
    icon: UserRound,
    name: 'Relationship Support',
    description: 'Personal assistance for eligible account-management needs.',
    plans: { standard: false, premium: false, elite: true },
  },
  {
    icon: Handshake,
    name: 'Concierge & Onboarding',
    description: 'Guided onboarding and eligible lifestyle or service assistance.',
    plans: { standard: false, premium: false, elite: 'White-glove' },
  },
  {
    icon: Code2,
    name: 'Business & API Capabilities',
    description: 'Supported integration capabilities for eligible business workflows.',
    plans: { standard: false, premium: false, elite: true },
  },
  {
    icon: FileChartColumn,
    name: 'Advanced Reporting',
    description: 'Detailed financial information and customised reporting options.',
    plans: { standard: false, premium: false, elite: true },
  },
  {
    icon: ShieldCheck,
    name: 'Layered Security',
    description: 'Authentication, monitoring, notifications and account-protection controls.',
    plans: { standard: true, premium: 'Enhanced', elite: 'Enhanced' },
  },
];

const trustItems = [
  { icon: ShieldCheck, title: 'Layered Security', body: 'Protection designed around every account experience.' },
  { icon: Globe2, title: 'Global Perspective', body: 'Built for increasingly international financial needs.' },
  { icon: Headphones, title: 'Dedicated Support', body: 'Clear routes to help across every account level.' },
  { icon: LockKeyhole, title: 'Privacy by Design', body: 'Thoughtful controls for personal and financial information.' },
];

function Availability({ value }: { value: string | boolean }) {
  if (!value) return <span className="text-white/25" aria-label="Not included">—</span>;
  if (value === true) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary" aria-label="Included">
        <Check size={15} strokeWidth={3} />
      </span>
    );
  }
  return <span className="text-sm font-semibold text-white/75">{value}</span>;
}

export default function DigitalBankingPage() {
  const [planConfig, setPlanConfig] = useState<AccountPlanConfig[]>(DEFAULT_ACCOUNT_PLANS);
  useEffect(() => {
    fetch('/api/settings/website')
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        if (payload?.data?.accountPlans) setPlanConfig(normalizeAccountPlans(payload.data.accountPlans));
      })
      .catch(() => {});
  }, []);

  const plans = PLAN_PRESENTATION.map(presentation => {
    const configured = planConfig.find(plan => plan.id === presentation.key);
    return configured ? {
      ...presentation,
      name: configured.name,
      price: configured.monthlyPrice,
      period: configured.monthlyPrice.toLowerCase() === 'free' ? undefined : '/ month',
      summary: configured.description,
      builtFor: configured.eligibility,
      cta: configured.ctaLabel,
      href: configured.ctaLink,
    } : presentation;
  }).filter(plan => planConfig.find(configured => configured.id === plan.key)?.visible !== false);

  const isIncluded = (feature: ComparisonFeature, plan: Plan) => {
    const configured = planConfig.find(item => item.id === plan.key);
    return configured ? configured.features.includes(feature.name) : Boolean(feature.plans[plan.key]);
  };

  return (
    <>
      <Helmet>
        <title>Digital Banking Plans | City Gate Capital</title>
        <meta
          name="description"
          content="Compare City Gate Capital Standard, Premium and Elite digital banking experiences, including multi-currency tools, wallets, transfers, analytics and support."
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://citygate.capital/digital-banking" />
        <meta property="og:title" content="Choose the Account That Fits Your Ambition | City Gate Capital" />
        <meta property="og:description" content="One connected digital financial experience, with three account options designed to grow with you." />
        <meta property="og:url" content="https://citygate.capital/digital-banking" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://citygate.capital/assets/media/city-gate-banking-customer-hero-v2.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Digital Banking Plans | City Gate Capital" />
        <meta name="twitter:description" content="Standard, Premium and Elite account experiences designed around the way you manage money." />
        <meta name="twitter:image" content="https://citygate.capital/assets/media/city-gate-banking-customer-hero-v2.png" />
      </Helmet>

      <main className="min-h-screen overflow-hidden bg-[#050505] text-white">
        <section className="relative border-b border-primary/10 pb-16 pt-36 md:pb-24 md:pt-44">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(201,168,76,0.16),transparent_46%)]" />
          <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:42px_42px]" />
          <div className="container relative mx-auto px-4 text-center md:px-6">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                <WalletCards size={15} /> Account experiences
              </span>
              <h1 className="mx-auto mt-7 max-w-5xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-7xl">
                Choose the Account<br />
                <span className="text-gold-shimmer">That Fits Your Ambition</span>
              </h1>
              <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-white/55 md:text-xl">
                Banking designed around the way you manage money. Start with the essentials, add greater capability as you grow, and move into a personalised experience when your financial world becomes more sophisticated.
              </p>
              <p className="mt-5 text-sm font-semibold tracking-wide text-white/70">Powerful features. Flexible plans. Built for you.</p>
            </motion.div>
          </div>
        </section>

        <section className="py-14 md:py-24" aria-labelledby="compare-plans">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-10 text-center md:mb-14">
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-primary">One platform · three experiences</span>
              <h2 id="compare-plans" className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">Compare your experience</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/48 md:text-base">
                Every account is built around visibility, connected financial tools, layered security and a global perspective.
              </p>
            </div>

            <div className="hidden overflow-hidden rounded-[30px] border border-primary/25 bg-[#0b0b0a] shadow-[0_24px_90px_rgba(0,0,0,.45)] lg:block">
              <div className="grid border-b border-white/10" style={{ gridTemplateColumns: `1.3fr repeat(${plans.length}, minmax(0, 1fr))` }}>
                <div className="flex items-end p-7">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Features</p>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-white/40">Select the experience that matches the way you live, work and manage your finances.</p>
                  </div>
                </div>
                {plans.map(plan => (
                  <div key={plan.key} className={`relative border-l border-white/10 p-7 text-center ${plan.highlight ? 'bg-gradient-to-b from-primary/15 to-primary/[0.035]' : ''}`}>
                    {plan.highlight && <span className="absolute right-4 top-4 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary">Popular</span>}
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">{plan.eyebrow}</p>
                    <h3 className="mt-3 text-2xl font-bold uppercase tracking-[0.1em]">{plan.name}</h3>
                    <div className="mt-4 flex items-end justify-center gap-1">
                      <span className="text-4xl font-bold text-primary">{plan.price}</span>
                      {plan.period && <span className="pb-1 text-sm text-white/45">{plan.period}</span>}
                    </div>
                    <p className="mx-auto mt-4 max-w-[250px] text-xs leading-5 text-white/45">{plan.summary}</p>
                  </div>
                ))}
              </div>

              {comparisonFeatures.map((feature, index) => (
                <div key={feature.name} className={`grid ${index < comparisonFeatures.length - 1 ? 'border-b border-white/[0.075]' : ''}`} style={{ gridTemplateColumns: `1.3fr repeat(${plans.length}, minmax(0, 1fr))` }}>
                  <div className="flex items-center gap-4 p-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <feature.icon size={19} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white/90">{feature.name}</p>
                      <p className="mt-1 text-xs leading-5 text-white/38">{feature.description}</p>
                    </div>
                  </div>
                  {plans.map(plan => (
                    <div key={plan.key} className={`flex min-h-[86px] items-center justify-center border-l border-white/[0.075] px-5 text-center ${plan.highlight ? 'bg-primary/[0.035]' : ''}`}>
                      <Availability value={isIncluded(feature, plan) ? feature.plans[plan.key] || true : false} />
                    </div>
                  ))}
                </div>
              ))}

              <div className="grid border-t border-white/10" style={{ gridTemplateColumns: `1.3fr repeat(${plans.length}, minmax(0, 1fr))` }}>
                <div className="p-7">
                  <p className="text-sm font-semibold text-white/75">Banking that grows with you.</p>
                  <p className="mt-1 text-xs leading-5 text-white/38">Move between experiences as your needs evolve.</p>
                </div>
                {plans.map(plan => (
                  <div key={plan.key} className={`border-l border-white/10 p-6 ${plan.highlight ? 'bg-primary/[0.035]' : ''}`}>
                    <Link to={plan.href} className={`group flex min-h-14 items-center justify-center gap-2 rounded-xl border px-5 text-center text-sm font-bold transition-all ${plan.highlight ? 'border-primary bg-primary text-black hover:bg-[#e5c66f]' : plan.key === 'elite' ? 'border-[#9f67d6]/60 text-[#c997ff] hover:bg-[#9f67d6]/10' : 'border-[#628cf0]/60 text-[#8cb0ff] hover:bg-[#628cf0]/10'}`}>
                      {plan.cta} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:hidden">
              {plans.map((plan, planIndex) => (
                <motion.article
                  key={plan.key}
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: planIndex * 0.08 }}
                  className={`overflow-hidden rounded-3xl border ${plan.highlight ? 'border-primary/50 bg-gradient-to-b from-primary/15 to-[#0b0b0a]' : 'border-primary/20 bg-[#0b0b0a]'}`}
                >
                  <div className="border-b border-white/10 p-6 sm:p-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{plan.eyebrow}</p>
                        <h3 className="mt-2 text-3xl font-bold">{plan.name}</h3>
                      </div>
                      {plan.highlight && <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">Popular</span>}
                    </div>
                    <div className="mt-5 flex items-end gap-1">
                      <span className="text-4xl font-bold text-primary">{plan.price}</span>
                      {plan.period && <span className="pb-1 text-sm text-white/45">{plan.period}</span>}
                    </div>
                    <p className="mt-4 text-sm leading-6 text-white/52">{plan.summary}</p>
                  </div>
                  <div className="space-y-4 p-6 sm:p-8">
                    {comparisonFeatures.filter(feature => isIncluded(feature, plan)).map(feature => (
                      <div key={feature.name} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary"><Check size={13} strokeWidth={3} /></span>
                        <div>
                          <p className="text-sm font-semibold text-white/85">{feature.name}</p>
                          <p className="mt-0.5 text-xs leading-5 text-white/40">{typeof feature.plans[plan.key] === 'string' ? feature.plans[plan.key] : feature.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-white/10 p-6 sm:p-8">
                    <p className="mb-2 text-xs uppercase tracking-[0.16em] text-white/35">Built for</p>
                    <p className="text-sm leading-6 text-white/52">{plan.builtFor}</p>
                    <p className="mt-4 text-sm font-bold text-primary">{plan.closing}</p>
                    <Link to={plan.href} className={`group mt-6 flex min-h-14 items-center justify-center gap-2 rounded-xl border px-5 text-center text-sm font-bold ${plan.highlight ? 'border-primary bg-primary text-black' : 'border-primary/35 text-primary'}`}>
                      {plan.cta} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-primary/10 bg-[#090909] py-20 md:py-28">
          <div className="container mx-auto grid items-center gap-12 px-4 md:px-6 lg:grid-cols-[1.05fr_.95fr]">
            <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Banking that grows with you</span>
              <h2 className="mt-4 text-4xl font-bold leading-tight tracking-tight md:text-6xl">Your needs change.<br /><span className="text-gold-shimmer">Your account can too.</span></h2>
              <p className="mt-6 max-w-xl text-base leading-8 text-white/50">
                You should not have to rebuild your financial life every time your needs change. Begin with essential tools, upgrade when you need greater capability, and move into a more personalised experience as your financial world evolves.
              </p>
            </motion.div>
            <div className="grid gap-4">
              {plans.map((plan, index) => (
                <motion.div key={plan.key} initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.08 }} className="flex items-center gap-5 rounded-2xl border border-primary/15 bg-black/35 p-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-lg font-bold text-primary">0{index + 1}</span>
                  <div>
                    <p className="font-bold text-white">{plan.name}</p>
                    <p className="mt-1 text-sm text-white/42">{plan.closing}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 md:py-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid overflow-hidden rounded-3xl border border-primary/20 bg-[#0b0b0a] sm:grid-cols-2 lg:grid-cols-4">
              {trustItems.map((item, index) => (
                <div key={item.title} className={`p-6 md:p-8 ${index > 0 ? 'border-t border-primary/15 sm:border-l sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l-0 lg:border-l' : ''}`}>
                  <item.icon size={25} className="text-primary" />
                  <p className="mt-4 text-sm font-bold text-primary">{item.title}</p>
                  <p className="mt-2 text-xs leading-5 text-white/42">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="mx-auto mt-10 max-w-5xl rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4 text-center text-[11px] leading-5 text-white/38">
              Account features, eligibility, pricing and availability may vary by jurisdiction. Banking, payment, card, investment, custody and digital-asset services requiring regulatory authorisation are available only when delivered through appropriately licensed or regulated entities and approved partners.
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
