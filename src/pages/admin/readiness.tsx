/**
 * /admin/readiness — Deployment Readiness Report
 *
 * Shows the server-owned subsystem readiness checks.
 * Secret and environment-variable inventories intentionally remain outside
 * the browser administration panel.
 *
 * Admin auth required (AdminOnly guard in routes.tsx).
 */
import { useState, useEffect, useCallback } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { authHeaders, useAdminAuth } from '@/lib/adminAuth';
import {
  CheckCircle, XCircle, AlertTriangle, Info, RefreshCw,
  Shield, Database, Mail, MessageSquare, Lock, Globe,
  Server, Cpu, ChevronDown, ChevronRight,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckStatus  = 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
type OverallStatus = 'READY' | 'DEGRADED' | 'NOT_READY';

interface ReadinessCheck {
  id:          string;
  name:        string;
  subsystem:   string;
  status:      CheckStatus;
  message:     string;
  detail?:     string;
  critical:    boolean;
  durationMs?: number;
}

interface ReadinessReport {
  environment:   string;
  generatedAt:   string;
  overallStatus: OverallStatus;
  summary: { total: number; pass: number; warn: number; fail: number; skip: number; critical: number };
  checks: ReadinessCheck[];
}

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusIcon({ status, size = 18 }: { status: CheckStatus; size?: number }) {
  const cls = `w-${size === 18 ? 4 : 5} h-${size === 18 ? 4 : 5} shrink-0`;
  if (status === 'PASS')
    return <CheckCircle className={`${cls} text-emerald-400`} />;
  if (status === 'FAIL')
    return <XCircle className={`${cls} text-red-400`} />;
  if (status === 'WARN')
    return <AlertTriangle className={`${cls} text-amber-400`} />;
  if (status === 'SKIP')
    return <Info className={`${cls} text-blue-400`} />;
  return <Info className={`${cls} text-zinc-500`} />;
}

function statusBadge(status: CheckStatus): string {
  if (status === 'PASS')
    return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  if (status === 'FAIL')
    return 'bg-red-500/10 text-red-400 border border-red-500/20';
  if (status === 'WARN')
    return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
  if (status === 'SKIP')
    return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
  return 'bg-zinc-800 text-zinc-400 border border-zinc-700';
}

function overallBadge(status: OverallStatus) {
  if (status === 'READY')
    return { cls: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30', label: 'READY FOR DEPLOYMENT' };
  if (status === 'DEGRADED')
    return { cls: 'bg-amber-500/10 text-amber-300 border border-amber-500/30', label: 'DEGRADED — WARNINGS PRESENT' };
  return { cls: 'bg-red-500/10 text-red-300 border border-red-500/30', label: 'NOT READY — CRITICAL FAILURES' };
}

function subsystemIcon(subsystem: string) {
  const cls = 'w-4 h-4 shrink-0';
  if (subsystem.includes('Auth'))     return <Lock className={cls} />;
  if (subsystem.includes('Email'))    return <Mail className={cls} />;
  if (subsystem.includes('Chat'))     return <MessageSquare className={cls} />;
  if (subsystem.includes('Database')) return <Database className={cls} />;
  if (subsystem.includes('Security')) return <Shield className={cls} />;
  if (subsystem.includes('SEO'))      return <Globe className={cls} />;
  if (subsystem.includes('Config'))   return <Cpu className={cls} />;
  return <Server className={cls} />;
}

// ── Readiness check row ───────────────────────────────────────────────────────

function CheckRow({ check }: { check: ReadinessCheck }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors text-left"
      >
        <StatusIcon status={check.status} />
        <span className="flex items-center gap-2 text-zinc-400 text-xs w-32 shrink-0">
          {subsystemIcon(check.subsystem)}
          <span className="truncate">{check.subsystem}</span>
        </span>
        <span className="flex-1 text-sm text-zinc-200 font-medium">{check.name}</span>
        <span className={`text-xs font-mono px-2 py-0.5 rounded ${statusBadge(check.status)}`}>
          {check.status}
        </span>
        {check.critical && (
          <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
            CRITICAL
          </span>
        )}
        {check.durationMs !== undefined && (
          <span className="text-xs text-zinc-600 font-mono">{check.durationMs}ms</span>
        )}
        {check.detail
          ? open ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />
          : <span className="w-4" />
        }
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 border-t border-zinc-800 bg-zinc-900/50">
          <p className="text-sm text-zinc-300 mb-1">{check.message}</p>
          {check.detail && (
            <p className="text-xs text-zinc-500 font-mono bg-zinc-950 rounded px-3 py-2 mt-2 whitespace-pre-wrap">
              {check.detail}
            </p>
          )}
        </div>
      )}
      {!open && (
        <div className="px-4 pb-2 pt-0">
          <p className="text-xs text-zinc-500">{check.message}</p>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReadinessPage() {
  const { admin } = useAdminAuth();
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    setError(null);
    try {
      const rRes = await fetch('/api/admin/readiness', { headers: authHeaders() });
      if (!rRes.ok) throw new Error('Failed to fetch the readiness report');
      const rData = await rRes.json();
      setReadiness(rData.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [admin]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const overall = readiness ? overallBadge(readiness.overallStatus) : null;

  return (
    <>
      <Helmet>
        <title>Deployment Readiness — City Gate Capital Admin</title>
        <meta name="description" content="Production subsystem readiness report for the City Gate Capital admin panel." />
        <link rel="canonical" href="https://citygate.capital/admin/readiness" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        {/* Header */}
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Shield className="w-6 h-6 text-amber-400" />
                Deployment Readiness
              </h1>
              <p className="text-zinc-500 text-sm mt-1">
                Server-owned subsystem health checks without secret exposure
              </p>
            </div>
            <div className="flex items-center gap-2">
            <button
              onClick={fetchReports}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Running…' : 'Re-run checks'}
            </button>
            </div>
          </div>

          {/* Overall status banner */}
          {readiness && overall && (
            <div className={`rounded-xl border px-6 py-4 mb-6 flex items-center justify-between ${overall.cls}`}>
              <div className="flex items-center gap-3">
                <StatusIcon status={readiness.overallStatus === 'READY' ? 'PASS' : readiness.overallStatus === 'DEGRADED' ? 'WARN' : 'FAIL'} size={20} />
                <div>
                  <p className="font-bold text-lg">{overall.label}</p>
                  <p className="text-sm opacity-75">
                    Environment: <span className="font-mono uppercase">{readiness.environment}</span>
                    {' · '}Generated: {new Date(readiness.generatedAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 text-sm font-mono">
                <span className="text-emerald-400">{readiness.summary.pass} PASS</span>
                <span className="text-amber-400">{readiness.summary.warn} WARN</span>
                <span className="text-red-400">{readiness.summary.fail} FAIL</span>
                {readiness.summary.skip > 0 && <span className="text-zinc-500">{readiness.summary.skip} SKIP</span>}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-6 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            {loading && !readiness && (
              <div className="text-center py-12 text-zinc-500">Running subsystem checks…</div>
            )}
            {readiness?.checks.map(check => (
              <CheckRow key={check.id} check={check} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
