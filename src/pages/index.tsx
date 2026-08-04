import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, useScroll, useTransform } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { useRef, useState, useEffect } from 'react';
import { trackConversion } from '@/lib/useAnalytics';
import { useABTest } from '@/lib/useABTest';
import {
  ArrowRight, Shield, Globe, Zap, CreditCard, TrendingUp, TrendingDown, Lock,
  CheckCircle, Bitcoin, BarChart3, Smartphone, Star, ChevronDown,
  Fingerprint, Eye, Layers, RefreshCw, MessageCircle, Mail,
  Send, PieChart, Bell, Wallet, Award, User, Camera
} from 'lucide-react';

// ── Animated counter ─────────────────────────────────────────
function Counter({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let frame = 0;
    const total = 100; // 100 × 20 ms ≈ 2 s
    const timer = setInterval(() => {
      frame++;
      setCount(Math.round((frame / total) * target));
      if (frame >= total) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, [target]);

  return <span suppressHydrationWarning>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// ── Live ticker data ──────────────────────────────────────────
const tickers = [
  { symbol: 'BTC/USD', change: '+3.2%', up: true },
  { symbol: 'ETH/USD', change: '+1.8%', up: true },
  { symbol: 'SOL/USD', change: '-0.9%', up: false },
  { symbol: 'EUR/USD', change: '+0.1%', up: true },
  { symbol: 'GBP/USD', change: '-0.2%', up: false },
  { symbol: 'XAU/USD', change: '+0.5%', up: true },
  { symbol: 'USDT', change: '0.0%', up: true },
  { symbol: 'BNB/USD', change: '+2.1%', up: true },
];

// ── Features ──────────────────────────────────────────────────
const features = [
  { icon: Globe, title: 'Global Transfers', desc: 'Send to 180+ countries at real mid-market rates. No hidden fees, ever.' },
  { icon: Bitcoin, title: 'Crypto Exchange', desc: 'Buy, sell and hold 50+ cryptocurrencies directly in your account.' },
  { icon: CreditCard, title: 'Smart Cards', desc: 'Virtual and physical cards with real-time spend controls and cashback.' },
  { icon: BarChart3, title: 'AI Analytics', desc: 'Machine-learning insights that predict spending and grow your wealth.' },
  { icon: Shield, title: 'Bank-Grade Security', desc: 'Biometrics, 256-bit encryption and cold-storage for every asset.' },
  { icon: PieChart, title: 'Investment Tools', desc: 'Stocks, ETFs, crypto indices and auto-rebalancing portfolios.' },
];

// ── Stats ─────────────────────────────────────────────────────
const stats = [
  { value: 2, suffix: 'M+', label: 'Active Customers' },
  { value: 180, suffix: '+', label: 'Countries Served' },
  { value: 50, suffix: 'B+', prefix: '$', label: 'Assets Managed' },
  { value: 40, suffix: '+', label: 'Jurisdictions' },
];

// ── Pricing ───────────────────────────────────────────────────
const plans = [
  {
    name: 'Standard',
    tagline: 'For individuals getting started',
    monthlyPrice: 0,
    yearlyPrice: 0,
    highlight: false,
    badge: null,
    color: '#627EEA',
    icon: Wallet,
    features: [
      { label: 'Multi-currency account (10 currencies)', included: true },
      { label: 'Virtual debit card', included: true },
      { label: '5 international transfers / month', included: true },
      { label: 'Crypto wallet (10 assets)', included: true },
      { label: 'Mobile banking app', included: true },
      { label: 'Standard support (48h)', included: true },
      { label: 'Physical metal card', included: false },
      { label: 'Investment portfolio', included: false },
      { label: 'Dedicated manager', included: false },
    ],
    cta: 'Open Free Account',
  },
  {
    name: 'Premium',
    tagline: 'For professionals & frequent traders',
    monthlyPrice: 9,
    yearlyPrice: 7,
    highlight: true,
    badge: 'Most Popular',
    color: '#C9A84C',
    icon: CreditCard,
    features: [
      { label: 'Multi-currency account (50+ currencies)', included: true },
      { label: 'Virtual & physical metal card', included: true },
      { label: 'Unlimited international transfers', included: true },
      { label: 'Crypto wallet (50+ assets)', included: true },
      { label: 'Mobile banking app', included: true },
      { label: 'Priority support 24/7', included: true },
      { label: 'Investment portfolio & analytics', included: true },
      { label: 'Advanced dashboard analytics', included: true },
      { label: 'Dedicated manager', included: false },
    ],
    cta: 'Start Premium',
  },
  {
    name: 'Elite',
    tagline: 'For HNWIs & institutional clients',
    monthlyPrice: 29,
    yearlyPrice: 23,
    highlight: false,
    badge: 'White Glove',
    color: '#9945FF',
    icon: Award,
    features: [
      { label: 'Everything in Premium', included: true },
      { label: 'Dedicated relationship manager', included: true },
      { label: 'Concierge card & travel services', included: true },
      { label: 'Institutional-grade cold custody', included: true },
      { label: 'Custom API access', included: true },
      { label: 'White-glove onboarding', included: true },
      { label: 'Private banking desk', included: true },
      { label: 'Custom reporting & compliance', included: true },
      { label: 'SLA-backed 1h support response', included: true },
    ],
    cta: 'Contact Elite Team',
  },
];

// ── Testimonials ──────────────────────────────────────────────
const testimonials = [
  { name: 'Sarah M.',    role: 'Entrepreneur',       location: 'New York, USA',    avatar: 'S', color: '#C9A84C', rating: 5, text: 'City Gate Capital transformed how I manage international payments. The exchange rates are unbeatable and the interface is stunning. I\'ve saved thousands in fees.' },
  { name: 'David K.',   role: 'Crypto Investor',     location: 'London, UK',       avatar: 'D', color: '#627EEA', rating: 5, text: 'Having both my crypto and fiat in one place is a game changer. The security features give me complete peace of mind. Nothing else comes close.' },
  { name: 'Priya R.',   role: 'Freelancer',          location: 'Singapore',        avatar: 'P', color: '#10B981', rating: 5, text: 'Getting paid from clients worldwide used to be a nightmare. Now it\'s instant and I keep far more of my money. The app is beautiful too.' },
  { name: 'Marcus T.',  role: 'CFO',                 location: 'Dubai, UAE',       avatar: 'M', color: '#9945FF', rating: 5, text: 'The institutional-grade custody and compliance tools are exactly what our treasury team needed. Exceptional platform, exceptional support.' },
  { name: 'Yuki T.',    role: 'Portfolio Manager',   location: 'Tokyo, Japan',     avatar: 'Y', color: '#F7931A', rating: 5, text: 'The analytics dashboard is on par with Bloomberg terminals I\'ve used. Real-time data, clean charts, and everything in one account.' },
  { name: 'Amara O.',   role: 'Business Owner',      location: 'Lagos, Nigeria',   avatar: 'A', color: '#F0D080', rating: 5, text: 'Sending money back home used to cost me 8% in fees. City Gate Capital charges $0.99. That\'s not a small difference — it\'s life-changing.' },
  { name: 'Lena B.',    role: 'Digital Nomad',       location: 'Berlin, Germany',  avatar: 'L', color: '#EC4899', rating: 5, text: 'I live in 6 countries a year. Having one card that works everywhere at real exchange rates is the single best financial decision I\'ve made.' },
  { name: 'James W.',   role: 'Hedge Fund Manager',  location: 'Zurich, Switzerland', avatar: 'J', color: '#14B8A6', rating: 5, text: 'We moved our entire treasury operation to City Gate Capital. The API, the compliance tools, and the dedicated manager make it seamless.' },
];

// ── FAQ ───────────────────────────────────────────────────────
const faqs = [
  { cat: 'Security',  q: 'Is City Gate Capital safe?',                     a: 'Yes. We use 256-bit AES encryption, multi-factor authentication, biometric verification, and air-gapped cold storage for 95% of crypto assets. Fiat deposits are FDIC insured up to $250,000 and we are regulated in 40+ jurisdictions worldwide.' },
  { cat: 'Security',  q: 'What happens if I lose access to my account?',    a: 'We offer multiple account recovery options including backup codes, identity re-verification, and support-assisted recovery. Our 24/7 security team can restore access securely, typically within 1 hour for Premium and Elite customers.' },
  { cat: 'Accounts',  q: 'How quickly can I open an account?',              a: 'Account opening takes under 5 minutes. Our AI-powered KYC verification is usually instant. You can fund your account and start transacting the same day — no branch visits, no paperwork.' },
  { cat: 'Accounts',  q: 'What currencies and crypto do you support?',      a: 'We support 50+ fiat currencies including USD, EUR, GBP, JPY, AUD, CAD, CHF, and 43 more. For crypto we support 50+ assets including BTC, ETH, SOL, USDT, USDC, BNB, ADA, and more. New assets are added regularly.' },
  { cat: 'Pricing',   q: 'Are there monthly fees?',                         a: 'Our Standard account is completely free forever — no monthly fee, no minimum balance. Premium ($9/mo) and Elite ($29/mo) plans unlock unlimited transfers, physical metal cards, investment tools, and priority support.' },
  { cat: 'Pricing',   q: 'Are there hidden fees on transfers?',             a: 'Never. We charge a transparent flat fee from $0.99 per transfer and always use the real mid-market exchange rate — no spread markup. You see the exact cost before you confirm every transaction.' },
  { cat: 'Transfers', q: 'How do international transfers work?',            a: 'Enter the amount, select the destination currency and recipient. We show you the exact rate and fee upfront. Most transfers arrive within seconds to minutes; some corridors may take up to 1 business day depending on the destination bank.' },
  { cat: 'Transfers', q: 'Can I schedule or automate recurring transfers?', a: 'Yes. Premium and Elite customers can set up recurring transfers on a daily, weekly, or monthly schedule. You can also set target exchange rates and we\'ll auto-execute when the market hits your price.' },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      className="border border-primary/10 rounded-2xl overflow-hidden hover:border-primary/20 transition-colors bg-white/[0.02]"
      layout
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left group"
      >
        <span className="font-medium text-foreground text-sm pr-4 group-hover:text-primary transition-colors">{q}</span>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${open ? 'bg-primary text-black rotate-180' : 'bg-primary/10 text-primary'}`}>
          <ChevronDown size={14} />
        </div>
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="px-6 pb-5"
        >
          <p className="text-sm text-foreground/50 leading-relaxed">{a}</p>
        </motion.div>
      )}
    </motion.div>
  );
}

function FaqSection() {
  const cats = ['All', 'Security', 'Accounts', 'Pricing', 'Transfers'] as const;
  const [active, setActive] = useState<string>('All');
  const filtered = active === 'All' ? faqs : faqs.filter(f => f.cat === active);
  return (
    <>
      {/* Category tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {cats.map(cat => (
          <button
            key={cat}
            onClick={() => setActive(cat)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              active === cat
                ? 'bg-primary text-black'
                : 'bg-white/5 text-foreground/50 border border-primary/10 hover:border-primary/25 hover:text-foreground/70'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Two-column accordion */}
      <div className="grid md:grid-cols-2 gap-3 max-w-5xl mx-auto">
        {filtered.map((faq, i) => (
          <motion.div
            key={faq.q}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <FaqItem q={faq.q} a={faq.a} />
          </motion.div>
        ))}
      </div>
    </>
  );
}

// ── Dashboard card mock ───────────────────────────────────────
const chartBars = [28, 45, 35, 60, 48, 72, 55, 80, 65, 88, 70, 95];

// ── Pricing sub-components ────────────────────────────────────
function PricingSection() {
  const [yearly, setYearly] = useState(false);
  return (
    <>
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-12">
        <span className={`text-sm transition-colors ${!yearly ? 'text-foreground font-semibold' : 'text-foreground/40'}`}>Monthly</span>
        <button
          onClick={() => setYearly(v => !v)}
          className={`relative w-12 h-6 rounded-full transition-colors ${yearly ? 'bg-primary' : 'bg-white/10'}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${yearly ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
        <span className={`text-sm transition-colors ${yearly ? 'text-foreground font-semibold' : 'text-foreground/40'}`}>
          Yearly
          <span className="ml-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">Save 20%</span>
        </span>
      </div>

      {/* Plan cards */}
      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan, i) => {
          const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
          return (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-3xl p-7 flex flex-col ${plan.highlight
                ? 'bg-gradient-to-b from-primary/15 to-primary/5 border border-primary/40'
                : 'glass-card gradient-border'
              }`}
              style={plan.highlight ? { boxShadow: 'var(--gold-glow)' } : {}}
            >
              {plan.badge && (
                <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold ${plan.highlight ? 'text-black' : 'text-white'}`}
                  style={{ background: plan.highlight ? 'linear-gradient(135deg, #C9A84C, #F0D080)' : `${plan.color}CC` }}>
                  {plan.badge}
                </div>
              )}
              <div className="flex items-start mb-5">
                <div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: `${plan.color}18` }}>
                    <plan.icon size={18} style={{ color: plan.color }} />
                  </div>
                  <p className="text-xs text-foreground/40 uppercase tracking-widest mb-1">{plan.name}</p>
                  <p className="text-xs text-foreground/35 leading-snug">{plan.tagline}</p>
                </div>
              </div>
              <div className="mb-6">
                <div className="flex items-end gap-1">
                  {price === 0 ? (
                    <span className="text-4xl font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>Free</span>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>${price}</span>
                      <span className="text-foreground/40 mb-1.5 text-sm">/mo</span>
                    </>
                  )}
                </div>
                {yearly && price > 0 && (
                  <p className="text-xs text-emerald-400 mt-1">Billed ${price * 12}/yr · Save ${(plan.monthlyPrice - price) * 12}/yr</p>
                )}
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f.label} className={`flex items-start gap-2.5 text-xs ${f.included ? 'text-foreground/65' : 'text-foreground/25 line-through'}`}>
                    <CheckCircle size={13} className={`shrink-0 mt-0.5 ${f.included ? 'text-primary' : 'text-foreground/20'}`} />
                    {f.label}
                  </li>
                ))}
              </ul>
              <Link
                to="/accounts"
                className={`block text-center py-3.5 rounded-xl text-sm font-bold transition-all ${plan.highlight
                  ? 'bg-gradient-to-r from-primary to-[#F0D080] text-black hover:opacity-90'
                  : 'glass border border-primary/20 text-foreground hover:border-primary/40'
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}




export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const location = useLocation();

  // A/B test: hero CTA copy
  // control  → "Open Free Account"
  // urgency  → "Start Banking Today"
  // benefit  → "Get $0 Fees Forever"
  const heroCTA = useABTest(
    'hero-cta-copy',
    ['control', 'urgency', 'benefit'] as const,
    location.pathname
  );
  const heroCTALabels: Record<string, string> = {
    control: 'Open Free Account',
    urgency: 'Start Banking Today',
    benefit: 'Get $0 Fees Forever',
  };

  return (
    <>
      <Helmet>
        <title>City Gate Capital — Secure Digital Banking</title>
        <meta name="description" content="City Gate Capital offers premium digital banking, crypto & fiat wallets, international transfers, and smart cards. Join 2M+ customers in 180+ countries. Open your account in minutes." />
        <link rel="canonical" href="https://citygate.capital/" />
        <meta property="og:title" content="City Gate Capital — Secure Digital Banking for the Modern World" />
        <meta property="og:description" content="Multi-currency wallets, crypto exchange, international transfers, and smart cards — all in one premium platform. Join 2M+ customers." />
        <meta property="og:url" content="https://citygate.capital/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={(() => { const u = new URL('/api/og', 'https://citygate.capital'); u.searchParams.set('title', 'City Gate Capital'); u.searchParams.set('description', 'Secure Digital Banking for the Modern World'); return u.href; })()} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content="City Gate Capital — Secure Digital Banking for the Modern World" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:creator" content="@CityGateCapital" />
        <meta name="twitter:title" content="City Gate Capital — Secure Digital Banking" />
        <meta name="twitter:description" content="Multi-currency wallets, crypto exchange, international transfers, and smart cards — all in one premium platform." />
        <meta name="twitter:image" content={(() => { const u = new URL('/api/og', 'https://citygate.capital'); u.searchParams.set('title', 'City Gate Capital'); u.searchParams.set('description', 'Secure Digital Banking for the Modern World'); return u.href; })()} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'City Gate Capital',
          url: 'https://citygate.capital',
          logo: 'https://citygate.capital/assets/IMG-20260519-WA0000.jpg',
          description: 'Premium digital banking with multi-currency wallets, crypto exchange, international transfers, and smart cards.',
          foundingDate: '2018',
          foundingLocation: 'London, UK',
          areaServed: 'Worldwide',
          numberOfEmployees: { '@type': 'QuantitativeValue', value: 500 },
          sameAs: [
            'https://twitter.com/CityGateCapital',
            'https://linkedin.com/company/citygatecapital',
            'https://instagram.com/citygatecapital',
          ],
          contactPoint: [
            {
              '@type': 'ContactPoint',
              telephone: '+447888382458',
              contactType: 'customer service',
              email: 'support@citygate.capital',
              availableLanguage: 'English',
            },
            {
              '@type': 'ContactPoint',
              contactType: 'general inquiry',
              email: 'info@citygate.capital',
              availableLanguage: 'English',
            },
          ],
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'City Gate Capital',
          url: 'https://citygate.capital',
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: 'https://citygate.capital/support?q={search_term_string}' },
            'query-input': 'required name=search_term_string',
          },
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FinancialService',
          name: 'City Gate Capital',
          url: 'https://citygate.capital',
          description: 'Premium digital banking, crypto wallets, and international transfers for global citizens.',
          serviceType: 'Digital Banking',
          areaServed: 'Worldwide',
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: 'Banking Plans',
            itemListElement: [
              { '@type': 'Offer', name: 'Standard Account', price: '0', priceCurrency: 'USD' },
              { '@type': 'Offer', name: 'Premium Account', price: '9', priceCurrency: 'USD' },
              { '@type': 'Offer', name: 'Elite Account', price: '29', priceCurrency: 'USD' },
            ],
          },
        })}</script>
      </Helmet>

      {/* ── Live Ticker ─────────────────────────────────────── */}
      <div className="relative z-10 bg-[#060606] border-b border-primary/10 overflow-hidden py-2.5 mt-[72px]" suppressHydrationWarning>
        <div className="flex gap-10 whitespace-nowrap" style={{ animation: 'ticker 40s linear infinite' }} suppressHydrationWarning>
          {[...tickers, ...tickers].map((t, i) => (
            <span key={i} className="inline-flex items-center gap-2.5 text-xs shrink-0">
              <span className="text-foreground/40 font-medium tracking-wide">{t.symbol}</span>
              <span className={`font-medium ${t.up ? 'text-emerald-400' : 'text-red-400'}`} suppressHydrationWarning>{t.change}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background image with parallax */}
        <motion.div style={{ y: heroY }} className="absolute inset-0 scale-110">
          <img
            src="/airo-assets/images/pages/home/hero"
            alt=""
            width={1920}
            height={1080}
            fetchPriority="high"
            className="w-full h-full object-cover opacity-25"
          />
        </motion.div>

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-[#0A0A0A]/90 to-[#0A0A0A]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent" />

        {/* Gold orb glow */}
        <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] rounded-full opacity-10 blur-[120px]"
          style={{ background: 'radial-gradient(circle, #C9A84C 0%, transparent 70%)' }} />

        <motion.div style={{ opacity: heroOpacity }} className="container mx-auto px-4 md:px-6 relative z-10 py-32 pt-40">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Copy */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-gold-glow mb-8">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold text-foreground/70 tracking-widest uppercase">Trusted by 2M+ customers worldwide</span>
                </div>

                <h1 className="text-5xl md:text-6xl xl:text-7xl font-bold text-foreground mb-6 leading-[1.05] tracking-tight">
                  The Future of{' '}
                  <span className="text-gold-shimmer">Banking</span>{' '}
                  is Here
                </h1>

                <p className="text-lg text-foreground/50 mb-10 leading-relaxed max-w-lg">
                  Multi-currency wallets, crypto exchange, international transfers, and smart cards — all in one premium platform built for global citizens.
                </p>

                <div className="flex flex-wrap gap-4 mb-12">
                  <Link
                    to="/accounts"
                    onClick={() => {
                      heroCTA.convert({ source: 'hero_cta' });
                      trackConversion('signup_started', location.pathname, { source: 'hero_cta', ab_variant: heroCTA.variant });
                    }}
                    className="group relative inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-bold text-black overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary via-[#F0D080] to-primary bg-[length:200%] transition-all duration-500 group-hover:bg-right-center" />
                    <span className="relative">{heroCTALabels[heroCTA.variant]}</span>
                    <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link to="/digital-banking" className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-medium text-foreground/70 glass border-gold-glow hover:text-foreground transition-colors">
                    Explore Features
                  </Link>
                </div>

                {/* Trust badges */}
                <div className="flex flex-wrap gap-5">
                  {[
                    { icon: Shield, label: 'FDIC Insured' },
                    { icon: Lock, label: '256-bit Encryption' },
                    { icon: Award, label: 'ISO 27001' },
                  ].map((b) => (
                    <div key={b.label} className="flex items-center gap-2 text-foreground/40">
                      <b.icon size={14} className="text-primary" />
                      <span className="text-xs font-medium">{b.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Right: Dashboard card */}
            <motion.div
              initial={{ opacity: 0, x: 40, rotateY: -10 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease: 'easeOut' }}
              className="hidden lg:block"
            >
              <div className="relative">
                {/* Main dashboard card */}
                <div className="glass-card rounded-3xl p-6 gradient-border shadow-2xl" style={{ boxShadow: 'var(--gold-glow)' }}>
                  {/* Card header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs text-foreground/40 mb-1 uppercase tracking-widest">Total Portfolio</p>
                      <p className="text-3xl font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>$46,373.75</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <TrendingUp size={12} className="text-emerald-400" />
                        <span className="text-xs text-emerald-400 font-medium">+$1,240.50 (2.75%) today</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Wallet size={22} className="text-primary" />
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="flex items-end gap-1.5 h-20 mb-6">
                    {chartBars.map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ delay: 0.5 + i * 0.05, duration: 0.5, ease: 'easeOut' }}
                        className="flex-1 rounded-t-sm"
                        style={{
                          background: i === chartBars.length - 1
                            ? 'linear-gradient(to top, #C9A84C, #F0D080)'
                            : 'rgba(201,168,76,0.2)'
                        }}
                      />
                    ))}
                  </div>

                  {/* Asset breakdown */}
                  <div className="space-y-3">
                    {[
                      { label: 'Bitcoin', symbol: 'BTC', value: '$28,420', pct: '61%', color: '#F7931A' },
                      { label: 'Ethereum', symbol: 'ETH', value: '$11,520', pct: '25%', color: '#627EEA' },
                      { label: 'USD Balance', symbol: 'USD', value: '$6,433', pct: '14%', color: '#C9A84C' },
                    ].map((a) => (
                      <div key={a.symbol} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: `${a.color}20`, color: a.color }}>
                          {a.symbol[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-foreground/60">{a.label}</span>
                            <span className="text-foreground font-medium">{a.value}</span>
                          </div>
                          <div className="h-1 rounded-full bg-white/5">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: a.pct }}
                              transition={{ delay: 0.8, duration: 0.8, ease: 'easeOut' }}
                              className="h-full rounded-full"
                              style={{ background: a.color }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating notification cards */}
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -top-6 -right-6 glass-card rounded-2xl px-4 py-3 border-gold-glow"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-400/10 flex items-center justify-center">
                      <ArrowRight size={14} className="text-emerald-400 rotate-[-45deg]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">Payment Received</p>
                      <p className="text-xs text-emerald-400">+$2,400.00</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  className="absolute -bottom-4 -left-6 glass-card rounded-2xl px-4 py-3 border-gold-glow"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield size={14} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">Secured & Verified</p>
                      <p className="text-xs text-foreground/40">KYC Complete</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-xs text-foreground/30 tracking-widest uppercase">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-primary/40 to-transparent" />
        </motion.div>
      </section>

      {/* ── Stats / Trust Bar ───────────────────────────────── */}
      <section className="border-y border-primary/10 bg-[#060606]">
        {/* Animated counters */}
        <div className="container mx-auto px-4 md:px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <p className="text-3xl md:text-4xl font-bold text-gold-gradient mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
                  <Counter target={s.value} suffix={s.suffix} prefix={s.prefix} />
                </p>
                <p className="text-xs text-foreground/40 uppercase tracking-widest">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <div className="border-t border-primary/8">
          <div className="container mx-auto px-4 md:px-6 py-5">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {[
                { icon: Shield, label: 'FDIC Insured' },
                { icon: Lock, label: '256-bit Encryption' },
                { icon: Fingerprint, label: 'Biometric Auth' },
                { icon: Award, label: 'Regulated in 40+ Jurisdictions' },
                { icon: CheckCircle, label: 'SOC 2 Type II Certified' },
              ].map((badge, i) => (
                <motion.div
                  key={badge.label}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="flex items-center gap-2 text-foreground/35 hover:text-foreground/55 transition-colors"
                >
                  <badge.icon size={13} className="text-primary/60 shrink-0" />
                  <span className="text-xs font-medium tracking-wide whitespace-nowrap">{badge.label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ───────────────────────────────────── */}
      <section className="py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                Platform Features
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
                Everything You Need to<br />
                <span className="text-gold-gradient">Bank Smarter</span>
              </h2>
              <p className="text-foreground/50 max-w-xl mx-auto leading-relaxed">
                One platform for all your financial needs — from everyday spending to global investments and crypto.
              </p>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                whileHover={{ y: -4 }}
                className="group glass-card rounded-2xl p-7 gradient-border cursor-default transition-all duration-300 hover:shadow-xl"
                style={{ '--hover-shadow': 'var(--gold-glow)' } as React.CSSProperties}
              >
                <div className="w-12 h-12 rounded-xl mb-5 flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                  style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05))' }}>
                  <f.icon size={22} className="text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2" style={{ fontFamily: 'var(--font-heading)' }}>{f.title}</h3>
                <p className="text-sm text-foreground/50 leading-relaxed">{f.desc}</p>
                <div className="mt-5 flex items-center gap-1.5 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn more <ArrowRight size={12} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dashboard Analytics Preview ─────────────────────── */}
      <section className="py-28 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">

          {/* Header */}
          <div className="text-center mb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                Smart Dashboard
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
                Your Finances,<br />
                <span className="text-gold-gradient">Beautifully Clear</span>
              </h2>
              <p className="text-foreground/50 max-w-xl mx-auto leading-relaxed">
                A real-time dashboard gives you a complete picture of your financial health — balances, spending trends, crypto portfolio, and upcoming payments.
              </p>
            </motion.div>
          </div>

          {/* Dashboard mock — full width */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="glass-card rounded-3xl p-6 md:p-8 gradient-border"
            style={{ boxShadow: 'var(--gold-glow)' }}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs text-foreground/40 uppercase tracking-widest mb-0.5">Good morning, Alex</p>
                <p className="text-sm font-semibold text-foreground">Here's your financial overview</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-foreground/40">Live</span>
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Total Balance',  value: '$46,373', trend: '+2.75%', up: true },
                { label: 'Monthly Spend',  value: '$3,240',  trend: '-8.2%',  up: false },
                { label: 'Crypto Value',   value: '$39,940', trend: '+5.1%',  up: true },
                { label: 'Savings Rate',   value: '28.4%',   trend: '+3.2%',  up: true },
              ].map((c, i) => (
                <motion.div
                  key={c.label}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.07 }}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-primary/10 hover:border-primary/20 transition-colors"
                >
                  <p className="text-xs text-foreground/40 mb-1.5 uppercase tracking-wide">{c.label}</p>
                  <p className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: 'var(--font-heading)' }}>{c.value}</p>
                  <div className={`flex items-center gap-1 text-xs ${c.up ? 'text-emerald-400' : 'text-red-400'}`}>
                    <TrendingUp size={10} className={c.up ? '' : 'rotate-180'} />
                    <span>{c.trend} this month</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Middle row: chart + allocation + transactions */}
            <div className="grid md:grid-cols-5 gap-4 mb-4">

              {/* Bar chart — 3 cols */}
              <div className="md:col-span-3 p-5 rounded-2xl bg-white/[0.02] border border-primary/10">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-foreground">Portfolio Performance</p>
                  <div className="flex gap-1">
                    {['1M','3M','1Y'].map((t, i) => (
                      <button key={t} className={`text-[10px] px-2 py-0.5 rounded-md transition-colors ${i === 2 ? 'bg-primary/20 text-primary' : 'text-foreground/30 hover:text-foreground/60'}`}>{t}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end gap-1 h-24">
                  {[40,55,45,70,58,82,65,90,72,95,80,100].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.5, ease: 'easeOut' as const }}
                      className="flex-1 rounded-t relative group/bar cursor-pointer"
                      style={{ background: i >= 10 ? 'linear-gradient(to top, #C9A84C, #F0D080)' : 'rgba(201,168,76,0.15)' }}
                    >
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-primary text-black text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        <span suppressHydrationWarning>${(h * 463).toLocaleString()}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="flex justify-between mt-2">
                  {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
                    <span key={m} className="text-[9px] text-foreground/20 flex-1 text-center">{m}</span>
                  ))}
                </div>
              </div>

              {/* Allocation — 2 cols */}
              <div className="md:col-span-2 p-5 rounded-2xl bg-white/[0.02] border border-primary/10">
                <p className="text-xs font-semibold text-foreground mb-4">Asset Allocation</p>
                <div className="space-y-3">
                  {[
                    { label: 'Crypto',    pct: 45, color: '#C9A84C' },
                    { label: 'Fiat',      pct: 28, color: '#627EEA' },
                    { label: 'Stocks',    pct: 18, color: '#10B981' },
                    { label: 'Cash',      pct: 9,  color: '#9945FF' },
                  ].map((a, i) => (
                    <div key={a.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-foreground/60">{a.label}</span>
                        <span className="font-semibold text-foreground">{a.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${a.pct}%` }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.4 + i * 0.08, duration: 0.7 }}
                          className="h-full rounded-full"
                          style={{ background: a.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Spending categories */}
                <p className="text-xs font-semibold text-foreground mt-5 mb-3">Top Spending</p>
                <div className="space-y-2">
                  {[
                    { label: 'Travel',    amount: '$840', icon: Globe },
                    { label: 'Dining',    amount: '$420', icon: CreditCard },
                    { label: 'Shopping',  amount: '$380', icon: Wallet },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <s.icon size={11} className="text-primary" />
                      </div>
                      <span className="text-xs text-foreground/50 flex-1">{s.label}</span>
                      <span className="text-xs font-semibold text-foreground">{s.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent transactions row */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-primary/10">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-foreground">Recent Transactions</p>
                <Link to="/digital-banking" className="text-xs text-primary hover:text-primary/70 transition-colors flex items-center gap-1">
                  View all <ArrowRight size={11} />
                </Link>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  { label: 'BTC Purchase',    amount: '-$1,200', icon: Bitcoin,     color: '#F7931A', time: '2m ago',  sub: 'Crypto' },
                  { label: 'Wire from Client', amount: '+$4,500', icon: Send,        color: '#10B981', time: '1h ago',  sub: 'Incoming' },
                  { label: 'Card Payment',     amount: '-$84.50', icon: CreditCard,  color: '#C9A84C', time: '3h ago',  sub: 'Shopping' },
                ].map(tx => (
                  <div key={tx.label} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${tx.color}15` }}>
                      <tx.icon size={15} style={{ color: tx.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{tx.label}</p>
                      <p className="text-xs text-foreground/30">{tx.sub} · {tx.time}</p>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${tx.amount.startsWith('+') ? 'text-emerald-400' : 'text-foreground/60'}`}>
                      {tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Feature bullets below */}
          <div className="grid md:grid-cols-5 gap-4 mt-8">
            {[
              { icon: BarChart3, label: 'Real-time analytics' },
              { icon: PieChart,  label: 'Portfolio breakdown' },
              { icon: Bell,      label: 'Smart alerts' },
              { icon: Eye,       label: 'Net worth view' },
              { icon: Layers,    label: 'Multi-account' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="flex items-center gap-3 p-4 glass-card rounded-2xl gradient-border"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon size={15} className="text-primary" />
                </div>
                <span className="text-xs font-medium text-foreground/60">{item.label}</span>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* ── International Transfers ──────────────────────────── */}
      <section className="py-28 relative overflow-hidden">
        <div className="absolute inset-0">
          <img src="/airo-assets/images/pages/home/global-transfers" alt="" width={1200} height={800} loading="lazy" className="w-full h-full object-cover opacity-[0.08]" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A0A0A] via-[#0A0A0A]/95 to-[#0A0A0A]" />
        </div>
        <div className="container mx-auto px-4 md:px-6 relative">

          {/* Header */}
          <div className="text-center mb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                International Transfers
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
                Send Money Anywhere<br />
                <span className="text-gold-gradient">In Seconds</span>
              </h2>
              <p className="text-foreground/50 max-w-xl mx-auto leading-relaxed">
                Transfer to 180+ countries at real mid-market rates. Transparent fees from $0.99, instant settlement, and full tracking from send to delivery.
              </p>
            </motion.div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">

            {/* Left: transfer flow mock */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="space-y-4"
            >
              {/* Transfer card */}
              <div className="glass-card rounded-3xl p-6 gradient-border" style={{ boxShadow: 'var(--gold-glow)' }}>
                <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-5">New Transfer</p>

                {/* You send */}
                <div className="mb-3">
                  <p className="text-xs text-foreground/40 uppercase tracking-wide mb-2">You Send</p>
                  <div className="flex gap-3">
                    <div className="flex-1 bg-white/[0.04] border border-primary/15 rounded-xl px-4 py-3 text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>
                      1,000
                    </div>
                    <div className="flex items-center gap-2 bg-white/[0.04] border border-primary/15 rounded-xl px-4 py-3">
                      <span className="text-base">🇺🇸</span>
                      <span className="text-sm font-semibold text-foreground">USD</span>
                    </div>
                  </div>
                </div>

                {/* Exchange indicator */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-primary/10" />
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                    <RefreshCw size={11} className="text-primary" />
                    <span className="text-xs text-primary font-medium">1 USD = 0.9210 EUR</span>
                  </div>
                  <div className="flex-1 h-px bg-primary/10" />
                </div>

                {/* Recipient gets */}
                <div className="mb-5">
                  <p className="text-xs text-foreground/40 uppercase tracking-wide mb-2">Recipient Gets</p>
                  <div className="flex gap-3">
                    <div className="flex-1 bg-white/[0.04] border border-primary/20 rounded-xl px-4 py-3 text-2xl font-bold text-gold-gradient" style={{ fontFamily: 'var(--font-heading)' }}>
                      920.10
                    </div>
                    <div className="flex items-center gap-2 bg-white/[0.04] border border-primary/15 rounded-xl px-4 py-3">
                      <span className="text-base">🇪🇺</span>
                      <span className="text-sm font-semibold text-foreground">EUR</span>
                    </div>
                  </div>
                </div>

                {/* Fee breakdown */}
                <div className="space-y-2 p-4 rounded-xl bg-white/[0.02] border border-primary/8 mb-5">
                  {[
                    { label: 'Transfer fee',    value: '$0.99',   highlight: false },
                    { label: 'Exchange rate',   value: '0.9210',  highlight: false },
                    { label: 'Arrival',         value: 'Instant', highlight: true  },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between text-xs">
                      <span className="text-foreground/40">{row.label}</span>
                      <span className={row.highlight ? 'text-emerald-400 font-semibold' : 'text-foreground/70'}>{row.value}</span>
                    </div>
                  ))}
                </div>

                <Link to="/transfers" className="group relative flex items-center justify-center gap-2.5 py-4 rounded-xl font-bold text-black overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                  <Send size={15} className="relative" />
                  <span className="relative">Send Now</span>
                  <ArrowRight size={15} className="relative transition-transform group-hover:translate-x-1" />
                </Link>
              </div>

              {/* Live transfer status */}
              <div className="glass-card rounded-2xl p-5 gradient-border">
                <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-4">Recent Transfer</p>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-emerald-400/10 flex items-center justify-center shrink-0">
                    <CheckCircle size={16} className="text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">$2,400 → £1,890 GBP</p>
                    <p className="text-xs text-foreground/40">To James W. · London, UK</p>
                  </div>
                  <span className="text-xs text-emerald-400 font-semibold bg-emerald-400/10 px-2 py-1 rounded-full">Delivered</span>
                </div>
                {/* Progress steps */}
                <div className="flex items-center gap-1">
                  {['Initiated', 'Processing', 'Sent', 'Delivered'].map((step, i) => (
                    <div key={step} className="flex items-center gap-1 flex-1">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${i <= 3 ? 'bg-emerald-400 text-black' : 'bg-white/10 text-foreground/30'}`}>
                        {i + 1}
                      </div>
                      {i < 3 && <div className={`flex-1 h-0.5 rounded-full ${i < 3 ? 'bg-emerald-400/40' : 'bg-white/10'}`} />}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  {['Initiated', 'Processing', 'Sent', 'Delivered'].map(step => (
                    <span key={step} className="text-[9px] text-foreground/25 flex-1 text-center first:text-left last:text-right">{step}</span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Right: corridors + features */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.15 }}
            >
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { value: '180+', label: 'Countries' },
                  { value: '$0.99', label: 'From' },
                  { value: '<1min', label: 'Avg. Speed' },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.08 }}
                    className="glass-card rounded-2xl p-4 text-center gradient-border"
                  >
                    <p className="text-2xl font-bold text-gold-gradient mb-1" style={{ fontFamily: 'var(--font-heading)' }}>{s.value}</p>
                    <p className="text-xs text-foreground/40 uppercase tracking-wide">{s.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Popular corridors */}
              <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-3">Popular Corridors</p>
              <div className="space-y-2 mb-6">
                {[
                  { from: '🇺🇸 USD', to: '🇬🇧 GBP', fee: '$0.99', time: 'Instant', rate: '0.7890' },
                  { from: '🇺🇸 USD', to: '🇪🇺 EUR', fee: '$0.99', time: 'Instant', rate: '0.9210' },
                  { from: '🇬🇧 GBP', to: '🇮🇳 INR', fee: '$1.49', time: '< 1 min', rate: '107.2' },
                  { from: '🇺🇸 USD', to: '🇦🇪 AED', fee: '$1.99', time: '< 5 min', rate: '3.6725' },
                ].map((c, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.07 }}
                    className="flex items-center gap-3 p-3.5 glass-card rounded-xl gradient-border hover:border-primary/25 transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground/70 w-20 shrink-0">{c.from}</span>
                    <ArrowRight size={12} className="text-primary shrink-0" />
                    <span className="text-sm font-medium text-foreground/70 flex-1">{c.to}</span>
                    <span className="text-xs text-primary font-semibold">{c.fee}</span>
                    <span className="text-xs text-emerald-400 w-14 text-right">{c.time}</span>
                  </motion.div>
                ))}
              </div>

              {/* Feature bullets */}
              <div className="space-y-3">
                {[
                  { icon: Shield,   title: 'Bank-grade security',     desc: 'Every transfer is encrypted and monitored for fraud in real time.' },
                  { icon: Globe,    title: '50+ currencies supported', desc: 'Send in the local currency — no double conversion, no extra fees.' },
                  { icon: Bell,     title: 'Real-time notifications',  desc: 'Push alerts the moment your transfer is initiated, sent, and delivered.' },
                  { icon: Layers,   title: 'Batch & scheduled sends',  desc: 'Send to multiple recipients at once or schedule recurring transfers.' },
                ].map((item, i) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.07 }}
                    className="flex items-start gap-3 p-4 glass-card rounded-xl gradient-border hover:border-primary/20 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <item.icon size={14} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-0.5">{item.title}</p>
                      <p className="text-xs text-foreground/40 leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── Crypto Section ───────────────────────────────────── */}
      <section className="py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left: live market table */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              {/* Section label */}
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-6 tracking-widest uppercase">
                Crypto Exchange
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight leading-tight">
                Buy, Sell & Hold<br />
                <span className="text-gold-gradient">50+ Cryptocurrencies</span>
              </h2>
              <p className="text-foreground/50 leading-relaxed mb-10 max-w-lg">
                Trade crypto at real market prices with zero commission. Instant settlement, cold-storage security, and a portfolio dashboard that keeps you in control.
              </p>

              {/* Crypto asset rows */}
              <div className="space-y-3">
                {[
                  { name: 'Bitcoin',  symbol: 'BTC', price: '$67,420', change: '+3.2%', up: true,  color: '#F7931A', bar: 72 },
                  { name: 'Ethereum', symbol: 'ETH', price: '$3,840',  change: '+1.8%', up: true,  color: '#627EEA', bar: 55 },
                  { name: 'Solana',   symbol: 'SOL', price: '$182.50', change: '-0.9%', up: false, color: '#9945FF', bar: 38 },
                  { name: 'USDT',     symbol: 'USDT',price: '$1.00',   change: '0.0%',  up: true,  color: '#26A17B', bar: 20 },
                  { name: 'BNB',      symbol: 'BNB', price: '$598',    change: '+2.1%', up: true,  color: '#F3BA2F', bar: 30 },
                ].map((asset, i) => (
                  <motion.div
                    key={asset.symbol}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.07 }}
                    className="glass-card rounded-2xl px-5 py-4 gradient-border flex items-center gap-4 hover:border-primary/25 transition-colors group"
                  >
                    {/* Coin dot */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: `${asset.color}20`, color: asset.color }}>
                      {asset.symbol[0]}
                    </div>

                    {/* Name */}
                    <div className="w-24 shrink-0">
                      <p className="text-sm font-semibold text-foreground">{asset.name}</p>
                      <p className="text-xs text-foreground/35">{asset.symbol}</p>
                    </div>

                    {/* Mini bar */}
                    <div className="flex-1 h-1.5 rounded-full bg-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${asset.bar}%` }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.4 + i * 0.07, duration: 0.8 }}
                        className="h-full rounded-full"
                        style={{ background: asset.color }}
                      />
                    </div>

                    {/* Price + change */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-foreground">{asset.price}</p>
                      <p className={`text-xs font-medium flex items-center justify-end gap-0.5 ${asset.up ? 'text-emerald-400' : 'text-red-400'}`}>
                        {asset.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {asset.change}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Right: feature highlights */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="space-y-5"
            >
              {[
                {
                  icon: Zap,
                  title: 'Instant Settlement',
                  desc: 'Trades execute in milliseconds. Your balance updates in real time — no waiting, no delays.',
                  color: '#F7931A',
                },
                {
                  icon: Lock,
                  title: 'Cold Storage Security',
                  desc: '95% of crypto assets held in air-gapped cold storage vaults, never connected to the internet.',
                  color: '#627EEA',
                },
                {
                  icon: PieChart,
                  title: 'Portfolio Analytics',
                  desc: 'Track performance, allocation, and P&L across all your crypto holdings in one dashboard.',
                  color: '#9945FF',
                },
                {
                  icon: RefreshCw,
                  title: 'Auto-Rebalancing',
                  desc: 'Set target allocations and let City Gate Capital automatically rebalance your crypto portfolio.',
                  color: '#26A17B',
                },
                {
                  icon: Shield,
                  title: 'Zero Commission',
                  desc: 'No trading fees. We earn on the spread — always transparent, always disclosed upfront.',
                  color: '#C9A84C',
                },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className="flex items-start gap-4 p-5 glass-card rounded-2xl gradient-border hover:border-primary/25 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                    style={{ background: `${item.color}15` }}>
                    <item.icon size={18} style={{ color: item.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">{item.title}</p>
                    <p className="text-xs text-foreground/50 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}

              <Link
                to="/wallet"
                className="group relative inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-bold text-black overflow-hidden mt-2"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                <Bitcoin size={16} className="relative" />
                <span className="relative">Explore Crypto Wallet</span>
                <ArrowRight size={16} className="relative transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── Multi-Currency Wallet ────────────────────────────── */}
      <section className="py-28 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">

          {/* Header */}
          <div className="text-center mb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                Multi-Currency Wallet
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
                One Wallet,<br />
                <span className="text-gold-gradient">Every Currency</span>
              </h2>
              <p className="text-foreground/50 max-w-xl mx-auto leading-relaxed">
                Hold, exchange, and spend in 50+ fiat currencies and 50+ cryptocurrencies — all from a single account with real mid-market rates.
              </p>
            </motion.div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">

            {/* Left: wallet UI mock */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              {/* Wallet card */}
              <div className="glass-card rounded-3xl p-6 gradient-border mb-4" style={{ boxShadow: 'var(--gold-glow)' }}>
                {/* Card header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs text-foreground/40 uppercase tracking-widest mb-0.5">Total Wallet Balance</p>
                    <p className="text-3xl font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>$86,313</p>
                    <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                      <TrendingUp size={10} /> +$2,140 today
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Wallet size={22} className="text-primary" />
                  </div>
                </div>

                {/* Currency balances */}
                <div className="space-y-2.5 mb-5">
                  {[
                    { flag: '🇺🇸', currency: 'USD', name: 'US Dollar',    balance: '$42,500', converted: '$42,500', color: '#10B981', pct: 49 },
                    { flag: '🇪🇺', currency: 'EUR', name: 'Euro',          balance: '€18,200', converted: '$19,800', color: '#627EEA', pct: 23 },
                    { flag: '₿',   currency: 'BTC', name: 'Bitcoin',       balance: '0.182 BTC', converted: '$12,270', color: '#F7931A', pct: 14 },
                    { flag: '🇬🇧', currency: 'GBP', name: 'British Pound', balance: '£7,400',  converted: '$9,360',  color: '#C9A84C', pct: 11 },
                    { flag: 'Ξ',   currency: 'ETH', name: 'Ethereum',      balance: '0.63 ETH', converted: '$2,383', color: '#9945FF', pct: 3  },
                  ].map((c, i) => (
                    <motion.div
                      key={c.currency}
                      initial={{ opacity: 0, x: -12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.1 + i * 0.07 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-primary/8 hover:border-primary/20 transition-colors group cursor-pointer"
                    >
                      {/* Flag / symbol */}
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ background: `${c.color}18`, color: c.color }}>
                        {c.flag}
                      </div>
                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-foreground">{c.currency}</p>
                          <p className="text-xs font-semibold text-foreground">{c.balance}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 h-1 rounded-full bg-white/5 mr-3">
                            <motion.div
                              initial={{ width: 0 }}
                              whileInView={{ width: `${c.pct}%` }}
                              viewport={{ once: true }}
                              transition={{ delay: 0.3 + i * 0.07, duration: 0.6 }}
                              className="h-full rounded-full"
                              style={{ background: c.color }}
                            />
                          </div>
                          <p className="text-xs text-foreground/35 shrink-0">{c.converted}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: ArrowRight, label: 'Send' },
                    { icon: RefreshCw,  label: 'Exchange' },
                    { icon: CreditCard, label: 'Top Up' },
                  ].map(btn => (
                    <button key={btn.label} className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-primary/8 hover:bg-primary/15 transition-colors group">
                      <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                        <btn.icon size={13} className="text-primary" />
                      </div>
                      <span className="text-xs text-foreground/50 group-hover:text-foreground/70 transition-colors">{btn.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Exchange rate mini card */}
              <div className="glass-card rounded-2xl p-4 gradient-border flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <RefreshCw size={15} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-foreground/40 mb-0.5">Live Exchange Rate</p>
                  <p className="text-sm font-semibold text-foreground">1 USD = 0.9210 EUR</p>
                </div>
                <span className="text-xs text-emerald-400 font-medium">Real rate</span>
              </div>
            </motion.div>

            {/* Right: feature list */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="space-y-4"
            >
              {[
                {
                  title: '50+ Fiat Currencies',
                  desc: 'Hold and spend in USD, EUR, GBP, JPY, AUD, CAD, CHF, and 43 more. Switch between currencies instantly at real rates.',
                  color: '#10B981',
                  icon: Globe,
                },
                {
                  title: '50+ Cryptocurrencies',
                  desc: 'BTC, ETH, SOL, USDT, USDC, BNB and more — all in the same wallet alongside your fiat balances.',
                  color: '#F7931A',
                  icon: Bitcoin,
                },
                {
                  title: 'Instant Currency Exchange',
                  desc: 'Convert between any two currencies in seconds at the real mid-market rate. No spread markup, no hidden fees.',
                  color: '#627EEA',
                  icon: RefreshCw,
                },
                {
                  title: 'Virtual & Physical Cards',
                  desc: 'Spend in any currency with your City Gate Capital card. The right currency is automatically selected at checkout.',
                  color: '#C9A84C',
                  icon: CreditCard,
                },
                {
                  title: 'Scheduled Conversions',
                  desc: 'Set target rates and let the platform auto-convert when the market hits your price. Never miss a rate again.',
                  color: '#9945FF',
                  icon: Bell,
                },
                {
                  title: 'Net Worth in One View',
                  desc: 'See your total wealth across all currencies and assets consolidated into your home currency in real time.',
                  color: '#F0D080',
                  icon: Eye,
                },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="flex items-start gap-4 p-5 glass-card rounded-2xl gradient-border hover:border-primary/25 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                    style={{ background: `${item.color}15` }}>
                    <item.icon size={18} style={{ color: item.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">{item.title}</p>
                    <p className="text-xs text-foreground/50 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}

              <Link
                to="/wallet"
                className="group relative inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-bold text-black overflow-hidden mt-2"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                <Wallet size={16} className="relative" />
                <span className="relative">Open Your Wallet</span>
                <ArrowRight size={16} className="relative transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── Security & KYC ───────────────────────────────────── */}
      <section className="py-28 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">

          {/* Header */}
          <div className="text-center mb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                Security & Compliance
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
                Your Money is<br />
                <span className="text-gold-gradient">Fort Knox Safe</span>
              </h2>
              <p className="text-foreground/50 max-w-xl mx-auto leading-relaxed">
                Institutional-grade security, AI-powered fraud detection, and a 5-minute KYC process — so you're protected from day one.
              </p>
            </motion.div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-8">

            {/* Security score card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 }}
              className="glass-card rounded-3xl p-6 gradient-border lg:row-span-2"
              style={{ boxShadow: 'var(--gold-glow)' }}
            >
              <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-6">Security Score</p>

              {/* Score ring */}
              <div className="relative w-36 h-36 mx-auto mb-6">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(201,168,76,0.1)" strokeWidth="8" />
                  <motion.circle
                    cx="60" cy="60" r="50" fill="none"
                    stroke="url(#scoreGrad)" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="314"
                    initial={{ strokeDashoffset: 314 }}
                    whileInView={{ strokeDashoffset: 314 * 0.03 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: 'easeOut' as const, delay: 0.3 }}
                  />
                  <defs>
                    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#C9A84C" />
                      <stop offset="100%" stopColor="#F0D080" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-gold-gradient" style={{ fontFamily: 'var(--font-heading)' }}>97</span>
                  <span className="text-xs text-foreground/40">/ 100</span>
                </div>
              </div>

              <p className="text-center text-sm font-semibold text-foreground mb-1">Excellent</p>
              <p className="text-center text-xs text-foreground/40 mb-6">Your account is fully secured</p>

              {/* Security layers */}
              <div className="space-y-3">
                {[
                  { label: '256-bit Encryption',  done: true },
                  { label: 'Biometric Auth',       done: true },
                  { label: '2FA Enabled',          done: true },
                  { label: 'KYC Verified',         done: true },
                  { label: 'Cold Storage',         done: true },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + i * 0.07 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-400/15 flex items-center justify-center shrink-0">
                      <CheckCircle size={11} className="text-emerald-400" />
                    </div>
                    <span className="text-xs text-foreground/60">{item.label}</span>
                  </motion.div>
                ))}
              </div>

              {/* Compliance badges */}
              <div className="mt-6 pt-5 border-t border-primary/10">
                <p className="text-xs text-foreground/30 uppercase tracking-widest mb-3">Regulated & Certified</p>
                <div className="flex flex-wrap gap-2">
                  {['FDIC', 'SOC 2', 'ISO 27001', 'PCI DSS', 'GDPR'].map(badge => (
                    <span key={badge} className="text-[10px] font-bold px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Security features — top right 2 cols */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2 grid sm:grid-cols-2 gap-4"
            >
              {[
                { icon: Shield,      title: '256-bit AES Encryption',    desc: 'Military-grade encryption for all data at rest and in transit. Your information is unreadable to anyone without your keys.', color: '#C9A84C' },
                { icon: Fingerprint, title: 'Biometric Verification',     desc: 'Face ID, Touch ID and liveness detection on every login. Spoofing attempts are blocked automatically.', color: '#10B981' },
                { icon: Lock,        title: 'Cold Storage Custody',       desc: '95% of crypto assets held in air-gapped cold storage vaults, never connected to the internet.', color: '#627EEA' },
                { icon: Eye,         title: 'AI Fraud Detection',         desc: 'Machine learning models monitor every transaction in real time and flag anomalies before they become problems.', color: '#9945FF' },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 + i * 0.08 }}
                  className="glass-card rounded-2xl p-5 gradient-border hover:border-primary/25 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                    style={{ background: `${item.color}15` }}>
                    <item.icon size={18} style={{ color: item.color }} />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-2">{item.title}</p>
                  <p className="text-xs text-foreground/45 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* KYC flow — bottom right 2 cols */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-2 glass-card rounded-3xl p-6 gradient-border"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-semibold text-foreground">KYC Verification</p>
                  <p className="text-xs text-foreground/40">Complete in under 5 minutes</p>
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
                  AI-Powered
                </span>
              </div>

              {/* Steps */}
              <div className="grid sm:grid-cols-4 gap-3 mb-5">
                {[
                  { icon: User,        step: '01', label: 'Personal Info',   desc: 'Name, DOB, address',       done: true  },
                  { icon: Camera,      step: '02', label: 'ID Document',     desc: 'Passport or national ID',  done: true  },
                  { icon: Fingerprint, step: '03', label: 'Liveness Check',  desc: 'Quick selfie scan',        done: true  },
                  { icon: CheckCircle, step: '04', label: 'Verified',        desc: 'Instant AI decision',      done: true  },
                ].map((s, i) => (
                  <motion.div
                    key={s.step}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className={`relative p-4 rounded-2xl border text-center transition-colors ${s.done ? 'bg-primary/5 border-primary/25' : 'bg-white/[0.02] border-primary/10'}`}
                  >
                    {i < 3 && (
                      <div className="hidden sm:block absolute top-1/2 -right-1.5 w-3 h-px bg-primary/30 z-10" />
                    )}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-3 ${s.done ? 'bg-primary/15' : 'bg-white/5'}`}>
                      <s.icon size={16} className={s.done ? 'text-primary' : 'text-foreground/30'} />
                    </div>
                    <p className="text-[10px] font-bold text-foreground/30 mb-1">{s.step}</p>
                    <p className="text-xs font-semibold text-foreground mb-1">{s.label}</p>
                    <p className="text-[10px] text-foreground/35 leading-tight">{s.desc}</p>
                    {s.done && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-400/15 flex items-center justify-center">
                        <CheckCircle size={9} className="text-emerald-400" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Jurisdiction bar */}
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-primary/8">
                <Shield size={12} className="text-primary shrink-0" />
                <span className="text-xs text-foreground/40">Regulated in</span>
                {['USA', 'UK', 'EU', 'UAE', 'SG', 'CA', 'AU', '+33 more'].map(j => (
                  <span key={j} className="text-[10px] font-semibold text-foreground/50 bg-white/5 px-2 py-0.5 rounded-md">{j}</span>
                ))}
              </div>
            </motion.div>

          </div>

          {/* Security image strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="relative rounded-3xl overflow-hidden h-48"
          >
            <img src="/airo-assets/images/pages/home/security" alt="Bank-grade security infrastructure" width={1200} height={800} loading="lazy" className="w-full h-full object-cover opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#060606] via-transparent to-[#060606]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground mb-1 tracking-tight">Zero Security Incidents</p>
                <p className="text-sm text-foreground/40">Since founding in 2018 — a record we're proud of and committed to maintaining.</p>
              </div>
            </div>
          </motion.div>

        </div>
      </section>

      {/* ── Mobile App Preview ──────────────────────────────── */}
      <section className="py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-4 blur-[120px]"
          style={{ background: 'radial-gradient(circle, #C9A84C, transparent)' }} />

        <div className="container mx-auto px-4 md:px-6 relative">

          {/* Header */}
          <div className="text-center mb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                Mobile App
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
                Banking in Your<br />
                <span className="text-gold-gradient">Pocket</span>
              </h2>
              <p className="text-foreground/50 max-w-xl mx-auto leading-relaxed">
                Award-winning iOS and Android apps with full banking power. Send, receive, invest and manage everything from your phone.
              </p>
            </motion.div>
          </div>

          <div className="grid lg:grid-cols-3 gap-10 items-center">

            {/* Left: features */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="space-y-4"
            >
              {[
                { icon: Zap,         title: 'Instant Notifications',    desc: 'Real-time push alerts for every transaction, transfer, and price movement.',    color: '#C9A84C' },
                { icon: Fingerprint, title: 'Biometric Login',          desc: 'Face ID and Touch ID for instant, secure access — no passwords needed.',        color: '#10B981' },
                { icon: RefreshCw,   title: 'Auto-sync Across Devices', desc: 'Your data syncs instantly across all your devices. Always up to date.',          color: '#627EEA' },
                { icon: PieChart,    title: 'Portfolio Dashboard',      desc: 'Full crypto and fiat portfolio view with P&L, charts, and allocation breakdown.', color: '#9945FF' },
                { icon: Send,        title: 'One-tap Transfers',        desc: 'Send money to anyone in seconds. Saved recipients, instant confirmation.',       color: '#F7931A' },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: -14 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="flex items-start gap-4 p-4 glass-card rounded-2xl gradient-border hover:border-primary/25 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                    style={{ background: `${item.color}15` }}>
                    <item.icon size={16} style={{ color: item.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-0.5">{item.title}</p>
                    <p className="text-xs text-foreground/40 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Centre: phone mockup */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="flex justify-center relative"
            >
              {/* Glow behind phone */}
              <div className="absolute inset-0 rounded-full blur-[60px] opacity-20"
                style={{ background: 'radial-gradient(circle, #C9A84C 0%, transparent 70%)' }} />

              <div className="relative w-60">
                {/* Phone frame */}
                <div className="relative rounded-[2.8rem] overflow-hidden border-2 border-primary/25"
                  style={{ boxShadow: 'var(--gold-glow), 0 50px 100px rgba(0,0,0,0.7)' }}>
                  <img
                    src="/airo-assets/images/pages/home/mobile-app"
                    alt="City Gate Capital mobile app"
                    className="w-full h-auto block"
                  />
                  {/* Screen UI overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/85 via-[#0A0A0A]/20 to-[#0A0A0A]/70 flex flex-col justify-between p-5">
                    {/* Top: balance */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] text-foreground/50">City Gate Capital</p>
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                          <Bell size={9} className="text-primary" />
                        </div>
                      </div>
                      <p className="text-[10px] text-foreground/50 mb-0.5">Total Balance</p>
                      <p className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>$86,313</p>
                      <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                        <TrendingUp size={8} /> +$2,140 today
                      </p>
                    </div>
                    {/* Bottom: quick actions */}
                    <div>
                      <div className="grid grid-cols-4 gap-1.5 mb-3">
                        {[
                          { icon: Send,       label: 'Send'    },
                          { icon: ArrowRight, label: 'Receive' },
                          { icon: RefreshCw,  label: 'Exchange'},
                          { icon: CreditCard, label: 'Card'    },
                        ].map(btn => (
                          <div key={btn.label} className="flex flex-col items-center gap-1">
                            <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                              <btn.icon size={12} className="text-primary" />
                            </div>
                            <span className="text-[8px] text-foreground/40">{btn.label}</span>
                          </div>
                        ))}
                      </div>
                      {/* Mini transaction */}
                      <div className="glass rounded-xl px-3 py-2 flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-emerald-400/15 flex items-center justify-center shrink-0">
                          <CheckCircle size={9} className="text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-medium text-foreground truncate">Wire Received</p>
                          <p className="text-[8px] text-foreground/30">Just now</p>
                        </div>
                        <span className="text-[9px] font-bold text-emerald-400">+$4,500</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating notification cards */}
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' as const }}
                  className="absolute -right-10 top-16 glass-card rounded-2xl px-3 py-2.5 gradient-border w-36"
                  style={{ boxShadow: '0 8px 32px rgba(201,168,76,0.15)' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-4 rounded-full bg-emerald-400/15 flex items-center justify-center">
                      <TrendingUp size={8} className="text-emerald-400" />
                    </div>
                    <span className="text-[9px] font-semibold text-foreground">BTC +5.2%</span>
                  </div>
                  <p className="text-[8px] text-foreground/40">Price alert triggered</p>
                </motion.div>

                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' as const, delay: 1 }}
                  className="absolute -left-10 bottom-24 glass-card rounded-2xl px-3 py-2.5 gradient-border w-32"
                  style={{ boxShadow: '0 8px 32px rgba(201,168,76,0.15)' }}
                >
                  <p className="text-[9px] font-bold text-primary mb-0.5">4.9 ★★★★★</p>
                  <p className="text-[8px] text-foreground/40">App Store · 48K reviews</p>
                </motion.div>
              </div>
            </motion.div>

            {/* Right: app store + stats */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="space-y-5"
            >
              {/* App store buttons */}
              <div className="space-y-3">
                {[
                  { store: 'App Store',   sub: 'Download on the', rating: '4.9', reviews: '48K reviews',  icon: Smartphone },
                  { store: 'Google Play', sub: 'Get it on',        rating: '4.8', reviews: '62K reviews',  icon: Smartphone },
                ].map((s, i) => (
                  <motion.button
                    key={s.store}
                    type="button"
                    aria-label={`${s.sub} ${s.store} — coming soon`}
                    onClick={() => {/* App store links coming soon */}}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="w-full flex items-center gap-4 p-4 glass-card rounded-2xl gradient-border hover:border-primary/30 transition-colors group cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <s.icon size={20} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-foreground/40">{s.sub}</p>
                      <p className="text-sm font-bold text-foreground">{s.store}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gold-gradient">{s.rating} ★</p>
                      <p className="text-[10px] text-foreground/35">{s.reviews}</p>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* App stats */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: '2M+',   label: 'Active Users'   },
                  { value: '180+',  label: 'Countries'      },
                  { value: '<0.1s', label: 'Avg. Load Time' },
                  { value: '99.9%', label: 'Uptime SLA'     },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.07 }}
                    className="glass-card rounded-2xl p-4 text-center gradient-border"
                  >
                    <p className="text-xl font-bold text-gold-gradient mb-0.5" style={{ fontFamily: 'var(--font-heading)' }}>{s.value}</p>
                    <p className="text-[10px] text-foreground/40 uppercase tracking-wide">{s.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Feature chips */}
              <div className="flex flex-wrap gap-2">
                {['Apple Pay', 'Google Pay', 'Widget Support', 'Dark Mode', 'Face ID', 'Offline Mode'].map(chip => (
                  <span key={chip} className="text-xs px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-foreground/60 hover:text-foreground/80 hover:border-primary/25 transition-colors">
                    {chip}
                  </span>
                ))}
              </div>

              {/* Award badge */}
              <div className="flex items-center gap-3 p-4 glass-card rounded-2xl gradient-border">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Award size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Best Fintech App 2025</p>
                  <p className="text-xs text-foreground/40">Financial Times · Global Awards</p>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────── */}
      <section className="py-28 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">

          {/* Header */}
          <div className="text-center mb-12">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                Pricing
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
                Simple, <span className="text-gold-gradient">Transparent</span> Pricing
              </h2>
              <p className="text-foreground/50 max-w-md mx-auto mb-8">No hidden fees. No surprises. Start free and upgrade when you're ready.</p>
            </motion.div>
          </div>

          {/* Pricing toggle + cards (shared state) */}
          <PricingSection />

          {/* Trust strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-12 pt-10 border-t border-primary/10"
          >
            {[
              { icon: Shield,      label: 'No contracts, cancel anytime' },
              { icon: RefreshCw,   label: '30-day money-back guarantee' },
              { icon: Lock,        label: 'Bank-grade security on all plans' },
              { icon: CheckCircle, label: 'Free plan forever — no credit card' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-foreground/35">
                <item.icon size={13} className="text-primary/60 shrink-0" />
                <span className="text-xs">{item.label}</span>
              </div>
            ))}
          </motion.div>

        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────── */}
      <section className="py-28 overflow-hidden">
        <div className="container mx-auto px-4 md:px-6">

          {/* Header */}
          <div className="text-center mb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                Testimonials
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
                Trusted by <span className="text-gold-gradient">2 Million+</span><br />Customers Worldwide
              </h2>
              <p className="text-foreground/50 max-w-md mx-auto">
                From freelancers to Fortune 500 treasurers — here's what our customers say.
              </p>
            </motion.div>
          </div>

          {/* Trust stats row */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14"
          >
            {[
              { value: '4.9/5',  label: 'App Store Rating',    sub: '48,000+ reviews'   },
              { value: '4.8/5',  label: 'Google Play Rating',  sub: '62,000+ reviews'   },
              { value: '98%',    label: 'Customer Satisfaction', sub: 'NPS score 72'    },
              { value: '#1',     label: 'Fintech App 2025',    sub: 'Financial Times'   },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card rounded-2xl p-5 text-center gradient-border"
              >
                <p className="text-3xl font-bold text-gold-gradient mb-1" style={{ fontFamily: 'var(--font-heading)' }}>{s.value}</p>
                <p className="text-xs font-semibold text-foreground mb-0.5">{s.label}</p>
                <p className="text-xs text-foreground/35">{s.sub}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Featured hero quote */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative glass-card rounded-3xl p-8 md:p-12 gradient-border mb-6 text-center"
            style={{ boxShadow: 'var(--gold-glow)' }}
          >
            <div className="text-6xl text-primary/20 font-serif leading-none mb-4 select-none">"</div>
            <p className="text-xl md:text-2xl font-medium text-foreground/80 leading-relaxed max-w-3xl mx-auto mb-8">
              We moved our entire treasury operation to City Gate Capital. The API, the compliance tools, and the dedicated relationship manager make it completely seamless. It's the most sophisticated fintech platform I've used in 20 years of finance.
            </p>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-black shrink-0"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
                J
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">James W.</p>
                <p className="text-sm text-foreground/40">Hedge Fund Manager · Zurich, Switzerland</p>
              </div>
              <div className="flex gap-0.5 ml-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} size={14} className="text-primary fill-primary" />
                ))}
              </div>
            </div>
          </motion.div>

          {/* Testimonial grid — first row */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {testimonials.slice(0, 4).map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card rounded-2xl p-5 gradient-border hover:border-primary/25 transition-colors flex flex-col"
              >
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} size={11} className="text-primary fill-primary" />
                  ))}
                </div>
                <p className="text-sm text-foreground/60 leading-relaxed mb-5 flex-1">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-black shrink-0"
                    style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}99)` }}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-foreground/35">{t.role} · {t.location}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Testimonial grid — second row */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
            {testimonials.slice(4).map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card rounded-2xl p-5 gradient-border hover:border-primary/25 transition-colors flex flex-col"
              >
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} size={11} className="text-primary fill-primary" />
                  ))}
                </div>
                <p className="text-sm text-foreground/60 leading-relaxed mb-5 flex-1">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-black shrink-0"
                    style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}99)` }}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-foreground/35">{t.role} · {t.location}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Press logos strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <p className="text-xs text-foreground/25 uppercase tracking-widest mb-6">As featured in</p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {['Financial Times', 'Forbes', 'Bloomberg', 'TechCrunch', 'The Economist', 'Wired'].map((pub) => (
                <span key={pub} className="text-sm font-bold text-foreground/20 hover:text-foreground/40 transition-colors tracking-wide">
                  {pub}
                </span>
              ))}
            </div>
          </motion.div>

        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section className="py-28 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">

          {/* Header */}
          <div className="text-center mb-12">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                FAQ
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
                Common <span className="text-gold-gradient">Questions</span>
              </h2>
              <p className="text-foreground/50 max-w-md mx-auto">
                Everything you need to know about City Gate Capital. Can't find an answer?{' '}
                <Link to="/support" className="text-primary hover:underline">Talk to our team.</Link>
              </p>
            </motion.div>
          </div>

          <FaqSection />

          {/* Bottom CTA nudge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-center mt-14"
          >
            <p className="text-sm text-foreground/40 mb-4">Still have questions?</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/support" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl glass-card gradient-border text-sm text-foreground/70 hover:text-foreground hover:border-primary/30 transition-colors">
                <MessageCircle size={14} className="text-primary" />
                Live Chat Support
              </Link>
              <Link to="/contact" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl glass-card gradient-border text-sm text-foreground/70 hover:text-foreground hover:border-primary/30 transition-colors">
                <Mail size={14} className="text-primary" />
                Email Us
              </Link>
            </div>
          </motion.div>

        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="py-28 relative overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute inset-0 bg-[#0A0A0A]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] blur-[120px] opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, #C9A84C 0%, transparent 70%)' }} />
        <div className="absolute top-0 left-0 w-[400px] h-[400px] blur-[100px] opacity-8 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #627EEA, transparent)' }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] blur-[100px] opacity-8 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #9945FF, transparent)' }} />

        <div className="container mx-auto px-4 md:px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden border border-primary/20 p-10 md:p-20 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.07) 0%, rgba(10,10,10,0.95) 50%, rgba(153,69,255,0.05) 100%)' }}
          >
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-primary/30 rounded-tl-3xl" />
            <div className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-primary/30 rounded-br-3xl" />

            {/* Live badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary/20 mb-8"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-foreground/60 tracking-widest uppercase">Open in under 5 minutes</span>
            </motion.div>

            {/* Headline */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 tracking-tight leading-none"
            >
              Ready to Bank<br />
              <span className="text-gold-gradient">Smarter?</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-foreground/50 mb-10 max-w-xl mx-auto text-lg leading-relaxed"
            >
              Join over 2 million customers who trust City Gate Capital for global transfers, crypto, investments, and everyday banking.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.25 }}
              className="flex flex-wrap justify-center gap-4 mb-14"
            >
              <Link
                to="/accounts"
                onClick={() => trackConversion('signup_started', location.pathname, { source: 'final_cta' })}
                className="group relative inline-flex items-center gap-2.5 px-9 py-4 rounded-xl font-bold text-black overflow-hidden text-base"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-[#F0D080] to-primary bg-[length:200%] transition-all duration-500 group-hover:bg-right-center" />
                <span className="relative">Open Free Account</span>
                <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2.5 px-9 py-4 rounded-xl font-semibold text-foreground/70 glass border border-primary/20 hover:border-primary/40 hover:text-foreground transition-all text-base"
              >
                Talk to Sales
              </Link>
            </motion.div>

            {/* Mini feature strip */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap justify-center gap-x-8 gap-y-3 pt-10 border-t border-primary/10"
            >
              {[
                { icon: Shield,      label: 'Bank-grade security'         },
                { icon: Globe,       label: '180+ countries'              },
                { icon: Zap,         label: 'Instant account opening'     },
                { icon: Lock,        label: 'No contracts, cancel anytime'},
                { icon: CheckCircle, label: 'Free plan forever'           },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.35 + i * 0.06 }}
                  className="flex items-center gap-2 text-foreground/35"
                >
                  <item.icon size={13} className="text-primary/60 shrink-0" />
                  <span className="text-xs">{item.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
