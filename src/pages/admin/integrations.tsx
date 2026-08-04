/**
 * /admin/integrations — Integrations Center
 * Manage all third-party service connections:
 * Zoho Mail · Smartsupp · Cloudflare · Google Analytics · GTM
 * Google Maps · Stripe · PayPal · Twilio · WhatsApp Business · Banking APIs
 */
import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail, MessageSquare, Shield, BarChart2, Tag, Map,
  CreditCard, DollarSign, Phone, MessageCircle, Building2,
  CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw,
  Zap, ExternalLink, ChevronDown, ChevronUp, Settings2,
  Clock, Wifi, WifiOff, Activity, Key, Save,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';
import { useProviders } from '@/hooks/useMarketData';

// ── Market Providers Panel ────────────────────────────────────────────────────

function MarketProvidersPanel() {
  const { providers, loading } = useProviders();
  const PROVIDER_KEYS: Record<string, { key: string; label: string }[]> = {
    'alpha-vantage': [{ key: 'ALPHA_VANTAGE_API_KEY', label: 'Alpha Vantage API Key' }],
    'finnhub':       [{ key: 'FINNHUB_API_KEY',       label: 'Finnhub API Key' }],
    'polygon':       [{ key: 'POLYGON_API_KEY',        label: 'Polygon.io API Key' }],
    'twelve-data':   [{ key: 'TWELVE_DATA_API_KEY',    label: 'Twelve Data API Key' }],
  };
  const ALL_PROVIDERS = [
    { id: 'binance',      name: 'Binance',       free: true,  url: 'https://binance.com' },
    { id: 'coinbase',     name: 'Coinbase',      free: true,  url: 'https://coinbase.com' },
    { id: 'kraken',       name: 'Kraken',        free: true,  url: 'https://kraken.com' },
    { id: 'alpha-vantage',name: 'Alpha Vantage', free: false, url: 'https://alphavantage.co' },
    { id: 'finnhub',      name: 'Finnhub',       free: false, url: 'https://finnhub.io' },
    { id: 'polygon',      name: 'Polygon.io',    free: false, url: 'https://polygon.io' },
    { id: 'twelve-data',  name: 'Twelve Data',   free: false, url: 'https://twelvedata.com' },
  ];
  const activeIds = new Set(providers.map(p => p.id));

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto pt-0">
      <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
          <Activity className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-white text-sm">Market Data Providers</span>
          {loading && <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin ml-auto" />}
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {ALL_PROVIDERS.map(p => {
            const active = activeIds.has(p.id);
            const detail = providers.find(pp => pp.id === p.id);
            return (
              <div key={p.id} className={`rounded-xl border p-4 ${
                active ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-white/8 bg-white/3'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-white">{p.name}</span>
                  <div className="flex items-center gap-1.5">
                    {p.free && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400">Free</span>}
                    <div className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-400' : 'bg-white/20'}`} />
                  </div>
                </div>
                <div className="text-xs text-white/30 mb-3">
                  {active ? (
                    <span className="text-emerald-400">Active · {detail?.capabilities.length ?? 0} capabilities</span>
                  ) : (
                    <span>Requires API key</span>
                  )}
                </div>
                {PROVIDER_KEYS[p.id] && (
                  <div className="text-xs text-white/25">
                    Key: <code className="text-white/40">{PROVIDER_KEYS[p.id][0].key}</code>
                  </div>
                )}
                {detail?.capabilities && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {detail.capabilities.map(c => (
                      <span key={c} className="text-xs px-1.5 py-0.5 rounded bg-white/8 text-white/40">{c}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="px-5 py-3 border-t border-white/8 text-xs text-white/25">
          Binance, Coinbase, and Kraken require no API key. Add keys in Settings → Secrets to enable Alpha Vantage, Finnhub, Polygon.io, and Twelve Data for stocks, forex, and ETF data.
        </div>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnectionStatus = 'connected' | 'disconnected' | 'partial' | 'unknown';

interface SecretInfo {
  name:     string;
  label:    string;
  present:  boolean;
  required: boolean;
}

interface ConfigField {
  key:         string;
  label:       string;
  placeholder: string;
  hint?:       string;
}

interface Integration {
  id:           string;
  name:         string;
  category:     string;
  description:  string;
  docsUrl:      string;
  status:       ConnectionStatus;
  enabled:      boolean;
  notes:        string;
  lastTestedAt: string | null;
  lastSyncAt:   string | null;
  config:       Record<string, string>;
  secrets:      SecretInfo[];
  configFields: ConfigField[];
}

interface TestResult {
  ok:        boolean;
  message:   string;
  latencyMs: number;
  testedAt:  string;
}

// ─── Category icon map ────────────────────────────────────────────────────────

const INTEGRATION_ICONS: Record<string, React.ElementType> = {
  zoho_mail:          Mail,
  smartsupp:          MessageSquare,
  cloudflare:         Shield,
  google_analytics:   BarChart2,
  google_tag_manager: Tag,
  google_maps:        Map,
  stripe:             CreditCard,
  paypal:             DollarSign,
  twilio:             Phone,
  whatsapp_business:  MessageCircle,
  banking_api:        Building2,
};

// ─── Status helpers ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const cfg = {
    connected:    { icon: CheckCircle2, label: 'Connected',    cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
    disconnected: { icon: XCircle,      label: 'Disconnected', cls: 'text-red-400 bg-red-400/10 border-red-400/20' },
    partial:      { icon: AlertCircle,  label: 'Partial',      cls: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
    unknown:      { icon: AlertCircle,  label: 'Unknown',      cls: 'text-white/30 bg-white/5 border-white/10' },
  }[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cfg.cls}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ─── Integration Card ─────────────────────────────────────────────────────────

interface CardProps {
  integration: Integration;
  onToggle:    (id: string, enabled: boolean) => void;
  onSave:      (id: string, notes: string, config: Record<string, string>) => void;
  onTest:      (id: string) => void;
  testing:     boolean;
  testResult:  TestResult | null;
}

function IntegrationCard({ integration, onToggle, onSave, onTest, testing, testResult }: CardProps) {
  const [expanded, setExpanded]   = useState(false);
  const [notes,    setNotes]      = useState(integration.notes);
  const [config,   setConfig]     = useState<Record<string, string>>(integration.config);
  const [dirty,    setDirty]      = useState(false);

  const Icon = INTEGRATION_ICONS[integration.id] ?? Settings2;

  const requiredSecrets  = integration.secrets.filter(s => s.required);
  const optionalSecrets  = integration.secrets.filter(s => !s.required);
  const allRequiredOk    = requiredSecrets.every(s => s.present);
  const missingRequired  = requiredSecrets.filter(s => !s.present);

  function patchConfig(key: string, value: string) {
    setConfig(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function handleSave() {
    onSave(integration.id, notes, config);
    setDirty(false);
  }

  // Status dot pulse for connected
  const dotColor = {
    connected:    'bg-emerald-400',
    disconnected: 'bg-red-400',
    partial:      'bg-amber-400',
    unknown:      'bg-white/20',
  }[integration.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}
    >
      {/* ── Card header ──────────────────────────────────────────────────── */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="relative shrink-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}>
              <Icon size={20} style={{ color: '#C9A84C' }} />
            </div>
            {/* Live status dot */}
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0A0A0A] ${dotColor} ${integration.status === 'connected' ? 'animate-pulse' : ''}`} />
          </div>

          {/* Name + category + status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-white font-semibold text-sm">{integration.name}</h3>
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/25 px-2 py-0.5 rounded-full border border-white/8">
                {integration.category}
              </span>
            </div>
            <p className="text-white/40 text-xs mt-1 leading-relaxed line-clamp-2">{integration.description}</p>
          </div>

          {/* Right: status badge + toggle */}
          <div className="flex flex-col items-end gap-2.5 shrink-0">
            <StatusBadge status={integration.status} />
            {/* Enable toggle */}
            <button
              onClick={() => onToggle(integration.id, !integration.enabled)}
              className={`relative w-10 h-5 rounded-full transition-all duration-200 ${integration.enabled ? 'bg-primary' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${integration.enabled ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        {/* ── Meta row ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          {/* Last tested */}
          <div className="flex items-center gap-1.5 text-white/30 text-[11px]">
            <Activity size={11} />
            <span>Tested: {relativeTime(integration.lastTestedAt)}</span>
          </div>
          {/* Last sync */}
          <div className="flex items-center gap-1.5 text-white/30 text-[11px]">
            <Clock size={11} />
            <span>Synced: {relativeTime(integration.lastSyncAt)}</span>
          </div>
          {/* Secret count */}
          <div className={`flex items-center gap-1.5 text-[11px] ${allRequiredOk ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
            <Key size={11} />
            <span>
              {integration.secrets.filter(s => s.present).length}/{integration.secrets.length} secrets
            </span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Docs link */}
          <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-white/25 hover:text-white/60 text-[11px] transition-colors">
            <ExternalLink size={10} />
            Docs
          </a>

          {/* Test button */}
          <button
            onClick={() => onTest(integration.id)}
            disabled={testing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-50"
            style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.2)' }}
          >
            {testing ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
            {testing ? 'Testing…' : 'Test'}
          </button>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-white/30 hover:text-white/60 text-[11px] transition-colors"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Less' : 'Configure'}
          </button>
        </div>

        {/* ── Test result banner ────────────────────────────────────────── */}
        <AnimatePresence>
          {testResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className={`mt-3 flex items-start gap-2.5 p-3 rounded-xl text-xs ${
                testResult.ok
                  ? 'bg-emerald-400/8 border border-emerald-400/15 text-emerald-300'
                  : 'bg-red-400/8 border border-red-400/15 text-red-300'
              }`}>
                {testResult.ok
                  ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                  : <XCircle      size={13} className="shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{testResult.message}</p>
                  <p className="text-[10px] opacity-60 mt-0.5">
                    {testResult.latencyMs}ms · {new Date(testResult.testedAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Expanded config panel ─────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t px-5 py-5 space-y-5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>

              {/* Secrets status */}
              {integration.secrets.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Secrets / Credentials</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[...requiredSecrets, ...optionalSecrets].map(sec => (
                      <div key={sec.name}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl border"
                        style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
                        <div className="min-w-0">
                          <p className="text-white/70 text-xs font-medium truncate">{sec.label}</p>
                          <p className="text-white/25 text-[10px] font-mono truncate">{sec.name}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-3">
                          {sec.required && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-white/25">req</span>
                          )}
                          {sec.present
                            ? <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-semibold"><CheckCircle2 size={11} /> Configured</span>
                            : <span className="flex items-center gap-1 text-red-400/80 text-[10px] font-semibold"><XCircle size={11} /> Missing</span>
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                  {missingRequired.length > 0 && (
                    <p className="mt-2 text-[11px] text-amber-400/70 flex items-center gap-1.5">
                      <AlertCircle size={11} />
                      Add missing secrets in <strong>Settings → Secrets</strong> to enable this integration.
                    </p>
                  )}
                </div>
              )}

              {/* Config fields */}
              {integration.configFields.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Configuration</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {integration.configFields.map(field => (
                      <div key={field.key}>
                        <label className="text-white/40 text-[10px] uppercase tracking-wide mb-1.5 block">
                          {field.label}
                          {field.hint && <span className="ml-1.5 text-white/20 normal-case tracking-normal">— {field.hint}</span>}
                        </label>
                        <input
                          type="text"
                          value={config[field.key] ?? ''}
                          onChange={e => patchConfig(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-primary/40 placeholder:text-white/20"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-white/40 text-[10px] uppercase tracking-wide mb-1.5 block">Admin Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => { setNotes(e.target.value); setDirty(true); }}
                  placeholder="Internal notes about this integration…"
                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-primary/40 placeholder:text-white/20 resize-none"
                />
              </div>

              {/* Save */}
              {dirty && (
                <div className="flex justify-end">
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-black transition-all"
                    style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}
                  >
                    <Save size={12} />
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [refreshing,   setRefreshing]   = useState(false);

  // Per-integration test state
  const [testing,     setTesting]     = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, TestResult | null>>({});

  // Filter
  const [filterStatus,   setFilterStatus]   = useState<'all' | ConnectionStatus>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [search,         setSearch]         = useState('');

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/integrations', { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { integrations: Integration[] };
      setIntegrations(data.integrations);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Toggle enabled ────────────────────────────────────────────────────────

  async function handleToggle(id: string, enabled: boolean) {
    try {
      await fetch('/api/admin/integrations', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled }),
      });
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, enabled, status: enabled ? i.status : 'disconnected' } : i));
    } catch { /* silent */ }
  }

  // ── Save config ───────────────────────────────────────────────────────────

  async function handleSave(id: string, notes: string, config: Record<string, string>) {
    try {
      const res = await fetch('/api/admin/integrations', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, notes, config }),
      });
      const data = await res.json() as { integration: Integration };
      if (data.integration) {
        setIntegrations(prev => prev.map(i => i.id === id ? data.integration : i));
      }
    } catch { /* silent */ }
  }

  // ── Test connection ───────────────────────────────────────────────────────

  async function handleTest(id: string) {
    setTesting(prev => ({ ...prev, [id]: true }));
    setTestResults(prev => ({ ...prev, [id]: null }));
    try {
      const res = await fetch('/api/admin/integrations/test', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json() as TestResult;
      setTestResults(prev => ({ ...prev, [id]: data }));
      // Refresh to pick up updated lastTestedAt
      await load(true);
      // Auto-clear result after 12s
      setTimeout(() => setTestResults(prev => ({ ...prev, [id]: null })), 12_000);
    } catch (e) {
      setTestResults(prev => ({ ...prev, [id]: { ok: false, message: String(e), latencyMs: 0, testedAt: new Date().toISOString() } }));
    } finally {
      setTesting(prev => ({ ...prev, [id]: false }));
    }
  }

  // ── Derived stats ─────────────────────────────────────────────────────────

  const stats = {
    total:        integrations.length,
    connected:    integrations.filter(i => i.status === 'connected').length,
    disconnected: integrations.filter(i => i.status === 'disconnected').length,
    partial:      integrations.filter(i => i.status === 'partial').length,
  };

  const categories = ['all', ...Array.from(new Set(integrations.map(i => i.category)))];

  const filtered = integrations.filter(i => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
    if (filterCategory !== 'all' && i.category !== filterCategory) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) &&
        !i.category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout title="Integrations Center">
      <Helmet>
        <title>Integrations Center — City Gate Capital Admin</title>
        <meta name="description" content="Manage third-party service integrations for City Gate Capital admin panel." />
        <link rel="canonical" href="https://citygate.capital/admin/integrations" />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
              Integrations Center
            </h1>
            <p className="text-white/40 text-sm mt-1">
              Manage third-party service connections, credentials, and health status.
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white transition-colors border border-white/8 hover:border-white/15"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* ── Stats strip ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total',        value: stats.total,        icon: Wifi,        color: 'text-white/60' },
            { label: 'Connected',    value: stats.connected,    icon: CheckCircle2, color: 'text-emerald-400' },
            { label: 'Disconnected', value: stats.disconnected, icon: WifiOff,     color: 'text-red-400' },
            { label: 'Partial',      value: stats.partial,      icon: AlertCircle, color: 'text-amber-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl p-4 border"
              style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/40 text-xs">{label}</p>
                <Icon size={14} className={color} />
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search integrations…"
            className="bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary/40 placeholder:text-white/25 w-52"
          />

          {/* Status filter */}
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'connected', 'partial', 'disconnected'] as const).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all capitalize ${
                  filterStatus === s
                    ? 'text-black font-bold'
                    : 'text-white/40 hover:text-white/70 border border-white/8'
                }`}
                style={filterStatus === s ? { background: 'linear-gradient(135deg, #C9A84C, #F0D080)' } : {}}>
                {s === 'all' ? 'All Status' : s}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="flex gap-1.5 flex-wrap">
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  filterCategory === cat
                    ? 'text-black font-bold'
                    : 'text-white/40 hover:text-white/70 border border-white/8'
                }`}
                style={filterCategory === cat ? { background: 'linear-gradient(135deg, #C9A84C, #F0D080)' } : {}}>
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Loading / error ───────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-primary" />
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-400/8 border border-red-400/15 text-red-300 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            <span>Failed to load integrations: {error}</span>
            <button onClick={() => load()} className="ml-auto text-red-300/60 hover:text-red-300 transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
        )}

        {/* ── Integration cards ─────────────────────────────────────────────── */}
        {!loading && !error && (
          <>
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-white/25">
                <Wifi size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No integrations match your filters.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(integration => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    onToggle={handleToggle}
                    onSave={handleSave}
                    onTest={handleTest}
                    testing={!!testing[integration.id]}
                    testResult={testResults[integration.id] ?? null}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Secrets note ─────────────────────────────────────────────────── */}
        {!loading && !error && (
          <div className="flex items-start gap-3 p-4 rounded-2xl border"
            style={{ background: 'rgba(201,168,76,0.04)', borderColor: 'rgba(201,168,76,0.12)' }}>
            <Key size={14} className="shrink-0 mt-0.5" style={{ color: '#C9A84C' }} />
            <div>
              <p className="text-white/60 text-xs font-medium">Credentials are managed securely</p>
              <p className="text-white/30 text-xs mt-0.5">
                API keys and secrets are stored in the platform's encrypted secrets vault — never in the database.
                To add or update credentials, go to <strong className="text-white/50">Settings → Secrets</strong>.
                Values are never exposed in this panel.
              </p>
            </div>
          </div>
        )}

      </div>
      {/* Market Data Providers panel */}
      <MarketProvidersPanel />
    </AdminLayout>
  );
}
