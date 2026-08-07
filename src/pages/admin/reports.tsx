/**
 * /admin/reports — Reports Center
 * 11 report tabs: Customers · Transactions · Revenue · Deposits · Withdrawals
 *                 Exchange · KYC · AML · Support · Emails · Security
 */
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
Activity,
AlertTriangle,
ArrowDownRight,
ArrowUpRight,
BarChart,
BarChart2,
CheckCircle2,
ChevronDown,
Clock,
DollarSign,
Download,FileText,
Hash,Layers,
Loader2,
Mail,
RefreshCw,
Repeat2,
Shield,
ShieldAlert,
TrendingDown,
TrendingUp,
UserCheck,
Users,
UserX,
XCircle,
Zap
} from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback,useEffect,useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period  = '7d' | '30d' | '90d' | 'ytd' | 'all';
type ReportType =
  | 'customers' | 'transactions' | 'revenue' | 'deposits' | 'withdrawals'
  | 'exchange'  | 'kyc'          | 'aml'     | 'support'  | 'emails' | 'security';

interface Kpi { value: number; change: number }

// ─── Shared helpers ───────────────────────────────────────────────────────────

function fmtUsd(n: number, compact = true): string {
  if (!compact) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}
function fmtPct(n: number): string { return `${n >= 0 ? '+' : ''}${n}%`; }

function ChangeChip({ change }: { change: number }) {
  const up = change >= 0;
  return (
    <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {Math.abs(change)}%
    </span>
  );
}

function KpiCard({ label, value, change, icon: Icon, color, prefix = '', suffix = '' }:
  { label: string; value: number; change: number; icon: React.ElementType; color: string; prefix?: string; suffix?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 border border-white/[0.05]" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <ChangeChip change={change} />
      </div>
      <p className="text-white text-xl font-bold leading-none mb-0.5 truncate">{prefix}{fmtNum(value)}{suffix}</p>
      <p className="text-white/30 text-[11px]">{label}</p>
    </motion.div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 border border-white/[0.05]" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <div className="mb-4">
        <h3 className="text-white font-semibold text-sm">{title}</h3>
        {subtitle && <p className="text-white/30 text-xs mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Horizontal bar chart for breakdown objects */
function BreakdownBars({ data, colorMap = {}, valueFormatter = fmtNum }:
  { data: Record<string, number>; colorMap?: Record<string, string>; valueFormatter?: (n: number) => string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(e => e[1]), 1);
  const DEFAULT_COLORS = ['#C9A84C','#10B981','#3B82F6','#8B5CF6','#EF4444','#F59E0B','#06B6D4','#EC4899'];
  return (
    <div className="space-y-2.5">
      {entries.slice(0, 10).map(([key, val], i) => {
        const pct = (val / max) * 100;
        const color = colorMap[key] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-white/60 text-xs capitalize">{key.replace(/_/g, ' ')}</p>
              <p className="text-white/40 text-[11px]">{valueFormatter(val)}</p>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Sparkline bar chart for daily series */
function DailyChart({ data, field, color = '#C9A84C', height = 120, formatter = fmtNum }:
  { data: Array<Record<string, unknown>>; field: string; color?: string; height?: number; formatter?: (n: number) => string }) {
  const show = data.slice(-60); // cap at 60 bars
  const showVals = show.map(d => Number(d[field] ?? 0));
  const showMax = Math.max(...showVals, 1);

  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {show.map((d, i) => {
        const v   = Number(d[field] ?? 0);
        const pct = (v / showMax) * 100;
        const isLast = i === show.length - 1;
        return (
          <div key={String(d.date ?? i)} className="flex-1 group relative min-w-0">
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
              <p className="font-semibold">{String(d.date ?? '').slice(5)}</p>
              <p style={{ color }}>{formatter(v)}</p>
            </div>
            <div className="w-full rounded-t-sm transition-all"
              style={{ height: `${Math.max(pct, 2)}%`, background: isLast ? color : `${color}40` }} />
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    completed: 'text-emerald-400 bg-emerald-400/10',
    approved:  'text-emerald-400 bg-emerald-400/10',
    active:    'text-emerald-400 bg-emerald-400/10',
    pending:   'text-amber-400 bg-amber-400/10',
    submitted: 'text-blue-400 bg-blue-400/10',
    failed:    'text-red-400 bg-red-400/10',
    rejected:  'text-red-400 bg-red-400/10',
    suspended: 'text-orange-400 bg-orange-400/10',
    frozen:    'text-purple-400 bg-purple-400/10',
    flagged:   'text-amber-400 bg-amber-400/10',
    sent:      'text-emerald-400 bg-emerald-400/10',
    bounced:   'text-red-400 bg-red-400/10',
    queued:    'text-blue-400 bg-blue-400/10',
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg[status] ?? 'text-white/30 bg-white/5'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: Array<{ id: ReportType; label: string; icon: React.ElementType; color: string }> = [
  { id: 'customers',    label: 'Customers',    icon: Users,        color: '#3B82F6' },
  { id: 'transactions', label: 'Transactions', icon: Repeat2,      color: '#C9A84C' },
  { id: 'revenue',      label: 'Revenue',      icon: DollarSign,   color: '#10B981' },
  { id: 'deposits',     label: 'Deposits',     icon: TrendingUp,   color: '#10B981' },
  { id: 'withdrawals',  label: 'Withdrawals',  icon: TrendingDown, color: '#EF4444' },
  { id: 'exchange',     label: 'Exchange',     icon: Zap,          color: '#F59E0B' },
  { id: 'kyc',          label: 'KYC',          icon: UserCheck,    color: '#8B5CF6' },
  { id: 'aml',          label: 'AML',          icon: ShieldAlert,  color: '#EF4444' },
  { id: 'support',      label: 'Support',      icon: Activity,     color: '#06B6D4' },
  { id: 'emails',       label: 'Emails',       icon: Mail,         color: '#EC4899' },
  { id: 'security',     label: 'Security',     icon: Shield,       color: '#8B5CF6' },
];

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: '7d',  label: '7 Days'   },
  { id: '30d', label: '30 Days'  },
  { id: '90d', label: '90 Days'  },
  { id: 'ytd', label: 'YTD'      },
  { id: 'all', label: 'All Time' },
];

const TX_TYPE_COLORS: Record<string, string> = {
  deposit: '#10B981', withdrawal: '#EF4444', transfer: '#3B82F6',
  crypto_buy: '#F59E0B', crypto_sell: '#8B5CF6', fee: '#6B7280',
  refund: '#06B6D4', wire_transfer: '#EC4899', manual_credit: '#10B981', manual_debit: '#EF4444',
};

const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981', approved: '#10B981', active: '#10B981',
  pending: '#F59E0B', submitted: '#3B82F6',
  failed: '#EF4444', rejected: '#EF4444', suspended: '#F97316', frozen: '#8B5CF6',
  flagged: '#F59E0B', sent: '#10B981', bounced: '#EF4444', queued: '#3B82F6',
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminReports() {
  const [tab,     setTab]     = useState<ReportType>('customers');
  const [period,  setPeriod]  = useState<Period>('30d');
  const [data,    setData]    = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchReport = useCallback(async (t: ReportType, p: Period) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/reports?type=${t}&period=${p}`, {
        credentials: 'same-origin', headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReport(tab, period); }, [tab, period, fetchReport]);

  function exportCsv() {
    const url = `/api/admin/reports?type=${tab}&period=${period}&format=csv`;
    const a = document.createElement('a');
    a.href = url; a.download = `cgc-${tab}-report.csv`; a.click();
  }

  function exportPdf() {
    if (!data) return;
    const kpis = (data as Record<string, unknown>).kpis as Record<string, Kpi> | undefined;
    const daily = ((data as Record<string, unknown>).daily ?? (data as Record<string, unknown>).dailyRegistrations) as Array<Record<string, unknown>> | undefined;
    const periodLabel = PERIODS.find(p => p.id === period)?.label ?? period;
    const tabLabel    = TABS.find(t => t.id === tab)?.label ?? tab;

    let html = `<!DOCTYPE html><html><head><title>CGC ${tabLabel} Report — ${periodLabel}</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:40px}
      h1{font-size:20px;margin-bottom:4px}h2{font-size:14px;margin:20px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      th{background:#f5f5f5;padding:8px;text-align:left;border-bottom:2px solid #ddd;font-size:11px}
      td{padding:7px 8px;border-bottom:1px solid #eee;font-size:11px}
      .meta{color:#666;font-size:11px;margin-bottom:20px}</style></head><body>
      <h1>City Gate Capital — ${tabLabel} Report</h1>
      <p class="meta">Period: ${periodLabel} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-GB')}</p>`;

    if (kpis) {
      html += '<h2>Key Metrics</h2><table><thead><tr><th>Metric</th><th>Value</th><th>Change</th></tr></thead><tbody>';
      for (const [k, v] of Object.entries(kpis)) {
        html += `<tr><td>${k.replace(/([A-Z])/g, ' $1').trim()}</td><td>${v.value.toLocaleString()}</td><td>${fmtPct(v.change)}</td></tr>`;
      }
      html += '</tbody></table>';
    }

    if (daily && daily.length > 0) {
      const headers = Object.keys(daily[0]);
      html += `<h2>Daily Series</h2><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
      for (const row of daily) {
        html += `<tr>${headers.map(h => `<td>${String(row[h] ?? '')}</td>`).join('')}</tr>`;
      }
      html += '</tbody></table>';
    }

    html += '<script>window.onload=()=>window.print();</script></body></html>';
    const blob = new Blob([html], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Helmet>
        <title>Reports Center — City Gate Capital Admin</title>
        <meta name="description" content="City Gate Capital admin reports — customers, transactions, revenue, KYC, AML, support, emails, security." />
        <meta name="robots" content="noindex,nofollow" />
        <link rel="canonical" href="https://citygate.capital/admin/reports" />
      </Helmet>
      <AdminLayout title="Reports">
        <div className="space-y-5 p-1">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
                <BarChart2 size={20} style={{ color: '#C9A84C' }} />
                Reports Center
              </h1>
              <p className="text-white/30 text-sm mt-0.5">Platform-wide analytics across 11 report categories</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Period selector */}
              <div className="relative">
                <select value={period} onChange={e => setPeriod(e.target.value as Period)}
                  className="appearance-none bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 pr-8 text-xs text-white/60 focus:outline-none cursor-pointer">
                  {PERIODS.map(p => <option key={p.id} value={p.id} style={{ background: '#0a0a0a' }}>{p.label}</option>)}
                </select>
                <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              </div>
              <button onClick={() => fetchReport(tab, period)}
                className="w-8 h-8 rounded-xl border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors">
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={exportCsv} disabled={!data || loading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-white/50 hover:text-white text-xs transition-colors disabled:opacity-40">
                <Download size={12} /> CSV
              </button>
              <button onClick={exportPdf} disabled={!data || loading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110 disabled:opacity-40"
                style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.2)' }}>
                <FileText size={12} /> PDF
              </button>
            </div>
          </div>

          {/* ── Tab bar ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-1 p-1 rounded-2xl border border-white/5"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            {TABS.map(t => {
              const Icon   = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    active ? 'text-black font-bold shadow-sm' : 'text-white/40 hover:text-white/70'
                  }`}
                  style={active ? { background: 'linear-gradient(135deg,#C9A84C,#F0D080)' } : {}}>
                  <Icon size={12} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* ── Loading / error ──────────────────────────────────────────── */}
          {loading && (
            <div className="flex items-center gap-2 text-white/30 text-xs py-4">
              <Loader2 size={14} className="animate-spin" /> Generating report…
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-400/8 border border-red-400/15 text-red-300 text-sm">
              <XCircle size={14} /> {error}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* CUSTOMERS                                                      */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {!loading && data && tab === 'customers' && (() => {
            const d = data as {
              kpis: Record<string, Kpi>;
              byStatus: Record<string, number>;
              byKyc: Record<string, number>;
              byTier: Record<string, number>;
              dailyRegistrations: Array<{ date: string; count: number }>;
              topCountries: Array<{ country: string; count: number }>;
              recentUsers: Array<{ id: string; name: string; email: string; status: string; kycStatus: string; tier: string; createdAt: string }>;
            };
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KpiCard label="Total Customers"  value={d.kpis.total?.value ?? 0}       change={d.kpis.total?.change ?? 0}       icon={Users}       color="#3B82F6" />
                  <KpiCard label="New This Period"   value={d.kpis.newThisPeriod?.value ?? 0} change={d.kpis.newThisPeriod?.change ?? 0} icon={TrendingUp}  color="#10B981" />
                  <KpiCard label="Active"            value={d.kpis.active?.value ?? 0}      change={d.kpis.active?.change ?? 0}      icon={CheckCircle2} color="#10B981" />
                  <KpiCard label="Suspended/Frozen"  value={d.kpis.suspended?.value ?? 0}   change={d.kpis.suspended?.change ?? 0}   icon={UserX}        color="#EF4444" />
                  <KpiCard label="KYC Approved"      value={d.kpis.kycApproved?.value ?? 0} change={d.kpis.kycApproved?.change ?? 0} icon={UserCheck}    color="#8B5CF6" />
                  <KpiCard label="KYC Pending"       value={d.kpis.kycPending?.value ?? 0}  change={d.kpis.kycPending?.change ?? 0}  icon={Clock}        color="#F59E0B" />
                </div>

                <div className="grid lg:grid-cols-3 gap-5">
                  <SectionCard title="Daily Registrations" subtitle="New sign-ups per day">
                    <DailyChart data={d.dailyRegistrations} field="count" color="#3B82F6" height={120} />
                  </SectionCard>
                  <SectionCard title="By Account Status">
                    <BreakdownBars data={d.byStatus} colorMap={STATUS_COLORS} />
                  </SectionCard>
                  <SectionCard title="By KYC Status">
                    <BreakdownBars data={d.byKyc} colorMap={{ approved: '#10B981', submitted: '#3B82F6', rejected: '#EF4444', not_submitted: '#6B7280', expired: '#F59E0B' }} />
                  </SectionCard>
                </div>

                <div className="grid lg:grid-cols-2 gap-5">
                  <SectionCard title="By Tier">
                    <BreakdownBars data={d.byTier} colorMap={{ standard: '#6B7280', premium: '#C9A84C', vip: '#8B5CF6', elite: '#EF4444' }} />
                  </SectionCard>
                  {d.topCountries.length > 0 && (
                    <SectionCard title="Top Countries">
                      <BreakdownBars data={Object.fromEntries(d.topCountries.map(c => [c.country, c.count]))} />
                    </SectionCard>
                  )}
                </div>

                <SectionCard title="Recent Customers" subtitle="Last 20 registrations">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-white/5">
                        {['Name','Email','Status','KYC','Tier','Joined'].map(h => (
                          <th key={h} className="text-left text-white/25 font-medium pb-2 pr-4">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {d.recentUsers.map(u => (
                          <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-2.5 pr-4 text-white/70 font-medium">{u.name}</td>
                            <td className="py-2.5 pr-4 text-white/40">{u.email}</td>
                            <td className="py-2.5 pr-4"><StatusBadge status={u.status} /></td>
                            <td className="py-2.5 pr-4"><StatusBadge status={u.kycStatus ?? 'not_submitted'} /></td>
                            <td className="py-2.5 pr-4 text-white/40 capitalize">{u.tier ?? 'standard'}</td>
                            <td className="py-2.5 text-white/25">{new Date(u.createdAt).toLocaleDateString('en-GB')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TRANSACTIONS                                                   */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {!loading && data && tab === 'transactions' && (() => {
            const d = data as {
              kpis: Record<string, Kpi>;
              byType: Record<string, { count: number; volumeUsd: number }>;
              byStatus: Record<string, number>;
              byCurrency: Record<string, { count: number; volumeUsd: number }>;
              daily: Array<{ date: string; volumeUsd: number; count: number }>;
              recent: Array<{ id: string; type: string; status: string; userName: string; amount: number; currency: string; reference: string; createdAt: string; flagged: boolean }>;
            };
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KpiCard label="Total Transactions" value={d.kpis.total?.value ?? 0}     change={d.kpis.total?.change ?? 0}     icon={Repeat2}      color="#C9A84C" />
                  <KpiCard label="Volume (USD)"        value={d.kpis.volumeUsd?.value ?? 0} change={d.kpis.volumeUsd?.change ?? 0} icon={DollarSign}   color="#10B981" prefix="$" />
                  <KpiCard label="Completed"           value={d.kpis.completed?.value ?? 0} change={0}                             icon={CheckCircle2} color="#10B981" />
                  <KpiCard label="Pending"             value={d.kpis.pending?.value ?? 0}   change={0}                             icon={Clock}        color="#F59E0B" />
                  <KpiCard label="Failed"              value={d.kpis.failed?.value ?? 0}    change={0}                             icon={XCircle}      color="#EF4444" />
                  <KpiCard label="Flagged"             value={d.kpis.flagged?.value ?? 0}   change={0}                             icon={AlertTriangle} color="#F59E0B" />
                </div>

                <div className="grid lg:grid-cols-2 gap-5">
                  <SectionCard title="Daily Volume (USD)" subtitle="Completed transactions">
                    <DailyChart data={d.daily} field="volumeUsd" color="#C9A84C" height={140} formatter={fmtUsd} />
                  </SectionCard>
                  <SectionCard title="Daily Count">
                    <DailyChart data={d.daily} field="count" color="#3B82F6" height={140} />
                  </SectionCard>
                </div>

                <div className="grid lg:grid-cols-3 gap-5">
                  <SectionCard title="By Type">
                    <BreakdownBars data={Object.fromEntries(Object.entries(d.byType).map(([k, v]) => [k, v.count]))} colorMap={TX_TYPE_COLORS} />
                  </SectionCard>
                  <SectionCard title="By Status">
                    <BreakdownBars data={d.byStatus} colorMap={STATUS_COLORS} />
                  </SectionCard>
                  <SectionCard title="By Currency">
                    <BreakdownBars data={Object.fromEntries(Object.entries(d.byCurrency).map(([k, v]) => [k, v.count]))} />
                  </SectionCard>
                </div>

                <SectionCard title="Recent Transactions">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-white/5">
                        {['ID','Type','User','Amount','Status','Reference','Date'].map(h => (
                          <th key={h} className="text-left text-white/25 font-medium pb-2 pr-4">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {d.recent.map(t => (
                          <tr key={t.id} className={`hover:bg-white/[0.02] transition-colors ${t.flagged ? 'bg-amber-400/[0.03]' : ''}`}>
                            <td className="py-2.5 pr-4 text-white/30 font-mono">{t.id.slice(-8)}</td>
                            <td className="py-2.5 pr-4"><span className="capitalize text-white/60">{t.type.replace(/_/g,' ')}</span></td>
                            <td className="py-2.5 pr-4 text-white/60">{t.userName}</td>
                            <td className="py-2.5 pr-4 text-white/70 font-semibold">{t.amount.toLocaleString()} {t.currency}</td>
                            <td className="py-2.5 pr-4"><StatusBadge status={t.status} /></td>
                            <td className="py-2.5 pr-4 text-white/25 font-mono">{t.reference}</td>
                            <td className="py-2.5 text-white/25">{new Date(t.createdAt).toLocaleDateString('en-GB')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* REVENUE                                                        */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {!loading && data && tab === 'revenue' && (() => {
            const d = data as {
              kpis: Record<string, Kpi>;
              daily: Array<{ date: string; revenue: number }>;
              monthly: Array<{ month: string; revenue: number }>;
              byCurrency: Record<string, number>;
            };
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard label="Period Revenue"  value={d.kpis.periodRevenue?.value ?? 0} change={d.kpis.periodRevenue?.change ?? 0} icon={DollarSign}  color="#10B981" prefix="$" />
                  <KpiCard label="All-Time Revenue" value={d.kpis.allTime?.value ?? 0}      change={0}                                  icon={TrendingUp}  color="#C9A84C" prefix="$" />
                  <KpiCard label="Fee Transactions" value={d.kpis.feeCount?.value ?? 0}     change={d.kpis.feeCount?.change ?? 0}       icon={Hash}        color="#3B82F6" />
                  <KpiCard label="Avg Fee (USD)"    value={d.kpis.avgFee?.value ?? 0}       change={0}                                  icon={BarChart}    color="#8B5CF6" prefix="$" />
                </div>

                <SectionCard title="Daily Revenue (USD)" subtitle="Fee income per day">
                  <DailyChart data={d.daily} field="revenue" color="#10B981" height={160} formatter={fmtUsd} />
                  <div className="flex justify-between mt-2">
                    <span className="text-white/20 text-[10px]">{d.daily[0]?.date?.slice(5)}</span>
                    <span className="text-white/20 text-[10px]">{d.daily[d.daily.length - 1]?.date?.slice(5)}</span>
                  </div>
                </SectionCard>

                <div className="grid lg:grid-cols-2 gap-5">
                  <SectionCard title="Monthly Revenue" subtitle="Last 12 months">
                    <div className="flex items-end gap-1 h-32">
                      {d.monthly.map((m, i, arr) => {
                        const max = Math.max(...arr.map(x => x.revenue), 1);
                        const pct = (m.revenue / max) * 100;
                        const isLast = i === arr.length - 1;
                        return (
                          <div key={m.month} className="flex-1 group relative">
                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                              <p className="font-semibold">{m.month}</p>
                              <p className="text-emerald-400">{fmtUsd(m.revenue)}</p>
                            </div>
                            <div className="w-full rounded-t-sm"
                              style={{ height: `${Math.max(pct, 3)}%`, background: isLast ? '#10B981' : 'rgba(16,185,129,0.35)' }} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-white/20 text-[10px]">{d.monthly[0]?.month}</span>
                      <span className="text-white/20 text-[10px]">{d.monthly[d.monthly.length - 1]?.month}</span>
                    </div>
                  </SectionCard>
                  <SectionCard title="Revenue by Currency">
                    <BreakdownBars data={d.byCurrency} valueFormatter={fmtUsd} />
                  </SectionCard>
                </div>
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* DEPOSITS                                                       */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {!loading && data && tab === 'deposits' && (() => {
            const d = data as {
              kpis: Record<string, Kpi>;
              byStatus: Record<string, number>;
              byCurrency: Record<string, { count: number; volumeUsd: number }>;
              byType: Record<string, { count: number; volumeUsd: number }>;
              daily: Array<{ date: string; volumeUsd: number }>;
            };
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard label="Total Deposited"  value={d.kpis.totalUsd?.value ?? 0} change={d.kpis.totalUsd?.change ?? 0} icon={TrendingUp}   color="#10B981" prefix="$" />
                  <KpiCard label="Deposit Count"    value={d.kpis.count?.value ?? 0}    change={d.kpis.count?.change ?? 0}    icon={Layers}       color="#3B82F6" />
                  <KpiCard label="Pending"          value={d.kpis.pending?.value ?? 0}  change={0}                            icon={Clock}        color="#F59E0B" />
                  <KpiCard label="Avg Deposit (USD)" value={d.kpis.avgUsd?.value ?? 0}  change={0}                            icon={BarChart}     color="#C9A84C" prefix="$" />
                </div>
                <SectionCard title="Daily Deposit Volume (USD)">
                  <DailyChart data={d.daily} field="volumeUsd" color="#10B981" height={140} formatter={fmtUsd} />
                </SectionCard>
                <div className="grid lg:grid-cols-3 gap-5">
                  <SectionCard title="By Status">
                    <BreakdownBars data={d.byStatus} colorMap={STATUS_COLORS} />
                  </SectionCard>
                  <SectionCard title="By Currency">
                    <BreakdownBars data={Object.fromEntries(Object.entries(d.byCurrency).map(([k, v]) => [k, v.count]))} />
                  </SectionCard>
                  <SectionCard title="By Type">
                    <BreakdownBars data={Object.fromEntries(Object.entries(d.byType).map(([k, v]) => [k, v.count]))} colorMap={TX_TYPE_COLORS} />
                  </SectionCard>
                </div>
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* WITHDRAWALS                                                    */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {!loading && data && tab === 'withdrawals' && (() => {
            const d = data as {
              kpis: Record<string, Kpi>;
              byStatus: Record<string, number>;
              byCurrency: Record<string, { count: number; volumeUsd: number }>;
              byType: Record<string, { count: number; volumeUsd: number }>;
              daily: Array<{ date: string; volumeUsd: number }>;
            };
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard label="Total Withdrawn"   value={d.kpis.totalUsd?.value ?? 0} change={d.kpis.totalUsd?.change ?? 0} icon={TrendingDown} color="#EF4444" prefix="$" />
                  <KpiCard label="Withdrawal Count"  value={d.kpis.count?.value ?? 0}    change={d.kpis.count?.change ?? 0}    icon={Layers}       color="#3B82F6" />
                  <KpiCard label="Pending"           value={d.kpis.pending?.value ?? 0}  change={0}                            icon={Clock}        color="#F59E0B" />
                  <KpiCard label="Avg Withdrawal"    value={d.kpis.avgUsd?.value ?? 0}   change={0}                            icon={BarChart}     color="#C9A84C" prefix="$" />
                </div>
                <SectionCard title="Daily Withdrawal Volume (USD)">
                  <DailyChart data={d.daily} field="volumeUsd" color="#EF4444" height={140} formatter={fmtUsd} />
                </SectionCard>
                <div className="grid lg:grid-cols-3 gap-5">
                  <SectionCard title="By Status">
                    <BreakdownBars data={d.byStatus} colorMap={STATUS_COLORS} />
                  </SectionCard>
                  <SectionCard title="By Currency">
                    <BreakdownBars data={Object.fromEntries(Object.entries(d.byCurrency).map(([k, v]) => [k, v.count]))} />
                  </SectionCard>
                  <SectionCard title="By Type">
                    <BreakdownBars data={Object.fromEntries(Object.entries(d.byType).map(([k, v]) => [k, v.count]))} colorMap={TX_TYPE_COLORS} />
                  </SectionCard>
                </div>
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* EXCHANGE                                                       */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {!loading && data && tab === 'exchange' && (() => {
            const d = data as {
              kpis: Record<string, Kpi>;
              byPair: Record<string, { count: number; volumeUsd: number }>;
              byType: Record<string, { count: number; volumeUsd: number }>;
              daily: Array<{ date: string; volumeUsd: number }>;
              liveRates: Array<{ pair: string; rate: number }>;
            };
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard label="Exchange Volume"  value={d.kpis.totalUsd?.value ?? 0} change={d.kpis.totalUsd?.change ?? 0} icon={Zap}         color="#F59E0B" prefix="$" />
                  <KpiCard label="Total Trades"     value={d.kpis.count?.value ?? 0}    change={d.kpis.count?.change ?? 0}    icon={Repeat2}     color="#C9A84C" />
                  <KpiCard label="Crypto Buys"      value={d.kpis.buys?.value ?? 0}     change={0}                            icon={TrendingUp}  color="#10B981" />
                  <KpiCard label="Crypto Sells"     value={d.kpis.sells?.value ?? 0}    change={0}                            icon={TrendingDown} color="#EF4444" />
                </div>

                <SectionCard title="Daily Exchange Volume (USD)">
                  <DailyChart data={d.daily} field="volumeUsd" color="#F59E0B" height={140} formatter={fmtUsd} />
                </SectionCard>

                <div className="grid lg:grid-cols-2 gap-5">
                  <SectionCard title="Volume by Trading Pair">
                    <BreakdownBars data={Object.fromEntries(Object.entries(d.byPair).map(([k, v]) => [k, v.count]))} />
                  </SectionCard>
                  <SectionCard title="Live Rates Snapshot">
                    <div className="space-y-2">
                      {d.liveRates.map(r => (
                        <div key={r.pair} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                          <p className="text-white/60 text-sm font-mono">{r.pair}</p>
                          <p className="text-white font-bold text-sm">{r.rate >= 1 ? fmtUsd(r.rate, false) : r.rate.toFixed(6)}</p>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                </div>
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* KYC                                                            */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {!loading && data && tab === 'kyc' && (() => {
            const d = data as {
              kpis: Record<string, Kpi>;
              byStatus: Record<string, number>;
              daily: Array<{ date: string; count: number }>;
              rejectionReasons: Record<string, number>;
              expired: number;
              queue: Array<{ id: string; name: string; email: string; kycStatus: string; kycSubmittedAt?: string; tier?: string }>;
            };
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KpiCard label="Total Customers"  value={d.kpis.total?.value ?? 0}        change={0}                                    icon={Users}       color="#3B82F6" />
                  <KpiCard label="Submitted"        value={d.kpis.submitted?.value ?? 0}    change={d.kpis.submitted?.change ?? 0}        icon={FileText}    color="#C9A84C" />
                  <KpiCard label="Approved"         value={d.kpis.approved?.value ?? 0}     change={d.kpis.approved?.change ?? 0}         icon={CheckCircle2} color="#10B981" />
                  <KpiCard label="Rejected"         value={d.kpis.rejected?.value ?? 0}     change={0}                                    icon={XCircle}     color="#EF4444" />
                  <KpiCard label="Expiring Soon"    value={d.kpis.expiringSoon?.value ?? 0} change={0}                                    icon={Clock}       color="#F59E0B" />
                  <KpiCard label="Approval Rate"    value={d.kpis.approvalRate?.value ?? 0} change={0}                                    icon={BarChart}    color="#10B981" suffix="%" />
                </div>

                <div className="grid lg:grid-cols-2 gap-5">
                  <SectionCard title="Daily KYC Submissions">
                    <DailyChart data={d.daily} field="count" color="#8B5CF6" height={120} />
                  </SectionCard>
                  <SectionCard title="KYC Status Breakdown">
                    <BreakdownBars data={d.byStatus} colorMap={{ approved: '#10B981', submitted: '#3B82F6', rejected: '#EF4444', not_submitted: '#6B7280', expired: '#F59E0B' }} />
                    {d.expired > 0 && (
                      <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-amber-400/8 border border-amber-400/15 text-amber-300 text-xs">
                        <Clock size={12} /> {d.expired} KYC document{d.expired !== 1 ? 's' : ''} expired
                      </div>
                    )}
                  </SectionCard>
                </div>

                {Object.keys(d.rejectionReasons).length > 0 && (
                  <SectionCard title="Rejection Reasons">
                    <BreakdownBars data={d.rejectionReasons} colorMap={{}} />
                  </SectionCard>
                )}

                {d.queue.length > 0 && (
                  <SectionCard title="KYC Queue" subtitle="Pending review">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-white/5">
                          {['Name','Email','Tier','Submitted'].map(h => (
                            <th key={h} className="text-left text-white/25 font-medium pb-2 pr-4">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody className="divide-y divide-white/[0.03]">
                          {d.queue.map(u => (
                            <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-2.5 pr-4 text-white/70 font-medium">{u.name}</td>
                              <td className="py-2.5 pr-4 text-white/40">{u.email}</td>
                              <td className="py-2.5 pr-4 text-white/40 capitalize">{u.tier ?? 'standard'}</td>
                              <td className="py-2.5 text-white/25">{u.kycSubmittedAt ? new Date(u.kycSubmittedAt).toLocaleDateString('en-GB') : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>
                )}
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* AML                                                            */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {!loading && data && tab === 'aml' && (() => {
            const d = data as {
              kpis: Record<string, Kpi>;
              byType: Record<string, number>;
              byCurrency: Record<string, number>;
              daily: Array<{ date: string; count: number }>;
              topFlaggedUsers: Array<{ id: string; name: string; email: string; count: number; volumeUsd: number }>;
              recentFlagged: Array<{ id: string; type: string; status: string; userName: string; amount: number; currency: string; reference: string; createdAt: string }>;
            };
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <KpiCard label="Flagged Transactions" value={d.kpis.flaggedTxs?.value ?? 0}  change={d.kpis.flaggedTxs?.change ?? 0}  icon={AlertTriangle} color="#F59E0B" />
                  <KpiCard label="High-Value (>$10k)"   value={d.kpis.highValue?.value ?? 0}   change={0}                               icon={DollarSign}    color="#EF4444" />
                  <KpiCard label="Frozen Accounts"      value={d.kpis.frozenUsers?.value ?? 0} change={0}                               icon={UserX}         color="#8B5CF6" />
                  <KpiCard label="Suspended Accounts"   value={d.kpis.suspended?.value ?? 0}   change={0}                               icon={UserX}         color="#F97316" />
                  <KpiCard label="Total Flagged (All)"  value={d.kpis.totalFlagged?.value ?? 0} change={0}                              icon={ShieldAlert}   color="#EF4444" />
                </div>

                <SectionCard title="Daily Flagged Transactions">
                  <DailyChart data={d.daily} field="count" color="#F59E0B" height={120} />
                </SectionCard>

                <div className="grid lg:grid-cols-2 gap-5">
                  <SectionCard title="Flagged by Transaction Type">
                    <BreakdownBars data={d.byType} colorMap={TX_TYPE_COLORS} />
                  </SectionCard>
                  <SectionCard title="Flagged by Currency">
                    <BreakdownBars data={d.byCurrency} />
                  </SectionCard>
                </div>

                {d.topFlaggedUsers.length > 0 && (
                  <SectionCard title="Top Flagged Users">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-white/5">
                          {['User','Email','Flagged Txs','Volume (USD)'].map(h => (
                            <th key={h} className="text-left text-white/25 font-medium pb-2 pr-4">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody className="divide-y divide-white/[0.03]">
                          {d.topFlaggedUsers.map(u => (
                            <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-2.5 pr-4 text-white/70 font-medium">{u.name}</td>
                              <td className="py-2.5 pr-4 text-white/40">{u.email}</td>
                              <td className="py-2.5 pr-4 text-amber-400 font-bold">{u.count}</td>
                              <td className="py-2.5 text-white/60">{fmtUsd(u.volumeUsd)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>
                )}

                {d.recentFlagged.length > 0 && (
                  <SectionCard title="Recent Flagged Transactions">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-white/5">
                          {['ID','Type','User','Amount','Status','Date'].map(h => (
                            <th key={h} className="text-left text-white/25 font-medium pb-2 pr-4">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody className="divide-y divide-white/[0.03]">
                          {d.recentFlagged.map(t => (
                            <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-2.5 pr-4 text-white/30 font-mono">{t.id.slice(-8)}</td>
                              <td className="py-2.5 pr-4 text-white/60 capitalize">{t.type.replace(/_/g,' ')}</td>
                              <td className="py-2.5 pr-4 text-white/60">{t.userName}</td>
                              <td className="py-2.5 pr-4 text-white/70 font-semibold">{t.amount.toLocaleString()} {t.currency}</td>
                              <td className="py-2.5 pr-4"><StatusBadge status={t.status} /></td>
                              <td className="py-2.5 text-white/25">{new Date(t.createdAt).toLocaleDateString('en-GB')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>
                )}
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* SUPPORT                                                        */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {!loading && data && tab === 'support' && (() => {
            const d = data as {
              kpis: Record<string, Kpi>;
              byStatus: Record<string, number>;
              byPriority: Record<string, number>;
              byChannel: Record<string, number>;
              daily: Array<{ date: string; count: number }>;
              totalAll: number;
            };
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <KpiCard label="Period Tickets"    value={d.kpis.total?.value ?? 0}            change={d.kpis.total?.change ?? 0}            icon={Activity}     color="#06B6D4" />
                  <KpiCard label="Open"              value={d.kpis.open?.value ?? 0}             change={0}                                    icon={AlertTriangle} color="#F59E0B" />
                  <KpiCard label="Resolved"          value={d.kpis.resolved?.value ?? 0}         change={0}                                    icon={CheckCircle2} color="#10B981" />
                  <KpiCard label="Pending"           value={d.kpis.pending?.value ?? 0}          change={0}                                    icon={Clock}        color="#3B82F6" />
                  <KpiCard label="Avg Resolution"    value={d.kpis.avgResolutionHrs?.value ?? 0} change={0}                                    icon={Clock}        color="#8B5CF6" suffix="h" />
                </div>

                <SectionCard title="Daily Ticket Volume">
                  <DailyChart data={d.daily} field="count" color="#06B6D4" height={120} />
                </SectionCard>

                <div className="grid lg:grid-cols-3 gap-5">
                  <SectionCard title="By Status">
                    <BreakdownBars data={d.byStatus} colorMap={STATUS_COLORS} />
                  </SectionCard>
                  <SectionCard title="By Priority">
                    <BreakdownBars data={d.byPriority} colorMap={{ critical: '#EF4444', high: '#F97316', normal: '#3B82F6', low: '#6B7280' }} />
                  </SectionCard>
                  <SectionCard title="By Channel">
                    <BreakdownBars data={d.byChannel} />
                  </SectionCard>
                </div>
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* EMAILS                                                         */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {!loading && data && tab === 'emails' && (() => {
            const d = data as {
              kpis: Record<string, Kpi>;
              byTemplate: Record<string, { count: number; sent: number; failed: number }>;
              byProvider: Record<string, number>;
              daily: Array<{ date: string; total: number; sent: number; failed: number }>;
              recentFailed: Array<{ id: string; ts: string; to: string; subject: string; template: string; error?: string }>;
            };
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KpiCard label="Total Sent"      value={d.kpis.total?.value ?? 0}        change={d.kpis.total?.change ?? 0}        icon={Mail}         color="#EC4899" />
                  <KpiCard label="Delivered"       value={d.kpis.sent?.value ?? 0}         change={0}                                icon={CheckCircle2} color="#10B981" />
                  <KpiCard label="Failed"          value={d.kpis.failed?.value ?? 0}       change={0}                                icon={XCircle}      color="#EF4444" />
                  <KpiCard label="Bounced"         value={d.kpis.bounced?.value ?? 0}      change={0}                                icon={AlertTriangle} color="#F97316" />
                  <KpiCard label="Queued"          value={d.kpis.queued?.value ?? 0}       change={0}                                icon={Clock}        color="#3B82F6" />
                  <KpiCard label="Delivery Rate"   value={d.kpis.deliveryRate?.value ?? 0} change={0}                                icon={BarChart}     color="#10B981" suffix="%" />
                </div>

                <div className="grid lg:grid-cols-2 gap-5">
                  <SectionCard title="Daily Email Volume">
                    <DailyChart data={d.daily} field="sent" color="#10B981" height={120} />
                  </SectionCard>
                  <SectionCard title="Daily Failures">
                    <DailyChart data={d.daily} field="failed" color="#EF4444" height={120} />
                  </SectionCard>
                </div>

                <div className="grid lg:grid-cols-2 gap-5">
                  <SectionCard title="By Template">
                    <BreakdownBars data={Object.fromEntries(Object.entries(d.byTemplate).map(([k, v]) => [k, v.count]))} />
                  </SectionCard>
                  <SectionCard title="By Provider">
                    <BreakdownBars data={d.byProvider} />
                  </SectionCard>
                </div>

                {d.recentFailed.length > 0 && (
                  <SectionCard title="Recent Failures">
                    <div className="space-y-2">
                      {d.recentFailed.map(e => (
                        <div key={e.id} className="flex items-start gap-3 p-3 rounded-xl bg-red-400/[0.04] border border-red-400/10">
                          <XCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white/70 text-xs font-medium truncate">{e.to}</p>
                            <p className="text-white/40 text-xs">{e.subject}</p>
                            {e.error && <p className="text-red-400/70 text-[10px] mt-0.5 font-mono">{e.error}</p>}
                          </div>
                          <p className="text-white/20 text-[10px] shrink-0">{new Date(e.ts).toLocaleDateString('en-GB')}</p>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* SECURITY                                                       */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {!loading && data && tab === 'security' && (() => {
            const d = data as {
              kpis: Record<string, Kpi>;
              bySeverity: Record<string, number>;
              byType: Record<string, number>;
              loginByResult: Record<string, number>;
              daily: Array<{ date: string; count: number }>;
              resolved: number;
              unresolved: number;
              recentAlerts: Array<{ id: string; ts: string; type: string; severity: string; title: string; detail: string; resolved: boolean }>;
            };
            const SEV_COLORS: Record<string, string> = { critical: '#EF4444', high: '#F97316', medium: '#F59E0B', low: '#3B82F6', info: '#6B7280' };
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KpiCard label="Security Alerts"  value={d.kpis.alerts?.value ?? 0}        change={d.kpis.alerts?.change ?? 0}        icon={ShieldAlert}  color="#8B5CF6" />
                  <KpiCard label="Critical"         value={d.kpis.critical?.value ?? 0}      change={0}                                  icon={AlertTriangle} color="#EF4444" />
                  <KpiCard label="Unresolved"       value={d.kpis.unresolved?.value ?? 0}    change={0}                                  icon={XCircle}      color="#F97316" />
                  <KpiCard label="Login Attempts"   value={d.kpis.loginAttempts?.value ?? 0} change={d.kpis.loginAttempts?.change ?? 0} icon={Users}        color="#3B82F6" />
                  <KpiCard label="Failed Logins"    value={d.kpis.failedLogins?.value ?? 0}  change={0}                                  icon={UserX}        color="#EF4444" />
                  <KpiCard label="Blocked"          value={d.kpis.blocked?.value ?? 0}       change={0}                                  icon={Shield}       color="#F59E0B" />
                </div>

                <div className="grid lg:grid-cols-2 gap-5">
                  <SectionCard title="Daily Security Alerts">
                    <DailyChart data={d.daily} field="count" color="#8B5CF6" height={120} />
                  </SectionCard>
                  <SectionCard title="Alert Severity Breakdown">
                    <BreakdownBars data={d.bySeverity} colorMap={SEV_COLORS} />
                  </SectionCard>
                </div>

                <div className="grid lg:grid-cols-2 gap-5">
                  <SectionCard title="Alert Types">
                    <BreakdownBars data={d.byType} />
                  </SectionCard>
                  <SectionCard title="Login Results">
                    <BreakdownBars data={d.loginByResult} colorMap={{ success: '#10B981', failed: '#EF4444', blocked: '#F59E0B', account_locked: '#F97316', totp_failed: '#EF4444' }} />
                  </SectionCard>
                </div>

                {d.recentAlerts.length > 0 && (
                  <SectionCard title="Recent Security Alerts">
                    <div className="space-y-2">
                      {d.recentAlerts.map(a => (
                        <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                          style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: SEV_COLORS[a.severity] ?? '#6B7280' }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-white/70 text-xs font-semibold">{a.title}</p>
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{ color: SEV_COLORS[a.severity] ?? '#6B7280', background: `${SEV_COLORS[a.severity] ?? '#6B7280'}18` }}>
                                {a.severity}
                              </span>
                              {a.resolved && <span className="text-[9px] text-emerald-400/70 font-bold">Resolved</span>}
                            </div>
                            <p className="text-white/35 text-xs mt-0.5">{a.detail}</p>
                          </div>
                          <p className="text-white/20 text-[10px] shrink-0">{new Date(a.ts).toLocaleDateString('en-GB')}</p>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}
              </div>
            );
          })()}

        </div>
      </AdminLayout>
    </>
  );
}
