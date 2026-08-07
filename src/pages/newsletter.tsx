import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Mail, Users, TrendingUp, Send, RefreshCw, Play,
  CheckCircle, Clock, XCircle, ChevronRight, Loader2,
  BarChart2, Globe, UserMinus,
} from 'lucide-react';
import { NURTURE_SEQUENCE } from '../server/lib/nurtureSequence';
import { authHeaders, useAdminAuth } from '@/lib/adminAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Subscriber {
  id: string;
  email: string;
  name?: string;
  source: string;
  status: 'active' | 'unsubscribed';
  subscribedAt: string;
  sequenceStep: number;
  lastEmailAt?: string;
  tags: string[];
}

interface Stats {
  total: number;
  active: number;
  unsubscribed: number;
  bySource: Record<string, number>;
  byStep: Record<number, number>;
}

interface SubscribersResponse {
  subscribers: Subscriber[];
  pagination: { page: number; limit: number; total: number; pages: number };
  stats: Stats;
}

interface SendResult {
  email: string;
  step: number;
  subject: string;
  status: 'sent' | 'skipped' | 'completed';
}

interface SequenceRunResult {
  ok: boolean;
  processed: number;
  sent: number;
  skipped: number;
  completed: number;
  results: SendResult[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString(); }

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const SOURCE_LABELS: Record<string, string> = {
  footer: 'Footer',
  homepage_hero: 'Homepage Hero',
  accounts_page: 'Accounts Page',
  contact_page: 'Contact Page',
  unknown: 'Unknown',
};

const STATUS_COLORS: Record<string, string> = {
  sent: 'text-emerald-400',
  skipped: 'text-foreground/40',
  completed: 'text-primary',
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' as const }}
      className="rounded-2xl border border-primary/10 bg-white/[0.03] p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-xs text-foreground/40 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground mb-0.5">{value}</p>
      {sub && <p className="text-xs text-foreground/30">{sub}</p>}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NewsletterPage() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [data, setData]           = useState<SubscribersResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [running, setRunning]     = useState(false);
  const [runResult, setRunResult] = useState<SequenceRunResult | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'unsubscribed'>('active');
  const [page, setPage]           = useState(1);

  useEffect(() => {
    if (!authLoading && !admin) navigate('/admin/login', { replace: true });
  }, [authLoading, admin, navigate]);

  const load = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/newsletter/subscribers?status=${statusFilter === 'all' ? '' : statusFilter}&page=${page}&limit=50`, {
        headers: authHeaders(),
      });
      if (res.ok) setData(await res.json() as SubscribersResponse);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, admin]);

  useEffect(() => { void load(); }, [load]);

  async function runSequence() {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/newsletter/send-sequence', {
        method: 'POST',
        headers: authHeaders(),
      });
      if (res.ok) setRunResult(await res.json() as SequenceRunResult);
    } finally {
      setRunning(false);
      void load();
    }
  }

  const stats = data?.stats;

  return (
    <>
      <Helmet>
        <title>Newsletter Admin — City Gate Capital</title>
        <meta name="description" content="Manage newsletter subscribers, run email sequences, and track campaign performance for City Gate Capital." />
        <meta name="robots" content="noindex,nofollow" />
        <link rel="canonical" href="https://citygate.capital/newsletter" />
      </Helmet>

      <main className="min-h-screen bg-background pt-24 pb-16">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">

          {/* Header */}
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Mail size={18} className="text-primary" />
                <h1 className="text-xl font-bold text-foreground">Newsletter & Lead Nurturing</h1>
              </div>
              <p className="text-sm text-foreground/40">Subscriber management and 5-step nurture sequence</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void load()}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg glass border border-primary/15 text-xs text-foreground/60 hover:text-foreground transition-colors"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                onClick={() => void runSequence()}
                disabled={running}
                className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-black overflow-hidden disabled:opacity-60"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                <span className="relative flex items-center gap-1.5">
                  {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                  Run Sequence Now
                </span>
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KpiCard icon={Users}     label="Total Subscribers" value={fmt(stats?.total ?? 0)}        color="#C9A84C" />
            <KpiCard icon={CheckCircle} label="Active"          value={fmt(stats?.active ?? 0)}       color="#10B981" sub="Receiving emails" />
            <KpiCard icon={UserMinus} label="Unsubscribed"      value={fmt(stats?.unsubscribed ?? 0)} color="#ef4444" />
            <KpiCard icon={TrendingUp} label="Sequence Rate"    value={stats && stats.active > 0 ? `${Math.round(((stats.active - (stats.byStep[0] ?? 0)) / stats.active) * 100)}%` : '—'} color="#627EEA" sub="In active sequence" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

            {/* Sequence overview */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="rounded-2xl border border-primary/10 bg-white/[0.03] p-6"
            >
              <div className="flex items-center gap-2 mb-5">
                <Send size={14} className="text-primary" />
                <span className="text-sm font-semibold text-foreground">5-Email Nurture Sequence</span>
              </div>
              <div className="space-y-3">
                {NURTURE_SEQUENCE.map((email, i) => {
                  const inStep = stats?.byStep[i] ?? 0;
                  return (
                    <div key={email.step} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-primary">{email.step}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground/80 truncate">{email.subject.slice(0, 48)}…</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock size={9} className="text-foreground/30" />
                          <span className="text-[10px] text-foreground/30">
                            {email.delayHours === 0 ? 'Immediately' : `+${email.delayHours}h`}
                          </span>
                          {inStep > 0 && (
                            <span className="text-[10px] text-primary font-medium">{inStep} waiting</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Source breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="rounded-2xl border border-primary/10 bg-white/[0.03] p-6"
            >
              <div className="flex items-center gap-2 mb-5">
                <Globe size={14} className="text-emerald-400" />
                <span className="text-sm font-semibold text-foreground">Subscribers by Source</span>
              </div>
              {stats && Object.keys(stats.bySource).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(stats.bySource)
                    .sort(([, a], [, b]) => b - a)
                    .map(([source, count]) => {
                      const pct = stats.active > 0 ? Math.round((count / stats.active) * 100) : 0;
                      return (
                        <div key={source}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-foreground/60">{SOURCE_LABELS[source] ?? source}</span>
                            <span className="text-xs font-semibold text-foreground">{fmt(count)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut' as const }}
                              className="h-full rounded-full"
                              style={{ background: 'linear-gradient(90deg,#C9A84C,#F0D080)' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-foreground/30 text-center py-6">No subscribers yet</p>
              )}
            </motion.div>

            {/* Last sequence run result */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="rounded-2xl border border-primary/10 bg-white/[0.03] p-6"
            >
              <div className="flex items-center gap-2 mb-5">
                <BarChart2 size={14} className="text-purple-400" />
                <span className="text-sm font-semibold text-foreground">Last Sequence Run</span>
              </div>
              {runResult ? (
                <div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: 'Sent',      value: runResult.sent,      color: '#10B981' },
                      { label: 'Skipped',   value: runResult.skipped,   color: '#888' },
                      { label: 'Completed', value: runResult.completed, color: '#C9A84C' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center p-2 rounded-lg bg-white/[0.03]">
                        <p className="text-lg font-bold" style={{ color }}>{value}</p>
                        <p className="text-[10px] text-foreground/40">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-hide">
                    {runResult.results.slice(0, 20).map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`shrink-0 ${STATUS_COLORS[r.status]}`}>
                          {r.status === 'sent' ? '✓' : r.status === 'completed' ? '★' : '–'}
                        </span>
                        <span className="text-foreground/50 truncate flex-1">{r.email}</span>
                        <span className="text-foreground/30 shrink-0">Step {r.step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Play size={24} className="text-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-foreground/30">Click "Run Sequence Now" to process pending emails</p>
                  <p className="text-xs text-foreground/20 mt-1">In production, schedule this via cron</p>
                </div>
              )}
            </motion.div>
          </div>

          {/* Subscriber table */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="rounded-2xl border border-primary/10 bg-white/[0.03] overflow-hidden"
          >
            {/* Table header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-primary" />
                <span className="text-sm font-semibold text-foreground">Subscribers</span>
                {data && <span className="text-xs text-foreground/30">({fmt(data.pagination.total)} total)</span>}
              </div>
              <div className="flex items-center gap-1">
                {(['all', 'active', 'unsubscribed'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => { setStatusFilter(f); setPage(1); }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                      statusFilter === f
                        ? 'bg-primary/15 text-primary border border-primary/25'
                        : 'text-foreground/40 hover:text-foreground/60'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={20} className="animate-spin text-primary" />
              </div>
            ) : data?.subscribers.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-primary/8">
                        {['Email', 'Name', 'Source', 'Step', 'Status', 'Subscribed'].map(h => (
                          <th key={h} className="px-6 py-3 text-left text-[10px] font-bold text-foreground/25 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.subscribers.map((sub, i) => (
                        <tr key={sub.id} className={`border-b border-primary/5 hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                          <td className="px-6 py-3 text-foreground/80 font-mono text-xs">{sub.email}</td>
                          <td className="px-6 py-3 text-foreground/60 text-xs">{sub.name ?? '—'}</td>
                          <td className="px-6 py-3">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-foreground/40">
                              {SOURCE_LABELS[sub.source] ?? sub.source}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="flex gap-0.5">
                                {NURTURE_SEQUENCE.map((_, si) => (
                                  <div
                                    key={si}
                                    className="w-2 h-2 rounded-full"
                                    style={{ background: si < sub.sequenceStep ? '#C9A84C' : 'rgba(255,255,255,0.1)' }}
                                  />
                                ))}
                              </div>
                              <span className="text-[10px] text-foreground/30">
                                {sub.sequenceStep}/{NURTURE_SEQUENCE.length}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <span className={`text-[10px] font-semibold ${sub.status === 'active' ? 'text-emerald-400' : 'text-foreground/30'}`}>
                              {sub.status}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-foreground/30 text-xs">{relativeTime(sub.subscribedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {data.pagination.pages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-primary/8">
                    <span className="text-xs text-foreground/30">
                      Page {data.pagination.page} of {data.pagination.pages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="px-3 py-1.5 rounded-lg glass border border-primary/15 text-xs text-foreground/50 hover:text-foreground disabled:opacity-30 transition-colors"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))}
                        disabled={page >= data.pagination.pages}
                        className="px-3 py-1.5 rounded-lg glass border border-primary/15 text-xs text-foreground/50 hover:text-foreground disabled:opacity-30 transition-colors flex items-center gap-1"
                      >
                        Next <ChevronRight size={11} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <Mail size={28} className="text-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-foreground/40 mb-1">No subscribers yet</p>
                <p className="text-xs text-foreground/25">Subscribers will appear here after the footer form is used.</p>
              </div>
            )}
          </motion.div>

          {/* SMTP note */}
          <div className="mt-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-5 py-4">
            <div className="flex items-start gap-3">
              <XCircle size={14} className="text-yellow-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-yellow-400 mb-1">Email delivery not yet configured</p>
                <p className="text-xs text-foreground/40 leading-relaxed">
                  Emails are currently <strong className="text-foreground/60">logged to /private/newsletter/sent-log.jsonl</strong> but not delivered.
                  To enable real delivery, connect an SMTP provider (e.g. SendGrid, Mailgun, or Resend) via the email integration.
                  The sequence logic, templates, and subscriber tracking are fully operational.
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
