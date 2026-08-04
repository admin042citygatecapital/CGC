import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { MessageCircle, Mail, Phone, ChevronDown, ChevronUp, Search, ArrowRight, Clock, Zap, Shield, BookOpen, CreditCard, Globe, Lock, Star } from 'lucide-react';

const categories = [
  { label: 'Getting Started', count: 12, icon: BookOpen,    color: '#C9A84C' },
  { label: 'Account & KYC',   count: 8,  icon: Shield,      color: '#627EEA' },
  { label: 'Cards & Payments',count: 15, icon: CreditCard,  color: '#10B981' },
  { label: 'Transfers',       count: 10, icon: Globe,       color: '#9945FF' },
  { label: 'Crypto & Wallet', count: 14, icon: Lock,        color: '#EC4899' },
  { label: 'Security',        count: 9,  icon: Shield,      color: '#F7931A' },
];

const faqs = [
  {
    category: 'Getting Started',
    q: 'How do I open an account?',
    a: 'Opening an account takes less than 5 minutes. Click "Open Account", provide your email, verify your identity with a government ID using our AI-powered KYC, and you\'re ready to go. No branch visit required.',
  },
  {
    category: 'Account & KYC',
    q: 'Is my money safe with City Gate Capital?',
    a: 'Yes. Fiat deposits are FDIC insured up to $250,000. Crypto assets are stored in cold storage with multi-signature security. We are regulated in 40+ jurisdictions and use 256-bit AES encryption on all data.',
  },
  {
    category: 'Transfers',
    q: 'What are the transfer fees?',
    a: 'Transfers between City Gate Capital accounts are always free. International transfers start at $0.99 with real mid-market exchange rates and no markup. Fees are always shown upfront before you confirm.',
  },
  {
    category: 'Transfers',
    q: 'How long do international transfers take?',
    a: 'Most international transfers arrive within minutes. In rare cases, transfers to certain countries may take 1-2 business days. You\'ll always see an estimated arrival time before confirming.',
  },
  {
    category: 'Crypto & Wallet',
    q: 'What cryptocurrencies do you support?',
    a: 'We support Bitcoin (BTC), Ethereum (ETH), Solana (SOL), USDT, USDC, BNB, and 50+ other cryptocurrencies. New assets are added regularly based on customer demand.',
  },
  {
    category: 'Cards & Payments',
    q: 'How do I freeze my card?',
    a: 'Open the app, go to Cards, select your card, and tap "Freeze". Your card is frozen instantly. You can unfreeze it just as quickly whenever you\'re ready.',
  },
  {
    category: 'Account & KYC',
    q: 'What is the daily transfer limit?',
    a: 'Standard accounts can transfer up to $10,000/day. Premium accounts have a $50,000/day limit. Elite accounts have custom limits. Limits can be increased by contacting support.',
  },
  {
    category: 'Getting Started',
    q: 'How do I contact support?',
    a: 'You can reach us via live chat in the app (fastest), email at support@citygate.capital, or phone at +44 7888 382458. Premium and Elite customers have priority support with dedicated lines.',
  },
  {
    category: 'Security',
    q: 'What security features protect my account?',
    a: 'Your account is protected by biometric authentication (Face ID / Touch ID), 256-bit AES encryption, 2-factor authentication, real-time fraud detection, and automatic session timeouts. We also offer hardware security key support.',
  },
  {
    category: 'Cards & Payments',
    q: 'Can I use my card internationally?',
    a: 'Yes. Your City Gate Capital card works in 180+ countries with zero foreign transaction fees. We use the real mid-market exchange rate with no markup. You\'ll receive instant notifications for every transaction.',
  },
];

function FaqItem({ q, a, category }: { q: string; a: string; category: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-primary/10 rounded-2xl overflow-hidden hover:border-primary/20 transition-colors">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-6 py-5 text-left group">
        <div className="flex-1 pr-4">
          <span className="text-[10px] text-primary/60 uppercase tracking-widest font-medium block mb-1">{category}</span>
          <span className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">{q}</span>
        </div>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${open ? 'bg-primary text-black' : 'bg-primary/10 text-primary'}`}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>
      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="px-6 pb-5">
          <p className="text-sm text-foreground/50 leading-relaxed">{a}</p>
        </motion.div>
      )}
    </div>
  );
}

const supportStats = [
  { value: '< 2 min',  label: 'Live Chat Response',  icon: Zap,           color: '#C9A84C' },
  { value: '< 2 hrs',  label: 'Email Response',      icon: Clock,         color: '#627EEA' },
  { value: '24/7',     label: 'Support Availability', icon: MessageCircle, color: '#10B981' },
  { value: '98%',      label: 'Satisfaction Rate',   icon: Star,          color: '#9945FF' },
];

export default function SupportPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = faqs.filter(f => {
    const matchSearch = f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All' || f.category === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <>
      <Helmet>
        <title>Customer Support — 24/7 Help & FAQ | City Gate Capital</title>
        <meta name="description" content="Get help with your City Gate Capital account. 24/7 live chat with under 2-minute response, email support, phone support, and a comprehensive FAQ covering accounts, transfers, crypto, and cards." />
        <link rel="canonical" href="https://citygate.capital/support" />
        <meta property="og:title" content="Customer Support — 24/7 Help & FAQ" />
        <meta property="og:description" content="24/7 live chat, email and phone support. Average response under 2 minutes. Comprehensive FAQ for all your banking questions." />
        <meta property="og:url" content="https://citygate.capital/support" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={(() => { const u = new URL('/api/og', 'https://citygate.capital'); u.searchParams.set('title', 'Customer Support'); u.searchParams.set('description', '24/7 Help & FAQ — Under 2 Minute Response'); return u.href; })()} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content="Customer Support — 24/7 Help & FAQ" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:creator" content="@CityGateCapital" />
        <meta name="twitter:title" content="Customer Support — City Gate Capital" />
        <meta name="twitter:description" content="24/7 live chat, email and phone support. Average response under 2 minutes." />
        <meta name="twitter:image" content={(() => { const u = new URL('/api/og', 'https://citygate.capital'); u.searchParams.set('title', 'Customer Support'); u.searchParams.set('description', '24/7 Help & FAQ — Under 2 Minute Response'); return u.href; })()} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          name: 'City Gate Capital Support FAQ',
          url: 'https://citygate.capital/support',
          mainEntity: faqs.map(faq => ({
            '@type': 'Question',
            name: faq.q,
            acceptedAnswer: { '@type': 'Answer', text: faq.a },
          })),
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://citygate.capital/' },
            { '@type': 'ListItem', position: 2, name: 'Support', item: 'https://citygate.capital/support' },
          ],
        })}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent" />
        <div className="container mx-auto px-4 md:px-6 relative text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-6 tracking-widest uppercase">
              Support Centre
            </span>
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight tracking-tight">
              How Can We <span className="text-gold-shimmer">Help?</span>
            </h1>
            <p className="text-xl text-foreground/50 mb-10 max-w-lg mx-auto">
              World-class support available 24/7. Find answers instantly or reach our team directly.
            </p>
            {/* Search */}
            <div className="relative max-w-xl mx-auto">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30" />
              <input
                type="text"
                placeholder="Search for answers..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full glass-card border border-primary/20 rounded-2xl pl-12 pr-4 py-4 text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Support stats */}
      <section className="py-12 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {supportStats.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="glass-card rounded-2xl p-5 gradient-border text-center">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: `${s.color}15` }}>
                  <s.icon size={18} style={{ color: s.color }} />
                </div>
                <p className="text-xl font-bold text-gold-gradient mb-0.5">{s.value}</p>
                <p className="text-xs text-foreground/40">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact channels */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-3xl font-bold text-foreground tracking-tight">
                Reach Us <span className="text-gold-gradient">Directly</span>
              </h2>
            </motion.div>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: MessageCircle,
                title: 'Live Chat',
                desc: 'Chat with our team in real time. Average response under 2 minutes. Available 24/7.',
                action: 'Start Chat',
                badge: '< 2 min',
                color: '#10B981',
              },
              {
                icon: Mail,
                title: 'Email Support',
                desc: 'Send us a detailed message at support@citygate.capital. We respond within 2 business hours with a full resolution.',
                action: 'Send Email',
                badge: '< 2 hrs',
                color: '#C9A84C',
              },
              {
                icon: Phone,
                title: 'Phone Support',
                desc: 'Speak directly with a specialist at +44 7888 382458. Available Mon–Fri 9am–6pm GMT. Priority for Premium & Elite.',
                action: 'Call Now',
                badge: 'Mon–Fri',
                color: '#627EEA',
              },
            ].map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card rounded-2xl p-7 gradient-border hover:border-primary/25 transition-colors group"
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{ background: `${c.color}15` }}>
                    <c.icon size={24} style={{ color: c.color }} />
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${c.color}15`, color: c.color }}>{c.badge}</span>
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{c.title}</h3>
                <p className="text-sm text-foreground/50 leading-relaxed mb-5">{c.desc}</p>
                <Link to="/contact" className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
                  style={{ color: c.color }}>
                  {c.action} <ArrowRight size={14} />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-2xl font-bold text-foreground mb-8 tracking-tight">Browse by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {categories.map((cat, i) => (
              <motion.button
                key={cat.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setActiveCategory(activeCategory === cat.label ? 'All' : cat.label)}
                className={`glass-card rounded-xl p-4 text-left transition-colors group ${activeCategory === cat.label ? 'border border-primary/40' : 'gradient-border hover:border-primary/30'}`}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                  style={{ background: `${cat.color}15` }}>
                  <cat.icon size={14} style={{ color: cat.color }} />
                </div>
                <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors mb-1">{cat.label}</p>
                <p className="text-[10px] text-foreground/30">{cat.count} articles</p>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-3xl font-bold text-foreground tracking-tight">
              Frequently Asked <span className="text-gold-gradient">Questions</span>
            </h2>
            {activeCategory !== 'All' && (
              <button onClick={() => setActiveCategory('All')} className="text-xs text-foreground/40 hover:text-foreground transition-colors">
                Clear filter
              </button>
            )}
          </div>
          <div className="space-y-3 max-w-3xl">
            {filtered.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
              >
                <FaqItem q={faq.q} a={faq.a} category={faq.category} />
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-foreground/40">
                <Search size={32} className="mx-auto mb-4 opacity-30" />
                <p className="text-sm">No results found for "{search}"</p>
                <button onClick={() => { setSearch(''); setActiveCategory('All'); }} className="mt-3 text-xs text-primary hover:underline">
                  Clear search
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Response time badges */}
      <section className="py-16 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Zap,     label: 'Live Chat',       time: '< 2 min',  desc: 'Average response time' },
              { icon: Clock,   label: 'Email',           time: '< 2 hrs',  desc: 'Business hours response' },
              { icon: Shield,  label: 'Security Issues', time: '< 15 min', desc: 'Priority escalation' },
            ].map((item, i) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="glass-card rounded-2xl p-5 gradient-border flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-foreground/40 uppercase tracking-wide">{item.label}</p>
                  <p className="text-lg font-bold text-gold-gradient">{item.time}</p>
                  <p className="text-xs text-foreground/40">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl font-bold text-foreground mb-4 tracking-tight">
              Still Need <span className="text-gold-gradient">Help?</span>
            </h2>
            <p className="text-foreground/50 mb-8 max-w-sm mx-auto">Our team is standing by 24/7. We'll get you sorted.</p>
            <Link to="/contact" className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-black overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
              <span className="relative">Contact Support</span>
              <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
