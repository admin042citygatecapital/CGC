import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Clock, CheckCircle, XCircle, AlertTriangle,
  TrendingUp, RefreshCw, ClipboardList, FileText,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';

/** Sparkline bar chart for a single daily series. */
function DailyBarChart({ data, field, color = '#C9A84C', height = 120 }:
  { data: Array<Record<string, unknown>>; field: string; color?: string; height?: number }) {
  const values = data.map(d => Number(d[field] ?? 0));
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {data.map((d, i) => {
        const v = Number(d[field] ?? 0);
        const pct = (v / max) * 100;
        return (
          <div key={String(d.date ?? i)} className="flex-1 group relative min-w-0">
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
              <p className="font-semibold">{String(d.date ?? '').slice(5)}</p>
              <p style={{ color }}>{v}</p>
            </div>
            <div className="w-full rounded-t-sm transition-all" style={{ height: `${Math.max(pct, 2)}%`, background: color }} />
          </div>
        );
      })}
    </div>
  );
}

/** Dual-series (approved vs rejected) daily comparison chart. */
function TrendChart({ data, height = 120 }: { data: Array<{ date: string; approved: number; rejected: number }>; height?: number }) {
  const max = Math.max(...data.map(d => Math.max(d.approved, d.rejected)), 1);
  return (
    <div>
      <div className="flex items-end gap-0.5" style={{ height }}>
        {data.map((d, i) => (
          <div key={d.date ?? i} className="flex-1 group relative min-w-0 flex items-end gap-px">
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
              <p className="font-semibold">{d.date.slice(5)}</p>
              <p className="text-green-400">Approved: {d.approved}</p>
              <p className="text-red-400">Rejected: {d.rejected}</p>
            </div>
            <div className="flex-1 rounded-t-sm" style={{ height: `${Math.max((d.approved / max) * 100, d.approved > 0 ? 2 : 0)}%`, background: '#22c55e' }} />
            <div className="flex-1 rounded-t-sm" style={{ height: `${Math.max((d.rejected / max) * 100, d.rejected > 0 ? 2 : 0)}%`, background: '#ef4444' }} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-white/50">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Approved</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Rejected</span>
      </div>
    </div>
  );
}

/** Horizontal proportion bars for the risk distribution breakdown. */
function RiskDistributionBars({ data }: { data: Array<{ name: string; value: number }> }) {
  const total = Math.max(data.reduce((s, d) => s + d.value, 0), 1);
  return (
    <div className="space-y-3">
      {data.map(d => {
        const pct = (d.value / total) * 100;
        return (
          <div key={d.name}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-white/60 text-xs">{d.name}</p>
              <p className="text-white/40 text-[11px]">{d.value} ({pct.toFixed(0)}%)</p>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: RISK_COLORS[d.name] ?? '#888' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface KYCAnalytics {
  kpis: {
    totalPending: { value: number };
    approvedThisWeek: { value: number };
    rejectedThisWeek: { value: number };
    totalExpired: { value: number };
    avgReviewTime: { value: number };
  };
  metrics: {
    approvalRate: number;
    rejectionRate: number;
    manualReviewRate: number;
    highRiskCount: number;
    expiringIn30Days: number;
  };
  dailyVolume: Array<{ date: string; count: number }>;
  trends: Array<{ date: string; approved: number; rejected: number }>;
  riskDistribution: Array<{ name: string; value: number }>;
}

const RISK_COLORS: Record<string, string> = {
  Low: '#22c55e',
  Medium: '#eab308',
  High: '#ef4444',
};

export default function AdminKYCDashboard() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<KYCAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/kyc/analytics', {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch KYC analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    const id = setInterval(fetchAnalytics, 60000);
    return () => clearInterval(id);
  }, [fetchAnalytics]);

  const kpiCards = [
    {
      label: 'Total Pending',
      value: analytics?.kpis.totalPending.value ?? '—',
      icon: Clock,
      color: '#F59E0B',
      sub: 'awaiting review',
    },
    {
      label: 'Approved This Week',
      value: analytics?.kpis.approvedThisWeek.value ?? '—',
      icon: CheckCircle,
      color: '#22C55E',
      sub: 'this week',
    },
    {
      label: 'Rejected This Week',
      value: analytics?.kpis.rejectedThisWeek.value ?? '—',
      icon: XCircle,
      color: '#EF4444',
      sub: 'this week',
    },
    {
      label: 'Expired Profiles',
      value: analytics?.kpis.totalExpired.value ?? '—',
      icon: AlertTriangle,
      color: '#8B5CF6',
      sub: 'need renewal',
    },
    {
      label: 'Avg Review Time',
      value: analytics ? `${analytics.kpis.avgReviewTime.value}h` : '—',
      icon: TrendingUp,
      color: '#06B6D4',
      sub: 'per submission',
    },
  ];

  const metricCards = [
    {
      label: 'Approval Rate',
      value: analytics ? `${analytics.metrics.approvalRate.toFixed(1)}%` : '—',
      color: '#22C55E',
    },
    {
      label: 'Rejection Rate',
      value: analytics ? `${analytics.metrics.rejectionRate.toFixed(1)}%` : '—',
      color: '#EF4444',
    },
    {
      label: 'Manual Review Rate',
      value: analytics ? `${analytics.metrics.manualReviewRate.toFixed(1)}%` : '—',
      color: '#F59E0B',
    },
    {
      label: 'High-Risk Applications',
      value: analytics?.metrics.highRiskCount ?? '—',
      color: '#EF4444',
    },
    {
      label: 'Expiring in 30 Days',
      value: analytics?.metrics.expiringIn30Days ?? '—',
      color: '#F59E0B',
    },
  ];

  const placeholderDist = [
    { name: 'Low', value: 1 },
    { name: 'Medium', value: 1 },
    { name: 'High', value: 1 },
  ];

  return (
    <AdminLayout title="KYC Operations">
      <Helmet>
        <title>KYC Operations — CityGate Admin</title>
      </Helmet>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-white text-xl font-bold"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            KYC Operations Dashboard
          </h1>
          <p className="text-white/50 text-sm mt-0.5">
            Last updated: {lastUpdated.toLocaleTimeString()} · Auto-refreshes every 60s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAnalytics}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => navigate('/admin/kyc-queue')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C9A84C] hover:bg-[#C9A84C]/90 text-black text-sm font-medium transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            Review Queue
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {kpiCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl bg-white/5 border border-white/10 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/50 text-xs">{card.label}</span>
              <card.icon className="w-4 h-4" style={{ color: card.color }} />
            </div>
            <div className="text-2xl font-bold text-white">
              {loading ? '...' : card.value}
            </div>
            <div className="text-white/40 text-xs mt-1">{card.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {metricCards.map((m) => (
          <div
            key={m.label}
            className="rounded-lg bg-white/5 border border-white/10 p-3 text-center"
          >
            <div className="text-xl font-semibold" style={{ color: m.color }}>
              {loading ? '...' : m.value}
            </div>
            <div className="text-white/50 text-xs mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily KYC Volume */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-5">
          <h2 className="text-white font-semibold mb-4">
            Daily KYC Volume (Last 30 Days)
          </h2>
          <DailyBarChart data={analytics?.dailyVolume ?? []} field="count" color="#C9A84C" height={220} />
        </div>

        {/* Approval vs Rejection Trends */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-5">
          <h2 className="text-white font-semibold mb-4">
            Approval vs Rejection Trends (Last 30 Days)
          </h2>
          <TrendChart data={analytics?.trends ?? []} height={200} />
        </div>

        {/* Risk Distribution */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-5">
          <h2 className="text-white font-semibold mb-4">Risk Distribution</h2>
          <RiskDistributionBars data={analytics?.riskDistribution ?? placeholderDist} />
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-5">
          <h2 className="text-white font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/admin/kyc-queue')}
              className="w-full flex items-center gap-3 p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm transition-colors text-left"
            >
              <ClipboardList className="w-5 h-5 text-[#C9A84C]" />
              <div>
                <div className="font-medium">Review Queue</div>
                <div className="text-white/50 text-xs">
                  Process pending KYC submissions
                </div>
              </div>
            </button>
            <button
              onClick={() => navigate('/admin/kyc-queue?status=flagged')}
              className="w-full flex items-center gap-3 p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm transition-colors text-left"
            >
              <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
              <div>
                <div className="font-medium">Flagged for Manual Review</div>
                <div className="text-white/50 text-xs">
                  High-priority cases requiring attention
                </div>
              </div>
            </button>
            <button
              onClick={() => navigate('/admin/kyc-queue?status=expiring')}
              className="w-full flex items-center gap-3 p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm transition-colors text-left"
            >
              <FileText className="w-5 h-5 text-[#F59E0B]" />
              <div>
                <div className="font-medium">Expiring Profiles</div>
                <div className="text-white/50 text-xs">
                  KYC profiles expiring in 30 days
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
