import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Shield, AlertTriangle, Activity, Lock, ChevronLeft, ChevronRight,
  RefreshCw, Download, Loader2, CheckCircle, XCircle, Globe, Monitor,
  Smartphone, Tablet, Bot, Search, X, Zap, Server, Users, Clock,
  TrendingUp, Wifi, Database, Terminal, LogOut, Mail, Send, ExternalLink,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';
import { useNavigate } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoginEvent {
  id: string; ts: string; actor: 'admin' | 'user'; email: string;
  result: string; ip: string; ua: string; device: string;
  browser: string; os: string; country: string; reason?: string;
  sessionId?: string;
}

interface AccessEntry {
  id: string; ts: string; method: string; url: string; status: number;
  duration: number; ip: string; ua: string; threat: string; threatNote: string; bytes: number;
}

interface ThreatAlert {
  id: string; ts: string; severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  type: string; title: string; detail: string; ip?: string; count?: number; resolved: boolean;
}

interface Session {
  token: string; adminId: string; email: string;
  createdAt: string; lastSeenAt: string; ip: string; ua: string;
}

interface ThreatSummary {
  active: number; critical: number; high: number; medium: number; low: number;
  loginStats: {
    totalLogins: number; successLogins: number; failedLogins: number;
    blockedLogins: number; adminLogins: number; userLogins: number;
    uniqueIPs: number; topIPs: Array<{ ip: string; count: number }>;
  };
  httpStats: {
    total: number; errors4xx: number; errors5xx: number; threats: number;
    avgDuration: number; statusBreakdown: Record<string, number>;
    methodBreakdown: Record<string, number>; threatBreakdown: Record<string, number>;
    topIPs: Array<{ ip: string; count: number }>;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RESULT_COLORS: Record<string, string> = {
  success:        '#10B981',
  failed:         '#EF4444',
  blocked:        '#F59E0B',
  account_locked: '#F59E0B',
  totp_failed:    '#EF4444',
  status_denied:  '#8B5CF6',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#F59E0B',
  low:      '#3B82F6',
  info:     '#6B7280',
};

const METHOD_COLORS: Record<string, string> = {
  GET: '#10B981', POST: '#3B82F6', PUT: '#F59E0B',
  DELETE: '#EF4444', PATCH: '#8B5CF6',
};

function DeviceIcon({ device }: { device: string }) {
  if (device === 'mobile')  return <Smartphone size={12} />;
  if (device === 'tablet')  return <Tablet size={12} />;
  if (device === 'bot')     return <Bot size={12} />;
  return <Monitor size={12} />;
}

function statusBadge(status: number) {
  const color = status < 300 ? '#10B981' : status < 400 ? '#F59E0B' : status < 500 ? '#EF4444' : '#8B5CF6';
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
      style={{ background: `${color}18`, color }}>
      {status}
    </span>
  );
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)  return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

// ── Tab definitions ───────────────────────────────────────────────────────────

type Tab = 'overview' | 'login-logs' | 'http-logs' | 'threats' | 'sessions' | 'health';

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: 'overview',   label: 'Overview',   icon: Shield },
  { id: 'login-logs', label: 'Login Logs', icon: Users },
  { id: 'http-logs',  label: 'HTTP Logs',  icon: Server },
  { id: 'threats',    label: 'Threats',    icon: AlertTriangle },
  { id: 'sessions',   label: 'Sessions',   icon: Wifi },
  { id: 'health',     label: 'Health',     icon: Activity },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminSecurity() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');

  // Overview
  const [summary, setSummary]     = useState<ThreatSummary | null>(null);
  const [threats, setThreats]     = useState<ThreatAlert[]>([]);

  // Login logs
  const [loginLogs, setLoginLogs]   = useState<LoginEvent[]>([]);
  const [loginTotal, setLoginTotal] = useState(0);
  const [loginPage, setLoginPage]   = useState(1);
  const [loginFilter, setLoginFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [loginResult, setLoginResult] = useState<string>('all');
  const [loginSearch, setLoginSearch] = useState('');

  // HTTP logs
  const [httpLogs, setHttpLogs]   = useState<AccessEntry[]>([]);
  const [httpTotal, setHttpTotal] = useState(0);
  const [httpPage, setHttpPage]   = useState(1);
  const [httpMethod, setHttpMethod] = useState('all');
  const [httpThreat, setHttpThreat] = useState('all');
  const [httpSearch, setHttpSearch] = useState('');

  // Sessions
  const [sessions, setSessions]   = useState<Session[]>([]);
  const [terminating, setTerminating] = useState<string | null>(null);

  // Health
  interface HealthData {
    status: string; timestamp: string; version: string; environment: string;
    uptime: { seconds: number; human: string };
    memory: { heapUsedMb: number; heapTotalMb: number; rssMb: number; freeRamMb: number; totalRamMb: number };
    stores: Record<string, { exists: boolean; sizeBytes: number; lineCount: number; lastModified: string | null }>;
    assetDirs: Record<string, number>;
    runtime: { activeSessions: number; nodeVersion: string; platform: string; arch: string; pid: number };
    users: { total: number; verified: number; pending: number; suspended: number };
  }
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Email test
  const [emailTestTo,      setEmailTestTo]      = useState('admin@citygate.capital');
  const [emailTestType,    setEmailTestType]     = useState<'smtp_verify' | 'login_alert' | 'kyc_approval'>('smtp_verify');
  const [emailTestLoading, setEmailTestLoading] = useState(false);
  const [emailTestResult,  setEmailTestResult]  = useState<{ ok: boolean; message: string; durationMs: number; attempts?: number; config?: { authMethod?: string; secretsReady?: boolean } } | null>(null);
  const [oauthStep,        setOauthStep]        = useState<'idle' | 'waiting'>('idle');

  const [loading, setLoading]     = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authLoading && !admin) navigate('/admin/login');
  }, [admin, authLoading, navigate]);

  const localAuthHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...authHeaders(),
  }), []);

  // ── Fetch functions ─────────────────────────────────────────────────────────

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes] = await Promise.all([
        fetch('/api/admin/security/threats?analyze=true&limit=50', { credentials: 'same-origin', headers: localAuthHeaders() }),
      ]);
      if (tRes.ok) {
        const d = await tRes.json();
        setThreats(d.threats ?? []);
        setSummary(d.summary ?? null);
      }
    } finally { setLoading(false); }
  }, [localAuthHeaders]);

  const fetchLoginLogs = useCallback(async (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams({
      type: 'login', limit: '50', offset: String((page - 1) * 50),
    });
    if (loginFilter !== 'all') params.set('actor', loginFilter);
    if (loginResult !== 'all') params.set('result', loginResult);
    if (loginSearch)           params.set('search', loginSearch);
    try {
      const res = await fetch(`/api/admin/security/logs?${params}`, { credentials: 'same-origin', headers: localAuthHeaders() });
      if (res.ok) { const d = await res.json(); setLoginLogs(d.data ?? []); setLoginTotal(d.total ?? 0); }
    } finally { setLoading(false); }
  }, [localAuthHeaders, loginFilter, loginResult, loginSearch]);

  const fetchHttpLogs = useCallback(async (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams({
      type: 'http', limit: '50', offset: String((page - 1) * 50),
    });
    if (httpMethod !== 'all') params.set('method', httpMethod);
    if (httpThreat !== 'all') params.set('threat', httpThreat);
    if (httpSearch)           params.set('search', httpSearch);
    try {
      const res = await fetch(`/api/admin/security/logs?${params}`, { credentials: 'same-origin', headers: localAuthHeaders() });
      if (res.ok) { const d = await res.json(); setHttpLogs(d.data ?? []); setHttpTotal(d.total ?? 0); }
    } finally { setLoading(false); }
  }, [localAuthHeaders, httpMethod, httpThreat, httpSearch]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/security/sessions', { credentials: 'same-origin', headers: localAuthHeaders() });
      if (res.ok) { const d = await res.json(); setSessions(d.sessions ?? []); }
    } finally { setLoading(false); }
  }, [localAuthHeaders]);

  // Load data when tab changes
  useEffect(() => {
    if (tab === 'overview')   fetchOverview();
    if (tab === 'login-logs') fetchLoginLogs(1);
    if (tab === 'http-logs')  fetchHttpLogs(1);
    if (tab === 'sessions')   fetchSessions();
    if (tab === 'health')     fetchHealth();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (tab === 'login-logs') { setLoginPage(1); fetchLoginLogs(1); } }, [loginFilter, loginResult]);
  useEffect(() => { if (tab === 'http-logs')  { setHttpPage(1);  fetchHttpLogs(1);  } }, [httpMethod, httpThreat]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      refreshRef.current = setInterval(() => {
        if (tab === 'overview')   fetchOverview();
        if (tab === 'login-logs') fetchLoginLogs(loginPage);
        if (tab === 'http-logs')  fetchHttpLogs(httpPage);
        if (tab === 'sessions')   fetchSessions();
      }, 15_000);
    } else {
      if (refreshRef.current) clearInterval(refreshRef.current);
    }
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [autoRefresh, tab, loginPage, httpPage]);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await fetch('/api/admin/health', { credentials: 'same-origin', headers: localAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHealthData(await res.json());
    } catch (e) {
      setHealthError(String(e));
    } finally {
      setHealthLoading(false);
    }
  }, [localAuthHeaders]);

  const sendEmailTest = useCallback(async () => {
    setEmailTestLoading(true);
    setEmailTestResult(null);
    try {
      const res = await fetch('/api/admin/email/test', {
        method: 'POST',
        credentials: 'same-origin',
        headers: localAuthHeaders(),
        body: JSON.stringify({ to: emailTestTo, type: emailTestType }),
      });
      // Guard against non-JSON responses (e.g. HTML error pages from auth middleware)
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Unexpected response (HTTP ${res.status}) — check admin session`);
      }
      const data = await res.json();
      setEmailTestResult(data);
    } catch (e) {
      setEmailTestResult({ ok: false, message: String(e), durationMs: 0 });
    } finally {
      setEmailTestLoading(false);
    }
  }, [localAuthHeaders, emailTestTo, emailTestType]);

  async function resolveTheat(id: string) {
    await fetch('/api/admin/security/threats', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: localAuthHeaders(),
      body: JSON.stringify({ id }),
    });
    setThreats(prev => prev.map(t => t.id === id ? { ...t, resolved: true } : t));
  }

  async function terminateSession(sessionToken: string) {
    setTerminating(sessionToken);
    await fetch('/api/admin/security/sessions', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: localAuthHeaders(),
      body: JSON.stringify({ token: sessionToken }),
    });
    setSessions(prev => prev.filter(s => s.token !== sessionToken));
    setTerminating(null);
  }

  function exportLogs(type: string, format = 'csv') {
    const url = `/api/admin/security/export?type=${type}&format=${format}`;
    window.open(url, '_blank');
  }

  if (authLoading) return null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <Helmet>
        <title>Security Monitor — CGC Admin</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <AdminLayout title="Security">
        <div className="space-y-5">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-white">Security Monitor</h1>
              <p className="text-sm text-white/30 mt-0.5">Login logs, HTTP traffic, threat detection &amp; session management</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRefresh(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  autoRefresh
                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                    : 'border-white/10 text-white/40 hover:text-white'
                }`}
              >
                <Activity size={12} className={autoRefresh ? 'animate-pulse' : ''} />
                {autoRefresh ? 'Live' : 'Auto-refresh'}
              </button>
              <button
                onClick={() => {
                  if (tab === 'overview')   fetchOverview();
                  if (tab === 'login-logs') fetchLoginLogs(loginPage);
                  if (tab === 'http-logs')  fetchHttpLogs(httpPage);
                  if (tab === 'sessions')   fetchSessions();
                }}
                className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/10 text-white/40 hover:text-white transition-colors"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl border border-white/5 w-fit"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tab === t.id ? 'text-black' : 'text-white/40 hover:text-white/70'
                }`}
                style={tab === t.id ? { background: 'linear-gradient(135deg, #C9A84C, #F0D080)' } : {}}>
                <t.icon size={11} />
                {t.label}
                {t.id === 'threats' && summary && summary.active > 0 && (
                  <span className="ml-0.5 px-1 py-0.5 rounded-full text-[9px] font-bold bg-red-500 text-white">
                    {summary.active}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
          {tab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

              {/* KPI row */}
              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Total Logins',   value: summary.loginStats.totalLogins,   icon: Users,    color: '#C9A84C' },
                    { label: 'Successful',     value: summary.loginStats.successLogins, icon: CheckCircle, color: '#10B981' },
                    { label: 'Failed',         value: summary.loginStats.failedLogins,  icon: XCircle,  color: '#EF4444' },
                    { label: 'Blocked',        value: summary.loginStats.blockedLogins, icon: Lock,     color: '#F59E0B' },
                    { label: 'HTTP Requests',  value: summary.httpStats.total,          icon: Server,   color: '#627EEA' },
                    { label: 'Active Threats', value: summary.active,                   icon: AlertTriangle, color: summary.active > 0 ? '#EF4444' : '#10B981' },
                  ].map((k, i) => (
                    <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="rounded-2xl p-4 border border-white/5" style={{ background: 'rgba(255,255,255,0.025)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider">{k.label}</p>
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${k.color}18` }}>
                          <k.icon size={11} style={{ color: k.color }} />
                        </div>
                      </div>
                      <p className="text-xl font-bold text-white">{Number(k.value ?? 0).toLocaleString()}</p>
                    </motion.div>
                  ))}
                </div>
              )}

              <div className="grid lg:grid-cols-3 gap-5">

                {/* Active threats */}
                <div className="lg:col-span-2 rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={13} className="text-red-400" />
                      <h3 className="text-white font-semibold text-sm">Active Threat Alerts</h3>
                    </div>
                    <button onClick={() => exportLogs('threats')}
                      className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors">
                      <Download size={10} /> Export
                    </button>
                  </div>
                  {loading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-primary" /></div>
                  ) : threats.filter(t => !t.resolved).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-white/20">
                      <CheckCircle size={28} className="mb-2 text-emerald-500/40" />
                      <p className="text-sm">No active threats detected</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.03] max-h-80 overflow-y-auto">
                      {threats.filter(t => !t.resolved).map((threat, i) => (
                        <motion.div key={threat.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                          className="flex items-start gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: `${SEVERITY_COLORS[threat.severity]}15` }}>
                            <Zap size={12} style={{ color: SEVERITY_COLORS[threat.severity] }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-white text-xs font-semibold">{threat.title}</p>
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase"
                                style={{ background: `${SEVERITY_COLORS[threat.severity]}18`, color: SEVERITY_COLORS[threat.severity] }}>
                                {threat.severity}
                              </span>
                            </div>
                            <p className="text-white/40 text-[11px] leading-relaxed">{threat.detail}</p>
                            {threat.ip && <p className="text-white/20 text-[10px] mt-0.5 font-mono">IP: {threat.ip}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <p className="text-white/20 text-[10px]">{fmtRelative(threat.ts)}</p>
                            <button onClick={() => resolveTheat(threat.id)}
                              className="text-[10px] px-2 py-0.5 rounded-lg text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors">
                              Resolve
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* HTTP stats */}
                <div className="space-y-3">
                  {summary && (
                    <>
                      {/* Method breakdown */}
                      <div className="rounded-2xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <p className="text-xs font-semibold text-white/50 mb-3 uppercase tracking-wider">HTTP Methods</p>
                        <div className="space-y-2">
                          {Object.entries(summary.httpStats.methodBreakdown).map(([method, count]) => {
                            const total = summary.httpStats.total || 1;
                            const pct = Math.round((count / total) * 100);
                            return (
                              <div key={method} className="flex items-center gap-2">
                                <span className="text-[10px] font-bold w-12 font-mono" style={{ color: METHOD_COLORS[method] ?? '#C9A84C' }}>{method}</span>
                                <div className="flex-1 h-1.5 rounded-full bg-white/5">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: METHOD_COLORS[method] ?? '#C9A84C' }} />
                                </div>
                                <span className="text-[10px] text-white/30 w-8 text-right">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Status breakdown */}
                      <div className="rounded-2xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <p className="text-xs font-semibold text-white/50 mb-3 uppercase tracking-wider">Response Codes</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: '2xx OK',    value: summary.httpStats.statusBreakdown['2xx'] ?? 0, color: '#10B981' },
                            { label: '3xx Redir', value: summary.httpStats.statusBreakdown['3xx'] ?? 0, color: '#F59E0B' },
                            { label: '4xx Error', value: summary.httpStats.errors4xx,                   color: '#EF4444' },
                            { label: '5xx Error', value: summary.httpStats.errors5xx,                   color: '#8B5CF6' },
                          ].map(s => (
                            <div key={s.label} className="rounded-xl p-2.5" style={{ background: `${s.color}08` }}>
                              <p className="text-[10px] text-white/30">{s.label}</p>
                              <p className="text-sm font-bold" style={{ color: s.color }}>{Number(s.value ?? 0).toLocaleString()}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Top IPs */}
                      {summary.loginStats.topIPs.length > 0 && (
                        <div className="rounded-2xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <p className="text-xs font-semibold text-white/50 mb-3 uppercase tracking-wider">Top Login IPs</p>
                          <div className="space-y-1.5">
                            {summary.loginStats.topIPs.slice(0, 5).map(({ ip, count }) => (
                              <div key={ip} className="flex items-center justify-between">
                                <span className="text-[11px] font-mono text-white/50">{ip}</span>
                                <span className="text-[10px] text-white/30">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── LOGIN LOGS TAB ────────────────────────────────────────────────── */}
          {tab === 'login-logs' && (
            <motion.div key="login-logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 w-full sm:w-56">
                  <Search size={12} className="text-white/25 shrink-0" />
                  <input value={loginSearch} onChange={e => setLoginSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchLoginLogs(1)}
                    placeholder="Search email, IP, browser..."
                    className="bg-transparent text-xs text-white placeholder:text-white/20 focus:outline-none flex-1" />
                  {loginSearch && <button onClick={() => { setLoginSearch(''); fetchLoginLogs(1); }}><X size={11} className="text-white/30" /></button>}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['all', 'admin', 'user'] as const).map(f => (
                    <button key={f} onClick={() => setLoginFilter(f)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium capitalize transition-colors ${loginFilter === f ? 'text-black' : 'text-white/40 hover:text-white/70'}`}
                      style={loginFilter === f ? { background: 'linear-gradient(135deg, #C9A84C, #F0D080)' } : {}}>
                      {f}
                    </button>
                  ))}
                  <select value={loginResult} onChange={e => setLoginResult(e.target.value)}
                    className="bg-white/[0.04] border border-white/8 rounded-lg px-2 py-1.5 text-[11px] text-white/60 focus:outline-none">
                    <option value="all">All results</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                    <option value="blocked">Blocked</option>
                    <option value="account_locked">Locked</option>
                    <option value="totp_failed">TOTP Failed</option>
                  </select>
                  <button onClick={() => exportLogs('login')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-white/40 border border-white/8 hover:text-white transition-colors">
                    <Download size={11} /> CSV
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                {loading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-primary" /></div>
                ) : loginLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-white/20">
                    <Database size={28} className="mb-2 opacity-30" />
                    <p className="text-sm">No login events recorded yet</p>
                    <p className="text-xs mt-1 text-white/15">Events will appear here after login attempts</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/5">
                          {['Time', 'Actor', 'Email', 'Result', 'IP', 'Device', 'Browser', 'OS', 'Country'].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-white/20 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {loginLogs.map((log, i) => (
                          <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                            className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-2.5 text-white/30 whitespace-nowrap font-mono text-[10px]">{fmtTime(log.ts)}</td>
                            <td className="px-4 py-2.5">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${log.actor === 'admin' ? 'bg-primary/15 text-primary' : 'bg-blue-500/15 text-blue-400'}`}>
                                {log.actor}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-white/60 max-w-[160px] truncate">{log.email}</td>
                            <td className="px-4 py-2.5">
                              <span className="flex items-center gap-1 text-[10px] font-semibold"
                                style={{ color: RESULT_COLORS[log.result] ?? '#C9A84C' }}>
                                {log.result === 'success' ? <CheckCircle size={9} /> : <XCircle size={9} />}
                                {log.result.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-white/40 font-mono text-[10px]">{log.ip}</td>
                            <td className="px-4 py-2.5">
                              <span className="flex items-center gap-1 text-white/40">
                                <DeviceIcon device={log.device} />
                                <span className="capitalize text-[10px]">{log.device}</span>
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-white/40 text-[10px]">{log.browser}</td>
                            <td className="px-4 py-2.5 text-white/40 text-[10px]">{log.os}</td>
                            <td className="px-4 py-2.5">
                              <span className="flex items-center gap-1 text-white/40 text-[10px]">
                                <Globe size={9} /> {log.country}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                  <p className="text-[10px] text-white/25">{Number(loginTotal ?? 0).toLocaleString()} total events</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { const p = Math.max(1, loginPage - 1); setLoginPage(p); fetchLoginLogs(p); }}
                      disabled={loginPage <= 1}
                      className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 disabled:opacity-30">
                      <ChevronLeft size={12} />
                    </button>
                    <span className="text-[10px] text-white/30">Page {loginPage}</span>
                    <button onClick={() => { const p = loginPage + 1; setLoginPage(p); fetchLoginLogs(p); }}
                      disabled={loginPage * 50 >= loginTotal}
                      className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 disabled:opacity-30">
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── HTTP LOGS TAB ─────────────────────────────────────────────────── */}
          {tab === 'http-logs' && (
            <motion.div key="http-logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 w-full sm:w-56">
                  <Search size={12} className="text-white/25 shrink-0" />
                  <input value={httpSearch} onChange={e => setHttpSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchHttpLogs(1)}
                    placeholder="Search URL, IP, UA..."
                    className="bg-transparent text-xs text-white placeholder:text-white/20 focus:outline-none flex-1" />
                  {httpSearch && <button onClick={() => { setHttpSearch(''); fetchHttpLogs(1); }}><X size={11} className="text-white/30" /></button>}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['all', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => (
                    <button key={m} onClick={() => setHttpMethod(m)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium font-mono transition-colors ${httpMethod === m ? 'text-black' : 'text-white/40 hover:text-white/70'}`}
                      style={httpMethod === m ? { background: 'linear-gradient(135deg, #C9A84C, #F0D080)' } : {}}>
                      {m}
                    </button>
                  ))}
                  <select value={httpThreat} onChange={e => setHttpThreat(e.target.value)}
                    className="bg-white/[0.04] border border-white/8 rounded-lg px-2 py-1.5 text-[11px] text-white/60 focus:outline-none">
                    <option value="all">All traffic</option>
                    <option value="sql_injection">SQL Injection</option>
                    <option value="xss_attempt">XSS</option>
                    <option value="path_traversal">Path Traversal</option>
                    <option value="scanner">Scanner</option>
                    <option value="suspicious_ua">Suspicious UA</option>
                    <option value="unauthorized_admin">Unauth Admin</option>
                    <option value="rate_limited">Rate Limited</option>
                  </select>
                  <button onClick={() => exportLogs('http')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-white/40 border border-white/8 hover:text-white transition-colors">
                    <Download size={11} /> CSV
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                {loading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-primary" /></div>
                ) : httpLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-white/20">
                    <Terminal size={28} className="mb-2 opacity-30" />
                    <p className="text-sm">No HTTP logs yet</p>
                    <p className="text-xs mt-1 text-white/15">Requests will be logged automatically</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/5">
                          {['Time', 'Method', 'URL', 'Status', 'Duration', 'IP', 'Threat'].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-white/20 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {httpLogs.map((log, i) => (
                          <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                            className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${log.threat !== 'none' ? 'bg-red-500/[0.03]' : ''}`}>
                            <td className="px-4 py-2.5 text-white/30 whitespace-nowrap font-mono text-[10px]">{fmtTime(log.ts)}</td>
                            <td className="px-4 py-2.5">
                              <span className="text-[10px] font-bold font-mono" style={{ color: METHOD_COLORS[log.method] ?? '#C9A84C' }}>{log.method}</span>
                            </td>
                            <td className="px-4 py-2.5 text-white/50 max-w-[220px] truncate font-mono text-[10px]" title={log.url}>{log.url}</td>
                            <td className="px-4 py-2.5">{statusBadge(log.status)}</td>
                            <td className="px-4 py-2.5 text-white/30 text-[10px]">
                              <span className={log.duration > 1000 ? 'text-amber-400' : ''}>{log.duration}ms</span>
                            </td>
                            <td className="px-4 py-2.5 text-white/40 font-mono text-[10px]">{log.ip}</td>
                            <td className="px-4 py-2.5">
                              {log.threat !== 'none' ? (
                                <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400">
                                  <AlertTriangle size={9} />
                                  {log.threat.replace(/_/g, ' ')}
                                </span>
                              ) : (
                                <span className="text-[10px] text-white/15">—</span>
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                  <p className="text-[10px] text-white/25">{Number(httpTotal ?? 0).toLocaleString()} total requests</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { const p = Math.max(1, httpPage - 1); setHttpPage(p); fetchHttpLogs(p); }}
                      disabled={httpPage <= 1}
                      className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 disabled:opacity-30">
                      <ChevronLeft size={12} />
                    </button>
                    <span className="text-[10px] text-white/30">Page {httpPage}</span>
                    <button onClick={() => { const p = httpPage + 1; setHttpPage(p); fetchHttpLogs(p); }}
                      disabled={httpPage * 50 >= httpTotal}
                      className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 disabled:opacity-30">
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── THREATS TAB ───────────────────────────────────────────────────── */}
          {tab === 'threats' && (
            <motion.div key="threats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/40">{threats.filter(t => !t.resolved).length} active · {threats.filter(t => t.resolved).length} resolved</p>
                <div className="flex gap-2">
                  <button onClick={() => fetchOverview()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/50 border border-white/10 hover:text-white transition-colors">
                    <Zap size={11} /> Re-analyze
                  </button>
                  <button onClick={() => exportLogs('threats')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/50 border border-white/10 hover:text-white transition-colors">
                    <Download size={11} /> Export
                  </button>
                </div>
              </div>

              {threats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-white/20">
                  <Shield size={36} className="mb-3 text-emerald-500/30" />
                  <p className="text-sm">No threats detected</p>
                  <p className="text-xs mt-1 text-white/15">Click Re-analyze to scan for new threats</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {threats.map((threat, i) => (
                    <motion.div key={threat.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className={`rounded-2xl border p-4 transition-all ${threat.resolved ? 'opacity-40 border-white/[0.04]' : 'border-white/8'}`}
                      style={{ background: threat.resolved ? 'rgba(255,255,255,0.01)' : `${SEVERITY_COLORS[threat.severity]}06` }}>
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${SEVERITY_COLORS[threat.severity]}15` }}>
                          <AlertTriangle size={15} style={{ color: SEVERITY_COLORS[threat.severity] }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-white text-sm font-semibold">{threat.title}</p>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                              style={{ background: `${SEVERITY_COLORS[threat.severity]}20`, color: SEVERITY_COLORS[threat.severity] }}>
                              {threat.severity}
                            </span>
                            {threat.resolved && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400">RESOLVED</span>
                            )}
                          </div>
                          <p className="text-white/50 text-xs leading-relaxed">{threat.detail}</p>
                          <div className="flex items-center gap-4 mt-2">
                            {threat.ip    && <span className="text-[10px] text-white/25 font-mono">IP: {threat.ip}</span>}
                            {threat.count && <span className="text-[10px] text-white/25">Count: {threat.count}</span>}
                            <span className="text-[10px] text-white/20 flex items-center gap-1"><Clock size={9} />{fmtTime(threat.ts)}</span>
                          </div>
                        </div>
                        {!threat.resolved && (
                          <button onClick={() => resolveTheat(threat.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors shrink-0">
                            <CheckCircle size={11} /> Resolve
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── SESSIONS TAB ─────────────────────────────────────────────────── */}
          {tab === 'sessions' && (
            <motion.div key="sessions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/40">{sessions.length} active session{sessions.length !== 1 ? 's' : ''}</p>
                <button
                  onClick={async () => {
                    if (!confirm('Terminate ALL other admin sessions?')) return;
                    await fetch('/api/admin/security/sessions', {
                      method: 'DELETE',
                      credentials: 'same-origin',
                      headers: localAuthHeaders(),
                      body: JSON.stringify({ all: true }),
                    });
                    fetchSessions();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={11} /> Terminate All Others
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-primary" /></div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/20">
                  <Wifi size={28} className="mb-2 opacity-30" />
                  <p className="text-sm">No active sessions</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map((session, i) => {
                    const isCurrentSession = false;
                    return (
                      <motion.div key={session.token} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        className="rounded-2xl border border-white/8 p-4 flex items-center gap-4"
                        style={{ background: 'rgba(255,255,255,0.025)' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: isCurrentSession ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.05)' }}>
                          <Monitor size={16} style={{ color: isCurrentSession ? '#C9A84C' : 'rgba(255,255,255,0.4)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-white text-sm font-medium">{session.email}</p>
                            {isCurrentSession && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-primary/15 text-primary">Current</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-white/30">
                            <span className="font-mono">{session.ip}</span>
                            <span className="flex items-center gap-1"><Clock size={9} />Active {fmtRelative(session.lastSeenAt)}</span>
                            <span className="flex items-center gap-1"><TrendingUp size={9} />Started {fmtRelative(session.createdAt)}</span>
                          </div>
                          <p className="text-[10px] text-white/20 mt-0.5 truncate">{session.ua}</p>
                        </div>
                        {!isCurrentSession && (
                          <button
                            onClick={() => terminateSession(session.token)}
                            disabled={terminating === session.token}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 disabled:opacity-50 transition-colors shrink-0"
                          >
                            {terminating === session.token
                              ? <Loader2 size={11} className="animate-spin" />
                              : <LogOut size={11} />}
                            Terminate
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Health Tab ─────────────────────────────────────────────────── */}
          {tab === 'health' && (
            <motion.div key="health" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold text-sm">System Health</h2>
                <button onClick={fetchHealth} disabled={healthLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.04] border border-white/8 text-white/50 hover:text-white disabled:opacity-40 transition-colors">
                  <RefreshCw size={11} className={healthLoading ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>

              {healthLoading && !healthData && (
                <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-primary" /></div>
              )}
              {healthError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
                  <AlertTriangle size={14} /> {healthError}
                </div>
              )}

              {healthData && (
                <div className="space-y-4">
                  {/* Status banner */}
                  <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border ${healthData.status === 'ok' ? 'border-emerald-500/20 bg-emerald-500/[0.06]' : 'border-red-500/20 bg-red-500/[0.06]'}`}>
                    {healthData.status === 'ok'
                      ? <CheckCircle size={20} className="text-emerald-400 shrink-0" />
                      : <XCircle size={20} className="text-red-400 shrink-0" />}
                    <div>
                      <p className={`font-semibold text-sm ${healthData.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {healthData.status === 'ok' ? 'All Systems Operational' : 'System Degraded'}
                      </p>
                      <p className="text-white/30 text-xs">v{healthData.version} · {healthData.environment} · Uptime {healthData.uptime.human}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-white/20 text-[10px]">Last checked</p>
                      <p className="text-white/40 text-xs">{new Date(healthData.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>

                  {/* KPI row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Heap Used',    value: `${healthData.memory.heapUsedMb} MB`, sub: `of ${healthData.memory.heapTotalMb} MB`, icon: Database },
                      { label: 'RSS Memory',   value: `${healthData.memory.rssMb} MB`,      sub: `${healthData.memory.freeRamMb} MB free`, icon: Server },
                      { label: 'Active Sessions', value: String(healthData.runtime.activeSessions), sub: 'admin sessions', icon: Wifi },
                      { label: 'Total Users',  value: String(healthData.users.total), sub: `${healthData.users.pending} pending KYC`, icon: Users },
                    ].map(kpi => (
                      <div key={kpi.label} className="rounded-2xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.025)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <kpi.icon size={13} className="text-primary" />
                          <p className="text-white/30 text-[10px] uppercase tracking-wide">{kpi.label}</p>
                        </div>
                        <p className="text-white font-bold text-lg">{kpi.value}</p>
                        <p className="text-white/30 text-[10px]">{kpi.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Data stores */}
                  <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="px-5 py-3 border-b border-white/5">
                      <p className="text-white/50 text-xs font-semibold uppercase tracking-wide">Data Stores</p>
                    </div>
                    <div className="divide-y divide-white/[0.03]">
                      {Object.entries(healthData.stores).map(([name, info]) => (
                        <div key={name} className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            {info.exists
                              ? <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                              : <XCircle size={12} className="text-white/20 shrink-0" />}
                            <p className="text-white/70 text-xs font-mono">{name}</p>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-white/30">
                            {info.exists && (
                              <>
                                <span>{Number(info.lineCount ?? 0).toLocaleString()} records</span>
                                <span>{((info.sizeBytes ?? 0) / 1024).toFixed(1)} KB</span>
                                {info.lastModified && <span>{fmtRelative(info.lastModified)}</span>}
                              </>
                            )}
                            {!info.exists && <span className="text-white/20">not created yet</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Runtime info */}
                  <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-3">Runtime</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      {[
                        ['Node.js', healthData.runtime.nodeVersion],
                        ['Platform', `${healthData.runtime.platform} / ${healthData.runtime.arch}`],
                        ['PID', String(healthData.runtime.pid)],
                        ['Users (verified)', `${healthData.users.verified} / ${healthData.users.total}`],
                        ['Users (suspended)', String(healthData.users.suspended)],
                        ['Environment', healthData.environment],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <p className="text-white/25 text-[10px] mb-0.5">{k}</p>
                          <p className="text-white/70 font-mono">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Email / OAuth Setup ──────────────────────────────────── */}
              <div className="mt-6 rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/5">
                  <Mail size={14} className="text-primary shrink-0" />
                  <p className="text-white/70 text-sm font-semibold">Transactional Email — Zoho OAuth Setup</p>
                  <span className="ml-auto text-[10px] font-mono text-white/20">HTTPS/443</span>
                </div>

                <div className="px-5 py-4 space-y-4">

                  {/* Step-by-step OAuth guide */}
                  <div className="rounded-xl border border-primary/10 bg-primary/[0.03] p-4 space-y-3">
                    <p className="text-primary text-xs font-semibold uppercase tracking-wide">One-time OAuth Setup — 3 Steps</p>

                    {/* Step 1 */}
                    <div className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-primary text-[10px] font-bold">1</span>
                      </div>
                      <div>
                        <p className="text-white/70 text-xs font-medium">Add ZOHO_CLIENT_SECRET</p>
                        <p className="text-white/30 text-[11px] mt-0.5">
                          Go to <a href="https://api-console.zoho.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">api-console.zoho.com</a> →
                          open your app → copy the <strong className="text-white/50">Client Secret</strong> →
                          add it as <code className="text-primary/80 bg-primary/10 px-1 rounded">ZOHO_CLIENT_SECRET</code> in Settings → Secrets.
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-primary text-[10px] font-bold">2</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-white/70 text-xs font-medium">Authorize Zoho in your browser</p>
                        <p className="text-white/30 text-[11px] mt-0.5 mb-2">
                          Click the button below — it opens the Zoho authorization page. Log in as <strong className="text-white/50">info@citygate.capital</strong> and click Allow.
                          You'll be redirected back here with your tokens.
                        </p>
                        <button
                          onClick={() => {
                            window.open('https://citygate.capital/api/zoho/connect', '_blank', 'width=620,height=720,noopener');
                            setOauthStep('waiting');
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-black hover:bg-primary/90 transition-all"
                        >
                          <ExternalLink size={11} /> Authorize with Zoho
                        </button>
                        {oauthStep === 'waiting' && (
                          <p className="text-primary/60 text-[11px] mt-2 animate-pulse">
                            ↗ Zoho authorization page opened — approve access, then copy the Refresh Token from the redirect page.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-primary text-[10px] font-bold">3</span>
                      </div>
                      <div>
                        <p className="text-white/70 text-xs font-medium">Save ZOHO_REFRESH_TOKEN</p>
                        <p className="text-white/30 text-[11px] mt-0.5">
                          The redirect page shows your Refresh Token (auto-copied to clipboard).
                          Add it as <code className="text-primary/80 bg-primary/10 px-1 rounded">ZOHO_REFRESH_TOKEN</code> in Settings → Secrets, then re-publish.
                          The server will auto-refresh access tokens — email will be live.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Config status row */}
                  <div className="grid grid-cols-3 gap-3 text-[11px]">
                    {[
                      { label: 'Transport',      value: 'Zoho Mail HTTP API' },
                      { label: 'Sender',         value: 'info@citygate.capital' },
                      { label: 'Client ID',      value: '1000.ZGGP8…DQZDS' },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl border border-white/[0.04] px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.015)' }}>
                        <p className="text-white/25 text-[9px] uppercase tracking-widest mb-1">{label}</p>
                        <p className="text-white/60 font-mono truncate">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-white/[0.04] pt-4">
                    <p className="text-white/30 text-[11px] mb-3">Once OAuth is configured, use the test below to verify delivery:</p>
                  </div>

                  {/* Test controls */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      value={emailTestTo}
                      onChange={e => setEmailTestTo(e.target.value)}
                      placeholder="Recipient email"
                      className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40"
                    />
                    <select
                      value={emailTestType}
                      onChange={e => setEmailTestType(e.target.value as typeof emailTestType)}
                      className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-primary/40"
                    >
                      <option value="smtp_verify">Connectivity Test</option>
                      <option value="login_alert">Login Alert Email</option>
                      <option value="kyc_approval">KYC Approval Email</option>
                    </select>
                    <button
                      onClick={sendEmailTest}
                      disabled={emailTestLoading || !emailTestTo.includes('@')}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-black hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                    >
                      {emailTestLoading
                        ? <><Loader2 size={11} className="animate-spin" /> Sending…</>
                        : <><Send size={11} /> Send Test</>}
                    </button>
                  </div>

                  {/* Result */}
                  {emailTestResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-xs ${
                        emailTestResult.ok
                          ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300'
                          : 'border-red-500/20 bg-red-500/[0.06] text-red-300'
                      }`}
                    >
                      {emailTestResult.ok
                        ? <CheckCircle size={14} className="shrink-0 mt-0.5" />
                        : <XCircle    size={14} className="shrink-0 mt-0.5" />}
                      <div className="min-w-0">
                        <p className="font-medium">{emailTestResult.ok ? 'Email delivered successfully' : 'Delivery failed'}</p>
                        <p className="opacity-70 mt-0.5 break-words">{emailTestResult.message}</p>
                        {emailTestResult.config?.authMethod && (
                          <p className="opacity-40 mt-1">Auth: {emailTestResult.config.authMethod}</p>
                        )}
                        {emailTestResult.durationMs > 0 && (
                          <p className="opacity-40 mt-0.5">{emailTestResult.durationMs} ms · {emailTestResult.attempts ?? 1} attempt{(emailTestResult.attempts ?? 1) !== 1 ? 's' : ''}</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

            </motion.div>
          )}

        </div>
      </AdminLayout>
    </>
  );
}
