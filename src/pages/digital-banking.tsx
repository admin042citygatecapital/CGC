import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
  CreditCard, Zap, Bell, RefreshCw, Shield, ArrowRight, CheckCircle,
  PieChart, BarChart2, Smartphone, Lock, Globe, TrendingUp, Star, Sparkles
} from 'lucide-react';

const cardFeatures = [
  { icon: CreditCard, title: 'Virtual Cards',      desc: 'Instantly create virtual cards for online shopping with custom spend limits and one-click disposal.',  color: '#C9A84C' },
  { icon: Shield,     title: 'Freeze & Unfreeze',  desc: 'Lock your card in one tap if it\'s lost or stolen. Unlock just as fast — no phone call required.',       color: '#10B981' },
  { icon: Bell,       title: 'Instant Alerts',     desc: 'Real-time push notifications for every transaction, anywhere in the world, in any currency.',             color: '#627EEA' },
  { icon: RefreshCw,  title: 'Auto Top-up',        desc: 'Set rules to automatically top up your card from your main balance when it falls below a threshold.',     color: '#9945FF' },
  { icon: PieChart,   title: 'Spend Analytics',    desc: 'AI categorises every purchase and shows you exactly where your money goes with beautiful visual charts.',  color: '#EC4899' },
  { icon: Zap,        title: 'Contactless Pay',    desc: 'Apple Pay, Google Pay and Samsung Pay supported on all cards. Tap and pay in milliseconds.',              color: '#F7931A' },
  { icon: Globe,      title: 'Zero FX Fees',       desc: 'Use your card in any country at the real mid-market rate. No foreign transaction fees, ever.',            color: '#14B8A6' },
  { icon: Lock,       title: '3D Secure',          desc: 'Every online transaction is protected by 3D Secure authentication and real-time fraud detection.',        color: '#F0D080' },
  { icon: Sparkles,   title: 'AI Insights',        desc: 'Personalised financial insights powered by AI. Know your patterns, optimise your spending automatically.', color: '#A78BFA' },
];

const analyticsData = [
  { month: 'Jan', spend: 2100, income: 5200 },
  { month: 'Feb', spend: 1800, income: 5200 },
  { month: 'Mar', spend: 2400, income: 5500 },
  { month: 'Apr', spend: 1950, income: 5200 },
  { month: 'May', spend: 2800, income: 6100 },
  { month: 'Jun', spend: 2200, income: 5200 },
];

const spendCategories = [
  { label: 'Dining',      pct: 32, color: '#C9A84C', amount: '$892' },
  { label: 'Travel',      pct: 24, color: '#627EEA', amount: '$672' },
  { label: 'Shopping',    pct: 20, color: '#10B981', amount: '$560' },
  { label: 'Utilities',   pct: 14, color: '#9945FF', amount: '$392' },
  { label: 'Other',       pct: 10, color: '#EC4899', amount: '$280' },
];

const plans = [
  {
    name: 'Standard',
    price: 'Free',
    tagline: 'Everything to get started',
    features: [
      { text: '1 virtual card',            included: true },
      { text: 'Basic spend analytics',     included: true },
      { text: 'Standard transfers',        included: true },
      { text: 'Mobile app access',         included: true },
      { text: 'Metal physical card',       included: false },
      { text: 'Priority support',          included: false },
      { text: 'Cashback rewards',          included: false },
    ],
  },
  {
    name: 'Premium',
    price: '$9',
    period: '/mo',
    tagline: 'For power users',
    highlight: true,
    features: [
      { text: '5 virtual cards',           included: true },
      { text: 'Advanced analytics',        included: true },
      { text: 'Priority transfers',        included: true },
      { text: 'Mobile app access',         included: true },
      { text: '1 metal physical card',     included: true },
      { text: 'Priority support',          included: true },
      { text: '1% cashback on all spend',  included: true },
    ],
  },
  {
    name: 'Elite',
    price: '$29',
    period: '/mo',
    tagline: 'Private banking experience',
    features: [
      { text: 'Unlimited virtual cards',   included: true },
      { text: 'AI financial advisor',      included: true },
      { text: 'Instant transfers',         included: true },
      { text: 'Mobile app access',         included: true },
      { text: 'Concierge metal card',      included: true },
      { text: 'Dedicated account manager', included: true },
      { text: '2% cashback on all spend',  included: true },
    ],
  },
];

const testimonials = [
  { name: 'Sarah K.',   role: 'Entrepreneur',     text: 'The virtual card feature alone is worth it. I create a new card for every subscription and never worry about fraud.', rating: 5 },
  { name: 'James T.',   role: 'Frequent Traveller', text: 'Zero FX fees have saved me hundreds of dollars. I use my City Gate card everywhere I travel.', rating: 5 },
  { name: 'Priya M.',   role: 'Freelancer',       text: 'The spend analytics are incredible. I finally understand where my money goes each month.', rating: 5 },
];

export default function DigitalBankingPage() {
  const [activeTab, setActiveTab] = useState<'spend' | 'income'>('spend');

  const maxVal = Math.max(...analyticsData.map(d => d.income));

  return (
    <>
      <Helmet>
        <title>Digital Banking — Smart Cards & Instant Payments | CGC</title>
        <meta name="description" content="Next-generation digital banking with virtual & physical cards, AI-powered spending analytics, instant payments, and auto-savings. Free Standard account available." />
        <link rel="canonical" href="https://citygate.capital/digital-banking" />
        <meta property="og:title" content="Digital Banking — Smart Cards, Analytics & Instant Payments" />
        <meta property="og:description" content="Smart cards, real-time analytics, instant payments and AI-powered insights in one platform. Free to start." />
        <meta property="og:url" content="https://citygate.capital/digital-banking" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={(() => { const u = new URL('/api/og', 'https://citygate.capital'); u.searchParams.set('title', 'Digital Banking'); u.searchParams.set('description', 'Smart Cards, Analytics & Instant Payments'); return u.href; })()} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content="Digital Banking — Smart Cards, Analytics & Instant Payments" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:creator" content="@CityGateCapital" />
        <meta name="twitter:title" content="Digital Banking — City Gate Capital" />
        <meta name="twitter:description" content="Smart cards, real-time analytics, instant payments and AI-powered insights in one platform." />
        <meta name="twitter:image" content={(() => { const u = new URL('/api/og', 'https://citygate.capital'); u.searchParams.set('title', 'Digital Banking'); u.searchParams.set('description', 'Smart Cards, Analytics & Instant Payments'); return u.href; })()} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Digital Banking — City Gate Capital',
          url: 'https://citygate.capital/digital-banking',
          description: 'Next-generation digital banking with virtual & physical cards, AI-powered analytics, and instant payments.',
          mainEntity: {
            '@type': 'FinancialProduct',
            name: 'City Gate Capital Digital Banking',
            description: 'Virtual and physical cards, AI analytics, instant payments, and auto-savings.',
            provider: { '@type': 'Organization', name: 'City Gate Capital', url: 'https://citygate.capital' },
          },
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://citygate.capital/' },
            { '@type': 'ListItem', position: 2, name: 'Digital Banking', item: 'https://citygate.capital/digital-banking' },
          ],
        })}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative pt-40 pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] rounded-full opacity-5 blur-[140px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #C9A84C, transparent)' }} />
        <div className="container mx-auto px-4 md:px-6 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-6 tracking-widest uppercase">
                Digital Banking
              </span>
              <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight tracking-tight">
                Banking That<br />
                <span className="text-gold-shimmer">Works for You</span>
              </h1>
              <p className="text-xl text-foreground/50 mb-8 leading-relaxed">
                Smart cards, real-time analytics, instant payments, and AI-powered insights — all in one beautifully designed platform.
              </p>
              <div className="flex flex-wrap gap-3 mb-10">
                {['Zero FX fees', 'Virtual cards', 'AI analytics', 'Metal card', 'Cashback'].map(tag => (
                  <span key={tag} className="px-3 py-1.5 rounded-full text-xs font-medium text-primary bg-primary/10 border border-primary/20">{tag}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-4">
                <Link to="/accounts" className="group relative inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-bold text-black overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                  <span className="relative">Open Account</span>
                  <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" />
                </Link>
                <Link to="/contact" className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-medium text-foreground/70 glass border border-primary/20 hover:border-primary/40 hover:text-foreground transition-colors">
                  Book a Demo
                </Link>
              </div>
            </motion.div>

            {/* Card visual */}
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2 }} className="flex justify-center">
              <div className="relative w-80">
                {/* Back card */}
                <div className="absolute top-8 left-8 right-0 h-52 rounded-2xl rotate-6 opacity-30"
                  style={{ background: 'linear-gradient(135deg, #1a1a1a, #2a2a2a)', border: '1px solid rgba(201,168,76,0.2)' }} />
                {/* Mid card */}
                <div className="absolute top-4 left-4 right-0 h-52 rounded-2xl rotate-3 opacity-50"
                  style={{ background: 'linear-gradient(135deg, #161410, #221E14)', border: '1px solid rgba(201,168,76,0.25)' }} />
                {/* Front card */}
                <div className="relative h-52 rounded-2xl p-6 flex flex-col justify-between"
                  style={{
                    background: 'linear-gradient(135deg, #1C1A14, #2A2618)',
                    border: '1px solid rgba(201,168,76,0.35)',
                    boxShadow: 'var(--gold-glow)',
                  }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] text-foreground/40 uppercase tracking-widest mb-0.5">City Gate Capital</p>
                      <p className="text-xs text-primary font-bold tracking-wider">ELITE METAL</p>
                    </div>
                    <div className="w-10 h-7 rounded bg-gradient-to-br from-primary/60 to-primary/20 border border-primary/30" />
                  </div>
                  <div>
                    <p className="text-base font-mono text-foreground/70 tracking-widest mb-4">•••• •••• •••• 4291</p>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[9px] text-foreground/30 uppercase tracking-wide mb-0.5">Card Holder</p>
                        <p className="text-sm font-semibold text-foreground">ALEX MORGAN</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-foreground/30 uppercase tracking-wide mb-0.5">Expires</p>
                        <p className="text-sm font-semibold text-foreground">12/28</p>
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                </div>
                {/* Floating notification */}
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -bottom-6 -right-6 glass-card rounded-xl px-4 py-3 border border-primary/20 shadow-xl"
                >
                  <p className="text-[10px] text-foreground/40 mb-0.5">Cashback earned</p>
                  <p className="text-sm font-bold text-primary">+$24.80</p>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Analytics preview */}
      <section className="py-24 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Chart */}
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="glass-card rounded-3xl p-7 gradient-border" style={{ boxShadow: 'var(--gold-glow)' }}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Spending Overview</p>
                    <p className="text-xs text-foreground/40">Last 6 months</p>
                  </div>
                  <div className="flex gap-1 p-1 glass rounded-xl">
                    {(['spend', 'income'] as const).map(t => (
                      <button key={t} onClick={() => setActiveTab(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${activeTab === t ? 'bg-primary text-black' : 'text-foreground/40 hover:text-foreground'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Bar chart */}
                <div className="flex items-end gap-2 h-32 mb-4">
                  {analyticsData.map((d, i) => {
                    const val = activeTab === 'spend' ? d.spend : d.income;
                    const h = (val / maxVal) * 100;
                    return (
                      <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                        <motion.div
                          initial={{ height: 0 }}
                          whileInView={{ height: `${h}%` }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.07, duration: 0.5 }}
                          className="w-full rounded-t-lg"
                          style={{ background: activeTab === 'spend' ? 'linear-gradient(to top, #C9A84C, #F0D080)' : 'linear-gradient(to top, #10B981, #34D399)' }}
                        />
                        <span className="text-[9px] text-foreground/30">{d.month}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Spend categories */}
                <div className="space-y-2 pt-4 border-t border-primary/10">
                  {spendCategories.map(c => (
                    <div key={c.label} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-foreground/50">{c.label}</span>
                          <span className="text-foreground/70">{c.amount}</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/5">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${c.pct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="h-full rounded-full"
                            style={{ background: c.color }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                AI Analytics
              </span>
              <h2 className="text-4xl font-bold text-foreground mb-5 tracking-tight">
                Know Your Money<br />
                <span className="text-gold-gradient">Inside Out</span>
              </h2>
              <p className="text-foreground/50 leading-relaxed mb-8">
                Our AI engine analyses every transaction and surfaces insights you'd never find on your own — helping you spend smarter and save more.
              </p>
              <div className="space-y-4">
                {[
                  { icon: BarChart2,  title: 'Monthly Trends',       desc: 'Track income vs. spending across 12 months with interactive charts.' },
                  { icon: PieChart,   title: 'Category Breakdown',   desc: 'See exactly how much you spend on dining, travel, shopping, and more.' },
                  { icon: TrendingUp, title: 'Savings Projections',  desc: 'AI predicts how much you could save with personalised recommendations.' },
                  { icon: Smartphone, title: 'Mobile Notifications', desc: 'Weekly summaries and real-time alerts keep you on top of your finances.' },
                ].map((item, i) => (
                  <motion.div key={item.title} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-4 p-4 glass rounded-xl border border-primary/10 hover:border-primary/20 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <item.icon size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-0.5">{item.title}</p>
                      <p className="text-xs text-foreground/45 leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                Features
              </span>
              <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                Everything You Need to<br />
                <span className="text-gold-gradient">Bank Smarter</span>
              </h2>
              <p className="text-foreground/50 max-w-md mx-auto">Built for people who demand the best from their banking experience.</p>
            </motion.div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {cardFeatures.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="glass-card rounded-2xl p-7 gradient-border hover:border-primary/25 transition-all hover:-translate-y-1 group"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
                  style={{ background: `${f.color}15` }}>
                  <f.icon size={20} style={{ color: f.color }} />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-foreground/50 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials strip */}
      <section className="py-16 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <motion.div key={t.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="glass-card rounded-2xl p-6 gradient-border">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} size={12} className="text-primary fill-primary" />
                  ))}
                </div>
                <p className="text-sm text-foreground/60 leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-foreground/35">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-14">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                Pricing
              </span>
              <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                Choose Your <span className="text-gold-gradient">Plan</span>
              </h2>
              <p className="text-foreground/50 max-w-sm mx-auto">Start free. Upgrade when you need more power.</p>
            </motion.div>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-3xl p-7 ${plan.highlight
                  ? 'bg-gradient-to-b from-primary/15 to-primary/5 border border-primary/40'
                  : 'glass-card gradient-border'}`}
                style={plan.highlight ? { boxShadow: 'var(--gold-glow)' } : {}}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-black"
                    style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
                    Most Popular
                  </div>
                )}
                <p className="text-xs text-foreground/40 uppercase tracking-widest mb-1">{plan.name}</p>
                <p className="text-xs text-foreground/30 mb-3">{plan.tagline}</p>
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  {plan.period && <span className="text-sm text-foreground/40 mb-1">{plan.period}</span>}
                </div>
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map(f => (
                    <li key={f.text} className={`flex items-center gap-2.5 text-sm ${f.included ? 'text-foreground/60' : 'text-foreground/25 line-through'}`}>
                      <CheckCircle size={13} className={f.included ? 'text-primary shrink-0' : 'text-foreground/20 shrink-0'} />
                      {f.text}
                    </li>
                  ))}
                </ul>
                <Link to="/accounts" className={`block text-center py-3 rounded-xl text-sm font-bold transition-all ${plan.highlight
                  ? 'bg-gradient-to-r from-primary to-[#F0D080] text-black'
                  : 'glass border border-primary/20 text-foreground hover:border-primary/40'}`}>
                  Get Started
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative glass-card rounded-3xl p-12 md:p-16 gradient-border text-center overflow-hidden"
            style={{ boxShadow: 'var(--gold-glow)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            <h2 className="text-4xl font-bold text-foreground mb-5 tracking-tight relative">
              Start Banking <span className="text-gold-gradient">Smarter Today</span>
            </h2>
            <p className="text-foreground/50 mb-8 max-w-md mx-auto relative">Open your free account in under 5 minutes. No credit check. No hidden fees.</p>
            <div className="flex flex-wrap justify-center gap-4 relative">
              <Link to="/accounts" className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-black overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                <span className="relative">Open Free Account</span>
                <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/contact" className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-medium text-foreground/70 glass border border-primary/20 hover:border-primary/40 hover:text-foreground transition-colors">
                Book a Demo
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
