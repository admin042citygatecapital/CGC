import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, ArrowRight, Globe, Heart, Landmark, Shield, TrendingUp, Users, WalletCards, Zap } from 'lucide-react';

const stats = [
  { value: 'Build', label: 'Current Stage', sub: 'Sponsor readiness' },
  { value: 'Web', label: 'Architecture', sub: 'Managed deployment' },
  { value: '50+', label: 'Currencies', sub: 'Global account vision' },
  { value: '3', label: 'Account Views', sub: 'Personal, savings, business' },
  { value: '2FA', label: 'Account Security', sub: 'Implemented control' },
  { value: '1', label: 'Unified Platform', sub: 'Web and administration' },
];

const values = [
  { icon: Shield,   title: 'Security by Design',     desc: 'Protective controls support secure access to financial information and services.',                                     color: '#C9A84C' },
  { icon: Globe,    title: 'Global Product Vision',  desc: 'A connected multi-currency experience designed around approved geographic and provider coverage.',                    color: '#627EEA' },
  { icon: TrendingUp, title: 'Measured Improvement', desc: 'Customer outcomes, reliability and security guide every product decision.',                                             color: '#10B981' },
  { icon: Users,    title: 'User-Centred Design',    desc: 'Design clear account, support, and administration workflows around user needs and accessibility.',                      color: '#9945FF' },
  { icon: Heart,    title: 'Truthful Communication', desc: 'Clearly distinguish current availability, proposed terms and verified provider capabilities.',                       color: '#EC4899' },
  { icon: Zap,      title: 'Simple Experiences',     desc: 'Turn complex operational workflows into understandable, accessible interfaces.',                                      color: '#F7931A' },
];

const milestones = [
  { year: '01', event: 'Defined the City Gate Capital product vision and premium global-finance experience.' },
  { year: '02', event: 'Built the responsive public website, authentication flows, and customer dashboard.' },
  { year: '03', event: 'Added account, transfer, card, wallet, analytics and market-planning interfaces.' },
  { year: '04', event: 'Built the administration workspace with role-based access and audit logging.' },
  { year: '05', event: 'Hardened sessions, CSRF controls, production configuration, and deployment checks.' },
  { year: 'Next', event: 'Complete legal approvals and contracted KYC, AML, payment, banking, and custody integrations before any live financial launch.' },
];

const leadership = [
  { name: 'Product', role: 'Experience & Research', initials: 'PX', color: '#C9A84C', bg: 'from-primary/20 to-primary/5', bio: 'Shapes clear, accessible journeys for the public and customer experiences.' },
  { name: 'Engineering', role: 'Platform & Reliability', initials: 'EN', color: '#627EEA', bg: 'from-blue-500/20 to-blue-500/5', bio: 'Builds the web application, APIs, data layer, and operational tooling.' },
  { name: 'Security', role: 'Identity & Protection', initials: 'SE', color: '#9945FF', bg: 'from-purple-500/20 to-purple-500/5', bio: 'Owns authentication controls, secure defaults, monitoring, and incident readiness.' },
  { name: 'Compliance', role: 'Launch Readiness', initials: 'CO', color: '#10B981', bg: 'from-emerald-500/20 to-emerald-500/5', bio: 'Coordinates legal review and required provider approvals before live operation.' },
];

const bankingCapabilities = [
  { icon: Landmark, title: 'Personal Banking', detail: 'Accounts designed around everyday financial needs' },
  { icon: WalletCards, title: 'Business Banking', detail: 'Structured controls for growing organisations' },
  { icon: ArrowLeftRight, title: 'Global Payments', detail: 'Multi-currency payment and beneficiary journeys' },
];

export default function AboutPage() {
  return (
    <>
      <Helmet>
        <title>About City Gate Capital — Our Mission, Values & Team</title>
        <meta name="description" content="Learn about the City Gate Capital mission, financial-technology platform, security approach, and partnership-led path to launch." />
        <link rel="canonical" href="https://citygate.capital/about" />
        <meta property="og:title" content="About City Gate Capital — Our Mission, Values & Team" />
        <meta property="og:description" content="Explore the City Gate Capital product vision and the work required before a live financial-services launch." />
        <meta property="og:url" content="https://citygate.capital/about" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="About City Gate Capital — Our Mission, Values & Team" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:creator" content="@CityGateCapital" />
        <meta name="twitter:title" content="About City Gate Capital — Our Mission, Values & Team" />
        <meta name="twitter:description" content="Explore the City Gate Capital mission, technology platform, and partnership-led path to launch." />
        <meta name="twitter:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: 'About City Gate Capital',
          url: 'https://citygate.capital/about',
          mainEntity: {
            '@type': 'Organization',
            '@id': 'https://citygate.capital/#organization',
            name: 'City Gate Capital',
            url: 'https://citygate.capital',
            logo: {
              '@type': 'ImageObject',
              url: 'https://citygate.capital/assets/brand/city-gate-capital-seal.png',
              width: 200,
              height: 200,
            },
            description: 'A financial-technology company developing secure operational infrastructure and provider-ready customer experiences.',
          },
        }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://citygate.capital/' },
            { '@type': 'ListItem', position: 2, name: 'About', item: 'https://citygate.capital/about' },
          ],
        }) }} />
      </Helmet>

      {/* Hero */}
      <section className="relative pt-40 pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] opacity-6 blur-[120px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, #C9A84C, transparent)' }} />
        <div className="container mx-auto px-4 md:px-6 relative text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-6 tracking-widest uppercase">
              Our Story
            </span>
            <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight tracking-tight">
              Banking Built for<br />
              <span className="text-gold-gradient">Global Citizens</span>
            </h1>
            <p className="text-xl text-foreground/50 mb-10 leading-relaxed max-w-2xl mx-auto">
              City Gate Capital is being built around a simple belief: global financial tools should be clear, secure, and accessible. We develop the technology and operational controls required to deliver that vision responsibly.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/contact" className="group relative inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-bold text-black overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                <span className="relative">Discuss a Partnership</span>
                <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/contact" className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-medium text-foreground/70 glass border border-primary/20 hover:border-primary/40 hover:text-foreground transition-colors">
                Contact Us
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Banking platform showcase */}
      <section className="pb-20">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl border border-primary/20 bg-[#080806] p-7 md:p-12"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(201,168,76,0.16),transparent_42%)]" />
            <div className="relative grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  <Landmark size={14} /> Banking Platform
                </span>
                <h2 className="max-w-xl text-3xl font-bold leading-tight text-foreground md:text-5xl">
                  Connected banking for <span className="text-gold-gradient">modern financial life</span>
                </h2>
                <p className="mt-5 max-w-xl text-sm leading-7 text-foreground/55 md:text-base">
                  One premium experience for personal accounts, business finances, multi-currency services, beneficiaries, statements, and secure account management.
                </p>
                <Link to="/accounts" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-black transition-transform hover:-translate-y-0.5">
                  Explore Account Options <ArrowRight size={16} />
                </Link>
              </div>

              <div className="relative">
                <div className="absolute inset-8 rounded-full bg-primary/10 blur-3xl" />
                <div className="relative rounded-3xl border border-primary/15 bg-black/35 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:p-7">
                  <div className="mb-6 flex items-center gap-4 border-b border-primary/10 pb-5">
                    <img src="/assets/brand/city-gate-capital-seal.png" alt="City Gate Capital" width={72} height={72} className="h-14 w-14 object-contain md:h-16 md:w-16" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">City Gate Capital</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">Premium digital banking</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {bankingCapabilities.map(({ icon: CapabilityIcon, title, detail }) => (
                      <div key={title} className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CapabilityIcon size={20} /></div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{title}</p>
                          <p className="mt-1 text-xs leading-5 text-foreground/45">{detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="glass-card rounded-2xl p-5 gradient-border text-center"
              >
                <p className="text-2xl font-bold text-gold-gradient mb-1" style={{ fontFamily: 'var(--font-heading)' }}>{s.value}</p>
                <p className="text-xs font-semibold text-foreground mb-0.5">{s.label}</p>
                <p className="text-[10px] text-foreground/50">{s.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission statement */}
      <section className="py-24">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative glass-card rounded-3xl p-10 md:p-16 gradient-border text-center"
            style={{ boxShadow: 'var(--gold-glow)' }}
          >
            <div className="absolute top-0 left-0 w-24 h-24 border-t-2 border-l-2 border-primary/30 rounded-tl-3xl" />
            <div className="absolute bottom-0 right-0 w-24 h-24 border-b-2 border-r-2 border-primary/30 rounded-br-3xl" />
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-6 tracking-widest uppercase">
              Our Mission
            </span>
            <p className="text-2xl md:text-3xl font-medium text-foreground/80 leading-relaxed max-w-3xl mx-auto">
              "To design global financial tools that are clear, secure, and accessible — and to launch them only when the required legal and operational protections are in place."
            </p>
            <p className="text-sm text-foreground/55 mt-6">— City Gate Capital product mission</p>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-14">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                Our Values
              </span>
              <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                What We <span className="text-gold-gradient">Stand For</span>
              </h2>
            </motion.div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card rounded-2xl p-7 gradient-border hover:border-primary/25 transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
                  style={{ background: `${v.color}15` }}>
                  <v.icon size={22} style={{ color: v.color }} />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-3">{v.title}</h3>
                <p className="text-sm text-foreground/50 leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                History
              </span>
              <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                Our <span className="text-gold-gradient">Journey</span>
              </h2>
            </motion.div>
          </div>
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <div className="absolute left-16 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent" />
              <div className="space-y-6">
                {milestones.map((m, i) => (
                  <motion.div
                    key={m.year}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="flex gap-8 items-start"
                  >
                    <div className="w-16 shrink-0 text-right pt-3">
                      <span className="text-sm font-bold text-primary">{m.year}</span>
                    </div>
                    <div className="relative flex-1">
                      <div className="absolute -left-[25px] top-4 w-3 h-3 rounded-full bg-primary border-2 border-[#0A0A0A]" />
                      <div className="glass-card rounded-xl p-4 gradient-border hover:border-primary/20 transition-colors">
                        <p className="text-sm text-foreground/70 leading-relaxed">{m.event}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Leadership */}
      <section className="py-20 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-14">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                The Workstreams
              </span>
              <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                The <span className="text-gold-gradient">Team</span> Behind It
              </h2>
              <p className="text-foreground/50 max-w-md mx-auto">World-class talent from Goldman Sachs, Stripe, JP Morgan, NSA, Revolut, and more.</p>
            </motion.div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {leadership.map((l, i) => (
              <motion.div
                key={l.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="glass-card rounded-2xl p-6 gradient-border text-center hover:border-primary/25 transition-colors group"
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${l.bg} flex items-center justify-center mx-auto mb-4 text-lg font-bold transition-transform group-hover:scale-105`}
                  style={{ color: l.color }}>
                  {l.initials}
                </div>
                <p className="font-semibold text-foreground text-sm mb-0.5">{l.name}</p>
                <p className="text-xs text-primary mb-2">{l.role}</p>
                <p className="text-xs text-foreground/55 leading-relaxed">{l.bio}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl font-bold text-foreground mb-5 tracking-tight">
              Join Our <span className="text-gold-gradient">Mission</span>
            </h2>
            <p className="text-foreground/50 mb-8 max-w-md mx-auto">Work with us on secure technology, compliance operations, and the partnerships required for responsible delivery.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/contact" className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-black overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                <span className="relative">Discuss a Partnership</span>
                <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/contact" className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-medium text-foreground/70 glass border border-primary/20 hover:border-primary/40 hover:text-foreground transition-colors">
                Contact Us
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
