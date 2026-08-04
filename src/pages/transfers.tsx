import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { ArrowRight, Globe, Zap, DollarSign, Shield, RefreshCw, Send, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { trackConversion } from '@/lib/useAnalytics';

const corridors = [
  { from: '🇺🇸 USD', to: '🇬🇧 GBP', fee: '$0.99', time: 'Instant',  volume: 'Most popular' },
  { from: '🇺🇸 USD', to: '🇪🇺 EUR', fee: '$0.99', time: 'Instant',  volume: 'High volume'  },
  { from: '🇬🇧 GBP', to: '🇮🇳 INR', fee: '$1.49', time: '< 1 min', volume: 'Popular'       },
  { from: '🇺🇸 USD', to: '🇯🇵 JPY', fee: '$0.99', time: 'Instant',  volume: 'Popular'       },
  { from: '🇪🇺 EUR', to: '🇦🇺 AUD', fee: '$1.49', time: '< 1 min', volume: 'Growing'        },
  { from: '🇺🇸 USD', to: '🇦🇪 AED', fee: '$1.99', time: '< 5 min', volume: 'Business'       },
  { from: '🇺🇸 USD', to: '🇨🇦 CAD', fee: '$0.99', time: 'Instant',  volume: 'Popular'       },
  { from: '🇬🇧 GBP', to: '🇦🇺 AUD', fee: '$1.49', time: '< 1 min', volume: 'Growing'        },
  { from: '🇪🇺 EUR', to: '🇨🇭 CHF', fee: '$0.99', time: 'Instant',  volume: 'Business'       },
];

const transferTypes = [
  { icon: Zap,        title: 'Instant Transfer',     desc: 'Send money between City Gate accounts in seconds. Available 24/7, 365 days a year.',                    color: '#C9A84C', time: 'Instant' },
  { icon: Globe,      title: 'International Wire',   desc: 'Send to any bank account worldwide. Arrives in 1–5 business days depending on destination.',            color: '#627EEA', time: '1–5 days' },
  { icon: RefreshCw,  title: 'Scheduled Transfer',   desc: 'Set up recurring transfers on a daily, weekly, or monthly schedule. Never miss a payment.',             color: '#10B981', time: 'Scheduled' },
  { icon: TrendingUp, title: 'Bulk Payments',        desc: 'Send to multiple recipients in one click. Perfect for payroll, supplier payments, and distributions.',  color: '#9945FF', time: 'Batch' },
];

const rates: Record<string, Record<string, number>> = {
  USD: { EUR: 0.9210, GBP: 0.7920, JPY: 154.20, AUD: 1.5340, INR: 83.40, AED: 3.6725 },
  EUR: { USD: 1.0858, GBP: 0.8600, JPY: 167.40, AUD: 1.6640, INR: 90.50, AED: 3.9870 },
  GBP: { USD: 1.2626, EUR: 1.1628, JPY: 194.60, AUD: 1.9340, INR: 105.20, AED: 4.6370 },
};

const transferStatuses = [
  { label: 'Initiated',   done: true,  time: '14:32:01' },
  { label: 'Processing',  done: true,  time: '14:32:04' },
  { label: 'Compliance',  done: true,  time: '14:32:08' },
  { label: 'Sent',        done: true,  time: '14:32:11' },
  { label: 'Delivered',   done: false, time: 'Pending'  },
];

export default function TransfersPage() {
  const [amount, setAmount] = useState('1000');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const location = useLocation();

  const rateMap = rates[fromCurrency] || {};
  const rate = rateMap[toCurrency] || 0.9210;
  const fee = 0.99;
  const received = Math.max(0, (parseFloat(amount) || 0) * rate - fee).toFixed(2);

  return (
    <>
      <Helmet>
        <title>International Transfers — 180+ Countries | CGC</title>
        <meta name="description" content="Send money globally at real mid-market exchange rates. Instant transfers, international wires from $0.99, and scheduled payments to 180+ countries in 50+ currencies." />
        <link rel="canonical" href="https://citygate.capital/transfers" />
        <meta property="og:title" content="International Money Transfers — 180+ Countries from $0.99" />
        <meta property="og:description" content="Send to 180+ countries at real mid-market rates. From $0.99. Instant transfers available 24/7." />
        <meta property="og:url" content="https://citygate.capital/transfers" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={(() => { const u = new URL('/api/og', 'https://citygate.capital'); u.searchParams.set('title', 'International Transfers'); u.searchParams.set('description', '180+ Countries from $0.99 at Real Exchange Rates'); return u.href; })()} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content="International Money Transfers — 180+ Countries from $0.99" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:creator" content="@CityGateCapital" />
        <meta name="twitter:title" content="International Money Transfers — City Gate Capital" />
        <meta name="twitter:description" content="Send to 180+ countries at real mid-market rates. From $0.99. Instant." />
        <meta name="twitter:image" content={(() => { const u = new URL('/api/og', 'https://citygate.capital'); u.searchParams.set('title', 'International Transfers'); u.searchParams.set('description', '180+ Countries from $0.99 at Real Exchange Rates'); return u.href; })()} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'International Money Transfers — City Gate Capital',
          url: 'https://citygate.capital/transfers',
          description: 'Send money globally at real mid-market exchange rates to 180+ countries from $0.99.',
          mainEntity: {
            '@type': 'FinancialProduct',
            name: 'City Gate Capital International Transfers',
            description: 'Instant and scheduled international money transfers to 180+ countries at real mid-market rates.',
            provider: { '@type': 'Organization', name: 'City Gate Capital', url: 'https://citygate.capital' },
            feesAndCommissionsSpecification: 'From $0.99 per transfer. No hidden fees. Real mid-market exchange rates.',
            areaServed: '180+ countries',
          },
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://citygate.capital/' },
            { '@type': 'ListItem', position: 2, name: 'Transfers', item: 'https://citygate.capital/transfers' },
          ],
        })}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative pt-40 pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-5 blur-[140px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #627EEA, transparent)' }} />
        <div className="container mx-auto px-4 md:px-6 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-6 tracking-widest uppercase">
                Global Transfers
              </span>
              <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight tracking-tight">
                Send Money<br />
                <span className="text-gold-shimmer">Anywhere, Instantly</span>
              </h1>
              <p className="text-xl text-foreground/50 mb-8 leading-relaxed">
                Transfer funds to 180+ countries at the real mid-market exchange rate. Transparent fees from $0.99. No hidden charges. Ever.
              </p>
              <div className="grid grid-cols-3 gap-3 mb-8">
                {[
                  { value: '180+',  label: 'Countries' },
                  { value: '$0.99', label: 'From' },
                  { value: '50+',   label: 'Currencies' },
                ].map(s => (
                  <div key={s.label} className="glass-card rounded-xl p-3.5 text-center gradient-border">
                    <p className="text-xl font-bold text-gold-gradient mb-0.5">{s.value}</p>
                    <p className="text-[10px] text-foreground/40 uppercase tracking-wide">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2.5">
                {['Real mid-market exchange rates', 'No hidden fees or spread markup', 'Instant transfers between CGC accounts', 'Scheduled & recurring payments'].map(f => (
                  <div key={f} className="flex items-center gap-3 text-sm text-foreground/60">
                    <CheckCircle size={14} className="text-primary shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Transfer calculator */}
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2 }}>
              <div className="glass-card rounded-3xl p-7 gradient-border" style={{ boxShadow: 'var(--gold-glow)' }}>
                <p className="text-sm font-semibold text-foreground mb-6">Transfer Calculator</p>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-xs text-foreground/40 uppercase tracking-wide mb-2 block">You Send</label>
                    <div className="flex gap-3">
                      <input
                        type="number"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="flex-1 bg-white/[0.03] border border-primary/15 rounded-xl px-4 py-3 text-foreground text-lg font-semibold focus:outline-none focus:border-primary/40 transition-colors"
                      />
                      <select
                        value={fromCurrency}
                        onChange={e => setFromCurrency(e.target.value)}
                        className="bg-white/[0.03] border border-primary/15 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/40 transition-colors"
                      >
                        {['USD', 'EUR', 'GBP', 'JPY', 'AUD'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-primary/10" />
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <RefreshCw size={14} className="text-primary" />
                    </div>
                    <div className="flex-1 h-px bg-primary/10" />
                  </div>

                  <div>
                    <label className="text-xs text-foreground/40 uppercase tracking-wide mb-2 block">Recipient Gets</label>
                    <div className="flex gap-3">
                      <div className="flex-1 bg-white/[0.03] border border-primary/20 rounded-xl px-4 py-3 text-2xl font-bold text-gold-gradient">
                        {received}
                      </div>
                      <select
                        value={toCurrency}
                        onChange={e => setToCurrency(e.target.value)}
                        className="bg-white/[0.03] border border-primary/15 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/40 transition-colors"
                      >
                        {['EUR', 'GBP', 'USD', 'JPY', 'AUD', 'INR', 'AED'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-6 p-4 rounded-xl bg-white/[0.02] border border-primary/10">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground/40">Exchange Rate</span>
                    <span className="text-foreground">1 {fromCurrency} = {rate} {toCurrency}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground/40">Transfer Fee</span>
                    <span className="text-primary">${fee}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground/40">Arrival</span>
                    <span className="text-emerald-400">Instant</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground/40">Rate Type</span>
                    <span className="text-foreground/60">Mid-market (no markup)</span>
                  </div>
                </div>

                <Link to="/accounts" onClick={() => trackConversion('transfer_initiated', location.pathname, { amount: parseFloat(amount) || 0, from: fromCurrency, to: toCurrency })} className="group relative flex items-center justify-center gap-2.5 py-4 rounded-xl font-bold text-black overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                  <Send size={16} className="relative" />
                  <span className="relative">Send Now</span>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Transfer types */}
      <section className="py-20 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                Transfer Types
              </span>
              <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                Every Way to <span className="text-gold-gradient">Send Money</span>
              </h2>
            </motion.div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {transferTypes.map((t, i) => (
              <motion.div key={t.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="glass-card rounded-2xl p-6 gradient-border hover:border-primary/25 transition-colors group">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ background: `${t.color}15` }}>
                  <t.icon size={20} style={{ color: t.color }} />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
                </div>
                <div className="flex items-center gap-1.5 mb-3">
                  <Clock size={10} className="text-foreground/30" />
                  <span className="text-[10px] text-foreground/30">{t.time}</span>
                </div>
                <p className="text-xs text-foreground/50 leading-relaxed">{t.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Live transfer tracker */}
      <section className="py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                Real-time Tracking
              </span>
              <h2 className="text-4xl font-bold text-foreground mb-5 tracking-tight">
                Track Every Transfer<br />
                <span className="text-gold-gradient">In Real Time</span>
              </h2>
              <p className="text-foreground/50 leading-relaxed mb-8">
                Know exactly where your money is at every step. Real-time status updates, push notifications, and full audit trail for every transfer.
              </p>
              <div className="space-y-3">
                {['Real-time status updates', 'Push notification at every step', 'Full transfer audit trail', 'Recipient confirmation alerts', 'Instant failure notifications'].map(f => (
                  <div key={f} className="flex items-center gap-3 text-sm text-foreground/60">
                    <CheckCircle size={14} className="text-primary shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Status tracker */}
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="glass-card rounded-3xl p-7 gradient-border" style={{ boxShadow: 'var(--gold-glow)' }}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Transfer #TXN-2847</p>
                    <p className="text-xs text-foreground/40">$1,000 USD → €921 EUR</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold text-emerald-400">Live</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {transferStatuses.map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${s.done ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-white/5 border border-white/10'}`}>
                        {s.done
                          ? <CheckCircle size={14} className="text-emerald-400" />
                          : <div className="w-2 h-2 rounded-full bg-white/20" />
                        }
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${s.done ? 'text-foreground' : 'text-foreground/30'}`}>{s.label}</p>
                      </div>
                      <span className={`text-xs ${s.done ? 'text-foreground/40' : 'text-foreground/20'}`}>{s.time}</span>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-6 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                  <p className="text-xs text-emerald-400 font-medium">4 of 5 steps complete — Delivery in progress</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Popular corridors */}
      <section className="py-24 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                Popular <span className="text-gold-gradient">Corridors</span>
              </h2>
              <p className="text-foreground/50 max-w-sm mx-auto">The most-used transfer routes, with the best rates.</p>
            </motion.div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {corridors.map((c, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="glass-card rounded-2xl p-5 gradient-border flex items-center justify-between hover:border-primary/25 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{c.from}</span>
                  <ArrowRight size={14} className="text-primary" />
                  <span className="text-sm font-medium text-foreground">{c.to}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-primary font-semibold">{c.fee}</p>
                  <p className="text-xs text-emerald-400">{c.time}</p>
                  <p className="text-[10px] text-foreground/25 mt-0.5">{c.volume}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* Features strip */}
      <section className="py-16 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-4 gap-5">
            {[
              { icon: Globe,      title: '180+ Countries',  desc: 'Send to virtually anywhere in the world.' },
              { icon: Zap,        title: 'Instant Transfers', desc: 'Most transfers arrive in seconds, not days.' },
              { icon: DollarSign, title: 'Real Rates',       desc: 'Mid-market exchange rates, always.' },
              { icon: Shield,     title: 'Fully Secure',     desc: 'Bank-grade encryption on every transfer.' },
            ].map((item, i) => (
              <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="glass-card rounded-2xl p-6 gradient-border text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon size={20} className="text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-xs text-foreground/50 leading-relaxed">{item.desc}</p>
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
              Start Sending <span className="text-gold-gradient">Today</span>
            </h2>
            <p className="text-foreground/50 mb-8 max-w-md mx-auto">Open your free account and send your first transfer in under 5 minutes.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/accounts" className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-black overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                <span className="relative">Open Free Account</span>
                <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/wallet" className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-medium text-foreground/70 glass border border-primary/20 hover:border-primary/40 hover:text-foreground transition-colors">
                View Wallet
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
