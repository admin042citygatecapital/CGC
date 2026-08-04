import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  BarChart2,
  TrendingUp,
  Users,
  Eye,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  RefreshCw,
  Clock,
  ArrowUpRight,
  MousePointer,
  Target,
  Percent,
  CreditCard,
  Send,
  UserPlus,
  CheckCircle,
  FlaskConical,
  Trophy,
  TrendingDown,
} from 'lucide-react';
import { useAdminAuth } from '@/lib/adminAuth';

// ── Types ────────────────────────────────────────────────────────────────────

interface DailyPoint { date: string; count: number }
interface LabelCount  { label: string; count: number }
interface HourPoint   { hour: number; count: number }

interface FunnelStep { step: string; type: string; count: number }
interface PlanBreakdown { plan: string; count: number }

interface ConversionSummary {
  period: { days: number; since: string };
  totals: { pageviews: number; conversions: number; conversionRate: string };
  byType: Record<string, number>;
  funnel: FunnelStep[];
  dailyTrend: Array<Record<string, number | string>>;
  planBreakdown: PlanBreakdown[];
}

interface VariantStats {
  variant: string;
  impressions: number;
  conversions: number;
  conversionRate: number;
  liftVsControl: number | null;
  confidence: 'low' | 'medium' | 'high';
}

interface ExperimentResult {
  experimentId: string;
  totalImpressions: number;
  totalConversions: number;
  variants: VariantStats[];
  winner: string | null;
}

interface ABResults {
  period: { days: number; since: string };
  experiments: ExperimentResult[];
}

interface Summary {
  period: { days: number; since: string };
  totals: { pageviews: number; events: number; uniqueSessions: number };
  dailyTrend: DailyPoint[];
  topPages: LabelCount[];
  referrers: LabelCount[];
  devices: LabelCount[];
  hourlyDistribution: HourPoint[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function pct(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function hourLabel(h: number): string {
  if (h === 0)  return '12am';
  if (h < 12)   return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' as const }}
      className="relative rounded-2xl border border-primary/10 bg-white/[0.03] p-6 overflow-hidden"
    >
      <div className="absolute inset-0 rounded-2xl" style={{ background: `radial-gradient(ellipse at top left, ${color}08 0%, transparent 60%)` }} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs text-foreground/40 uppercase tracking-widest font-medium mb-2">{label}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {sub && <p className="text-xs text-foreground/40 mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
    </motion.div>
  );
}

function MiniBar({ data, maxVal, color }: { data: { label: string; count: number }[]; maxVal: number; color: string }) {
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-foreground/50 w-28 shrink-0 truncate">{item.label}</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct(item.count, maxVal)}%` }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' as const }}
              className="h-full rounded-full"
              style={{ background: color }}
            />
          </div>
          <span className="text-xs text-foreground/60 w-10 text-right shrink-0">{fmt(item.count)}</span>
        </div>
      ))}
    </div>
  );
}

function SparkLine({ data, color }: { data: DailyPoint[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const W = 600;
  const H = 120;
  const pad = 8;
  const pts = data.map((d, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * (W - pad * 2);
    const y = H - pad - ((d.count / max) * (H - pad * 2));
    return `${x},${y}`;
  });
  const area = `M${pts[0]} L${pts.join(' L')} L${W - pad},${H} L${pad},${H} Z`;
  const line = `M${pts[0]} L${pts.join(' L')}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkGrad)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HourHeatmap({ data }: { data: HourPoint[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="grid grid-cols-12 gap-1">
      {data.map(({ hour, count }) => {
        const intensity = count / max;
        return (
          <div key={hour} className="group relative">
            <div
              className="h-8 rounded-md transition-all duration-200 cursor-default"
              style={{ background: `rgba(201,168,76,${0.05 + intensity * 0.7})`, border: `1px solid rgba(201,168,76,${0.1 + intensity * 0.3})` }}
            />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-black/80 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
              {hourLabel(hour)}: {count} views
            </div>
          </div>
        );
      })}
      <div className="col-span-12 flex justify-between mt-1">
        {[0, 6, 12, 18, 23].map(h => (
          <span key={h} className="text-[10px] text-foreground/30">{hourLabel(h)}</span>
        ))}
      </div>
    </div>
  );
}

function DeviceIcon({ device }: { device: string }) {
  if (device === 'mobile')  return <Smartphone size={14} className="text-primary" />;
  if (device === 'tablet')  return <Tablet size={14} className="text-blue-400" />;
  return <Monitor size={14} className="text-emerald-400" />;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PERIODS = [7, 14, 30, 90] as const;
type Period = typeof PERIODS[number];

export default function AnalyticsPage() {
  const { token, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [conversions, setConversions] = useState<ConversionSummary | null>(null);
  const [abResults, setABResults] = useState<ABResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [period, setPeriod]   = useState<Period>(30);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    if (!authLoading && !token) navigate('/admin/login', { replace: true });
  }, [authLoading, token, navigate]);

  const authHeaders = useCallback(() => ({
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const load = useCallback(async (days: Period) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, convRes, abRes] = await Promise.all([
        fetch(`/api/analytics/summary?days=${days}`,     { headers: authHeaders() }),
        fetch(`/api/analytics/conversions?days=${days}`, { headers: authHeaders() }),
        fetch(`/api/analytics/ab-results?days=${days}`,  { headers: authHeaders() }),
      ]);
      if (!summaryRes.ok) throw new Error(`HTTP ${summaryRes.status}`);
      const data = await summaryRes.json() as Summary;
      setSummary(data);
      if (convRes.ok) {
        const convData = await convRes.json() as ConversionSummary;
        setConversions(convData);
      }
      if (abRes.ok) {
        const abData = await abRes.json() as ABResults;
        setABResults(abData);
      }
      setLastRefresh(new Date());
    } catch (e) {
      setError('Could not load analytics data.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, authHeaders]);

  useEffect(() => { void load(period); }, [period, load]);

  const totalPV = summary?.totals.pageviews ?? 0;

  return (
    <>
      <Helmet>
        <title>Analytics Dashboard — City Gate Capital</title>
        <meta name="description" content="Internal analytics dashboard for City Gate Capital." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <main className="min-h-screen bg-background px-4 py-12 md:px-8">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 size={20} className="text-primary" />
                <span className="text-xs text-primary uppercase tracking-widest font-semibold">Analytics</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground">User Behaviour</h1>
              <p className="text-sm text-foreground/40 mt-1">
                Last refreshed {lastRefresh.toLocaleTimeString()}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Period selector */}
              <div className="flex items-center gap-1 rounded-xl border border-primary/10 bg-white/[0.03] p-1">
                {PERIODS.map(d => (
                  <button
                    key={d}
                    onClick={() => setPeriod(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      period === d
                        ? 'bg-primary text-black'
                        : 'text-foreground/50 hover:text-foreground'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
              <button
                onClick={() => void load(period)}
                disabled={loading}
                className="w-9 h-9 rounded-xl border border-primary/10 bg-white/[0.03] flex items-center justify-center text-foreground/50 hover:text-primary transition-colors disabled:opacity-40"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </motion.div>

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 mb-8 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <KpiCard icon={Eye}         label="Page Views"       value={fmt(totalPV)}                                color="#C9A84C" delay={0}    sub={`Last ${period} days`} />
            <KpiCard icon={Users}       label="Unique Sessions"  value={fmt(summary?.totals.uniqueSessions ?? 0)}   color="#627EEA" delay={0.05} sub="Browser sessions" />
            <KpiCard icon={MousePointer} label="Total Events"    value={fmt(summary?.totals.events ?? 0)}           color="#10B981" delay={0.1}  sub="All event types" />
          </div>

          {/* Trend Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="rounded-2xl border border-primary/10 bg-white/[0.03] p-6 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-primary" />
                <span className="text-sm font-semibold text-foreground">Daily Page Views</span>
              </div>
              <span className="text-xs text-foreground/30">{period}-day trend</span>
            </div>

            {summary && (
              <>
                <SparkLine data={summary.dailyTrend} color="#C9A84C" />
                {/* X-axis labels */}
                <div className="flex justify-between mt-2">
                  {summary.dailyTrend
                    .filter((_, i) => i % Math.ceil(summary.dailyTrend.length / 6) === 0)
                    .map((d, i) => (
                      <span key={i} className="text-[10px] text-foreground/30">{shortDate(d.date)}</span>
                    ))}
                </div>
              </>
            )}
            {loading && <div className="h-28 flex items-center justify-center text-foreground/20 text-sm">Loading…</div>}
          </motion.div>

          {/* Middle row: Top Pages + Referrers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            {/* Top Pages */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="rounded-2xl border border-primary/10 bg-white/[0.03] p-6"
            >
              <div className="flex items-center gap-2 mb-5">
                <ArrowUpRight size={16} className="text-primary" />
                <span className="text-sm font-semibold text-foreground">Top Pages</span>
              </div>
              {summary?.topPages.length ? (
                <MiniBar data={summary.topPages} maxVal={summary.topPages[0]?.count ?? 1} color="#C9A84C" />
              ) : (
                <p className="text-sm text-foreground/30 text-center py-6">No data yet</p>
              )}
            </motion.div>

            {/* Referrers */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="rounded-2xl border border-primary/10 bg-white/[0.03] p-6"
            >
              <div className="flex items-center gap-2 mb-5">
                <Globe size={16} className="text-blue-400" />
                <span className="text-sm font-semibold text-foreground">Traffic Sources</span>
              </div>
              {summary?.referrers.length ? (
                <MiniBar data={summary.referrers} maxVal={summary.referrers[0]?.count ?? 1} color="#627EEA" />
              ) : (
                <p className="text-sm text-foreground/30 text-center py-6">No referrer data yet</p>
              )}
            </motion.div>
          </div>

          {/* Bottom row: Devices + Hourly Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Devices */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="rounded-2xl border border-primary/10 bg-white/[0.03] p-6"
            >
              <div className="flex items-center gap-2 mb-5">
                <Monitor size={16} className="text-emerald-400" />
                <span className="text-sm font-semibold text-foreground">Devices</span>
              </div>
              {summary?.devices.length ? (
                <div className="space-y-4">
                  {summary.devices.map((d, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DeviceIcon device={d.label} />
                        <span className="text-sm text-foreground/70 capitalize">{d.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${pct(d.count, totalPV)}%` }}
                          />
                        </div>
                        <span className="text-xs text-foreground/50 w-8 text-right">{pct(d.count, totalPV)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground/30 text-center py-6">No data yet</p>
              )}
            </motion.div>

            {/* Hourly Heatmap */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="rounded-2xl border border-primary/10 bg-white/[0.03] p-6 lg:col-span-2"
            >
              <div className="flex items-center gap-2 mb-5">
                <Clock size={16} className="text-purple-400" />
                <span className="text-sm font-semibold text-foreground">Traffic by Hour</span>
                <span className="text-xs text-foreground/30 ml-auto">Hover for details</span>
              </div>
              {summary?.hourlyDistribution.length ? (
                <HourHeatmap data={summary.hourlyDistribution} />
              ) : (
                <p className="text-sm text-foreground/30 text-center py-6">No data yet</p>
              )}
            </motion.div>
          </div>

          {/* ── Conversions Section ─────────────────────────────────────── */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-5">
              <Target size={16} className="text-primary" />
              <h2 className="text-base font-semibold text-foreground">Conversion Tracking</h2>
              <span className="text-xs text-foreground/30 ml-auto">Key user actions</span>
            </div>

            {/* Conversion KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <KpiCard icon={Percent}  label="Conversion Rate"   value={conversions?.totals.conversionRate ?? '—'} color="#C9A84C" delay={0.4}  sub="Signups / page views" />
              <KpiCard icon={UserPlus} label="Signups Started"   value={fmt(conversions?.byType['signup_started'] ?? 0)}   color="#627EEA" delay={0.45} sub="Open Account clicks" />
              <KpiCard icon={Send}     label="Transfers Initiated" value={fmt(conversions?.byType['transfer_initiated'] ?? 0)} color="#10B981" delay={0.5}  sub="Send Now clicks" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Conversion Funnel */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.45 }}
                className="rounded-2xl border border-primary/10 bg-white/[0.03] p-6"
              >
                <div className="flex items-center gap-2 mb-5">
                  <Target size={16} className="text-primary" />
                  <span className="text-sm font-semibold text-foreground">Conversion Funnel</span>
                </div>
                {conversions?.funnel.length ? (
                  <div className="space-y-3">
                    {conversions.funnel.map((step, i) => {
                      const topCount = conversions.funnel[0]?.count ?? 1;
                      const widthPct = topCount > 0 ? Math.round((step.count / topCount) * 100) : 0;
                      const dropPct = i > 0
                        ? Math.round(((conversions.funnel[i - 1].count - step.count) / Math.max(conversions.funnel[i - 1].count, 1)) * 100)
                        : null;
                      return (
                        <div key={step.type}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-foreground/60">{step.step}</span>
                            <div className="flex items-center gap-2">
                              {dropPct !== null && dropPct > 0 && (
                                <span className="text-[10px] text-red-400/70">-{dropPct}%</span>
                              )}
                              <span className="text-xs font-semibold text-foreground">{fmt(step.count)}</span>
                            </div>
                          </div>
                          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${widthPct}%` }}
                              transition={{ duration: 0.6, delay: 0.5 + i * 0.05, ease: 'easeOut' as const }}
                              className="h-full rounded-full"
                              style={{ background: `linear-gradient(90deg, #C9A84C, #F0D080)`, opacity: 1 - i * 0.12 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-foreground/30 text-center py-6">No conversion data yet — start clicking CTAs to populate this funnel.</p>
                )}
              </motion.div>

              {/* Plan Breakdown + Account Opens */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
                className="rounded-2xl border border-primary/10 bg-white/[0.03] p-6"
              >
                <div className="flex items-center gap-2 mb-5">
                  <CreditCard size={16} className="text-emerald-400" />
                  <span className="text-sm font-semibold text-foreground">Account Opens by Plan</span>
                </div>

                {/* Plan breakdown */}
                {conversions?.planBreakdown.length ? (
                  <MiniBar
                    data={conversions.planBreakdown.map(p => ({ label: p.plan.charAt(0).toUpperCase() + p.plan.slice(1), count: p.count }))}
                    maxVal={Math.max(...conversions.planBreakdown.map(p => p.count), 1)}
                    color="#10B981"
                  />
                ) : (
                  <p className="text-sm text-foreground/30 text-center py-4">No plan selections yet</p>
                )}

                {/* Signup completed vs started */}
                <div className="mt-6 pt-5 border-t border-primary/10 space-y-3">
                  <p className="text-xs text-foreground/40 uppercase tracking-widest font-medium mb-3">Signup Funnel</p>
                  {[
                    { label: 'Signup Started',   key: 'signup_started',   icon: UserPlus,    color: '#627EEA' },
                    { label: 'Signup Completed',  key: 'signup_completed', icon: CheckCircle, color: '#10B981' },
                    { label: 'Account Opened',    key: 'account_open',     icon: CreditCard,  color: '#C9A84C' },
                  ].map(({ label, key, icon: Icon, color }) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon size={13} style={{ color }} />
                        <span className="text-xs text-foreground/60">{label}</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{fmt(conversions?.byType[key] ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>

          {/* ── A/B Testing Results ─────────────────────────────────────── */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-5">
              <FlaskConical size={16} className="text-purple-400" />
              <h2 className="text-base font-semibold text-foreground">A/B Test Results</h2>
              <span className="text-xs text-foreground/30 ml-auto">Variant performance</span>
            </div>

            {abResults?.experiments.length ? (
              <div className="space-y-4">
                {abResults.experiments.map((exp, ei) => (
                  <motion.div
                    key={exp.experimentId}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.55 + ei * 0.08, ease: 'easeOut' as const }}
                    className="rounded-2xl border border-primary/10 bg-white/[0.03] p-6"
                  >
                    {/* Experiment header */}
                    <div className="flex items-start justify-between mb-5 gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <FlaskConical size={13} className="text-purple-400" />
                          <span className="text-xs text-purple-400 font-mono">{exp.experimentId}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-foreground/40">
                          <span>{fmt(exp.totalImpressions)} impressions</span>
                          <span>·</span>
                          <span>{fmt(exp.totalConversions)} conversions</span>
                        </div>
                      </div>
                      {exp.winner && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                          <Trophy size={12} className="text-primary" />
                          <span className="text-xs font-semibold text-primary capitalize">{exp.winner} winning</span>
                        </div>
                      )}
                    </div>

                    {/* Variant rows */}
                    <div className="space-y-3">
                      {exp.variants.map((v, vi) => {
                        const isWinner = v.variant === exp.winner;
                        const maxRate = Math.max(...exp.variants.map(x => x.conversionRate), 0.01);
                        return (
                          <div key={v.variant} className={`rounded-xl p-4 border transition-all ${isWinner ? 'border-primary/30 bg-primary/5' : 'border-white/5 bg-white/[0.02]'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold capitalize ${isWinner ? 'text-primary' : 'text-foreground/70'}`}>
                                  {v.variant}
                                </span>
                                {v.variant === 'control' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-foreground/40">baseline</span>
                                )}
                                {isWinner && v.variant !== 'control' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">winner</span>
                                )}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  v.confidence === 'high' ? 'bg-emerald-500/15 text-emerald-400' :
                                  v.confidence === 'medium' ? 'bg-yellow-500/15 text-yellow-400' :
                                  'bg-white/10 text-foreground/30'
                                }`}>
                                  {v.confidence} confidence
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-foreground/40">{fmt(v.impressions)} shown</span>
                                <span className={`font-bold ${isWinner ? 'text-primary' : 'text-foreground'}`}>
                                  {v.conversionRate}%
                                </span>
                                {v.liftVsControl !== null && (
                                  <span className={`flex items-center gap-0.5 font-semibold ${v.liftVsControl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {v.liftVsControl >= 0
                                      ? <TrendingUp size={11} />
                                      : <TrendingDown size={11} />
                                    }
                                    {v.liftVsControl >= 0 ? '+' : ''}{v.liftVsControl}pp
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Conversion rate bar */}
                            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(v.conversionRate / maxRate) * 100}%` }}
                                transition={{ duration: 0.6, delay: 0.6 + vi * 0.05, ease: 'easeOut' as const }}
                                className="h-full rounded-full"
                                style={{ background: isWinner ? 'linear-gradient(90deg,#C9A84C,#F0D080)' : 'rgba(255,255,255,0.2)' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-primary/10 bg-white/[0.03] p-10 text-center">
                <FlaskConical size={28} className="text-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-foreground/40 mb-1">No A/B test data yet</p>
                <p className="text-xs text-foreground/25">Impressions will appear here once visitors land on the homepage or accounts page.</p>
              </div>
            )}
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-foreground/20 mt-10">
            Privacy-first analytics — no cookies, no PII. Session IDs are random tokens scoped to the browser tab.
          </p>
        </div>
      </main>
    </>
  );
}
