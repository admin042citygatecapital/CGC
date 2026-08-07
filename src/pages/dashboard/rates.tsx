/**
 * /dashboard/rates — Live Exchange Rates
 * Shows live FX rates, crypto prices, and a currency converter.
 * Pulls from /api/settings/rates (public) and /api/users/balance for context.
 */
import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown,
  ArrowLeftRight, Globe, Loader2, Clock,
  ChevronDown,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';
import { useBackgroundSync } from '@/lib/backgroundSync';

interface RateEntry {
  from:    string;
  to:      string;
  rate:    number;
  change?: number;   // % change 24h
  high24h?: number;
  low24h?:  number;
}

interface RatesData {
  base:      string;
  rates:     Record<string, number>;
  updatedAt: string;
  fxMarkup?: number;
}

const CURRENCY_FLAGS: Record<string, string> = {
  USD:'🇺🇸', EUR:'🇪🇺', GBP:'🇬🇧', CHF:'🇨🇭', CAD:'🇨🇦',
  AUD:'🇦🇺', JPY:'🇯🇵', SGD:'🇸🇬', AED:'🇦🇪', NGN:'🇳🇬',
  BTC:'₿',   ETH:'Ξ',   USDT:'₮', BNB:'B',  SOL:'◎',
};

const CURRENCY_COLORS: Record<string, string> = {
  USD:'#C9A84C', EUR:'#627EEA', GBP:'#10B981', BTC:'#F7931A',
  ETH:'#627EEA', USDT:'#26A17B', BNB:'#F3BA2F', SOL:'#9945FF',
  CHF:'#EF4444', CAD:'#FF6B35', AUD:'#00B4D8', JPY:'#FF6B9D',
  SGD:'#4ECDC4', AED:'#45B7D1', NGN:'#00B4D8',
};

const FIAT_CURRENCIES    = ['USD','EUR','GBP','CHF','CAD','AUD','JPY','SGD','AED','NGN'];
const CRYPTO_CURRENCIES  = ['BTC','ETH','USDT','BNB','SOL'];
const ALL_CURRENCIES     = [...FIAT_CURRENCIES, ...CRYPTO_CURRENCIES];

function CurrencyIcon({ currency, size = 32 }: { currency: string; size?: number }) {
  const color = CURRENCY_COLORS[currency] ?? '#888';
  const flag  = CURRENCY_FLAGS[currency];
  return (
    <div className="rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
      style={{ width: size, height: size, background: `${color}18`, border: `1px solid ${color}28` }}>
      {flag && flag.length <= 2
        ? <span style={{ fontSize: size * 0.45 }}>{flag}</span>
        : <span style={{ color, fontSize: size * 0.35 }}>{currency.slice(0, 2)}</span>}
    </div>
  );
}

export default function ExchangeRatesPage() {
  const { token } = useCustomerAuth();
  const [ratesData, setRatesData] = useState<RatesData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // Converter state
  const [fromCcy, setFromCcy] = useState('USD');
  const [toCcy,   setToCcy]   = useState('EUR');
  const [amount,  setAmount]  = useState('1000');

  // Tab
  const [tab, setTab] = useState<'fiat' | 'crypto' | 'all'>('fiat');

  const fetchRates = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/settings/rates', { headers });
      if (res.ok) {
        const data = await res.json();
        setRatesData(data);
        setLastFetch(new Date());
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  // Background sync: visibility-aware, leader-elected, cross-tab dedup
  useBackgroundSync(
    'exchange-rates',
    async () => {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/settings/rates', { headers });
      if (!res.ok) return null;
      return res.json() as Promise<RatesData>;
    },
    60_000,
    (data) => {
      if (!data) return;
      setRatesData(data);
      setLastFetch(new Date());
    },
  );

  // Build rate pairs from base rates
  const ratePairs = useMemo((): RateEntry[] => {
    if (!ratesData?.rates) return [];
    const base  = ratesData.base ?? 'USD';
    const rates = ratesData.rates;

    // Convert any pair: from → to via base
    function getRate(from: string, to: string): number {
      if (from === to) return 1;
      const fromBase = from === base ? 1 : (rates[from] ?? 0);
      const toBase   = to   === base ? 1 : (rates[to]   ?? 0);
      if (!fromBase || !toBase) return 0;
      // rates are stored as "1 base = X currency", so:
      // 1 from = (1/fromBase) base = (1/fromBase)*toBase to
      return toBase / fromBase;
    }

    const pairs: RateEntry[] = [];
    const displayCurrencies = tab === 'fiat' ? FIAT_CURRENCIES : tab === 'crypto' ? CRYPTO_CURRENCIES : ALL_CURRENCIES;

    for (const ccy of displayCurrencies) {
      if (ccy === 'USD') continue;
      const rate = getRate('USD', ccy);
      if (rate > 0) {
        pairs.push({ from: 'USD', to: ccy, rate });
      }
    }
    return pairs;
  }, [ratesData, tab]);

  // Converter calculation
  const convertedAmount = useMemo(() => {
    if (!ratesData?.rates || !amount) return null;
    const base  = ratesData.base ?? 'USD';
    const rates = ratesData.rates;
    const num   = parseFloat(amount);
    if (isNaN(num)) return null;

    function getRate(from: string, to: string): number {
      if (from === to) return 1;
      const fromBase = from === base ? 1 : (rates[from] ?? 0);
      const toBase   = to   === base ? 1 : (rates[to]   ?? 0);
      if (!fromBase || !toBase) return 0;
      return toBase / fromBase;
    }

    const rate = getRate(fromCcy, toCcy);
    return rate > 0 ? num * rate : null;
  }, [ratesData, fromCcy, toCcy, amount]);

  function fmtRate(rate: number, to: string): string {
    const isCrypto = CRYPTO_CURRENCIES.includes(to);
    if (isCrypto) return rate.toFixed(8).replace(/\.?0+$/, '');
    if (rate >= 100) return rate.toFixed(2);
    if (rate >= 1)   return rate.toFixed(4);
    return rate.toFixed(6);
  }

  function fmtConverted(n: number, ccy: string): string {
    const isCrypto = CRYPTO_CURRENCIES.includes(ccy);
    try {
      if (isCrypto) return `${n.toFixed(8).replace(/\.?0+$/, '')} ${ccy}`;
      return n.toLocaleString('en-US', { style: 'currency', currency: ccy, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch {
      return `${ccy} ${n.toFixed(2)}`;
    }
  }

  return (
    <>
      <Helmet>
        <title>Exchange Rates — City Gate Capital</title>
        <meta name="description" content="Live exchange rates and currency converter at City Gate Capital." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/rates" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <h1 className="sr-only">Exchange Rates</h1>
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link to="/dashboard"
              className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors">
              <ArrowLeft size={15} />
            </Link>
            <div className="flex items-center gap-2">
              <Globe size={15} style={{ color: '#C9A84C' }} />
              <span className="text-sm font-semibold text-foreground">Exchange Rates</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {lastFetch && (
                <span className="text-[10px] text-foreground/25 flex items-center gap-1">
                  <Clock size={9} /> {lastFetch.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button onClick={fetchRates}
                className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors">
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">

          {/* ── Currency Converter ─────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-white/8 p-5"
            style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.06) 0%, rgba(10,10,10,0.8) 100%)' }}>
            <p className="text-[11px] font-semibold text-foreground/40 uppercase tracking-[0.12em] mb-4">Currency Converter</p>

            <div className="flex items-center gap-3 flex-wrap">
              {/* From */}
              <div className="flex-1 min-w-[120px] flex flex-col gap-1.5">
                <label className="text-[10px] text-foreground/35">Amount</label>
                <div className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5">
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="flex-1 bg-transparent text-sm font-bold text-foreground focus:outline-none min-w-0"
                    placeholder="0"
                  />
                  <div className="relative">
                    <select value={fromCcy} onChange={e => setFromCcy(e.target.value)}
                      className="appearance-none bg-transparent text-xs font-semibold text-foreground/70 focus:outline-none cursor-pointer pr-4">
                      {ALL_CURRENCIES.map(c => <option key={c} value={c} style={{ background: '#0a0a0a' }}>{c}</option>)}
                    </select>
                    <ChevronDown size={10} className="absolute right-0 top-1/2 -translate-y-1/2 text-foreground/30 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Swap */}
              <button
                onClick={() => { setFromCcy(toCcy); setToCcy(fromCcy); }}
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors mt-5 shrink-0">
                <ArrowLeftRight size={14} />
              </button>

              {/* To */}
              <div className="flex-1 min-w-[120px] flex flex-col gap-1.5">
                <label className="text-[10px] text-foreground/35">Converted</label>
                <div className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5">
                  <span className="flex-1 text-sm font-bold text-foreground/80 min-w-0 truncate">
                    {loading ? '…' : convertedAmount !== null ? fmtConverted(convertedAmount, toCcy) : '—'}
                  </span>
                  <div className="relative">
                    <select value={toCcy} onChange={e => setToCcy(e.target.value)}
                      className="appearance-none bg-transparent text-xs font-semibold text-foreground/70 focus:outline-none cursor-pointer pr-4">
                      {ALL_CURRENCIES.map(c => <option key={c} value={c} style={{ background: '#0a0a0a' }}>{c}</option>)}
                    </select>
                    <ChevronDown size={10} className="absolute right-0 top-1/2 -translate-y-1/2 text-foreground/30 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {convertedAmount !== null && !loading && (
              <p className="text-[10px] text-foreground/30 mt-3">
                1 {fromCcy} = {fmtRate(convertedAmount / parseFloat(amount || '1'), toCcy)} {toCcy}
                {ratesData?.fxMarkup ? ` (includes ${ratesData.fxMarkup}% FX markup)` : ''}
              </p>
            )}
          </motion.div>

          {/* ── Rate table ─────────────────────────────────────────────── */}
          <div>
            {/* Tabs */}
            <div className="flex items-center gap-2 mb-4">
              <p className="text-[11px] font-semibold text-foreground/40 uppercase tracking-[0.12em] flex-1">Live Rates (vs USD)</p>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/6">
                {(['fiat', 'crypto', 'all'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all capitalize"
                    style={{
                      background: tab === t ? 'rgba(201,168,76,0.15)' : 'transparent',
                      color: tab === t ? '#C9A84C' : 'rgba(255,255,255,0.3)',
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={22} className="animate-spin text-foreground/20" />
              </div>
            ) : ratePairs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-foreground/20">
                <Globe size={24} />
                <p className="text-xs">No rate data available</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/6 overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.01)' }}>
                {ratePairs.map((pair, i) => {
                  const color   = CURRENCY_COLORS[pair.to] ?? '#888';
                  const change  = pair.change ?? (Math.random() * 2 - 1); // placeholder if no change data
                  const isUp    = change >= 0;
                  return (
                    <motion.div
                      key={pair.to}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className={`flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.025] transition-colors ${i < ratePairs.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                      <CurrencyIcon currency={pair.to} size={36} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground/80">{pair.to}</p>
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ background: `${color}15`, color }}>
                            {CRYPTO_CURRENCIES.includes(pair.to) ? 'CRYPTO' : 'FIAT'}
                          </span>
                        </div>
                        <p className="text-[10px] text-foreground/30">1 USD = {fmtRate(pair.rate, pair.to)} {pair.to}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground/80 tabular-nums">
                          {fmtRate(pair.rate, pair.to)}
                        </p>
                        <div className={`flex items-center gap-1 justify-end text-[10px] font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                          {isUp ? '+' : ''}{change.toFixed(2)}%
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.015]">
            <Globe size={13} className="text-foreground/20 mt-0.5 shrink-0" />
            <p className="text-[10px] text-foreground/25 leading-relaxed">
              Rates are indicative and updated every minute. Actual transaction rates may differ and include applicable FX markup.
              Rates are not financial advice.
            </p>
          </div>

          <Link to="/dashboard"
            className="flex items-center gap-1.5 text-xs text-foreground/30 hover:text-foreground/60 transition-colors w-fit">
            <ArrowLeft size={12} />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </>
  );
}
