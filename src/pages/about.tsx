import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Globe, Users, TrendingUp, Award, Zap, Heart } from 'lucide-react';

const stats = [
  { value: 'Preview', label: 'Current Stage', sub: 'Product validation' },
  { value: '24/7', label: 'Architecture', sub: 'Designed for availability' },
  { value: '50+', label: 'Currencies', sub: 'Prototype coverage' },
  { value: '3', label: 'Account Views', sub: 'Personal, savings, business' },
  { value: '2FA', label: 'Account Security', sub: 'Supported in preview' },
  { value: '1', label: 'Unified Platform', sub: 'Web and administration' },
];

const values = [
  { icon: Shield,   title: 'Security First',        desc: 'Every decision we make starts with one question: is this safe for our customers? Security is never a trade-off.',       color: '#C9A84C' },
  { icon: Globe,    title: 'Borderless Finance',     desc: 'We believe financial services should work as seamlessly across borders as the internet does. Geography is not a barrier.', color: '#627EEA' },
  { icon: TrendingUp, title: 'Relentless Innovation', desc: 'We ship fast, learn faster, and never stop improving the platform our customers depend on every single day.',            color: '#10B981' },
  { icon: Users,    title: 'Customer Obsession',     desc: 'Our customers are at the centre of every product decision, every policy, every hire. Their success is our success.',     color: '#9945FF' },
  { icon: Heart,    title: 'Radical Transparency',   desc: 'No hidden fees, no fine print surprises. We tell you exactly what things cost and why — always.',                        color: '#EC4899' },
  { icon: Zap,      title: 'Speed & Simplicity',     desc: 'Complex financial infrastructure, beautifully simple experience. We do the hard work so you don\'t have to.',           color: '#F7931A' },
];

const milestones = [
  { year: '01', event: 'Defined the City Gate Capital product vision and premium global-finance experience.' },
  { year: '02', event: 'Built the responsive public website, authentication flows, and customer dashboard.' },
  { year: '03', event: 'Added account, transfer, card, wallet, analytics, and paper-trading demonstrations.' },
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

const awards = [
  { title: 'Responsive Experience', org: 'Product preview' },
  { title: 'Secure Administration', org: 'Role-based controls' },
  { title: 'Release Guardrails', org: 'Preview-safe deployment' },
];

export default function AboutPage() {
  return (
    <>
      <Helmet>
        <title>About City Gate Capital — Our Mission, Values & Team</title>
        <meta name="description" content="Learn about the City Gate Capital product vision, preview platform, security approach, and path to a compliant financial-services launch." />
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
        <meta name="twitter:description" content="Explore the City Gate Capital product vision and preview platform." />
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
            description: 'A product-preview platform exploring multi-currency accounts, transfers, cards, analytics, and administration.',
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
              City Gate Capital is being built around a simple belief: global financial tools should be clear, secure, and accessible. This site currently demonstrates that product direction.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/accounts" className="group relative inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-bold text-black overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                <span className="relative">Open Account</span>
                <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/contact" className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-medium text-foreground/70 glass border border-primary/20 hover:border-primary/40 hover:text-foreground transition-colors">
                Contact Us
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Team image */}
      <section className="pb-20">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden h-80 md:h-[480px]"
          >
            <img src="/airo-assets/images/pages/about/team" alt="City Gate Capital team" width={1200} height={800} loading="lazy" className="w-full h-full object-cover opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent" />
            <div className="absolute inset-0 border border-primary/15 rounded-3xl" />
            <div className="absolute bottom-8 left-8 right-8 flex flex-wrap gap-3">
              {awards.map(a => (
                <div key={a.title} className="flex items-center gap-2 glass px-3 py-2 rounded-xl border border-primary/20">
                  <Award size={12} className="text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{a.title}</p>
                    <p className="text-[10px] text-foreground/55">{a.org}</p>
                  </div>
                </div>
              ))}
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
            <p className="text-foreground/50 mb-8 max-w-md mx-auto">Be part of the future of banking. Open your account today — free, instant, no paperwork.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/accounts" className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-black overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                <span className="relative">Create Preview Profile</span>
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
