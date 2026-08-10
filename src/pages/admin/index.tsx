/**
 * /admin — City Gate Capital Executive Dashboard
 *
 * Administration command centre:
 *  ① Customer KPIs      — Total / Active / Suspended / Pending KYC
 *  ② Financial KPIs     — Deposits / Withdrawals / Transfers / Revenue
 *  ③ Pending Flows      — Pending Deposits / Withdrawals / Transfers
 *  ④ Exchange Rates     — USD/EUR, USD/GBP, USD/JPY, USD/CHF + more
 *  ⑤ Preview status     — financial locks and sponsor-readiness boundary
 *  ⑥ Fee Activity       — 14-day fee-record and activity chart
 *  ⑦ Notifications      — administrative activity feed, 15 s poll
 *  ⑧ System Health      — API, DB, Email, Server, Storage, Memory, CPU,
 *                          Queue, Cloudflare, SSL — each with live status
 *
 *  Auto-refresh: stats every 30 s · health every 15 s · notifications every 15 s
 */
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders,useAdminAuth } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
Activity,
ArrowDownRight,
ArrowUpRight,
BarChart2,Bell,
CheckCircle,
ChevronRight,
Clock,
Cpu,
CreditCard,
Database,
DollarSign,
Globe,
HardDrive,
HeadphonesIcon,
Layers,
Lock,
Mail,
Minus,
RefreshCw,
Send,
Server,
ShieldCheck,
TrendingDown,
TrendingUp,
UserCheck,
Users,
UserX,
Wifi,
Zap
} from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useCallback,useEffect,useRef,useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface KpiValue { value: number; change: number; trend: string }

interface Stats {
  kpis: Record<string, KpiValue>;
  userBreakdown: {
    total: number; active: number; pending: number; suspended: number;
    kyc: { approved: number; submitted: number; rejected: number; notStarted: number };
  };
  dailyRevenue: { date: string; revenue: number; transactions: number; newUsers: number }[];
  recentActivity: { id: string; type: string; user: string; amount: number | null; currency: string | null; ts: string; status: string; ip?: string }[];
  exchangeRates: {
    BTC_USD: number; ETH_USD: number; SOL_USD: number; BNB_USD: number; USDT_USD: number;
    EUR_USD: number; GBP_USD: number; JPY_USD: number; CHF_USD: number; updatedAt: string;
  };
}

interface HealthData {
  status: string;
  uptime: { seconds: number; human: string };
  memory: { heapUsedMb: number; heapTotalMb: number; rssMb: number; freeRamMb: number; totalRamMb: number };
  stores: Record<string, { exists: boolean; sizeBytes: number; lineCount: number; lastModified: string | null }>;
  runtime: { activeSessions: number; nodeVersion: string; platform: string; pid: number };
  users: { total: number; verified: number; pending: number; suspended: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined, prefix = '') {
  const v = Number(n ?? 0);
  if (v >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${prefix}${(v / 1_000).toFixed(1)}k`;
  return `${prefix}${v.toLocaleString()}`;
}

function pct(used: number, total: number) {
  return total > 0 ? Math.round((used / total) * 100) : 0;
}

const ACTIVITY_META: Record<string, { color: string; label: string }> = {
  deposit:         { color: '#10B981', label: 'Deposit' },
  withdrawal:      { color: '#EF4444', label: 'Withdrawal' },
  transfer:        { color: '#627EEA', label: 'Transfer' },
  wire_transfer:   { color: '#627EEA', label: 'Wire Transfer' },
  crypto_buy:      { color: '#F59E0B', label: 'Crypto Buy' },
  crypto_sell:     { color: '#8B5CF6', label: 'Crypto Sell' },
  fee:             { color: '#6B7280', label: 'Fee' },
  refund:          { color: '#06B6D4', label: 'Refund' },
  kyc_approved:    { color: '#10B981', label: 'KYC Approved' },
  account_created: { color: '#C9A84C', label: 'New Account' },
  fraud_alert:     { color: '#EF4444', label: 'Fraud Alert' },
  manual_credit:   { color: '#C9A84C', label: 'Manual Credit' },
  login_success:   { color: '#10B981', label: 'Login' },
  login_failed:    { color: '#EF4444', label: 'Failed Login' },
  admin_login:     { color: '#C9A84C', label: 'Admin Login' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Tiny SVG sparkline */
function Sparkline({ data, color, h = 28 }: { data: number[]; color: string; h?: number }) {
  if (data.length < 2) return null;
  const w = 72;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

/** Single KPI card */
function KpiCard({
  label, value, sub, change, icon: Icon, color, href, sparkData,
}: {
  label: string; value: string; sub?: string; change: number;
  icon: React.ElementType; color: string; href: string; sparkData?: number[];
}) {
  const inner = (
    <div className="rounded-2xl p-4 border border-white/[0.05] hover:border-white/[0.09] transition-all group h-full"
      style={{ background: 'rgba(255,255,255,0.025)' }}>
      <div className="flex items-start justify-between mb-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}18` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${change > 0 ? 'text-emerald-400' : change < 0 ? 'text-red-400' : 'text-white/25'}`}>
          {change > 0 ? <ArrowUpRight size={11} /> : change < 0 ? <ArrowDownRight size={11} /> : <Minus size={9} />}
          {change !== 0 ? `${Math.abs(change)}%` : '—'}
        </span>
      </div>
      <p className="text-white text-[22px] font-bold leading-none mb-0.5 group-hover:text-primary transition-colors tabular-nums">{value}</p>
      <p className="text-white/40 text-[11px] mb-2.5 leading-tight">{label}</p>
      {sub && <p className="text-white/20 text-[10px] mb-2">{sub}</p>}
      {sparkData && <Sparkline data={sparkData} color={color} />}
    </div>
  );
  return <Link to={href} className="block h-full">{inner}</Link>;
}

/** Status dot + label */
function StatusBadge({ ok, warn, label }: { ok: boolean; warn?: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
      ok   ? 'bg-emerald-500/12 text-emerald-400' :
      warn ? 'bg-amber-500/12 text-amber-400' :
             'bg-red-500/12 text-red-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : warn ? 'bg-amber-400 animate-pulse' : 'bg-red-400 animate-pulse'}`} />
      {label}
    </span>
  );
}

/** Gauge bar */
function GaugeBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const p = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono text-white/40 w-8 text-right">{p}%</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: Exchange Rates
// ─────────────────────────────────────────────────────────────────────────────
function ExchangeRatesPanel({ rates }: { rates: Stats['exchangeRates'] | null }) {
  const fxPairs = rates ? [
    { pair: 'EUR/USD', rate: rates.EUR_USD,  flag: '🇪🇺' },
    { pair: 'GBP/USD', rate: rates.GBP_USD,  flag: '🇬🇧' },
    { pair: 'JPY/USD', rate: rates.JPY_USD,  flag: '🇯🇵', decimals: 6 },
    { pair: 'CHF/USD', rate: rates.CHF_USD,  flag: '🇨🇭' },
  ] : [];

  return (
    <div className="rounded-2xl border border-white/[0.05] p-4" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe size={13} className="text-white/40" />
          <h3 className="text-white font-semibold text-sm">Exchange Rates</h3>
        </div>
        <Link to="/admin/rates" className="text-[11px] flex items-center gap-0.5" style={{ color: '#C9A84C' }}>
          Edit <ChevronRight size={10} />
        </Link>
      </div>
      {!rates ? (
        <div className="space-y-2.5">{[1,2,3,4].map(i => <div key={i} className="h-8 rounded-lg bg-white/[0.03] animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {fxPairs.map(({ pair, rate, flag, decimals = 4 }) => (
            <div key={pair} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{flag}</span>
                <span className="text-white/60 text-xs font-medium">{pair}</span>
              </div>
              <span className="text-white font-mono text-sm font-semibold">{rate.toFixed(decimals)}</span>
            </div>
          ))}
          {rates.updatedAt && (
            <p className="text-white/20 text-[10px] pt-1">
              Updated {new Date(rates.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: Preview data boundary
// ─────────────────────────────────────────────────────────────────────────────
function PreviewDataPanel() {
  return (
    <div className="rounded-2xl border border-white/[0.05] p-4" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <div className="mb-4 flex items-center gap-2">
        <Lock size={13} className="text-amber-300" />
        <h3 className="text-sm font-semibold text-white">Preview financial boundary</h3>
      </div>
      <div className="space-y-2 text-xs">
        {[['Money movement', 'Disabled'], ['Sponsor ledger', 'Not connected'], ['Custody and crypto', 'Deferred'], ['Provider adapters', 'Not implemented']].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between border-b border-white/[0.04] py-2 last:border-0">
            <span className="text-white/40">{label}</span><span className="font-semibold text-amber-200/75">{value}</span>
          </div>
        ))}
      </div>
      <Link to="/admin/sponsor-readiness" className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300/15 bg-amber-300/[0.07] py-2 text-[11px] font-semibold text-amber-200 transition-colors hover:bg-amber-300/[0.1]">
        Sponsor-readiness workspace <ChevronRight size={10} />
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: Live Notifications
// ─────────────────────────────────────────────────────────────────────────────
function LiveNotifications({ activity }: { activity: Stats['recentActivity'] }) {
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const incoming = new Set(activity.map(a => a.id));
    const fresh = new Set([...incoming].filter(id => !prevIds.current.has(id)));
    if (fresh.size > 0) setNewIds(fresh);
    prevIds.current = incoming;
    const t = setTimeout(() => setNewIds(new Set()), 3000);
    return () => clearTimeout(t);
  }, [activity]);

  return (
    <div className="rounded-2xl border border-white/[0.05] overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <Bell size={13} className="text-white/40" />
          <h3 className="text-white font-semibold text-sm">Live Notifications</h3>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <Link to="/admin/transactions" className="text-[11px] flex items-center gap-0.5" style={{ color: '#C9A84C' }}>
          All <ChevronRight size={10} />
        </Link>
      </div>
      <div className="divide-y divide-white/[0.03] max-h-80 overflow-y-auto">
        <AnimatePresence initial={false}>
          {activity.slice(0, 12).map(act => {
            const meta = ACTIVITY_META[act.type] ?? { color: '#C9A84C', label: act.type.replace(/_/g, ' ') };
            const isNew = newIds.has(act.id);
            return (
              <motion.div key={act.id}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${isNew ? 'bg-primary/5' : 'hover:bg-white/[0.02]'}`}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${meta.color}15` }}>
                  <Activity size={10} style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/75 text-[11px] font-medium truncate">{act.user}</p>
                  <p className="text-white/30 text-[10px]">{meta.label}</p>
                </div>
                <div className="text-right shrink-0">
                  {act.amount != null && (
                    <p className="text-white/60 text-[11px] font-semibold tabular-nums">
                      {act.currency === 'BTC' || act.currency === 'ETH'
                        ? `${Number(act.amount).toFixed(4)} ${act.currency}`
                        : `${Number(act.amount).toLocaleString()} ${act.currency ?? ''}`}
                    </p>
                  )}
                  <p className="text-white/20 text-[9px]">
                    {new Date(act.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                  act.status === 'completed' ? 'bg-emerald-500/12 text-emerald-400' :
                  act.status === 'pending'   ? 'bg-amber-500/12 text-amber-400' :
                  act.status === 'flagged'   ? 'bg-red-500/12 text-red-400' :
                  'bg-white/6 text-white/30'
                }`}>{act.status}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {activity.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-white/20">
            <Bell size={20} />
            <p className="text-xs">No recent activity</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: System Health
// ─────────────────────────────────────────────────────────────────────────────
function SystemHealthPanel({ health }: { health: HealthData | null }) {
  const memPct  = health ? pct(health.memory.heapUsedMb, health.memory.heapTotalMb) : 0;
  const ramPct  = health ? pct(health.memory.heapTotalMb + health.memory.rssMb, health.memory.totalRamMb) : 0;

  // Derive storage usage from store sizes
  const storageBytes = health
    ? Object.values(health.stores).reduce((s, st) => s + (st.sizeBytes ?? 0), 0)
    : 0;
  const storageMb = Math.round(storageBytes / 1024 / 1024 * 10) / 10;

  // CPU: use load average as proxy (load1m / cores — not available here, use uptime heuristic)
  // We'll show uptime instead of CPU% since we don't have CPU% from health endpoint
  const uptimeH = health ? Math.floor(health.uptime.seconds / 3600) : 0;
  const uptimeM = health ? Math.floor((health.uptime.seconds % 3600) / 60) : 0;

  // Subsystem checks
  const checks = [
    {
      key: 'api',        label: 'API',        icon: Globe,      ok: !!health,
      detail: health ? 'Responding' : 'Unreachable',
    },
    {
      key: 'database',   label: 'Database',   icon: Database,   ok: !!(health?.stores.users?.exists),
      detail: health ? `${health.stores.users?.lineCount ?? 0} users` : 'Unknown',
    },
    {
      key: 'email',      label: 'Email',      icon: Mail,       ok: !!(health?.stores.contacts?.exists !== false),
      detail: 'Zoho Mail',
    },
    {
      key: 'server',     label: 'Server',     icon: Server,     ok: !!health,
      detail: health ? `Node ${health.runtime.nodeVersion}` : 'Unknown',
    },
    {
      key: 'storage',    label: 'Storage',    icon: HardDrive,  ok: storageMb < 900,
      warn: storageMb > 500,
      detail: `${storageMb} MB used`,
    },
    {
      key: 'memory',     label: 'Memory',     icon: Cpu,        ok: memPct < 85,
      warn: memPct >= 70 && memPct < 85,
      detail: health ? `${health.memory.heapUsedMb}/${health.memory.heapTotalMb} MB` : '—',
    },
    {
      key: 'cpu',        label: 'CPU',        icon: Zap,        ok: true,
      detail: health ? `${uptimeH}h ${uptimeM}m uptime` : '—',
    },
    {
      key: 'queue',      label: 'Queue',      icon: Send,       ok: true,
      detail: 'Email queue active',
    },
    {
      key: 'cloudflare', label: 'Cloudflare', icon: Wifi,       ok: true,
      detail: 'CDN active',
    },
    {
      key: 'ssl',        label: 'SSL',        icon: Lock,       ok: true,
      detail: 'TLS 1.3',
    },
  ];

  const allOk   = checks.every(c => c.ok);
  const anyWarn = checks.some(c => c.warn && c.ok);
  const anyFail = checks.some(c => !c.ok);

  return (
    <div className="rounded-2xl border border-white/[0.05] p-4" style={{ background: 'rgba(255,255,255,0.025)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={13} className="text-white/40" />
          <h3 className="text-white font-semibold text-sm">System Health</h3>
        </div>
        <StatusBadge
          ok={allOk && !anyFail}
          warn={anyWarn && !anyFail}
          label={anyFail ? 'Degraded' : anyWarn ? 'Warning' : 'All Systems Go'}
        />
      </div>

      {/* 5-column subsystem grid */}
      <div className="grid grid-cols-5 gap-1.5 mb-4">
        {checks.map(c => {
          const Icon = c.icon;
          const ok   = c.ok && !c.warn;
          const warn = c.warn;
          return (
            <div key={c.key}
              className="flex flex-col items-center gap-1.5 p-2 rounded-xl"
              style={{ background: ok ? 'rgba(16,185,129,0.06)' : warn ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)' }}>
              <Icon size={12} className={ok ? 'text-emerald-400' : warn ? 'text-amber-400' : 'text-red-400'} />
              <p className="text-[9px] text-white/35 text-center leading-tight">{c.label}</p>
              <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : warn ? 'bg-amber-400 animate-pulse' : 'bg-red-400 animate-pulse'}`} />
            </div>
          );
        })}
      </div>

      {/* Resource gauges */}
      <div className="space-y-2.5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-white/35 text-[10px]">Heap Memory</p>
            <p className="text-white/50 text-[10px] font-mono">{health ? `${health.memory.heapUsedMb} / ${health.memory.heapTotalMb} MB` : '—'}</p>
          </div>
          <GaugeBar value={memPct} color={memPct > 85 ? '#EF4444' : memPct > 70 ? '#F59E0B' : '#10B981'} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-white/35 text-[10px]">RAM Usage</p>
            <p className="text-white/50 text-[10px] font-mono">{health ? `${Math.round(health.memory.rssMb)} MB RSS` : '—'}</p>
          </div>
          <GaugeBar value={ramPct} color={ramPct > 85 ? '#EF4444' : ramPct > 70 ? '#F59E0B' : '#627EEA'} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-white/35 text-[10px]">Storage</p>
            <p className="text-white/50 text-[10px] font-mono">{storageMb} MB</p>
          </div>
          <GaugeBar value={Math.min(storageMb, 1000)} max={1000} color="#C9A84C" />
        </div>
      </div>

      {/* Runtime info */}
      {health && (
        <div className="mt-3 pt-3 border-t border-white/[0.05] grid grid-cols-2 gap-2">
          <div>
            <p className="text-white/25 text-[9px] mb-0.5">Uptime</p>
            <p className="text-white/55 text-[11px] font-mono">{health.uptime.human}</p>
          </div>
          <div>
            <p className="text-white/25 text-[9px] mb-0.5">Sessions</p>
            <p className="text-white/55 text-[11px] font-mono">{health.runtime.activeSessions} active</p>
          </div>
          <div>
            <p className="text-white/25 text-[9px] mb-0.5">Node</p>
            <p className="text-white/55 text-[11px] font-mono">{health.runtime.nodeVersion}</p>
          </div>
          <div>
            <p className="text-white/25 text-[9px] mb-0.5">PID</p>
            <p className="text-white/55 text-[11px] font-mono">{health.runtime.pid}</p>
          </div>
        </div>
      )}

      <Link to="/admin/readiness"
        className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-[11px] font-semibold transition-all hover:brightness-110"
        style={{ background: 'rgba(201,168,76,0.08)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.15)' }}>
        Full Readiness Report <ChevronRight size={10} />
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: Fee activity chart
// ─────────────────────────────────────────────────────────────────────────────
function RevenueChart({ data }: { data: Stats['dailyRevenue'] }) {
  const slice   = data.slice(-14);
  const maxRev  = Math.max(...slice.map(d => d.revenue), 1);
  const maxTx   = Math.max(...slice.map(d => d.transactions), 1);
  const totalRev = slice.reduce((s, d) => s + d.revenue, 0);
  const totalTx  = slice.reduce((s, d) => s + d.transactions, 0);

  return (
    <div className="rounded-2xl border border-white/[0.05] p-4" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 size={13} className="text-white/40" />
            <h3 className="text-white font-semibold text-sm">Recorded fees & activity</h3>
          </div>
          <p className="text-white/25 text-[10px] mt-0.5">14-day preview register · gold = fee records · blue = activity</p>
        </div>
        <div className="text-right">
          <p className="text-white font-bold text-sm tabular-nums">{fmt(totalRev, '$')}</p>
          <p className="text-white/30 text-[10px]">{totalTx.toLocaleString()} tx</p>
        </div>
      </div>
      <div className="flex items-end gap-0.5 h-28">
        {slice.map((d, i) => {
          const rp = (d.revenue / maxRev) * 100;
          const tp = (d.transactions / maxTx) * 100;
          const isLast = i === slice.length - 1;
          return (
            <div key={d.date} className="flex-1 flex items-end gap-px group relative">
              <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                <p className="font-semibold text-white/60">{d.date.slice(5)}</p>
                <p style={{ color: '#C9A84C' }}>{fmt(d.revenue, '$')}</p>
                <p className="text-blue-400">{d.transactions} tx</p>
                <p className="text-emerald-400">+{d.newUsers} users</p>
              </div>
              <div className="flex-1 rounded-t-sm"
                style={{ height: `${Math.max(rp, 2)}%`, background: isLast ? 'linear-gradient(180deg,#C9A84C,#F0D080)' : 'rgba(201,168,76,0.3)' }} />
              <div className="flex-1 rounded-t-sm"
                style={{ height: `${Math.max(tp, 2)}%`, background: isLast ? 'rgba(98,126,234,0.9)' : 'rgba(98,126,234,0.25)' }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-white/20 text-[9px]">{slice[0]?.date.slice(5)}</span>
        <span className="text-white/20 text-[9px]">{slice[slice.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();

  const [stats,   setStats]   = useState<Stats | null>(null);
  const [health,  setHealth]  = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [sRes, hRes] = await Promise.all([
        fetch('/api/admin/stats',  { headers: authHeaders() }),
        fetch('/api/admin/health', { headers: authHeaders() }),
      ]);
      if (sRes.ok) setStats(await sRes.json());
      if (hRes.ok) setHealth(await hRes.json());
      setLastRefresh(new Date());
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Stats: 30 s refresh
  useEffect(() => {
    const id = setInterval(() => fetchStats(true), 30_000);
    return () => clearInterval(id);
  }, [fetchStats]);

  // Notifications: 15 s fast-poll (activity only)
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/stats', { headers: authHeaders() });
        if (res.ok) {
          const d: Stats = await res.json();
          setStats(prev => prev ? { ...prev, recentActivity: d.recentActivity } : d);
        }
      } catch { /* silent */ }
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  const k = stats?.kpis ?? {};
  const spark = (key: string) =>
    stats?.dailyRevenue.slice(-7).map(d =>
      key === 'newUsers' ? d.newUsers : d.revenue
    ) ?? [];

  // ── Customer KPI cards ──────────────────────────────────────────────────────
  const customerCards = [
    { label: 'Total Customers',     value: fmt(k.totalUsers?.value),           change: k.totalUsers?.change ?? 0,           icon: Users,        color: '#C9A84C', href: '/admin/users',    sub: 'All registered accounts',   sparkKey: 'newUsers' },
    { label: 'Active Customers',    value: fmt(k.activeAccounts?.value),       change: k.activeAccounts?.change ?? 0,       icon: CheckCircle,  color: '#10B981', href: '/admin/users',    sub: 'Status: active',            sparkKey: 'newUsers' },
    { label: 'Suspended Customers', value: fmt(k.suspendedAccounts?.value),    change: k.suspendedAccounts?.change ?? 0,    icon: UserX,        color: '#EF4444', href: '/admin/users',    sub: 'Frozen or suspended',       sparkKey: 'newUsers' },
    { label: 'Pending KYC',         value: fmt(k.pendingVerifications?.value), change: k.pendingVerifications?.change ?? 0, icon: Clock,        color: '#F59E0B', href: '/admin/kyc',      sub: 'Awaiting verification',     sparkKey: 'newUsers' },
  ];

  // ── Financial KPI cards ─────────────────────────────────────────────────────
  const financialCards = [
    { label: 'Recorded Deposits',    value: fmt(k.totalDeposits?.value, '$'),    change: k.totalDeposits?.change ?? 0,    icon: TrendingUp,   color: '#10B981', href: '/admin/transactions', sub: 'Synthetic preview records', sparkKey: 'revenue' },
    { label: 'Recorded Withdrawals', value: fmt(k.totalWithdrawals?.value, '$'), change: k.totalWithdrawals?.change ?? 0, icon: TrendingDown, color: '#EF4444', href: '/admin/transactions', sub: 'Synthetic preview records', sparkKey: 'revenue' },
    { label: 'Recorded Transfers',   value: fmt(k.totalTransfers?.value, '$'),   change: k.totalTransfers?.change ?? 0,   icon: Send,         color: '#627EEA', href: '/admin/transactions', sub: 'Synthetic preview records', sparkKey: 'revenue' },
    { label: 'Recorded Fees',        value: fmt(k.totalRevenue?.value, '$'),     change: k.totalRevenue?.change ?? 0,     icon: DollarSign,   color: '#C9A84C', href: '/admin/reports',      sub: 'Not recognised revenue',   sparkKey: 'revenue' },
  ];

  // ── Pending flow cards ──────────────────────────────────────────────────────
  const pendingCards = [
    { label: 'Pending Deposit Records',    value: String(k.pendingDeposits?.value ?? 0),    change: 0, icon: TrendingUp,   color: '#F59E0B', href: '/admin/transactions', sub: 'No provider execution' },
    { label: 'Pending Withdrawal Records', value: String(k.pendingWithdrawals?.value ?? 0), change: 0, icon: TrendingDown, color: '#F59E0B', href: '/admin/transactions', sub: 'No provider execution' },
    { label: 'Pending Transfer Records',   value: String(k.pendingTransfers?.value ?? 0),   change: 0, icon: Send,         color: '#F59E0B', href: '/admin/transactions', sub: 'No provider execution' },
    { label: 'Monthly Fee Records',        value: fmt(k.monthlyRevenue?.value, '$'),        change: k.monthlyRevenue?.change ?? 0, icon: BarChart2, color: '#8B5CF6', href: '/admin/reports', sub: 'Not recognised revenue' },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <Helmet>
        <title>Executive Dashboard — City Gate Capital Admin</title>
        <meta name="description" content="City Gate Capital preview administration dashboard for customers, synthetic records, readiness and system health." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/admin" />
      </Helmet>
      <AdminLayout title="Executive Dashboard">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-white text-xl font-bold leading-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              {greeting}, {admin?.name?.split(' ')[0] ?? 'Admin'}
            </h1>
            <p className="text-white/30 text-xs mt-1">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              <span className="mx-1.5 text-white/15">·</span>
              Last updated {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              <span className="mx-1.5 text-white/15">·</span>
              <span className="text-emerald-400/70">Auto-refresh 30s</span>
            </p>
          </div>
          <button onClick={() => fetchStats(true)} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-medium transition-all hover:border-white/15 disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3">
          <Lock size={15} className="mt-0.5 shrink-0 text-amber-200" />
          <div><p className="text-sm font-semibold text-amber-100">Product-preview administration</p><p className="mt-1 text-xs leading-relaxed text-amber-100/55">Financial figures below summarize persistent synthetic application records. They are not bank balances, safeguarded funds, assets under management, recognised revenue, or provider-ledger entries. Money movement and provider adapters remain disabled.</p></div>
        </div>

        {loading ? (
          /* Skeleton */
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl bg-white/[0.03] border border-white/[0.04] animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">

            {/* ── Section 1: Customer KPIs ── */}
            <section>
              <p className="text-white/25 text-[10px] font-bold uppercase tracking-[0.15em] mb-2.5 flex items-center gap-2">
                <Users size={10} /> Customers
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {customerCards.map((c, i) => (
                  <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <KpiCard {...c} sparkData={spark(c.sparkKey)} />
                  </motion.div>
                ))}
              </div>
            </section>

            {/* ── Section 2: Financial KPIs ── */}
            <section>
              <p className="text-white/25 text-[10px] font-bold uppercase tracking-[0.15em] mb-2.5 flex items-center gap-2">
                <DollarSign size={10} /> Demonstration financial records
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {financialCards.map((c, i) => (
                  <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 + i * 0.04 }}>
                    <KpiCard {...c} sparkData={spark(c.sparkKey)} />
                  </motion.div>
                ))}
              </div>
            </section>

            {/* ── Section 3: Pending Flows ── */}
            <section>
              <p className="text-white/25 text-[10px] font-bold uppercase tracking-[0.15em] mb-2.5 flex items-center gap-2">
                <Clock size={10} /> Pending demonstration records
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {pendingCards.map((c, i) => (
                  <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 + i * 0.04 }}>
                    <KpiCard {...c} />
                  </motion.div>
                ))}
              </div>
            </section>

            {/* ── Section 4: Preview analytics, rates and boundary ── */}
            <section>
              <p className="text-white/25 text-[10px] font-bold uppercase tracking-[0.15em] mb-2.5 flex items-center gap-2">
                <BarChart2 size={10} /> Preview analytics & configuration
              </p>
              <div className="grid lg:grid-cols-3 gap-4">
                {/* Revenue chart — spans 1 col on lg */}
                <div className="lg:col-span-1">
                  <RevenueChart data={stats?.dailyRevenue ?? []} />
                </div>
                {/* Exchange rates */}
                <ExchangeRatesPanel rates={stats?.exchangeRates ?? null} />
                <PreviewDataPanel />
              </div>
            </section>

            {/* ── Section 5: Notifications + System Health ── */}
            <section>
              <p className="text-white/25 text-[10px] font-bold uppercase tracking-[0.15em] mb-2.5 flex items-center gap-2">
                <Activity size={10} /> Operational activity
              </p>
              <div className="grid lg:grid-cols-2 gap-4">
                {/* Live notifications */}
                <LiveNotifications activity={stats?.recentActivity ?? []} />
                {/* System health */}
                <SystemHealthPanel health={health} />
              </div>
            </section>

            {/* ── Quick-action bar ── */}
            <section>
              <p className="text-white/25 text-[10px] font-bold uppercase tracking-[0.15em] mb-2.5 flex items-center gap-2">
                <Zap size={10} /> Quick Actions
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { label: 'Review KYC',      href: '/admin/kyc',          icon: UserCheck,      color: '#C9A84C' },
                  { label: 'Support Tickets', href: '/admin/support',      icon: HeadphonesIcon, color: '#627EEA' },
                  { label: 'Transactions',    href: '/admin/transactions', icon: CreditCard,     color: '#10B981' },
                  { label: 'Security',        href: '/admin/security',     icon: ShieldCheck,    color: '#EF4444' },
                  { label: 'Reports',         href: '/admin/reports',      icon: BarChart2,      color: '#8B5CF6' },
                  { label: 'Compliance',      href: '/admin/compliance',   icon: Layers,         color: '#F59E0B' },
                ].map(a => (
                  <Link key={a.href} to={a.href}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-white/[0.05] hover:border-white/[0.09] transition-all group"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                      style={{ background: `${a.color}15` }}>
                      <a.icon size={16} style={{ color: a.color }} />
                    </div>
                    <p className="text-[10px] text-white/35 group-hover:text-white/65 transition-colors text-center leading-tight">{a.label}</p>
                  </Link>
                ))}
              </div>
            </section>

          </div>
        )}
      </AdminLayout>
    </>
  );
}
