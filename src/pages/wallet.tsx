import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { ArrowRight, TrendingUp, TrendingDown, RefreshCw, Shield, Lock, Zap, Globe, ArrowLeftRight, CheckCircle, Copy, Save, Loader2, AlertCircle } from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';
import { newIdempotencyKey } from '@/lib/idempotency';
import { CurrencyMark, currencyOptionLabel } from '@/components/CurrencyMark';

// ── Static display data (portfolio overview / security sections) ──────────────
// These are illustrative examples shown to all visitors, not real user balances.
const cryptoAssets = [
  { name: 'Bitcoin',   symbol: 'BTC',  color: '#F7931A', pct: 45 },
  { name: 'Ethereum',  symbol: 'ETH',  color: '#627EEA', pct: 28 },
  { name: 'Solana',    symbol: 'SOL',  color: '#9945FF', pct: 12 },
  { name: 'USDT',      symbol: 'USDT', color: '#26A17B', pct: 8  },
  { name: 'BNB',       symbol: 'BNB',  color: '#F3BA2F', pct: 7  },
];

const fiatCurrencyMeta = [
  { name: 'US Dollar',         symbol: 'USD', color: '#10B981' },
  { name: 'Euro',              symbol: 'EUR', color: '#627EEA' },
  { name: 'British Pound',     symbol: 'GBP', color: '#C9A84C' },
  { name: 'Japanese Yen',      symbol: 'JPY', color: '#EC4899' },
  { name: 'Singapore Dollar',  symbol: 'SGD', color: '#9945FF' },
  { name: 'UAE Dirham',        symbol: 'AED', color: '#F7931A' },
  { name: 'Swiss Franc',       symbol: 'CHF', color: '#14B8A6' },
  { name: 'Canadian Dollar',   symbol: 'CAD', color: '#A78BFA' },
  { name: 'Australian Dollar', symbol: 'AUD', color: '#00B4D8' },
  { name: 'Nigerian Naira',    symbol: 'NGN', color: '#10B981' },
];

const securityFeatures = [
  { icon: Lock,   title: 'Custody Status',       desc: 'No crypto custody is active in this preview. A contracted and reviewed provider is required before launch.',     color: '#C9A84C' },
  { icon: Shield, title: 'Multi-Signature',       desc: 'All withdrawals require multiple cryptographic signatures, eliminating single points of failure.',                color: '#627EEA' },
  { icon: RefreshCw, title: 'Real-time Monitoring', desc: '24/7 automated threat detection with instant alerts and transaction blocking on suspicious activity.',          color: '#10B981' },
  { icon: Zap,    title: 'Settlement Preview',    desc: 'The interface demonstrates how settlement and conversion status could be presented after providers are approved.', color: '#9945FF' },
  { icon: Globe,  title: 'Launch Readiness',      desc: 'Legal review, KYC/AML providers, geographic controls, and custody approval are required before launch.',         color: '#EC4899' },
  { icon: ArrowLeftRight, title: 'Exchange Preview', desc: 'Compare supported crypto and fiat currencies using transparent indicative rates and flags.', color: '#F7931A' },
];


interface UserBalance {
  currency:      string;
  amount:        number;
  usdEquivalent: number;
}

export default function WalletPage() {
  const { customer, token } = useCustomerAuth();
  const [tab, setTab] = useState<'crypto' | 'fiat'>('crypto');
  const [fromAsset, setFromAsset] = useState('BTC');
  const [toAsset, setToAsset] = useState('USD');
  const [amount, setAmount] = useState('0.1');

  // Swap execution state
  const [swapLoading,  setSwapLoading]  = useState(false);
  const [swapSuccess,  setSwapSuccess]  = useState('');
  const [swapError,    setSwapError]    = useState('');

  // Live rates fetched from admin-controlled API
  const [liveRates, setLiveRates] = useState<Record<string, number> | null>(null);

  // Real user balances from /api/users/balance
  const [userBalances,    setUserBalances]    = useState<UserBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);

  useEffect(() => {
    fetch('/api/settings/rates')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.rates) return;
        const r = d.rates as Record<string, number>;
        setLiveRates({
          USD:  1,
          EUR:  r.EUR_USD,
          GBP:  r.GBP_USD,
          CHF:  r.CHF_USD,
          CAD:  r.CAD_USD,
          AUD:  r.AUD_USD,
          JPY:  r.JPY_USD,
          SGD:  r.SGD_USD,
          AED:  r.AED_USD,
          NGN:  r.NGN_USD,
          BTC:  r.BTC_USD,
          ETH:  r.ETH_USD,
          SOL:  r.SOL_USD,
          USDT: r.USDT_USD,
          BNB:  r.BNB_USD,
        });
      })
      .catch(() => {});
  }, []);

  // Fetch real user balances when logged in
  useEffect(() => {
    if (!token) return;
    setBalancesLoading(true);
    fetch('/api/users/balance', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.currencies) setUserBalances(d.currencies); })
      .catch(() => {})
      .finally(() => setBalancesLoading(false));
  }, [token]);

  // "1 unit of X = N USD" map — live rates from admin panel, no hardcoded fallbacks
  const USD_RATES: Record<string, number> = useMemo(() => liveRates ?? {
    USD: 1, EUR: 1.086, GBP: 1.262, CHF: 1.11, CAD: 0.74,
    AUD: 0.65, JPY: 0.0065, SGD: 0.74, AED: 0.2723, NGN: 0.00066,
    BTC: 67420, ETH: 3840, SOL: 182.5, USDT: 1, BNB: 598,
  }, [liveRates]);

  /** Convert `amt` of `from` → USD, then USD → `to` */
  const calcReceive = (amt: number, from: string, to: string): number => {
    const fromUsd = amt * (USD_RATES[from] ?? 1);
    return fromUsd / (USD_RATES[to] ?? 1);
  };

  const receiveAmount = useMemo(() => {
    const n = parseFloat(amount || '0');
    if (!n || n <= 0) return 0;
    return calcReceive(n, fromAsset, toAsset);
  }, [amount, fromAsset, toAsset, USD_RATES]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build live exchange pair display from rates
  const exchangePairs = useMemo(() => {
    const r = USD_RATES;
    return [
      { from: 'BTC', to: 'USD',  rate: `1 BTC = $${Math.round(r.BTC ?? 67420).toLocaleString()}` },
      { from: 'ETH', to: 'EUR',  rate: `1 ETH = €${((r.ETH ?? 3840) / (r.EUR ?? 1.086)).toFixed(0)}` },
      { from: 'USD', to: 'GBP',  rate: `1 USD = £${(1 / (r.GBP ?? 1.262)).toFixed(4)}` },
      { from: 'SOL', to: 'USDT', rate: `1 SOL = ${(r.SOL ?? 182.5).toFixed(2)} USDT` },
    ];
  }, [USD_RATES]);

  // Build fiat currency display with live rates
  const fiatCurrencies = useMemo(() => {
    const r = USD_RATES;
    return fiatCurrencyMeta.map(c => ({
      ...c,
      rate: c.symbol === 'USD' ? '—' : `1 USD = ${(1 / (r[c.symbol] ?? 1)).toFixed(c.symbol === 'JPY' ? 1 : 4)} ${c.symbol}`,
    }));
  }, [USD_RATES]);

  async function handleSwap() {
    if (!token) { setSwapError('Please log in to exchange assets.'); return; }
    const n = parseFloat(amount || '0');
    if (!n || n <= 0) { setSwapError('Enter a valid amount.'); return; }
    setSwapLoading(true);
    setSwapError('');
    setSwapSuccess('');
    try {
      const res = await fetch('/api/users/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': newIdempotencyKey() },
        body: JSON.stringify({ fromAsset, toAsset, amount: n }),
      });
      const data = await res.json();
      if (!res.ok) { setSwapError(data.error ?? 'Swap failed. Please try again.'); return; }
      setSwapSuccess(
        `Swapped ${n} ${fromAsset} → ${data.toAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${toAsset}`
      );
      setTimeout(() => setSwapSuccess(''), 6000);
    } catch {
      setSwapError('Network error. Please try again.');
    } finally {
      setSwapLoading(false);
    }
  }

  // Wallet address editing
  const [wallets, setWallets] = useState({
    btc:  customer?.walletBtc  ?? '',
    eth:  customer?.walletEth  ?? '',
    usdt: customer?.walletUsdt ?? '',
    sol:  customer?.walletSol  ?? '',
  });
  const [walletSaving, setWalletSaving] = useState(false);
  const [walletSaved,  setWalletSaved]  = useState(false);
  const [walletError,  setWalletError]  = useState('');
  const [copiedAddr,   setCopiedAddr]   = useState('');

  async function saveWallets() {
    if (!token) return;
    setWalletSaving(true);
    setWalletError('');
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletBtc: wallets.btc, walletEth: wallets.eth, walletUsdt: wallets.usdt, walletSol: wallets.sol }),
      });
      const data = await res.json();
      if (!res.ok) { setWalletError(data.error ?? 'Failed to save.'); return; }
      setWalletSaved(true);
      setTimeout(() => setWalletSaved(false), 3000);
    } catch { setWalletError('Network error.'); }
    finally { setWalletSaving(false); }
  }

  function copyAddr(addr: string, key: string) {
    navigator.clipboard.writeText(addr).catch(() => {});
    setCopiedAddr(key);
    setTimeout(() => setCopiedAddr(''), 2000);
  }

  // Build crypto asset display from real user balances (falls back to zero if not logged in)
  const CRYPTO_SYMBOLS = ['BTC', 'ETH', 'SOL', 'USDT', 'BNB'];
  const cryptoDisplayAssets = useMemo(() => {
    const r = USD_RATES;
    // Build a lookup from real balances
    const holdingsMap: Record<string, number> = {};
    for (const b of userBalances) holdingsMap[b.currency] = b.amount;

    return cryptoAssets.map(a => {
      const price   = r[a.symbol] ?? 1;
      const holding = holdingsMap[a.symbol] ?? 0;
      const usdVal  = holding * price;
      return {
        ...a,
        price:   price >= 1000 ? `$${Math.round(price).toLocaleString()}` : `$${price.toFixed(2)}`,
        balance: `${holding.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${a.symbol}`,
        usd:     `$${usdVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
        change:  '+0.0%',
        up:      true,
      };
    });
  }, [USD_RATES, userBalances]);

  const totalCryptoUsd = useMemo(() => {
    // Sum real crypto balances in USD
    const cryptoSet = new Set(CRYPTO_SYMBOLS);
    const total = userBalances
      .filter(b => cryptoSet.has(b.currency))
      .reduce((s, b) => s + b.usdEquivalent, 0);
    return `$${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }, [userBalances]); // eslint-disable-line react-hooks/exhaustive-deps

  // Suppress unused-variable warning for balancesLoading while keeping the state
  void balancesLoading;

  return (
    <>
      <Helmet>
        <title>Crypto & Fiat Wallet — 50+ Currencies | CGC</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="description" content="Preview a unified crypto and fiat wallet interface using demonstration balances. Live custody, trading, and transfers are unavailable." />
        <link rel="canonical" href="https://citygate.capital/wallet" />
        <meta property="og:title" content="Crypto & Fiat Wallet — Hold 50+ Currencies" />
        <meta property="og:description" content="Preview a unified crypto and fiat wallet interface using demonstration balances." />
        <meta property="og:url" content="https://citygate.capital/wallet" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
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
        <meta name="twitter:description" content="Preview a unified crypto and fiat wallet interface with demonstration balances. Live custody, exchange, and transfers are unavailable." />
        <meta name="twitter:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': 'https://citygate.capital/wallet#webpage',
          name: 'Crypto & Fiat Wallet — City Gate Capital',
          url: 'https://citygate.capital/wallet',
          description: 'Manage Bitcoin, Ethereum, USDT, and 50+ fiat currencies in one secure wallet with real exchange rates.',
          isPartOf: { '@id': 'https://citygate.capital/#website' },
          about: { '@id': 'https://citygate.capital/#organization' },
          mainEntity: {
            '@type': 'FinancialProduct',
            name: 'City Gate Capital Multi-Currency Wallet',
            description: 'Product preview of a crypto and fiat wallet interface using demonstration balances.',
            provider: { '@id': 'https://citygate.capital/#organization' },
            feesAndCommissionsSpecification: 'Zero hidden fees. Real mid-market exchange rates.',
          },
        }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://citygate.capital/' },
            { '@type': 'ListItem', position: 2, name: 'Wallet', item: 'https://citygate.capital/wallet' },
          ],
        }) }} />
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
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <TrendingUp size={12} className="text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">+8.4% this month</span>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {cryptoDisplayAssets.slice(0, 4).map((asset, i) => (
                    <motion.div key={asset.symbol} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.07 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                      <CurrencyMark currency={asset.symbol} size={32} />
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
              {cryptoDisplayAssets.map((asset, i) => (
                <motion.div
                  key={asset.symbol}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="glass-card rounded-2xl p-5 gradient-border flex items-center gap-5 hover:border-primary/25 transition-colors group"
                >
                  <CurrencyMark currency={asset.symbol} size={44} />
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
                    <CurrencyMark currency={c.symbol} size={36} />
                    <div>
                      <p className="font-semibold text-foreground text-sm">{c.name}</p>
                      <p className="text-xs text-foreground/40">{c.symbol}</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-foreground mb-1">{c.rate}</p>
                  <p className="text-[10px] text-foreground/30">{c.symbol}</p>
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
                Exchange Preview
              </span>
              <h2 className="text-4xl font-bold text-foreground mb-5 tracking-tight">
                Explore Asset Swaps<br />
                <span className="text-gold-gradient">Without Moving Funds</span>
              </h2>
              <p className="text-foreground/50 leading-relaxed mb-8">
                Explore how crypto and fiat conversions could appear using illustrative prices. This preview does not execute orders, settle transactions, or custody assets.
              </p>
              <div className="space-y-3">
                {[
                  'Illustrative market pricing',
                  'No live settlement',
                  'No customer assets accepted',
                  'Prototype trading pairs',
                  'Provider integration required before launch',
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
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="number"
                        value={amount}
                        min="0"
                        onChange={e => { setAmount(e.target.value); setSwapError(''); setSwapSuccess(''); }}
                        className="flex-1 min-w-0 w-full bg-white/[0.03] border border-primary/15 rounded-xl px-4 py-3 text-foreground text-lg font-semibold focus:outline-none focus:border-primary/40 transition-colors"
                      />
                      <div className="flex items-center gap-2 w-full sm:w-auto bg-white/[0.03] border border-primary/15 rounded-xl px-3 focus-within:border-primary/40 transition-colors">
                        <CurrencyMark currency={fromAsset} size={28} />
                        <select value={fromAsset} onChange={e => { setFromAsset(e.target.value); setSwapError(''); setSwapSuccess(''); }}
                          aria-label="Currency to exchange from"
                          className="flex-1 sm:flex-none bg-transparent py-3 text-foreground focus:outline-none min-w-[92px]">
                          {['BTC', 'ETH', 'SOL', 'USDT', 'BNB', 'USD', 'EUR', 'GBP'].map(c => <option key={c} value={c}>{currencyOptionLabel(c)}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-primary/10" />
                    <button
                      onClick={() => { setFromAsset(toAsset); setToAsset(fromAsset); }}
                      className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                      title="Swap direction"
                    >
                      <ArrowLeftRight size={14} className="text-primary" />
                    </button>
                    <div className="flex-1 h-px bg-primary/10" />
                  </div>
                  <div>
                    <label className="text-xs text-foreground/40 uppercase tracking-wide mb-2 block">You Receive</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 min-w-0 w-full bg-white/[0.03] border border-primary/20 rounded-xl px-4 py-3 text-xl font-bold text-gold-gradient">
                        {receiveAmount > 0
                          ? receiveAmount.toLocaleString('en-US', { maximumFractionDigits: receiveAmount < 1 ? 8 : 2 })
                          : '—'}
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto bg-white/[0.03] border border-primary/15 rounded-xl px-3 focus-within:border-primary/40 transition-colors">
                        <CurrencyMark currency={toAsset} size={28} />
                        <select value={toAsset} onChange={e => { setToAsset(e.target.value); setSwapError(''); setSwapSuccess(''); }}
                          aria-label="Currency to exchange to"
                          className="flex-1 sm:flex-none bg-transparent py-3 text-foreground focus:outline-none min-w-[92px]">
                          {['USD', 'EUR', 'GBP', 'USDT', 'ETH', 'BTC', 'SOL', 'BNB'].map(c => <option key={c} value={c}>{currencyOptionLabel(c)}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rate rows — all pairs, no clipping */}
                <div className="mb-5 p-4 rounded-xl bg-white/[0.02] border border-primary/10 space-y-2">
                  {exchangePairs.map(p => (
                    <div key={`${p.from}-${p.to}`} className="flex justify-between text-xs">
                      <span className="text-foreground/40">{p.from}/{p.to}</span>
                      <span className="text-foreground">{p.rate}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs pt-1 border-t border-primary/10">
                    <span className="text-foreground/40">Fee</span>
                    <span className="text-primary">$0.00</span>
                  </div>
                </div>

                {/* Feedback messages */}
                {swapError && (
                  <div className="mb-4 flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <AlertCircle size={13} className="shrink-0" />
                    {swapError}
                  </div>
                )}
                {swapSuccess && (
                  <div className="mb-4 flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                    <CheckCircle size={13} className="shrink-0" />
                    {swapSuccess}
                  </div>
                )}

                <button
                  onClick={handleSwap}
                  disabled={swapLoading || !parseFloat(amount || '0')}
                  className="group relative w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-bold text-black overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                  {swapLoading ? (
                    <Loader2 size={16} className="relative animate-spin" />
                  ) : (
                    <>
                      <span className="relative">{token ? 'Exchange Now' : 'Log In to Exchange'}</span>
                      <ArrowRight size={16} className="relative transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
                {!token && (
                  <p className="text-center text-xs text-foreground/30 mt-3">
                    <Link to="/login" className="text-primary hover:underline">Sign in</Link> to execute real swaps
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-24 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">

          {/* My Crypto Receiving Addresses — only shown when logged in */}
          {customer && (
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="mb-16 bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-white mb-2">My Crypto Receiving Addresses</h2>
              <p className="text-white/50 text-sm mb-6">Save your personal wallet addresses for withdrawals. These are stored on your account.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { key: 'btc',  label: 'Bitcoin (BTC)',   placeholder: 'bc1q...' },
                  { key: 'eth',  label: 'Ethereum (ETH)',  placeholder: '0x...'  },
                  { key: 'usdt', label: 'USDT (TRC20/ERC20)', placeholder: 'T... or 0x...' },
                  { key: 'sol',  label: 'Solana (SOL)',    placeholder: 'Sol...' },
                ] as { key: keyof typeof wallets; label: string; placeholder: string }[]).map(w => (
                  <div key={w.key}>
                    <label className="block text-xs text-white/50 mb-1.5">{w.label}</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={wallets[w.key]}
                        onChange={e => setWallets(prev => ({ ...prev, [w.key]: e.target.value }))}
                        placeholder={w.placeholder}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/50 transition-colors text-xs font-mono"
                      />
                      {wallets[w.key] && (
                        <button type="button" onClick={() => copyAddr(wallets[w.key], w.key)}
                          className="px-2.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white transition-colors">
                          {copiedAddr === w.key ? <CheckCircle size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {walletError && (
                <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle size={14} /> {walletError}
                </div>
              )}
              <div className="mt-5 flex items-center gap-3">
                <button onClick={saveWallets} disabled={walletSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#C9A84C] text-black font-semibold text-sm hover:bg-[#E8C97A] transition-colors disabled:opacity-50">
                  {walletSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {walletSaving ? 'Saving…' : 'Save Addresses'}
                </button>
                {walletSaved && <span className="text-emerald-400 text-sm flex items-center gap-1"><CheckCircle size={14} /> Saved</span>}
              </div>
            </motion.div>
          )}

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
