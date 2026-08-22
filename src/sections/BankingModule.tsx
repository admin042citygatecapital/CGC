/**
 * Banking Module — homepage sections
 *
 * Exports (used by src/pages/index.tsx):
 *   HeroSection
 *   StatsBar
 *   FeaturesGrid
 *   DashboardPreview
 *   TransfersSection
 *   SecuritySection
 *   MobileAppSection
 *   LookingAheadSection
 *   PricingSection
 *   TestimonialsSection
 *   FaqSection
 *   CtaSection
 */
import { AnimatedBar,GlassCard,GoldButton,StatBadge } from '@/lib/homeShared';
import {
ArrowRight,
Apple,
Award,
BarChart3,
Bell,
Bitcoin,
Camera,
CheckCircle,
ChevronDown,
CreditCard,
Eye,
Fingerprint,
Globe,
HelpCircle,
Layers,
Lock,
PieChart,
Play,
RefreshCw,
Send,
Shield,
Smartphone,Star,
TrendingUp,
User,
Wallet,
Zap,
} from 'lucide-react';
import { motion,useScroll,useTransform } from 'motion/react';
import { useEffect,useRef,useState } from 'react';
import { Link } from 'react-router-dom';
import { useHomepageContent } from '@/lib/homepageContentContext';

// ── Animated counter ──────────────────────────────────────────────────────────

function AnimatedCount({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started) setStarted(true);
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const duration = 1200;
    const startTime = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, target]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

const STAT_TARGETS = [2, 180, 50, 40] as const;

const featureIconMap: Record<string, React.ElementType> = {
  'Multi-Currency Accounts': Globe,
  'Digital Wallets': Wallet,
  'Transfers': Send,
  'Global Transfers': Globe,
  'Crypto Exchange': Bitcoin,
  'Smart Cards': CreditCard,
  'Smart Analytics': BarChart3,
  'AI Analytics': BarChart3,
  'Bank-Grade Security': Shield,
  'Investment Tools': PieChart,
};

const planIconMap: Record<string, React.ElementType> = {
  Standard: Wallet,
  Premium: CreditCard,
  Elite: Award,
};

// ── HeroSection ───────────────────────────────────────────────────────────────

export function HeroSection() {
  const home = useHomepageContent();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY       = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  return (
    <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden">
      <motion.div style={{ y: heroY }} className="absolute inset-0 scale-110">
        <img
          src="/assets/media/city-gate-banking-customer-hero-v2.png"
          alt="Professional customer using the City Gate Capital digital banking experience"
          width={1536}
          height={1024}
          fetchPriority="high"
          className="w-full h-full object-cover object-[72%_center] opacity-80"
        />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-[#0A0A0A]/90 to-[#0A0A0A]/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent" />
      <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] rounded-full opacity-10 blur-[120px]"
        style={{ background: 'radial-gradient(circle, #C9A84C 0%, transparent 70%)' }} />

      <motion.div style={{ opacity: heroOpacity }} className="container relative z-10 mx-auto px-5 pb-20 pt-28 sm:px-6 sm:pb-24 sm:pt-36 md:py-32 md:pt-40">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }}>
              <h1 className="text-4xl font-bold leading-[1.02] tracking-tight text-foreground sm:text-5xl md:text-6xl xl:text-7xl">
                {home.finalCta.headline1}{' '}
                <span className="block text-gold-shimmer lg:inline">{home.finalCta.headlineAccent}</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-foreground/55 sm:mt-7 sm:text-lg sm:leading-8 lg:mx-0">
                {home.finalCta.subheadline}
              </p>
              <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-4 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5 lg:justify-start [&>a]:justify-center">
                <GoldButton to="/register">{home.finalCta.ctaPrimary}</GoldButton>
                <Link to="/digital-banking" className="inline-flex items-center gap-2 text-sm font-medium text-foreground/65 transition-colors hover:text-foreground">
                  {home.finalCta.ctaSecondary} <ArrowRight size={15} />
                </Link>
              </div>
              <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-4 sm:flex sm:flex-wrap sm:justify-center lg:justify-start">
                {home.finalCta.featureStrip.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-left text-foreground/45">
                    <CheckCircle size={14} className="shrink-0 text-primary" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Hero logo — right column */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: 'easeOut' }}
            className="hidden lg:flex min-h-[520px] items-center justify-end"
          >
            <div className="w-[260px] space-y-3 mr-1 xl:mr-6">
              <div className="rounded-2xl border border-primary/25 bg-[#07101e]/90 p-5 shadow-2xl backdrop-blur-md">
                <div className="flex items-center justify-between text-xs text-foreground/55"><span>Total balance</span><span>USD</span></div>
                <p className="mt-2 text-2xl font-bold text-foreground">$28,650.75</p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-black/75 p-5 shadow-2xl backdrop-blur-md">
                <div className="flex items-center justify-between"><p className="text-xs font-semibold">Spending overview</p><TrendingUp size={15} className="text-primary" /></div>
                <p className="mt-3 text-sm font-semibold text-primary">−8.3%</p>
                <div className="mt-4 flex h-12 items-end gap-1">{[28,42,35,54,47,68,58,74,65,86,73,96].map((height, index) => <span key={index} className="flex-1 rounded-t bg-primary/60" style={{ height: `${height}%` }} />)}</div>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-black/75 p-5 shadow-2xl backdrop-blur-md">
                <p className="text-xs font-semibold mb-4">Recent activity</p>
                <div className="space-y-3 text-xs"><div className="flex justify-between"><span className="text-foreground/60">Coffee shop</span><span>−$4.75</span></div><div className="flex justify-between"><span className="text-foreground/60">Salary deposit</span><span className="text-emerald-400">+$2,450.00</span></div><div className="flex justify-between"><span className="text-foreground/60">Travel booking</span><span>−$320.00</span></div></div>
              </div>
              <div className="hidden">
              {/* Ambient glow ring */}
              <motion.div
                animate={{ opacity: [0.18, 0.32, 0.18], scale: [1, 1.06, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute rounded-full pointer-events-none"
                style={{
                  inset: '-20%',
                  background: 'radial-gradient(circle, rgba(201,168,76,0.35) 0%, transparent 70%)',
                  filter: 'blur(40px)',
                }}
              />
              {/* Logo image — 200px mobile, up to 320px desktop */}
              <img
                src="/assets/brand/city-gate-capital-seal.png"
                alt="City Gate Capital"
                className="relative object-contain shrink-0"
                style={{
                  width: 'clamp(180px, 30vw, 320px)',
                  height: 'auto',
                  maxWidth: '100%',
                  filter: 'drop-shadow(0 0 32px rgba(212,175,55,0.55)) drop-shadow(0 0 8px rgba(212,175,55,0.3))',
                }}
              />
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <span className="text-xs text-foreground/30 tracking-widest uppercase">Scroll</span>
        <div className="w-px h-8 bg-gradient-to-b from-primary/40 to-transparent" />
      </motion.div>
    </section>
  );
}

// ── StatsBar ──────────────────────────────────────────────────────────────────

export function StatsBar() {
  const home = useHomepageContent();
  return (
    <section className="border-y border-primary/10 bg-[#060606]">
      <div className="container mx-auto px-4 md:px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {home.stats.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-gold-gradient mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
                <AnimatedCount target={STAT_TARGETS[i]} /><span>{s.suffix}</span>
              </p>
              <p className="text-xs text-foreground/55 uppercase tracking-widest">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="border-t border-primary/8">
        <div className="container mx-auto px-4 md:px-6 py-5">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {home.trustBadges.map((badge, i) => {
              const BadgeIcon = [Shield, Lock, Fingerprint, Award, CheckCircle][i] ?? Shield;
              return (
                <motion.div key={badge.id} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }} className="flex items-center gap-2 text-foreground/35 hover:text-foreground/55 transition-colors">
                  <BadgeIcon size={13} className="text-primary/60 shrink-0" />
                  <span className="text-xs font-medium tracking-wide whitespace-nowrap">{badge.label}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── FeaturesGrid ──────────────────────────────────────────────────────────────

export function FeaturesGrid() {
  const home = useHomepageContent();
  return (
    <section className="py-16 md:py-28">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-10 md:mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-4 md:mb-5">{home.features.eyebrow}</span>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 md:mb-5 tracking-tight">
              {home.features.headline1}{' '}<span className="text-gold-gradient">{home.features.headlineAccent}</span>
            </h2>
            <p className="text-sm md:text-base text-foreground/50 max-w-xl mx-auto leading-relaxed px-2 md:px-0">{home.features.subheadline}</p>
          </motion.div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {home.features.items.map((f, i) => {
            const FIcon = featureIconMap[f.title] ?? Globe;
            return (
              <motion.div key={f.id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5 }} whileHover={{ y: -4 }}
                className="group glass-card rounded-2xl p-5 md:p-7 gradient-border cursor-default transition-all duration-300 hover:shadow-xl">
                <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl mb-4 md:mb-5 flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                  style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05))' }}>
                  <FIcon size={20} className="text-primary" />
                </div>
                <h3 className="text-base md:text-lg font-semibold text-foreground mb-2" style={{ fontFamily: 'var(--font-heading)' }}>{f.title}</h3>
                <p className="text-sm text-foreground/50 leading-relaxed">{f.desc}</p>
                <div className="mt-4 md:mt-5 flex items-center gap-1.5 text-xs text-primary font-medium opacity-60 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn more <ArrowRight size={12} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function GlobalBankingSection() {
  const advantages = [
    [Globe, 'Multiple currencies', 'Organise supported currencies through one connected experience.'],
    [Shield, 'Secure and protected', 'Layered account security, authentication and administrative controls.'],
    [User, 'Global access', 'Designed for increasingly international financial needs.'],
    [Bell, 'Here for you', 'Support, notifications and account information when you need them.'],
  ] as const;

  return (
    <section className="relative overflow-hidden border-y border-primary/10 bg-[#060606]">
      <div className="grid min-h-[650px] lg:grid-cols-2">
        <div className="relative min-h-[360px] lg:min-h-full">
          <video
            className="absolute inset-0 h-full w-full object-cover object-center motion-reduce:hidden"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="City Gate Capital global transfer experience"
          >
            <source src="/assets/media/hero.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#060606]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060606]/60 to-transparent" />
        </div>
        <div className="flex items-center px-6 py-16 md:px-12 lg:px-16">
          <motion.div initial={{ opacity: 0, x: 28 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="max-w-2xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">Global financial access</p>
            <h2 className="text-4xl font-bold leading-tight md:text-5xl">Your financial partner <span className="text-gold-gradient">around the world.</span></h2>
            <p className="mt-6 text-foreground/55 leading-8">City Gate Capital connects modern account experiences, international financial needs and customer-first technology through one secure platform.</p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {advantages.map(([Icon, title, text]) => <div key={title} className="flex gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Icon size={19} className="text-primary" /></div><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-6 text-foreground/45">{text}</p></div></div>)}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export function BankingFitsLifeBanner() {
  return (
    <section className="px-4 py-16 md:px-6 md:py-24">
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="container mx-auto overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-r from-[#090806] via-[#11100c] to-[#060606] shadow-2xl">
        <div className="grid items-center gap-10 px-7 py-10 md:px-12 lg:grid-cols-[0.8fr_1fr_1fr]">
          <div className="relative flex justify-center lg:justify-start">
            <div className="relative w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-primary/25 bg-black shadow-[0_20px_60px_rgba(201,168,76,0.18)]">
              <video
                className="aspect-[4/5] h-full w-full object-cover object-center motion-reduce:hidden"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="City Gate Capital mobile banking experience"
              >
                <source src="/assets/media/city-gate-mobile-app.mp4" type="video/mp4" />
              </video>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />
            </div>
          </div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Banking that moves with you</p><h2 className="mt-4 text-4xl font-bold md:text-5xl">Banking that fits <span className="text-gold-gradient">your life.</span></h2></div>
          <div>
            <p className="text-foreground/55 leading-8">Manage your accounts, follow transfers, review spending and control important security settings from one responsive digital experience.</p>
            <div className="mt-6" aria-label="City Gate Capital mobile applications">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/40">Mobile access</p>
              <div className="flex flex-wrap gap-3">
                <div className="inline-flex min-w-[178px] items-center gap-3 rounded-xl border border-primary/25 bg-black/70 px-5 py-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.24)]">
                  <Apple size={28} className="shrink-0 text-white" aria-hidden="true" />
                  <div className="leading-none"><p className="text-[10px] text-foreground/50">Download on the</p><p className="mt-1 text-base font-semibold text-white">App Store</p></div>
                </div>
                <div className="inline-flex min-w-[178px] items-center gap-3 rounded-xl border border-primary/25 bg-black/70 px-5 py-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.24)]">
                  <Play size={27} className="shrink-0 fill-primary/20 text-primary" aria-hidden="true" />
                  <div className="leading-none"><p className="text-[10px] text-foreground/50">Get it on</p><p className="mt-1 text-base font-semibold text-white">Google Play</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

export function LookingAheadSection() {
  return (
    <section className="relative overflow-hidden border-y border-primary/10 bg-primary/[0.025] px-4 py-16 md:px-6 md:py-24">
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-[110px]" />
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="container relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-[#11100c] via-[#090909] to-black shadow-[0_28px_90px_rgba(0,0,0,0.38)]"
      >
        <div className="absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <div className="flex justify-center px-7 pb-10 pt-20 md:px-12 md:pb-14 lg:px-16 lg:pt-24">
          <div className="relative w-full max-w-xl rounded-3xl border border-primary/25 bg-black/55 px-7 pb-9 pt-20 text-center shadow-[0_20px_70px_rgba(201,168,76,0.08)]">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/30 bg-[#080808] p-3 shadow-[0_0_45px_rgba(201,168,76,0.22)]">
              <img src="/assets/brand/city-gate-capital-seal.png" alt="City Gate Capital" className="h-28 w-28 object-contain" />
            </div>
            <div className="mx-auto mb-7 h-px w-24 bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            <p className="text-xl font-semibold leading-8 text-foreground md:text-2xl">Technology is the infrastructure.</p>
            <p className="mt-2 text-xl font-semibold leading-8 text-primary md:text-2xl">People are the purpose.</p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// ── DashboardPreview ──────────────────────────────────────────────────────────

export function DashboardPreview({ compactTop = false }: { compactTop?: boolean }) {
  const home = useHomepageContent();
  return (
    <section className={`${compactTop ? 'pb-20 pt-8 md:pt-10' : 'py-28'} bg-[#060606]`}>
      <div className="container mx-auto px-4 md:px-6">
        {!compactTop && (
          <div className="mb-16 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
                {home.dashboard.headline1}<br /><span className="text-gold-gradient">{home.dashboard.headlineAccent}</span>
              </h2>
              <p className="text-foreground/50 max-w-xl mx-auto leading-relaxed">{home.dashboard.subheadline}</p>
            </motion.div>
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
          <GlassCard className="rounded-3xl p-6 md:p-8" glow>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs text-foreground/55 uppercase tracking-widest mb-0.5">Good morning, Alex</p>
                <p className="text-sm font-semibold text-foreground">Here's your financial overview</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-foreground/55">Live</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Total Balance', value: '$46,373', trend: '+2.75%', up: true  },
                { label: 'Monthly Spend', value: '$3,240',  trend: '-8.2%',  up: false },
                { label: 'Crypto Value',  value: '$39,940', trend: '+5.1%',  up: true  },
                { label: 'Savings Rate',  value: '28.4%',   trend: '+3.2%',  up: true  },
              ].map((c, i) => (
                <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 + i * 0.07 }}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-primary/10 hover:border-primary/20 transition-colors">
                  <p className="text-xs text-foreground/55 mb-1.5 uppercase tracking-wide">{c.label}</p>
                  <p className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: 'var(--font-heading)' }}>{c.value}</p>
                  <div className={`flex items-center gap-1 text-xs ${c.up ? 'text-emerald-400' : 'text-red-400'}`}>
                    <TrendingUp size={10} className={c.up ? '' : 'rotate-180'} />
                    <span>{c.trend} this month</span>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid md:grid-cols-5 gap-4 mb-4">
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
                    <motion.div key={i} initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.05, duration: 0.5, ease: 'easeOut' as const }}
                      className="flex-1 rounded-t relative group/bar cursor-pointer"
                      style={{ background: i >= 10 ? 'linear-gradient(to top, #C9A84C, #F0D080)' : 'rgba(201,168,76,0.15)' }}>
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-primary text-black text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        ${(h * 463).toLocaleString()}
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

              <div className="md:col-span-2 p-5 rounded-2xl bg-white/[0.02] border border-primary/10">
                <p className="text-xs font-semibold text-foreground mb-4">Asset Allocation</p>
                <div className="space-y-3">
                  {[
                    { label: 'Crypto', pct: 45, color: '#C9A84C' },
                    { label: 'Fiat',   pct: 28, color: '#627EEA' },
                    { label: 'Stocks', pct: 18, color: '#10B981' },
                    { label: 'Cash',   pct: 9,  color: '#9945FF' },
                  ].map((a, i) => (
                    <div key={a.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-foreground/60">{a.label}</span>
                        <span className="font-semibold text-foreground">{a.pct}%</span>
                      </div>
                      <AnimatedBar pct={a.pct} color={a.color} delay={0.4 + i * 0.08} />
                    </div>
                  ))}
                </div>
                <p className="text-xs font-semibold text-foreground mt-5 mb-3">Top Spending</p>
                <div className="space-y-2">
                  {[
                    { label: 'Travel',   amount: '$840', icon: Globe },
                    { label: 'Dining',   amount: '$420', icon: CreditCard },
                    { label: 'Shopping', amount: '$380', icon: Wallet },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><s.icon size={11} className="text-primary" /></div>
                      <span className="text-xs text-foreground/50 flex-1">{s.label}</span>
                      <span className="text-xs font-semibold text-foreground">{s.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.02] border border-primary/10">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-foreground">Recent Transactions</p>
                <Link to="/digital-banking" className="text-xs text-primary hover:text-primary/70 transition-colors flex items-center gap-1">View all <ArrowRight size={11} /></Link>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  { label: 'BTC Purchase',     amount: '-$1,200', icon: Bitcoin,    color: '#F7931A', time: '2m ago', sub: 'Crypto'   },
                  { label: 'Wire from Client', amount: '+$4,500', icon: Send,       color: '#10B981', time: '1h ago', sub: 'Incoming' },
                  { label: 'Card Payment',     amount: '-$84.50', icon: CreditCard, color: '#C9A84C', time: '3h ago', sub: 'Shopping' },
                ].map(tx => (
                  <div key={tx.label} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tx.color}15` }}><tx.icon size={15} style={{ color: tx.color }} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{tx.label}</p>
                      <p className="text-xs text-foreground/50">{tx.sub} · {tx.time}</p>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${tx.amount.startsWith('+') ? 'text-emerald-400' : 'text-foreground/60'}`}>{tx.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </motion.div>

        <div className="grid md:grid-cols-5 gap-4 mt-8">
          {home.dashboard.featureBullets.map((item, i) => {
            const BulletIcon = [BarChart3, PieChart, Bell, Eye, Layers][i] ?? BarChart3;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                className="flex items-center gap-3 p-4 glass-card rounded-2xl gradient-border">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><BulletIcon size={15} className="text-primary" /></div>
                <span className="text-xs font-medium text-foreground/60">{item.label}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── TransfersSection ──────────────────────────────────────────────────────────

export function TransfersSection() {
  const paymentFeatures = [
    { id: 'secure-authorisation', title: 'Secure authorisation', desc: 'Step-up authentication, transaction limits, account-ownership checks, and controlled approvals protect every instruction.' },
    { id: 'currency-configuration', title: 'Multi-currency configuration', desc: "Currency and corridor availability is governed by product configuration and the contracted provider's approved coverage." },
    { id: 'status-visibility', title: 'Payment status visibility', desc: 'Clear lifecycle notifications communicate authorisation, screening, execution, rejection, reversal, and reconciliation states.' },
    { id: 'business-governance', title: 'Business payment governance', desc: 'Maker-checker approvals, beneficiary controls, and auditable scheduling support controlled business-payment workflows.' },
  ];
  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute inset-0">
        <img src="/airo-assets/images/pages/home/global-transfers" alt="" width={1200} height={800} loading="lazy" className="w-full h-full object-cover opacity-[0.08]" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A0A0A] via-[#0A0A0A]/95 to-[#0A0A0A]" />
      </div>
      <div className="container mx-auto px-4 md:px-6 relative">
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">Global Payments Infrastructure</span>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
              International Payments<br /><span className="text-gold-gradient">With Institutional Controls</span>
            </h2>
            <p className="text-foreground/50 max-w-2xl mx-auto leading-relaxed">A provider-ready payment experience designed around transparent pricing, beneficiary controls, payment screening, status tracking, and reconciliation. Activation remains subject to an authorised payment provider.</p>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="space-y-4">
            <GlassCard className="rounded-3xl p-6" glow>
              <p className="text-xs font-semibold text-foreground/55 uppercase tracking-widest mb-5">Global payment instruction</p>
              <div className="mb-3">
                <p className="text-xs text-foreground/55 uppercase tracking-wide mb-2">Source account</p>
                <div className="flex gap-3">
                  <div className="flex-1 bg-white/[0.04] border border-primary/15 rounded-xl px-4 py-3 text-base font-semibold text-foreground">Choose an eligible account</div>
                  <div className="flex items-center gap-2 bg-white/[0.04] border border-primary/15 rounded-xl px-4 py-3"><Globe size={16} className="text-primary"/><span className="text-sm font-semibold text-foreground">Currency</span></div>
                </div>
              </div>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-primary/10" />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                  <RefreshCw size={11} className="text-primary" />
                  <span className="text-xs text-primary font-medium">Rate and fees disclosed before authorisation</span>
                </div>
                <div className="flex-1 h-px bg-primary/10" />
              </div>
              <div className="mb-5">
                <p className="text-xs text-foreground/55 uppercase tracking-wide mb-2">Beneficiary and destination</p>
                <div className="flex gap-3">
                  <div className="flex-1 bg-white/[0.04] border border-primary/20 rounded-xl px-4 py-3 text-base font-semibold text-gold-gradient">Verified recipient details</div>
                  <div className="flex items-center gap-2 bg-white/[0.04] border border-primary/15 rounded-xl px-4 py-3"><Shield size={16} className="text-primary"/><span className="text-sm font-semibold text-foreground">Corridor</span></div>
                </div>
              </div>
              <div className="space-y-2 p-4 rounded-xl bg-white/[0.02] border border-primary/8 mb-5">
                {[{ label: 'Account ownership', value: 'Verified', highlight: true }, { label: 'Beneficiary validation', value: 'Required', highlight: false }, { label: 'Payment screening', value: 'Provider controlled', highlight: false }].map(row => (
                  <div key={row.label} className="flex justify-between text-xs">
                    <span className="text-foreground/55">{row.label}</span>
                    <span className={row.highlight ? 'text-emerald-400 font-semibold' : 'text-foreground/70'}>{row.value}</span>
                  </div>
                ))}
              </div>
              <Link to="/digital-banking" className="group relative flex items-center justify-center gap-2.5 py-4 rounded-xl font-bold text-black overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                <Send size={15} className="relative" /><span className="relative">Explore Payment Capabilities</span>
                <ArrowRight size={15} className="relative transition-transform group-hover:translate-x-1" />
              </Link>
            </GlassCard>

            <GlassCard className="rounded-2xl p-5">
              <p className="text-xs font-semibold text-foreground/55 uppercase tracking-widest mb-4">Payment control framework</p>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-emerald-400/10 flex items-center justify-center shrink-0"><CheckCircle size={16} className="text-emerald-400" /></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Authorised instruction lifecycle</p>
                  <p className="text-xs text-foreground/55">Identity, limits, screening and reconciliation</p>
                </div>
                <span className="text-xs text-primary font-semibold bg-primary/10 px-2 py-1 rounded-full">Controlled</span>
              </div>
              <div className="flex items-center gap-1">
                {['Authorised','Screened','Executed','Reconciled'].map((step, i) => (
                  <div key={step} className="flex items-center gap-1 flex-1">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 bg-emerald-400 text-black">{i + 1}</div>
                    {i < 3 && <div className="flex-1 h-0.5 rounded-full bg-emerald-400/40" />}
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.15 }}>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[{ value: '6', label: 'Designed currencies' }, { value: '2FA', label: 'Step-up control' }, { value: '24/7', label: 'Status visibility' }].map((s, i) => (
                <StatBadge key={s.label} value={s.value} label={s.label} delay={0.1 + i * 0.08} />
              ))}
            </div>
            <p className="text-xs font-semibold text-foreground/55 uppercase tracking-widest mb-3">Payment architecture</p>
            <div className="space-y-2 mb-6">
              {[
                { from: 'GBP', to: 'Domestic', fee: 'Account', time: 'Provider' },
                { from: 'EUR', to: 'European', fee: 'FX', time: 'Provider' },
                { from: 'USD', to: 'International', fee: 'SWIFT', time: 'Provider' },
                { from: 'CAD · AUD · CHF', to: 'Expansion', fee: 'Phased', time: 'Approval' },
              ].map((c, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.07 }}
                  className="flex items-center gap-3 p-3.5 glass-card rounded-xl gradient-border hover:border-primary/25 transition-colors">
                  <span className="text-sm font-medium text-foreground/70 w-20 shrink-0">{c.from}</span>
                  <ArrowRight size={12} className="text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground/70 flex-1">{c.to}</span>
                  <span className="text-xs text-primary font-semibold">{c.fee}</span>
                  <span className="text-xs text-emerald-400 w-14 text-right">{c.time}</span>
                </motion.div>
              ))}
            </div>
            <div className="space-y-3">
              {paymentFeatures.map((item, i) => {
                const TIcon = [Shield, Globe, Bell, Layers][i] ?? Shield;
                return (
                  <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.07 }}
                    className="flex items-start gap-3 p-4 glass-card rounded-xl gradient-border hover:border-primary/20 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors"><TIcon size={14} className="text-primary" /></div>
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-0.5">{item.title}</p>
                      <p className="text-xs text-foreground/55 leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ── SecuritySection ───────────────────────────────────────────────────────────

export function SecuritySection() {
  const home = useHomepageContent();
  return (
    <section className="py-28 bg-[#060606]">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">{home.security.eyebrow}</span>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
              {home.security.headline1}<br /><span className="text-gold-gradient">{home.security.headlineAccent}</span>
            </h2>
            <p className="text-foreground/50 max-w-xl mx-auto leading-relaxed">{home.security.subheadline}</p>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.05 }}>
            <GlassCard className="rounded-3xl p-6 h-full" glow>
              <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-6">Security Score</p>
              <div className="relative w-36 h-36 mx-auto mb-6">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(201,168,76,0.1)" strokeWidth="8" />
                  <motion.circle cx="60" cy="60" r="50" fill="none" stroke="url(#scoreGrad)" strokeWidth="8" strokeLinecap="round" strokeDasharray="314"
                    initial={{ strokeDashoffset: 314 }} whileInView={{ strokeDashoffset: 314 * 0.03 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: 'easeOut' as const, delay: 0.3 }} />
                  <defs>
                    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#C9A84C" /><stop offset="100%" stopColor="#F0D080" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-gold-gradient" style={{ fontFamily: 'var(--font-heading)' }}>97</span>
                  <span className="text-xs text-foreground/40">/ 100</span>
                </div>
              </div>
              <p className="text-center text-sm font-semibold text-foreground mb-1">Security Center</p>
              <p className="text-center text-xs text-foreground/40 mb-6">Review and strengthen your account protection</p>
              <div className="space-y-3">
                {['Secure Sessions','Device Controls','Two-Factor Authentication','Identity Review','Service Availability'].map((item, i) => (
                  <motion.div key={item} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 + i * 0.07 }} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-400/15 flex items-center justify-center shrink-0"><CheckCircle size={11} className="text-emerald-400" /></div>
                    <span className="text-xs text-foreground/60">{item}</span>
                  </motion.div>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-primary/10">
                <p className="text-xs text-foreground/30 uppercase tracking-widest mb-3">Account Safeguards</p>
                <div className="flex flex-wrap gap-2">
                  {['Secure Cookies','CSRF Controls','Admin RBAC','Audit Events','Launch Guard'].map(badge => (
                    <span key={badge} className="text-[10px] font-bold px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">{badge}</span>
                  ))}
                </div>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
            {home.security.featureBullets.map((item, i) => {
              const SecIcon = [Shield, Fingerprint, Lock, Eye][i] ?? Shield;
              const secColors = ['#C9A84C','#10B981','#627EEA','#9945FF'];
              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 + i * 0.08 }}
                  className="glass-card rounded-2xl p-5 gradient-border hover:border-primary/25 transition-colors group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ background: `${secColors[i]}15` }}>
                    <SecIcon size={18} style={{ color: secColors[i] }} />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-2">{item.title}</p>
                  <p className="text-xs text-foreground/45 leading-relaxed">{item.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="lg:col-span-2">
            <GlassCard className="rounded-3xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-semibold text-foreground">KYC Verification</p>
                  <p className="text-xs text-foreground/40">Secure identity and eligibility review</p>
                </div>
                <span className="text-xs font-bold text-amber-300 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">Provider Required</span>
              </div>
              <div className="grid sm:grid-cols-4 gap-3 mb-5">
                {[
                  { icon: User,        step: '01', label: 'Personal Info',  desc: 'Name, DOB, address',      done: true },
                  { icon: Camera,      step: '02', label: 'ID Document',    desc: 'Passport or national ID', done: true },
                  { icon: Fingerprint, step: '03', label: 'Liveness Check', desc: 'Quick selfie scan',       done: true },
                  { icon: CheckCircle, step: '04', label: 'Review',         desc: 'Eligibility decision',     done: true },
                ].map((s, i) => (
                  <motion.div key={s.step} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.1 }}
                    className="relative p-4 rounded-2xl border text-center bg-primary/5 border-primary/25">
                    {i < 3 && <div className="hidden sm:block absolute top-1/2 -right-1.5 w-3 h-px bg-primary/30 z-10" />}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-3 bg-primary/15"><s.icon size={16} className="text-primary" /></div>
                    <p className="text-[10px] font-bold text-foreground/30 mb-1">{s.step}</p>
                    <p className="text-xs font-semibold text-foreground mb-1">{s.label}</p>
                    <p className="text-[10px] text-foreground/35 leading-tight">{s.desc}</p>
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-400/15 flex items-center justify-center"><CheckCircle size={9} className="text-emerald-400" /></div>
                  </motion.div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-primary/8">
                <Shield size={12} className="text-primary shrink-0" />
                <span className="text-xs text-foreground/40">Launch review needed for</span>
                {['USA','UK','EU','UAE','SG','CA','AU','other markets'].map(j => (
                  <span key={j} className="text-[10px] font-semibold text-foreground/50 bg-white/5 px-2 py-0.5 rounded-md">{j}</span>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="relative rounded-3xl overflow-hidden h-48">
          <img src="/airo-assets/images/pages/home/security" alt="Bank-grade security infrastructure" width={1200} height={800} loading="lazy" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#060606] via-transparent to-[#060606]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground mb-1 tracking-tight">{home.security.zeroIncidentsHeadline}</p>
              <p className="text-sm text-foreground/55">{home.security.zeroIncidentsSub}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── MobileAppSection ──────────────────────────────────────────────────────────

export function MobileAppSection() {
  const home = useHomepageContent();
  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-4 blur-[120px]" style={{ background: 'radial-gradient(circle, #C9A84C, transparent)' }} />
      <div className="container mx-auto px-4 md:px-6 relative">
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">{home.mobileApp.eyebrow}</span>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
              {home.mobileApp.headline1}<br /><span className="text-gold-gradient">{home.mobileApp.headlineAccent}</span>
            </h2>
            <p className="text-foreground/50 max-w-xl mx-auto leading-relaxed">{home.mobileApp.subheadline}</p>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-3 gap-10 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="space-y-4">
            {home.mobileApp.featureBullets.map((item, i) => {
              const MIcon = [Zap, Fingerprint, RefreshCw, PieChart, Send][i] ?? Zap;
              const mColors = ['#C9A84C','#10B981','#627EEA','#9945FF','#F7931A'];
              return (
                <motion.div key={item.id} initial={{ opacity: 0, x: -14 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 + i * 0.08 }}
                  className="flex items-start gap-4 p-4 glass-card rounded-2xl gradient-border hover:border-primary/25 transition-colors group">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110" style={{ background: `${mColors[i]}15` }}>
                    <MIcon size={16} style={{ color: mColors[i] }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-0.5">{item.title}</p>
                    <p className="text-xs text-foreground/40 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="flex justify-center relative">
            <div className="absolute inset-0 rounded-full blur-[60px] opacity-20" style={{ background: 'radial-gradient(circle, #C9A84C 0%, transparent 70%)' }} />
            <div className="relative w-60">
              <div className="relative rounded-[2.8rem] overflow-hidden border-2 border-primary/25" style={{ boxShadow: 'var(--gold-glow), 0 50px 100px rgba(0,0,0,0.7)' }}>
                <img src="/airo-assets/images/pages/home/mobile-app" alt="City Gate Capital mobile app" width={390} height={844} loading="lazy" className="w-full h-auto block" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/85 via-[#0A0A0A]/20 to-[#0A0A0A]/70 flex flex-col justify-between p-5 pointer-events-none">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] text-foreground/50">City Gate Capital</p>
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center"><Bell size={9} className="text-primary" /></div>
                    </div>
                    <p className="text-[10px] text-foreground/50 mb-0.5">Total Balance</p>
                    <p className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>$86,313</p>
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5"><TrendingUp size={8} /> +$2,140 today</p>
                  </div>
                  <div>
                    <div className="grid grid-cols-4 gap-1.5 mb-3">
                      {[{ icon: Send, label: 'Send' }, { icon: ArrowRight, label: 'Receive' }, { icon: RefreshCw, label: 'Exchange' }, { icon: CreditCard, label: 'Card' }].map(btn => (
                        <div key={btn.label} className="flex flex-col items-center gap-1">
                          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center"><btn.icon size={12} className="text-primary" /></div>
                          <span className="text-[8px] text-foreground/40">{btn.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="glass rounded-xl px-3 py-2 flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-400/15 flex items-center justify-center shrink-0"><CheckCircle size={9} className="text-emerald-400" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-medium text-foreground truncate">Wire Received</p>
                        <p className="text-[8px] text-foreground/30">Just now</p>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-400">+$4,500</span>
                    </div>
                  </div>
                </div>
              </div>
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' as const }}
                className="absolute -right-10 top-16 glass-card rounded-2xl px-3 py-2.5 gradient-border w-36" style={{ boxShadow: '0 8px 32px rgba(201,168,76,0.15)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 rounded-full bg-emerald-400/15 flex items-center justify-center"><TrendingUp size={8} className="text-emerald-400" /></div>
                  <span className="text-[9px] font-semibold text-foreground">BTC +5.2%</span>
                </div>
                <p className="text-[8px] text-foreground/40">Price alert triggered</p>
              </motion.div>
              <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' as const, delay: 1 }}
                className="absolute -left-10 bottom-24 glass-card rounded-2xl px-3 py-2.5 gradient-border w-32" style={{ boxShadow: '0 8px 32px rgba(201,168,76,0.15)' }}>
                <p className="text-[9px] font-bold text-primary mb-0.5">Mobile Access</p>
                <p className="text-[8px] text-foreground/40">Responsive web experience</p>
              </motion.div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.15 }} className="space-y-5">
            <div className="space-y-3">
              {[
                { store: 'App Store',   sub: 'Planned for', rating: '—', reviews: 'Not yet published', icon: Smartphone },
                { store: 'Google Play', sub: 'Planned for', rating: '—', reviews: 'Not yet published', icon: Smartphone },
              ].map((s, i) => (
                <motion.button key={s.store} type="button" aria-label={`${s.sub} ${s.store} — coming soon`}
                  initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.1 }}
                  className="w-full flex items-center gap-4 p-4 glass-card rounded-2xl gradient-border hover:border-primary/30 transition-colors group cursor-pointer">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors"><s.icon size={20} className="text-primary" /></div>
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
            <div className="grid grid-cols-2 gap-3">
              {[{ value: 'Web', label: 'Mobile Access' }, { value: '50+', label: 'Currency Views' }, { value: '2FA', label: 'Account Protection' }, { value: '24/7', label: 'Secure Access' }].map((s, i) => (
                <StatBadge key={s.label} value={s.value} label={s.label} delay={0.3 + i * 0.07} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {home.mobileApp.appChips.map(chip => (
                <span key={chip.id} className="text-xs px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-foreground/60 hover:text-foreground/80 hover:border-primary/25 transition-colors">{chip.label}</span>
              ))}
            </div>
            <div className="flex items-center gap-3 p-4 glass-card rounded-2xl gradient-border">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Award size={18} className="text-primary" /></div>
              <div>
                <p className="text-xs font-semibold text-foreground">{home.mobileApp.awardLabel}</p>
                <p className="text-xs text-foreground/40">{home.mobileApp.awardSub}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ── PricingSection ────────────────────────────────────────────────────────────

export function PricingSection() {
  const home = useHomepageContent();
  const [yearly, setYearly] = useState(false);
  return (
    <>
      <div className="flex items-center justify-center gap-3 mb-12">
        <span className={`text-sm transition-colors ${!yearly ? 'text-foreground font-semibold' : 'text-foreground/65'}`}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={yearly}
          aria-label="Use yearly pricing"
          onClick={() => setYearly(v => !v)}
          className={`relative w-12 h-6 rounded-full transition-colors ${yearly ? 'bg-primary' : 'bg-white/10'}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${yearly ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
        <span className={`text-sm transition-colors ${yearly ? 'text-foreground font-semibold' : 'text-foreground/65'}`}>
          Yearly <span className="ml-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">Save 20%</span>
        </span>
      </div>
      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {home.plans.map((plan, i) => {
          const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
          const PlanIcon = planIconMap[plan.name] ?? Wallet;
          return (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className={`relative rounded-3xl p-7 flex flex-col ${plan.highlight ? 'bg-gradient-to-b from-primary/15 to-primary/5 border border-primary/40' : 'glass-card gradient-border'}`}
              style={plan.highlight ? { boxShadow: 'var(--gold-glow)' } : {}}>
              {plan.badge && (
                <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold ${plan.highlight ? 'text-black' : 'text-white'}`}
                  style={{ background: plan.highlight ? 'linear-gradient(135deg, #C9A84C, #F0D080)' : `${plan.color}CC` }}>{plan.badge}</div>
              )}
              <div className="flex items-start mb-5">
                <div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${plan.color}18` }}><PlanIcon size={18} style={{ color: plan.color }} /></div>
                  <p className="text-xs text-foreground/55 uppercase tracking-widest mb-1">{plan.name}</p>
                  <p className="text-xs text-foreground/50 leading-snug">{plan.tagline}</p>
                </div>
              </div>
              <div className="mb-6">
                <div className="flex items-end gap-1">
                  {price === 0 ? (
                    <span className="text-4xl font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>Free</span>
                  ) : (
                    <><span className="text-4xl font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>${price}</span><span className="text-foreground/55 mb-1.5 text-sm">/mo</span></>
                  )}
                </div>
                {yearly && price > 0 && <p className="text-xs text-emerald-400 mt-1">Billed ${price * 12}/yr · Save ${(plan.monthlyPrice - price) * 12}/yr</p>}
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f.id} className={`flex items-start gap-2.5 text-xs ${f.included ? 'text-foreground/65' : 'text-foreground/25 line-through'}`}>
                    <CheckCircle size={13} className={`shrink-0 mt-0.5 ${f.included ? 'text-primary' : 'text-foreground/20'}`} />{f.label}
                  </li>
                ))}
              </ul>
              <Link to="/accounts" className={`block text-center py-3.5 rounded-xl text-sm font-bold transition-all ${plan.highlight ? 'bg-gradient-to-r from-primary to-[#F0D080] text-black hover:opacity-90' : 'glass border border-primary/20 text-foreground hover:border-primary/40'}`}>
                {plan.cta}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}

// ── TestimonialsSection ───────────────────────────────────────────────────────

export function TestimonialsSection() {
  const home = useHomepageContent();
  return (
    <div className="grid md:grid-cols-3 gap-5">
      {home.testimonials.items.map((t, i) => (
        <motion.div key={t.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
          className="glass-card rounded-2xl p-6 gradient-border hover:border-primary/25 transition-colors">
          <div className="flex gap-0.5 mb-4">
            {Array.from({ length: 5 }).map((_, j) => (
              <Star key={j} size={13} className={j < t.rating ? 'text-primary fill-primary' : 'text-foreground/20'} />
            ))}
          </div>
          <p className="text-sm text-foreground/65 leading-relaxed mb-5 italic">"{t.text}"</p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary shrink-0">{t.name[0]}</div>
            <div>
              <p className="text-xs font-semibold text-foreground">{t.name}</p>
              <p className="text-xs text-foreground/40">{t.role}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── FaqSection ────────────────────────────────────────────────────────────────

export function FaqSection() {
  const home = useHomepageContent();
  const [panelOpen, setPanelOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-3xl">
      <button
        type="button"
        onClick={() => setPanelOpen(open => !open)}
        aria-expanded={panelOpen}
        aria-controls="homepage-faq-panel"
        className="group flex w-full items-center justify-between rounded-2xl border border-primary/20 bg-primary/[0.035] px-5 py-4 text-left transition-colors hover:border-primary/40 md:px-6"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><HelpCircle size={20} /></span>
          <span><span className="block text-sm font-semibold text-foreground">Frequently asked questions</span><span className="mt-1 block text-xs text-foreground/55">Find quick answers about accounts, security, pricing and transfers.</span></span>
        </span>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform ${panelOpen ? 'rotate-180' : ''}`}><ChevronDown size={17} /></span>
      </button>

      {panelOpen && (
        <motion.div
          id="homepage-faq-panel"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 space-y-2 overflow-hidden"
        >
          {home.faq.items.map((faq, i) => (
            <motion.div key={faq.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }} className="overflow-hidden rounded-xl border border-primary/10 bg-white/[0.02]">
              <button type="button" onClick={() => setOpenId(openId === faq.id ? null : faq.id)} aria-expanded={openId === faq.id} className="group flex w-full items-center justify-between px-5 py-4 text-left">
                <span className="pr-4 text-sm font-medium text-foreground transition-colors group-hover:text-primary">{faq.q}</span>
                <ChevronDown size={14} className={`shrink-0 text-primary transition-transform ${openId === faq.id ? 'rotate-180' : ''}`} />
              </button>
              {openId === faq.id && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="px-5 pb-5">
                  <p className="text-sm leading-relaxed text-foreground/50">{faq.a}</p>
                </motion.div>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// ── CtaSection ────────────────────────────────────────────────────────────────

export function CtaSection({
  primaryTo = '/accounts',
  secondaryTo = '/digital-banking',
}: {
  primaryTo?: string;
  secondaryTo?: string;
} = {}) {
  const home = useHomepageContent();
  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-primary/4" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-10 blur-[100px]"
          style={{ background: 'radial-gradient(ellipse, #C9A84C 0%, transparent 70%)' }} />
      </div>
      <div className="container mx-auto px-4 md:px-6 relative text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-6 tracking-widest uppercase">{home.finalCta.badge}</span>
          <h2 className="text-4xl md:text-6xl font-bold text-foreground mb-6 tracking-tight leading-tight">
            {home.finalCta.headline1}<br /><span className="text-gold-shimmer">{home.finalCta.headlineAccent}</span>
          </h2>
          <p className="text-foreground/50 max-w-xl mx-auto mb-10 leading-relaxed">{home.finalCta.subheadline}</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <GoldButton to={primaryTo}>{home.finalCta.ctaPrimary}</GoldButton>
            <Link to={secondaryTo} className="inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground transition-colors">
              {home.finalCta.ctaSecondary} <ArrowRight size={14} />
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-10">
            {home.finalCta.featureStrip.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-foreground/35">
                <CheckCircle size={13} className="text-primary/60" />
                <span className="text-xs">{item.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
