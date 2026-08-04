import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ArrowRight, TrendingUp, TrendingDown, RefreshCw, Shield, Lock, Zap, Globe, ArrowLeftRight, CheckCircle } from 'lucide-react';

const cryptoAssets = [
  { name: 'Bitcoin',   symbol: 'BTC',  color: '#F7931A', pct: 45, balance: '0.2122 BTC',  usd: '$14,301', up: true,  change: '+2.4%'  },
  { name: 'Ethereum',  symbol: 'ETH',  color: '#627EEA', pct: 28, balance: '2.519 ETH',   usd: '$8,898',  up: true,  change: '+1.8%'  },
  { name: 'Solana',    symbol: 'SOL',  color: '#9945FF', pct: 12, balance: '20.89 SOL',   usd: '$3,814',  up: false, change: '-0.6%'  },
  { name: 'USDT',      symbol: 'USDT', color: '#26A17B', pct: 8,  balance: '2,542 USDT',  usd: '$2,542',  up: true,  change: '+0.01%' },
  { name: 'BNB',       symbol: 'BNB',  color: '#F3BA2F', pct: 7,  balance: '3.71 BNB',    usd: '$2,225',  up: true,  change: '+3.1%'  },
];

const fiatCurrencies = [
  { name: 'US Dollar',        symbol: 'USD', flag: '🇺🇸', color: '#10B981', balance: '$12,450.00', rate: 'Base currency'   },
  { name: 'Euro',             symbol: 'EUR', flag: '🇪🇺', color: '#627EEA', balance: '€3,200.00',  rate: '1 EUR = $1.08'   },
  { name: 'British Pound',    symbol: 'GBP', flag: '🇬🇧', color: '#C9A84C', balance: '£1,850.00',  rate: '1 GBP = $1.27'   },
  { name: 'Japanese Yen',     symbol: 'JPY', flag: '🇯🇵', color: '#EC4899', balance: '¥95,000',    rate: '1 JPY = $0.0064' },
  { name: 'Singapore Dollar', symbol: 'SGD', flag: '🇸🇬', color: '#9945FF', balance: 'S$4,100.00', rate: '1 SGD = $0.74'   },
  { name: 'UAE Dirham',       symbol: 'AED', flag: '🇦🇪', color: '#F7931A', balance: 'د.إ2,600.00', rate: '1 AED = $0.27'  },
  { name: 'Swiss Franc',      symbol: 'CHF', flag: '🇨🇭', color: '#14B8A6', balance: 'CHF 980.00',  rate: '1 CHF = $1.12'  },
  { name: 'Canadian Dollar',  symbol: 'CAD', flag: '🇨🇦', color: '#A78BFA', balance: 'C$1,540.00',  rate: '1 CAD = $0.73'  },
];

const exchangePairs = [
  { from: 'BTC', to: 'USD', rate: '1 BTC = $67,420' },
  { from: 'ETH', to: 'EUR', rate: '1 ETH = €3,533' },
  { from: 'USD', to: 'GBP', rate: '1 USD = £0.79' },
  { from: 'SOL', to: 'USDT', rate: '1 SOL = 182.5 USDT' },
];

const securityFeatures = [
  { icon: Lock,   title: 'Cold Storage',         desc: '95% of crypto assets held in air-gapped cold storage vaults, never connected to the internet.',                   color: '#C9A84C' },
  { icon: Shield, title: 'Multi-Signature',       desc: 'All withdrawals require multiple cryptographic signatures, eliminating single points of failure.',                color: '#627EEA' },
  { icon: RefreshCw, title: 'Real-time Monitoring', desc: '24/7 automated threat detection with instant alerts and transaction blocking on suspicious activity.',          color: '#10B981' },
  { icon: Zap,    title: 'Instant Settlement',    desc: 'On-chain transactions settle in seconds. Fiat conversions happen at the real mid-market rate, instantly.',       color: '#9945FF' },
  { icon: Globe,  title: 'Global Compliance',     desc: 'Fully compliant with AML/KYC regulations in 40+ jurisdictions. Your assets are always protected by law.',       color: '#EC4899' },
  { icon: ArrowLeftRight, title: 'Seamless Exchange', desc: 'Swap between any crypto or fiat currency in your wallet at the best available rate, with no hidden fees.', color: '#F7931A' },
];

export default function WalletPage() {
  const [tab, setTab] = useState<'crypto' | 'fiat'>('crypto');
  const [fromAsset, setFromAsset] = useState('BTC');
  const [toAsset, setToAsset] = useState('USD');
  const [amount, setAmount] = useState('0.1');

  const totalCryptoUsd = '$31,780';

  return (
    <>
      <Helmet>
        <title>Crypto & Fiat Wallet — 50+ Currencies | CGC</title>
        <meta name="description" content="Manage Bitcoin, Ethereum, USDT, and 50+ fiat currencies in one secure wallet. Real exchange rates, zero hidden fees, institutional-grade cold storage security." />
        <link rel="canonical" href="https://citygate.capital/wallet" />
        <meta property="og:title" content="Crypto & Fiat Wallet — Hold 50+ Currencies" />
        <meta property="og:description" content="One wallet for every currency. 50+ crypto and fiat currencies, real exchange rates, institutional-grade cold storage." />
        <meta property="og:url" content="https://citygate.capital/wallet" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={(() => { const u = new URL('/api/og', 'https://citygate.capital'); u.searchParams.set('title', 'Crypto & Fiat Wallet'); u.searchParams.set('description', 'Hold 50+ Currencies with Zero Hidden Fees'); return u.href; })()} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content="Crypto & Fiat Wallet — Hold 50+ Currencies with Zero Hidden Fees" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:creator" content="@CityGateCapital" />
        <meta name="twitter:title" content="Crypto & Fiat Wallet — City Gate Capital" />
        <meta name="twitter:description" content="One wallet for every currency. 50+ crypto and fiat currencies, real exchange rates, zero hidden fees." />
        <meta name="twitter:image" content={(() => { const u = new URL('/api/og', 'https://citygate.capital'); u.searchParams.set('title', 'Crypto & Fiat Wallet'); u.searchParams.set('description', 'Hold 50+ Currencies with Zero Hidden Fees'); return u.href; })()} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Crypto & Fiat Wallet — City Gate Capital',
          url: 'https://citygate.capital/wallet',
          description: 'Manage Bitcoin, Ethereum, USDT, and 50+ fiat currencies in one secure wallet with real exchange rates.',
          mainEntity: {
            '@type': 'FinancialProduct',
            name: 'City Gate Capital Multi-Currency Wallet',
            description: 'Secure crypto and fiat wallet supporting 50+ currencies with institutional-grade cold storage.',
            provider: { '@type': 'Organization', name: 'City Gate Capital', url: 'https://citygate.capital' },
            feesAndCommissionsSpecification: 'Zero hidden fees. Real mid-market exchange rates.',
          },
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://citygate.capital/' },
            { '@type': 'ListItem', position: 2, name: 'Wallet', item: 'https://citygate.capital/wallet' },
          ],
        })}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative pt-40 pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent" />
        <div className="absolute top-1/2 right-0 w-[600px] h-[600px] rounded-full opacity-5 blur-[140px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #627EEA, transparent)' }} />
        <div className="container mx-auto px-4 md:px-6 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-6 tracking-widest uppercase">
                Multi-Currency Wallet
              </span>
              <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight tracking-tight">
                One Wallet,<br />
                <span className="text-gold-shimmer">Every Currency</span>
              </h1>
              <p className="text-xl text-foreground/50 mb-8 leading-relaxed">
                Hold, exchange and manage 50+ cryptocurrencies and fiat currencies in one beautifully unified wallet with institutional-grade security.
              </p>
              <div className="grid grid-cols-3 gap-3 mb-8">
                {[
                  { value: '50+',  label: 'Currencies' },
                  { value: '95%',  label: 'Cold Storage' },
                  { value: '$0',   label: 'Hidden Fees' },
                ].map(s => (
                  <div key={s.label} className="glass-card rounded-xl p-3.5 text-center gradient-border">
                    <p className="text-xl font-bold text-gold-gradient mb-0.5">{s.value}</p>
                    <p className="text-[10px] text-foreground/40 uppercase tracking-wide">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-4">
                <Link to="/accounts" className="group relative inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-bold text-black overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                  <span className="relative">Open Wallet</span>
                  <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" />
                </Link>
                <Link to="/transfers" className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-medium text-foreground/70 glass border border-primary/20 hover:border-primary/40 hover:text-foreground transition-colors">
                  View Transfers
                </Link>
              </div>
            </motion.div>

            {/* Wallet preview */}
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2 }}>
              <div className="glass-card rounded-3xl p-6 gradient-border" style={{ boxShadow: 'var(--gold-glow)' }}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs text-foreground/40 uppercase tracking-wide mb-0.5">Total Portfolio</p>
                    <p className="text-2xl font-bold text-foreground">{totalCryptoUsd}</p>
                  </div>
                  
                </div>
                <div className="space-y-2.5">
                  {cryptoAssets.slice(0, 4).map((asset, i) => (
                    <motion.div key={asset.symbol} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.07 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: `${asset.color}20`, color: asset.color }}>
                        {asset.symbol[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between">
                          <p className="text-xs font-semibold text-foreground">{asset.symbol}</p>
                          <p className="text-xs font-semibold text-foreground">{asset.usd}</p>
                        </div>
                        <div className="flex justify-between">
                          <p className="text-[10px] text-foreground/35">{asset.balance}</p>
                          <p className={`text-[10px] ${asset.up ? 'text-emerald-400' : 'text-red-400'}`}>{asset.change}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Wallet dashboard */}
      <section className="py-20 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-10">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-3xl font-bold text-foreground tracking-tight">
                Your <span className="text-gold-gradient">Assets</span>
              </h2>
            </motion.div>
          </div>
          {/* Tab switcher */}
          <div className="flex gap-2 mb-8 p-1.5 glass rounded-2xl w-fit mx-auto">
            {(['crypto', 'fiat'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all capitalize ${tab === t
                  ? 'bg-gradient-to-r from-primary to-[#F0D080] text-black'
                  : 'text-foreground/50 hover:text-foreground'}`}
              >
                {t === 'crypto' ? 'Crypto Assets' : 'Fiat Currencies'}
              </button>
            ))}
          </div>

          {tab === 'crypto' ? (
            <div className="space-y-3 max-w-3xl mx-auto">
              {cryptoAssets.map((asset, i) => (
                <motion.div
                  key={asset.symbol}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="glass-card rounded-2xl p-5 gradient-border flex items-center gap-5 hover:border-primary/25 transition-colors group"
                >
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: `${asset.color}20`, color: asset.color }}>
                    {asset.symbol[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-foreground text-sm">{asset.name}</p>
                        <p className="text-xs text-foreground/40">{asset.balance}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground text-sm">{asset.usd}</p>
                        <div className={`flex items-center gap-1 text-xs justify-end ${asset.up ? 'text-emerald-400' : 'text-red-400'}`}>
                          {asset.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {asset.change}
                        </div>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${asset.pct}%` }}
                        transition={{ delay: 0.3 + i * 0.07, duration: 0.7 }}
                        className="h-full rounded-full"
                        style={{ background: asset.color }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-foreground/30 shrink-0 w-8 text-right">{asset.pct}%</div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {fiatCurrencies.map((c, i) => (
                <motion.div
                  key={c.symbol}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="glass-card rounded-2xl p-5 gradient-border hover:border-primary/25 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{c.flag}</span>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{c.name}</p>
                      <p className="text-xs text-foreground/40">{c.symbol}</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-foreground mb-1">{c.balance}</p>
                  <p className="text-[10px] text-foreground/30">{c.rate}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Exchange mock */}
      <section className="py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                Instant Exchange
              </span>
              <h2 className="text-4xl font-bold text-foreground mb-5 tracking-tight">
                Swap Any Asset<br />
                <span className="text-gold-gradient">In Seconds</span>
              </h2>
              <p className="text-foreground/50 leading-relaxed mb-8">
                Exchange between crypto and fiat currencies instantly at the real mid-market rate. No spread markup, no hidden fees — just the best rate available.
              </p>
              <div className="space-y-3">
                {[
                  'Real mid-market exchange rates',
                  'Instant settlement on all pairs',
                  'No spread markup or hidden fees',
                  '50+ trading pairs available',
                  'Automatic best-rate routing',
                ].map(f => (
                  <div key={f} className="flex items-center gap-3 text-sm text-foreground/60">
                    <CheckCircle size={14} className="text-primary shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Exchange widget */}
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="glass-card rounded-3xl p-7 gradient-border" style={{ boxShadow: 'var(--gold-glow)' }}>
                <p className="text-sm font-semibold text-foreground mb-6">Quick Exchange</p>
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="text-xs text-foreground/40 uppercase tracking-wide mb-2 block">You Pay</label>
                    <div className="flex gap-3">
                      <input
                        type="number"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="flex-1 bg-white/[0.03] border border-primary/15 rounded-xl px-4 py-3 text-foreground text-lg font-semibold focus:outline-none focus:border-primary/40 transition-colors"
                      />
                      <select value={fromAsset} onChange={e => setFromAsset(e.target.value)}
                        className="bg-white/[0.03] border border-primary/15 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/40 transition-colors">
                        {['BTC', 'ETH', 'SOL', 'USDT', 'BNB'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-primary/10" />
                    <button className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
                      <ArrowLeftRight size={14} className="text-primary" />
                    </button>
                    <div className="flex-1 h-px bg-primary/10" />
                  </div>
                  <div>
                    <label className="text-xs text-foreground/40 uppercase tracking-wide mb-2 block">You Receive</label>
                    <div className="flex gap-3">
                      <div className="flex-1 bg-white/[0.03] border border-primary/20 rounded-xl px-4 py-3 text-xl font-bold text-gold-gradient">
                        {(parseFloat(amount || '0') * 67420).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </div>
                      <select value={toAsset} onChange={e => setToAsset(e.target.value)}
                        className="bg-white/[0.03] border border-primary/15 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/40 transition-colors">
                        {['USD', 'EUR', 'GBP', 'USDT', 'ETH'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 mb-5 p-4 rounded-xl bg-white/[0.02] border border-primary/10">
                  {exchangePairs.slice(0, 2).map(p => (
                    <div key={p.from} className="flex justify-between text-xs">
                      <span className="text-foreground/40">{p.from}/{p.to}</span>
                      <span className="text-foreground">{p.rate}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground/40">Fee</span>
                    <span className="text-primary">$0.00</span>
                  </div>
                </div>
                <Link to="/accounts" className="group relative flex items-center justify-center gap-2.5 py-4 rounded-xl font-bold text-black overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                  <span className="relative">Exchange Now</span>
                  <ArrowRight size={16} className="relative transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-24 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-14">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                Security
              </span>
              <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                Institutional-Grade <span className="text-gold-gradient">Security</span>
              </h2>
              <p className="text-foreground/50 max-w-md mx-auto">Your assets are protected by the same security infrastructure used by the world's largest financial institutions.</p>
            </motion.div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {securityFeatures.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card rounded-2xl p-7 gradient-border hover:border-primary/25 transition-colors group"
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
                  style={{ background: `${item.color}15` }}>
                  <item.icon size={22} style={{ color: item.color }} />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-3">{item.title}</h3>
                <p className="text-sm text-foreground/50 leading-relaxed">{item.desc}</p>
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
              Your Wallet, <span className="text-gold-gradient">Your Rules</span>
            </h2>
            <p className="text-foreground/50 mb-8 max-w-md mx-auto">Open your multi-currency wallet today. Free to start, no minimum balance required.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/accounts" className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-black overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                <span className="relative">Open Wallet</span>
                <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/transfers" className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-medium text-foreground/70 glass border border-primary/20 hover:border-primary/40 hover:text-foreground transition-colors">
                Learn About Transfers
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
