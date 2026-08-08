import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Save, TrendingUp, DollarSign, Loader2, CheckCircle, AlertCircle,
  Percent, ToggleLeft, ToggleRight, History, Download, Shield,
  RefreshCw, Globe, Users, AlertTriangle,
  Building2, Coins, BarChart2,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

type FeeMode = 'flat' | 'percentage';

interface FeeRule {
  mode:       FeeMode;
  flat:       number;
  percentage: number;
  minFee:     number;
  maxFee:     number;
  enabled:    boolean;
}

interface TransactionTypeFees {
  domestic_transfer:  FeeRule;
  international_wire: FeeRule;
  crypto_send:        FeeRule;
  currency_exchange:  FeeRule;
  updatedAt: string;
}

interface FxMarkup {
  pair:    string;
  markup:  number;
  enabled: boolean;
}

interface TierFeeRule {
  tier:               string;
  label:              string;
  transferFeeMode:    FeeMode;
  transferFlat:       number;
  transferPct:        number;
  wireFeeMode:        FeeMode;
  wireFlat:           number;
  wirePct:            number;
  cryptoFeeMode:      FeeMode;
  cryptoFlat:         number;
  cryptoPct:          number;
  exchangeFeeMode:    FeeMode;
  exchangeFlat:       number;
  exchangePct:        number;
  volumeDiscountPct:  number;
  enabled:            boolean;
}

interface WithdrawalLimitRule {
  tier:            string;
  dailyLimitUSD:   number;
  monthlyLimitUSD: number;
}

interface FeeHistoryEntry {
  id:         string;
  ts:         string;
  adminId:    string;
  adminEmail?: string;
  section:    string;
  field:      string;
  oldValue:   string;
  newValue:   string;
  ip:         string;
}

interface RatesConfig {
  txFees:    TransactionTypeFees;
  fxMarkups: { pairs: FxMarkup[]; updatedAt: string };
  tierFees:  { tiers: TierFeeRule[]; updatedAt: string };
  limits:    { tierLimits: WithdrawalLimitRule[]; userOverrides: Record<string, { dailyLimitUSD: number; monthlyLimitUSD: number; note?: string; updatedAt: string }>; updatedAt: string };
  rates:     Record<string, number | string>;
  fees:      Record<string, number | string>;
}

interface ExchangeRateField {
  key:    string;
  label:  string;
  symbol: string;
  color:  string;
}

interface TierUsage {
  tier:       string;
  todayUSD:   number;
  monthUSD:   number;
  userCount:  number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TX_FEE_LABELS: Record<string, { label: string; icon: typeof DollarSign; color: string }> = {
  domestic_transfer:  { label: 'Domestic Transfer',   icon: Building2, color: '#10B981' },
  international_wire: { label: 'International Wire',  icon: Globe,     color: '#3B82F6' },
  crypto_send:        { label: 'Crypto Send',          icon: Coins,     color: '#F7931A' },
  currency_exchange:  { label: 'Currency Exchange',    icon: TrendingUp, color: '#C9A84C' },
};

const TIER_COLORS: Record<string, string> = {
  personal: '#6366F1',
  savings:  '#10B981',
  business: '#C9A84C',
};

const SECTION_LABELS: Record<string, string> = {
  transfer_fees: 'Transfer Fees',
  fx_markup:     'FX Markup',
  tier_fees:     'Tier Fees',
  rates:         'Exchange Rates',
  limits:        'Withdrawal Limits',
};

function fmtDate(ts: string) {
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

// ── FeeRule editor sub-component ─────────────────────────────────────────────

function FeeRuleEditor({
  label, icon: Icon, color, rule, onChange,
}: {
  label: string;
  icon: typeof DollarSign;
  color: string;
  rule: FeeRule;
  onChange: (r: FeeRule) => void;
}) {
  return (
    <div className="rounded-xl border border-white/5 p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
            <Icon size={13} style={{ color }} />
          </div>
          <span className="text-white text-sm font-semibold">{label}</span>
        </div>
        <button
          onClick={() => onChange({ ...rule, enabled: !rule.enabled })}
          className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${rule.enabled ? 'text-emerald-400' : 'text-white/25'}`}
        >
          {rule.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          {rule.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-white/[0.04] border border-white/8 rounded-xl p-1">
        {(['flat', 'percentage'] as FeeMode[]).map(m => (
          <button key={m} onClick={() => onChange({ ...rule, mode: m })}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize ${
              rule.mode === m ? 'bg-primary text-black' : 'text-white/40 hover:text-white'
            }`}>
            {m === 'flat' ? <DollarSign size={10} /> : <Percent size={10} />}
            {m === 'flat' ? 'Flat Amount' : 'Percentage'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {rule.mode === 'flat' ? (
          <div className="col-span-2">
            <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1 block">Flat Fee (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
              <input type="number" min="0" step="0.01" value={rule.flat}
                onChange={e => onChange({ ...rule, flat: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors" />
            </div>
          </div>
        ) : (
          <div className="col-span-2">
            <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1 block">Percentage (%)</label>
            <div className="relative">
              <input type="number" min="0" step="0.01" value={rule.percentage}
                onChange={e => onChange({ ...rule, percentage: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-3 pr-8 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">%</span>
            </div>
          </div>
        )}
        <div>
          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1 block">Min Fee (USD, 0=none)</label>
          <input type="number" min="0" step="0.01" value={rule.minFee}
            onChange={e => onChange({ ...rule, minFee: parseFloat(e.target.value) || 0 })}
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors" />
        </div>
        <div>
          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1 block">Max Fee (USD, 0=no cap)</label>
          <input type="number" min="0" step="0.01" value={rule.maxFee}
            onChange={e => onChange({ ...rule, maxFee: parseFloat(e.target.value) || 0 })}
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors" />
        </div>
      </div>

      {/* Preview */}
      <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 text-[10px] text-white/40">
        Preview on $1,000 transaction:{' '}
        <span className="text-white/70 font-semibold">
          {rule.mode === 'flat'
            ? `$${rule.flat.toFixed(2)}`
            : `$${(1000 * rule.percentage / 100).toFixed(2)} (${rule.percentage}%)`}
          {rule.minFee > 0 ? `, min $${rule.minFee}` : ''}
          {rule.maxFee > 0 ? `, max $${rule.maxFee}` : ''}
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const PANELS = ['transfer', 'markup', 'tiers', 'limits', 'rates', 'history'] as const;
type Panel = typeof PANELS[number];

const PANEL_META: Record<Panel, { label: string; icon: typeof DollarSign; color: string }> = {
  transfer: { label: 'Transfer Fees',    icon: DollarSign,  color: '#10B981' },
  markup:   { label: 'FX Rate Markup',   icon: TrendingUp,  color: '#C9A84C' },
  tiers:    { label: 'Account Tier Fees', icon: Users,      color: '#6366F1' },
  limits:   { label: 'Withdrawal Limits', icon: Shield,     color: '#EF4444' },
  rates:    { label: 'Exchange Rates',    icon: BarChart2,  color: '#3B82F6' },
  history:  { label: 'Fee History Log',   icon: History,    color: '#8B5CF6' },
};

export default function AdminRates() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();

  const [activePanel, setActivePanel] = useState<Panel>('transfer');
  const [config,      setConfig]      = useState<RatesConfig | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState<string | null>(null);
  const [error,       setError]       = useState('');

  // Local editable state per panel
  const [txFees,    setTxFees]    = useState<TransactionTypeFees | null>(null);
  const [fxPairs,   setFxPairs]   = useState<FxMarkup[]>([]);
  const [tierFees,  setTierFees]  = useState<TierFeeRule[]>([]);
  const [tierLimits, setTierLimits] = useState<WithdrawalLimitRule[]>([]);

  // Exchange rates editable state
  const [editRates, setEditRates] = useState<Record<string, number>>({});

  // Tier usage (live withdrawal usage per tier)
  const [tierUsage,      setTierUsage]      = useState<TierUsage[]>([]);
  const [tierUsageLoading, setTierUsageLoading] = useState(false);

  // Fee history
  const [history,     setHistory]     = useState<FeeHistoryEntry[]>([]);
  const [histTotal,   setHistTotal]   = useState(0);
  const [histLoading, setHistLoading] = useState(false);
  const [histFilter,  setHistFilter]  = useState('');

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/rates', { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json() as RatesConfig;
        setConfig(d);
        setTxFees(d.txFees);
        setFxPairs(d.fxMarkups?.pairs ?? []);
        setTierFees(d.tierFees?.tiers ?? []);
        setTierLimits(d.limits?.tierLimits ?? []);
        // Seed exchange rates editor from stored rates
        const r = d.rates as Record<string, number | string>;
        setEditRates({
          BTC_USD:  Number(r.BTC_USD  ?? 67420),
          ETH_USD:  Number(r.ETH_USD  ?? 3840),
          SOL_USD:  Number(r.SOL_USD  ?? 182.5),
          BNB_USD:  Number(r.BNB_USD  ?? 598),
          USDT_USD: Number(r.USDT_USD ?? 1),
          EUR_USD:  Number(r.EUR_USD  ?? 1.086),
          GBP_USD:  Number(r.GBP_USD  ?? 1.262),
          JPY_USD:  Number(r.JPY_USD  ?? 0.0065),
          CHF_USD:  Number(r.CHF_USD  ?? 1.11),
        });
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await fetch('/api/admin/rates/fee-history?limit=200', { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setHistory(d.data ?? []);
        setHistTotal(d.total ?? 0);
      }
    } catch { /* silent */ }
    setHistLoading(false);
  }, []);

  useEffect(() => {
    if (activePanel === 'history') loadHistory();
  }, [activePanel, loadHistory]);

  // Load tier usage when limits panel opens
  const loadTierUsage = useCallback(async () => {
    setTierUsageLoading(true);
    try {
      const res = await fetch('/api/admin/rates/limits/user?summary=1', { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.tierUsage)) setTierUsage(d.tierUsage);
      }
    } catch { /* silent */ }
    setTierUsageLoading(false);
  }, []);

  useEffect(() => {
    if (activePanel === 'limits') loadTierUsage();
  }, [activePanel, loadTierUsage]);

  function showSaved(panel: string) {
    setSaved(panel);
    setTimeout(() => setSaved(null), 3000);
  }

  // ── Save handlers ──────────────────────────────────────────────────────────

  async function saveTxFees() {
    if (!txFees) return;
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/rates/tx-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ txFees }),
      });
      const d = await res.json();
      if (res.ok) { showSaved('transfer'); }
      else setError(d.error ?? 'Save failed');
    } catch { setError('Network error'); }
    setSaving(false);
  }

  async function saveFxMarkup() {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/rates/fx-markup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ pairs: fxPairs }),
      });
      const d = await res.json();
      if (res.ok) { showSaved('markup'); }
      else setError(d.error ?? 'Save failed');
    } catch { setError('Network error'); }
    setSaving(false);
  }

  async function saveTierFees() {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/rates/tier-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ tiers: tierFees }),
      });
      const d = await res.json();
      if (res.ok) { showSaved('tiers'); }
      else setError(d.error ?? 'Save failed');
    } catch { setError('Network error'); }
    setSaving(false);
  }

  async function saveLimits() {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/rates/limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ tierLimits }),
      });
      const d = await res.json();
      if (res.ok) { showSaved('limits'); }
      else setError(d.error ?? 'Save failed');
    } catch { setError('Network error'); }
    setSaving(false);
  }

  async function saveRates() {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/settings/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ rates: editRates }),
      });
      const d = await res.json();
      if (res.ok) {
        showSaved('rates');
        // Refresh config so fxMarkup preview callout stays accurate
        loadConfig();
      } else setError(d.error ?? 'Save failed');
    } catch { setError('Network error'); }
    setSaving(false);
  }

  function downloadCsv() {
    window.open('/api/admin/rates/fee-history?csv=1', '_blank');
  }

  // ── Filtered history ───────────────────────────────────────────────────────
  const filteredHistory = history.filter(e => {
    if (!histFilter) return true;
    const s = histFilter.toLowerCase();
    return (
      e.section.includes(s) || e.field.toLowerCase().includes(s) ||
      (e.adminEmail ?? '').toLowerCase().includes(s) ||
      e.oldValue.toLowerCase().includes(s) || e.newValue.toLowerCase().includes(s)
    );
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Helmet><title>Exchange Rates & Fees — CGC Admin</title><meta name="description" content="Manage exchange rates and transaction fees for City Gate Capital." /><meta name="robots" content="noindex, nofollow" /><link rel="canonical" href="https://citygate.capital/admin/rates" /></Helmet>
      <AdminLayout title="Rates & Fees">
        {/* Visually-hidden H1 for accessibility and SEO heading hierarchy */}
        <h1 className="sr-only">Exchange Rates &amp; Fees — CGC Admin</h1>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Panel tabs */}
            <div className="flex flex-wrap gap-2">
              {PANELS.map(p => {
                const meta = PANEL_META[p];
                const Icon = meta.icon;
                return (
                  <button key={p} onClick={() => setActivePanel(p)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      activePanel === p
                        ? 'text-black shadow-lg'
                        : 'bg-white/[0.04] border border-white/8 text-white/50 hover:text-white'
                    }`}
                    style={activePanel === p ? { background: meta.color } : {}}>
                    <Icon size={14} />
                    {meta.label}
                  </button>
                );
              })}
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle size={14} /> {error}
                <button onClick={() => setError('')} className="ml-auto text-red-400/50 hover:text-red-400">✕</button>
              </div>
            )}

            {/* ── Panel: Transfer Fees ─────────────────────────────────────── */}
            {activePanel === 'transfer' && txFees && (
              <motion.div key="transfer" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-white font-bold text-base">Transfer Fee Control</h2>
                    <p className="text-white/30 text-xs mt-0.5">Set fees per transaction type. Changes apply to all new transactions immediately.</p>
                  </div>
                  <SaveButton saving={saving} saved={saved === 'transfer'} onClick={saveTxFees} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {(Object.keys(TX_FEE_LABELS) as (keyof typeof TX_FEE_LABELS)[]).map(key => {
                    const meta = TX_FEE_LABELS[key];
                    return (
                      <FeeRuleEditor
                        key={key}
                        label={meta.label}
                        icon={meta.icon}
                        color={meta.color}
                        rule={(txFees as unknown as Record<string, FeeRule>)[key]}
                        onChange={r => setTxFees(f => f ? { ...f, [key]: r } : f)}
                      />
                    );
                  })}
                </div>
                {txFees.updatedAt && (
                  <p className="text-white/20 text-xs mt-4">Last saved: {fmtDate(txFees.updatedAt)}</p>
                )}
              </motion.div>
            )}

            {/* ── Panel: FX Rate Markup ────────────────────────────────────── */}
            {activePanel === 'markup' && (
              <motion.div key="markup" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-white font-bold text-base">Per-Currency FX Markup</h2>
                    <p className="text-white/30 text-xs mt-0.5">Markup % added on top of the base rate before showing to customers.</p>
                  </div>
                  <SaveButton saving={saving} saved={saved === 'markup'} onClick={saveFxMarkup} />
                </div>

                {/* Example callout */}
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-xs text-white/50 mb-5 flex items-start gap-2">
                  <AlertTriangle size={12} className="text-primary shrink-0 mt-0.5" />
                  <span>
                    Example: BTC/USD base rate = 68,420 · 1.5% markup → customer sees{' '}
                    <span className="text-white/80 font-semibold">69,446</span>
                  </span>
                </div>

                <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 text-[10px] uppercase tracking-wide text-white/25 px-4 py-2.5 border-b border-white/5">
                    <span>Currency Pair</span>
                    <span className="text-right pr-4">Markup %</span>
                    <span className="text-right pr-4">Preview on $10k</span>
                    <span className="text-right">Enabled</span>
                  </div>
                  <div className="divide-y divide-white/[0.03]">
                    {fxPairs.map((pair, i) => (
                      <div key={pair.pair} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-0 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                        <span className="text-white text-sm font-mono font-semibold">{pair.pair}</span>
                        <div className="relative mr-4">
                          <input
                            type="number" min="0" step="0.01" value={pair.markup}
                            onChange={e => setFxPairs(ps => ps.map((p, j) => j === i ? { ...p, markup: parseFloat(e.target.value) || 0 } : p))}
                            className="w-24 bg-white/[0.04] border border-white/8 rounded-lg px-3 py-1.5 text-white text-sm text-right focus:outline-none focus:border-primary/40 transition-colors"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs pointer-events-none">%</span>
                        </div>
                        <span className="text-white/40 text-xs font-mono mr-4 text-right">
                          +${(10000 * pair.markup / 100).toFixed(2)}
                        </span>
                        <button
                          onClick={() => setFxPairs(ps => ps.map((p, j) => j === i ? { ...p, enabled: !p.enabled } : p))}
                          className={`transition-colors ${pair.enabled ? 'text-emerald-400' : 'text-white/20'}`}
                        >
                          {pair.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                {config?.fxMarkups?.updatedAt && (
                  <p className="text-white/20 text-xs mt-3">Last saved: {fmtDate(config.fxMarkups.updatedAt)}</p>
                )}
              </motion.div>
            )}

            {/* ── Panel: Account Tier Fees ─────────────────────────────────── */}
            {activePanel === 'tiers' && (
              <motion.div key="tiers" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-white font-bold text-base">Account Tier Fee Schedule</h2>
                    <p className="text-white/30 text-xs mt-0.5">Set different fee rates per account type. Business tier supports volume discounts.</p>
                  </div>
                  <SaveButton saving={saving} saved={saved === 'tiers'} onClick={saveTierFees} />
                </div>

                <div className="grid lg:grid-cols-3 gap-4">
                  {tierFees.map((tier, ti) => {
                    const color = TIER_COLORS[tier.tier] ?? '#C9A84C';
                    return (
                      <div key={tier.tier} className="rounded-2xl border border-white/5 overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.025)' }}>
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between"
                          style={{ background: `${color}08` }}>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: `${color}20` }}>
                              <Users size={14} style={{ color }} />
                            </div>
                            <div>
                              <p className="text-white font-bold text-sm">{tier.label}</p>
                              <p className="text-white/30 text-[10px] capitalize">{tier.tier} account</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setTierFees(ts => ts.map((t, i) => i === ti ? { ...t, enabled: !t.enabled } : t))}
                            className={`transition-colors ${tier.enabled ? 'text-emerald-400' : 'text-white/20'}`}
                          >
                            {tier.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                          </button>
                        </div>

                        <div className="p-4 space-y-4">
                          {/* Transfer fee */}
                          <TierFeeRow
                            label="Transfer"
                            mode={tier.transferFeeMode}
                            flat={tier.transferFlat}
                            pct={tier.transferPct}
                            onModeChange={m => setTierFees(ts => ts.map((t, i) => i === ti ? { ...t, transferFeeMode: m } : t))}
                            onFlatChange={v => setTierFees(ts => ts.map((t, i) => i === ti ? { ...t, transferFlat: v } : t))}
                            onPctChange={v => setTierFees(ts => ts.map((t, i) => i === ti ? { ...t, transferPct: v } : t))}
                          />
                          {/* Wire fee */}
                          <TierFeeRow
                            label="Wire"
                            mode={tier.wireFeeMode}
                            flat={tier.wireFlat}
                            pct={tier.wirePct}
                            onModeChange={m => setTierFees(ts => ts.map((t, i) => i === ti ? { ...t, wireFeeMode: m } : t))}
                            onFlatChange={v => setTierFees(ts => ts.map((t, i) => i === ti ? { ...t, wireFlat: v } : t))}
                            onPctChange={v => setTierFees(ts => ts.map((t, i) => i === ti ? { ...t, wirePct: v } : t))}
                          />
                          {/* Crypto fee */}
                          <TierFeeRow
                            label="Crypto Send"
                            mode={tier.cryptoFeeMode}
                            flat={tier.cryptoFlat}
                            pct={tier.cryptoPct}
                            onModeChange={m => setTierFees(ts => ts.map((t, i) => i === ti ? { ...t, cryptoFeeMode: m } : t))}
                            onFlatChange={v => setTierFees(ts => ts.map((t, i) => i === ti ? { ...t, cryptoFlat: v } : t))}
                            onPctChange={v => setTierFees(ts => ts.map((t, i) => i === ti ? { ...t, cryptoPct: v } : t))}
                          />
                          {/* Exchange fee */}
                          <TierFeeRow
                            label="FX Exchange"
                            mode={tier.exchangeFeeMode}
                            flat={tier.exchangeFlat}
                            pct={tier.exchangePct}
                            onModeChange={m => setTierFees(ts => ts.map((t, i) => i === ti ? { ...t, exchangeFeeMode: m } : t))}
                            onFlatChange={v => setTierFees(ts => ts.map((t, i) => i === ti ? { ...t, exchangeFlat: v } : t))}
                            onPctChange={v => setTierFees(ts => ts.map((t, i) => i === ti ? { ...t, exchangePct: v } : t))}
                          />

                          {/* Volume discount (business only) */}
                          {tier.tier === 'business' && (
                            <div>
                              <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1 block">Volume Discount (%)</label>
                              <div className="relative">
                                <input type="number" min="0" max="100" step="0.5" value={tier.volumeDiscountPct}
                                  onChange={e => setTierFees(ts => ts.map((t, i) => i === ti ? { ...t, volumeDiscountPct: parseFloat(e.target.value) || 0 } : t))}
                                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 pr-8 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors" />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">%</span>
                              </div>
                              <p className="text-white/20 text-[10px] mt-1">Additional discount applied on top of base fees for high-volume business accounts</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {config?.tierFees?.updatedAt && (
                  <p className="text-white/20 text-xs mt-4">Last saved: {fmtDate(config.tierFees.updatedAt)}</p>
                )}
              </motion.div>
            )}

            {/* ── Panel: Withdrawal Limits ─────────────────────────────────── */}
            {activePanel === 'limits' && (
              <motion.div key="limits" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-white font-bold text-base">Withdrawal Limits</h2>
                    <p className="text-white/30 text-xs mt-0.5">Set daily and monthly withdrawal limits per account tier. 0 = unlimited. Per-user overrides are set from Banking Operations.</p>
                  </div>
                  <SaveButton saving={saving} saved={saved === 'limits'} onClick={saveLimits} />
                </div>

                <div className="rounded-2xl border border-white/5 overflow-hidden mb-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="px-5 py-4 border-b border-white/5">
                    <h3 className="text-white font-semibold text-sm">Tier Default Limits</h3>
                    <p className="text-white/30 text-xs mt-0.5">Applied to all users of each tier unless overridden individually</p>
                  </div>
                  <div className="divide-y divide-white/[0.03]">
                    {tierLimits.map((tl, i) => {
                      const color = TIER_COLORS[tl.tier] ?? '#6B7280';
                      const usage = tierUsage.find(u => u.tier === tl.tier);
                      const dailyPct  = tl.dailyLimitUSD   > 0 ? Math.min(100, ((usage?.todayUSD  ?? 0) / tl.dailyLimitUSD)   * 100) : 0;
                      const monthPct  = tl.monthlyLimitUSD > 0 ? Math.min(100, ((usage?.monthUSD  ?? 0) / tl.monthlyLimitUSD) * 100) : 0;
                      return (
                        <div key={tl.tier} className="px-5 py-4 space-y-3">
                          {/* Tier header */}
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: `${color}15` }}>
                              <Shield size={12} style={{ color }} />
                            </div>
                            <span className="text-white text-sm font-semibold capitalize">{tl.tier}</span>
                            {tierUsageLoading && <Loader2 size={10} className="animate-spin text-white/20 ml-auto" />}
                          </div>
                          {/* Limit inputs + live usage */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1 block">Daily Limit (USD)</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                                <input type="number" min="0" step="1000" value={tl.dailyLimitUSD}
                                  onChange={e => setTierLimits(ls => ls.map((l, j) => j === i ? { ...l, dailyLimitUSD: Number(e.target.value) || 0 } : l))}
                                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors" />
                              </div>
                              {tl.dailyLimitUSD === 0
                                ? <p className="text-emerald-400 text-[10px] mt-1">Unlimited</p>
                                : (
                                  <div className="mt-1.5">
                                    <div className="flex justify-between text-[10px] mb-0.5">
                                      <span className="text-white/30">Today used</span>
                                      <span className="text-white/50">${(usage?.todayUSD ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} / ${tl.dailyLimitUSD.toLocaleString()}</span>
                                    </div>
                                    <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                      <div className="h-full rounded-full transition-all" style={{ width: `${dailyPct}%`, background: dailyPct > 80 ? '#EF4444' : color }} />
                                    </div>
                                  </div>
                                )
                              }
                            </div>
                            <div>
                              <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1 block">Monthly Limit (USD)</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                                <input type="number" min="0" step="1000" value={tl.monthlyLimitUSD}
                                  onChange={e => setTierLimits(ls => ls.map((l, j) => j === i ? { ...l, monthlyLimitUSD: Number(e.target.value) || 0 } : l))}
                                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors" />
                              </div>
                              {tl.monthlyLimitUSD === 0
                                ? <p className="text-emerald-400 text-[10px] mt-1">Unlimited</p>
                                : (
                                  <div className="mt-1.5">
                                    <div className="flex justify-between text-[10px] mb-0.5">
                                      <span className="text-white/30">This month</span>
                                      <span className="text-white/50">${(usage?.monthUSD ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} / ${tl.monthlyLimitUSD.toLocaleString()}</span>
                                    </div>
                                    <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                      <div className="h-full rounded-full transition-all" style={{ width: `${monthPct}%`, background: monthPct > 80 ? '#EF4444' : color }} />
                                    </div>
                                  </div>
                                )
                              }
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Per-user overrides info */}
                <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={14} className="text-white/40" />
                    <h3 className="text-white font-semibold text-sm">Per-User Overrides</h3>
                  </div>
                  <p className="text-white/30 text-xs mb-3">
                    Individual user limit overrides are managed from the <span className="text-primary">Banking Operations</span> page.
                    Search for a user, open their profile, and set a custom daily/monthly limit that overrides their tier default.
                  </p>
                  {config?.limits?.userOverrides && Object.keys(config.limits.userOverrides).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(config.limits.userOverrides).map(([uid, ov]) => (
                        <div key={uid} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs">
                          <div>
                            <p className="text-white/60 font-mono">{uid}</p>
                            {ov.note && <p className="text-white/30 mt-0.5">{ov.note}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-white/70">Daily: <span className="text-white font-semibold">${ov.dailyLimitUSD === 0 ? '∞' : ov.dailyLimitUSD.toLocaleString()}</span></p>
                            <p className="text-white/70">Monthly: <span className="text-white font-semibold">${ov.monthlyLimitUSD === 0 ? '∞' : ov.monthlyLimitUSD.toLocaleString()}</span></p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-white/20 text-xs">No per-user overrides set yet.</p>
                  )}
                </div>

                {config?.limits?.updatedAt && (
                  <p className="text-white/20 text-xs mt-4">Last saved: {fmtDate(config.limits.updatedAt)}</p>
                )}
              </motion.div>
            )}

            {/* ── Panel: Exchange Rates ────────────────────────────────────── */}
            {activePanel === 'rates' && (
              <motion.div key="rates" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-white font-bold text-base">Exchange Rates</h2>
                    <p className="text-white/30 text-xs mt-0.5">
                      Base rates used for all conversions, balance calculations, and fee previews.
                      FX markup is applied on top of these rates for customer-facing prices.
                    </p>
                  </div>
                  <SaveButton saving={saving} saved={saved === 'rates'} onClick={saveRates} />
                </div>

                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 text-xs text-white/50 mb-5 flex items-start gap-2">
                  <AlertTriangle size={12} className="text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    These are the <strong className="text-white/70">mid-market base rates</strong> used internally.
                    Customer-facing rates include the FX markup set in the <span className="text-primary">FX Rate Markup</span> panel.
                    Update these regularly to reflect live market prices.
                  </span>
                </div>

                {/* Crypto rates */}
                <div className="rounded-2xl border border-white/5 overflow-hidden mb-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="px-5 py-3 border-b border-white/5">
                    <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                      <Coins size={13} className="text-amber-400" /> Crypto / USD Rates
                    </h3>
                  </div>
                  <div className="divide-y divide-white/[0.03]">
                    {(
                      [
                        { key: 'BTC_USD',  label: 'Bitcoin (BTC)',  symbol: 'BTC',  color: '#F7931A' },
                        { key: 'ETH_USD',  label: 'Ethereum (ETH)', symbol: 'ETH',  color: '#627EEA' },
                        { key: 'SOL_USD',  label: 'Solana (SOL)',   symbol: 'SOL',  color: '#9945FF' },
                        { key: 'BNB_USD',  label: 'BNB',            symbol: 'BNB',  color: '#F3BA2F' },
                        { key: 'USDT_USD', label: 'Tether (USDT)',  symbol: 'USDT', color: '#26A17B' },
                      ] as ExchangeRateField[]
                    ).map(f => (
                      <div key={f.key} className="px-5 py-3 flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold"
                          style={{ background: `${f.color}20`, color: f.color }}>
                          {f.symbol.slice(0, 3)}
                        </div>
                        <span className="text-white/70 text-sm flex-1">{f.label}</span>
                        <div className="relative w-44">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">$</span>
                          <input
                            type="number" min="0" step={f.key === 'JPY_USD' ? '0.0001' : f.key === 'USDT_USD' ? '0.0001' : '0.01'}
                            value={editRates[f.key] ?? 0}
                            onChange={e => setEditRates(r => ({ ...r, [f.key]: parseFloat(e.target.value) || 0 }))}
                            className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-7 pr-3 py-2 text-white text-sm text-right focus:outline-none focus:border-primary/40 transition-colors"
                          />
                        </div>
                        <span className="text-white/25 text-xs w-20 text-right">
                          1 {f.symbol} = ${(editRates[f.key] ?? 0).toLocaleString('en-US', { maximumFractionDigits: f.key === 'JPY_USD' ? 6 : 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fiat rates */}
                <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="px-5 py-3 border-b border-white/5">
                    <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                      <Globe size={13} className="text-blue-400" /> Fiat / USD Rates
                    </h3>
                  </div>
                  <div className="divide-y divide-white/[0.03]">
                    {(
                      [
                        { key: 'EUR_USD', label: 'Euro (EUR)',          symbol: 'EUR', color: '#3B82F6' },
                        { key: 'GBP_USD', label: 'British Pound (GBP)', symbol: 'GBP', color: '#10B981' },
                        { key: 'JPY_USD', label: 'Japanese Yen (JPY)',  symbol: 'JPY', color: '#EF4444' },
                        { key: 'CHF_USD', label: 'Swiss Franc (CHF)',   symbol: 'CHF', color: '#6366F1' },
                        { key: 'CAD_USD', label: 'Canadian Dollar (CAD)', symbol: 'CAD', color: '#EF4444' },
                        { key: 'AUD_USD', label: 'Australian Dollar (AUD)', symbol: 'AUD', color: '#00B4D8' },
                        { key: 'SGD_USD', label: 'Singapore Dollar (SGD)', symbol: 'SGD', color: '#4ECDC4' },
                        { key: 'AED_USD', label: 'UAE Dirham (AED)', symbol: 'AED', color: '#45B7D1' },
                        { key: 'NGN_USD', label: 'Nigerian Naira (NGN)', symbol: 'NGN', color: '#10B981' },
                      ] as ExchangeRateField[]
                    ).map(f => (
                      <div key={f.key} className="px-5 py-3 flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold"
                          style={{ background: `${f.color}20`, color: f.color }}>
                          {f.symbol}
                        </div>
                        <span className="text-white/70 text-sm flex-1">{f.label}</span>
                        <div className="relative w-44">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">$</span>
                          <input
                            type="number" min="0" step={f.key === 'JPY_USD' ? '0.0001' : '0.0001'}
                            value={editRates[f.key] ?? 0}
                            onChange={e => setEditRates(r => ({ ...r, [f.key]: parseFloat(e.target.value) || 0 }))}
                            className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-7 pr-3 py-2 text-white text-sm text-right focus:outline-none focus:border-primary/40 transition-colors"
                          />
                        </div>
                        <span className="text-white/25 text-xs w-20 text-right">
                          1 {f.symbol} = ${(editRates[f.key] ?? 0).toFixed(f.key === 'JPY_USD' ? 6 : 4)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {config?.rates?.updatedAt && (
                  <p className="text-white/20 text-xs mt-4">Last saved: {fmtDate(String(config.rates.updatedAt))}</p>
                )}
              </motion.div>
            )}

            {/* ── Panel: Fee History Log ───────────────────────────────────── */}
            {activePanel === 'history' && (
              <motion.div key="history" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-white font-bold text-base">Fee Change History</h2>
                    <p className="text-white/30 text-xs mt-0.5">Read-only audit log of every fee and rate change. {histTotal} total entries.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={loadHistory} disabled={histLoading}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/50 text-sm hover:text-white transition-colors">
                      <RefreshCw size={12} className={histLoading ? 'animate-spin' : ''} /> Refresh
                    </button>
                    <button onClick={downloadCsv}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/15 border border-primary/20 text-primary text-sm font-semibold hover:bg-primary/25 transition-colors">
                      <Download size={12} /> Export CSV
                    </button>
                  </div>
                </div>

                {/* Filter */}
                <div className="relative mb-4">
                  <input value={histFilter} onChange={e => setHistFilter(e.target.value)}
                    placeholder="Filter by section, field, admin, value..."
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
                </div>

                {histLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-white/20" />
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="py-12 text-center">
                    <History size={28} className="text-white/10 mx-auto mb-2" />
                    <p className="text-white/25 text-sm">No history entries yet</p>
                    <p className="text-white/15 text-xs mt-1">Changes to fees, rates, and limits will appear here</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    {/* Table header */}
                    <div className="hidden md:grid grid-cols-[auto_auto_1fr_1fr_1fr_auto] gap-3 px-4 py-2.5 border-b border-white/5 text-[10px] uppercase tracking-wide text-white/25">
                      <span>Date/Time</span>
                      <span>Section</span>
                      <span>Field</span>
                      <span>Old Value</span>
                      <span>New Value</span>
                      <span>Admin</span>
                    </div>
                    <div className="divide-y divide-white/[0.03] max-h-[600px] overflow-y-auto">
                      {filteredHistory.map(entry => (
                        <div key={entry.id}
                          className="px-4 py-3 hover:bg-white/[0.02] transition-colors grid md:grid-cols-[auto_auto_1fr_1fr_1fr_auto] gap-2 md:gap-3 items-start">
                          <span className="text-white/30 text-[10px] font-mono whitespace-nowrap">
                            {fmtDate(entry.ts)}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                            entry.section === 'rates'         ? 'bg-primary/15 text-primary' :
                            entry.section === 'transfer_fees' ? 'bg-emerald-500/15 text-emerald-400' :
                            entry.section === 'fx_markup'     ? 'bg-amber-500/15 text-amber-400' :
                            entry.section === 'tier_fees'     ? 'bg-indigo-500/15 text-indigo-400' :
                            'bg-red-500/15 text-red-400'
                          }`}>
                            {SECTION_LABELS[entry.section] ?? entry.section}
                          </span>
                          <span className="text-white/70 text-xs font-mono truncate">{entry.field}</span>
                          <span className="text-red-400/70 text-xs font-mono truncate" title={entry.oldValue}>{entry.oldValue}</span>
                          <span className="text-emerald-400/70 text-xs font-mono truncate" title={entry.newValue}>{entry.newValue}</span>
                          <span className="text-white/25 text-[10px] whitespace-nowrap">{entry.adminEmail ?? entry.adminId}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}
      </AdminLayout>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SaveButton({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={saving}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
      <span className="relative flex items-center gap-2 text-black">
        {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : <Save size={14} />}
        {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
      </span>
    </button>
  );
}

function TierFeeRow({
  label, mode, flat, pct,
  onModeChange, onFlatChange, onPctChange,
}: {
  label: string;
  mode: FeeMode;
  flat: number;
  pct: number;
  onModeChange: (m: FeeMode) => void;
  onFlatChange: (v: number) => void;
  onPctChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-white/40 text-[10px] uppercase tracking-wide">{label}</label>
        <div className="flex gap-1">
          {(['flat', 'percentage'] as FeeMode[]).map(m => (
            <button key={m} onClick={() => onModeChange(m)}
              className={`px-2 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                mode === m ? 'bg-primary text-black' : 'bg-white/[0.04] text-white/30 hover:text-white'
              }`}>
              {m === 'flat' ? '$' : '%'}
            </button>
          ))}
        </div>
      </div>
      {mode === 'flat' ? (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">$</span>
          <input type="number" min="0" step="0.01" value={flat}
            onChange={e => onFlatChange(parseFloat(e.target.value) || 0)}
            className="w-full bg-white/[0.04] border border-white/8 rounded-lg pl-6 pr-3 py-2 text-white text-xs focus:outline-none focus:border-primary/40 transition-colors" />
        </div>
      ) : (
        <div className="relative">
          <input type="number" min="0" step="0.01" value={pct}
            onChange={e => onPctChange(parseFloat(e.target.value) || 0)}
            className="w-full bg-white/[0.04] border border-white/8 rounded-lg px-3 pr-7 py-2 text-white text-xs focus:outline-none focus:border-primary/40 transition-colors" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">%</span>
        </div>
      )}
    </div>
  );
}
