/**
 * Admin SMTP Management — /admin/smtp
 * ─────────────────────────────────────
 * Full dual-mode email transport control panel:
 *   • Live status monitor (OAuth health, queue stats, last delivery)
 *   • Config editor (OAuth credentials + manual SMTP fallback)
 *   • Test center (8 email types, force-mode override)
 *   • Email queue viewer with per-item retry + bulk retry
 *   • Emergency override controls (resend verification, approve, activate)
 */
import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';
import {
  Mail, Settings, Send, RefreshCw, CheckCircle, XCircle, AlertTriangle,
  Wifi, RotateCcw, Eye, EyeOff, Zap, Shield, Activity, Inbox, User,
  ArrowRight, AlertCircle, Clock, TrendingUp, FileText, BookOpen,
  RotateCw, Filter, Download,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SmtpConfig {
  mode: 'oauth' | 'manual';
  host: string;
  port: number;
  username: string;
  password: string;
  senderEmail: string;
  senderName: string;
  encryption: 'ssl' | 'tls' | 'none';
  oauthClientId: string;
  oauthClientSecret: string;
  oauthRefreshToken: string;
  updatedAt: string;
  updatedBy: string;
}

interface SmtpStatus {
  mode: 'oauth' | 'manual';
  oauthReady: boolean;
  manualReady: boolean;
  hasAccountId: boolean;
  hasRefreshToken: boolean;
  hasClientSecret: boolean;
  clientSecretValid: boolean;
  clientSecretReason?: string;
  refreshTokenValid: boolean;
  manualHost: string | null;
  manualPort: number;
  senderEmail: string;
  senderName: string;
  updatedAt: string;
  queue: {
    queued: number;
    retrying: number;
    sent: number;
    failed: number;
    lastSentAt: string;
  };
}

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  status: 'queued' | 'sent' | 'failed' | 'retrying';
  attempts: number;
  errorMessage: string;
  createdAt: string;
  sentAt: string;
  lastAttemptAt: string;
}

const EMAIL_TEST_TYPES = [
  { value: 'connectivity',   label: 'Connectivity Test' },
  { value: 'verification',   label: 'Email Verification' },
  { value: 'otp',            label: 'OTP / 2FA Code' },
  { value: 'password_reset', label: 'Password Reset' },
  { value: 'transaction',    label: 'Transaction Notification' },
  { value: 'login_alert',    label: 'Admin Login Alert' },
  { value: 'withdrawal',     label: 'Withdrawal Notification' },
  { value: 'admin_alert',    label: 'Security Alert' },
];

// ── Email template types ──────────────────────────────────────────────────────

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  variables: string[];
  category: string;
  updatedAt: string;
  updatedBy: string;
}

interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  template: string;
  status: 'delivered' | 'bounced' | 'failed' | 'pending';
  sentAt: string;
  errorMessage?: string;
  campaignId?: string;
}

const OVERRIDE_ACTIONS = [
  { value: 'resend_verification', label: 'Resend Verification Email' },
  { value: 'manual_verify',       label: 'Manually Verify Email' },
  { value: 'approve',             label: 'Approve Account (KYC)' },
  { value: 'activate',            label: 'Activate Account' },
  { value: 'resend_welcome',      label: 'Resend Welcome Email' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' });
  } catch { return iso; }
}

function fmtAge(iso: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
      ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
    }`}>
      {ok ? <CheckCircle size={10} /> : <XCircle size={10} />}
      {label}
    </span>
  );
}

function Field({
  label, value, onChange, placeholder, type = 'text', className = '', hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; className?: string; hint?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className={className}>
      <label className="block text-xs text-muted-foreground mb-1.5 font-medium">{label}</label>
      <div className="relative">
        <input
          type={isPassword && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary pr-10"
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {show ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-5 rounded-xl bg-card border border-border ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
      <Icon size={14} className="text-primary" />
      {label}
    </h3>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SmtpManagementPage() {
  const [status, setStatus]     = useState<SmtpStatus | null>(null);
  const [config, setConfig]     = useState<SmtpConfig | null>(null);
  const [logs, setLogs]         = useState<EmailLog[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');
  const [retryingAll, setRetryingAll] = useState(false);
  const [retryAllMsg, setRetryAllMsg] = useState('');

  const [testTo,      setTestTo]      = useState('admin@citygate.capital');
  const [testType,    setTestType]    = useState('connectivity');
  const [testMode,    setTestMode]    = useState<'oauth' | 'manual' | 'auto'>('auto');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult,  setTestResult]  = useState<{
    ok: boolean; message: string; transport?: string; durationMs?: number; attempts?: number;
  } | null>(null);

  const [overrideUserId, setOverrideUserId] = useState('');
  const [overrideAction, setOverrideAction] = useState('resend_verification');
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideMsg, setOverrideMsg] = useState('');

  const [flushLoading, setFlushLoading] = useState(false);
  const [flushResult, setFlushResult]   = useState<{
    ok: boolean; durationMs: number;
    oauth: { tokenRefreshed: boolean; tokenError: string | null; hasRefreshToken: boolean; hasClientSecret: boolean; clientSecretValid: boolean; refreshTokenValid: boolean; secretSources?: Record<string, string> };
    queue: { flushed: number; sent: number; failed: number; requeuedExhausted?: number };
  } | null>(null);

  const [requeueLoading, setRequeueLoading] = useState(false);
  const [requeueResult, setRequeueResult]   = useState<{ ok: boolean; requeued: number } | null>(null);

  const [activeTab, setActiveTab] = useState<'status' | 'config' | 'test' | 'queue' | 'templates' | 'emaillog' | 'override'>('status');
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Template state ─────────────────────────────────────────────────────────
  const [templates, setTemplates]           = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [editSubject, setEditSubject]       = useState('');
  const [editBody, setEditBody]             = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateMsg, setTemplateMsg]       = useState('');
  const [testTemplateTo, setTestTemplateTo] = useState('admin@citygate.capital');
  const [testTemplateSending, setTestTemplateSending] = useState(false);
  const [testTemplateMsg, setTestTemplateMsg] = useState('');

  // ── Email log state ────────────────────────────────────────────────────────
  const [emailLog, setEmailLog]             = useState<EmailLogEntry[]>([]);
  const [logFilter, setLogFilter]           = useState<'all' | 'delivered' | 'failed' | 'bounced'>('all');
  const [logTemplate, setLogTemplate]       = useState('');
  const [logDateFrom, setLogDateFrom]       = useState('');
  const [logDateTo, setLogDateTo]           = useState('');
  const [logLoading, setLogLoading]         = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/smtp/status', { headers: authHeaders() });
      if (r.ok) setStatus(await r.json());
    } catch { /* silent */ }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/smtp/config', { headers: authHeaders() });
      if (r.ok) setConfig(await r.json());
    } catch { /* silent */ }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/email/queue?view=logs&limit=100', { headers: authHeaders() });
      if (r.ok) { const d = await r.json(); setLogs(d.data ?? []); }
    } catch { /* silent */ }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/email/templates', { headers: authHeaders() });
      if (r.ok) { const d = await r.json(); setTemplates(d.templates ?? []); }
    } catch { /* silent */ }
  }, []);

  const fetchEmailLog = useCallback(async () => {
    setLogLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (logFilter !== 'all') params.set('status', logFilter);
      if (logTemplate) params.set('template', logTemplate);
      if (logDateFrom) params.set('dateFrom', new Date(logDateFrom).toISOString());
      if (logDateTo)   params.set('dateTo',   new Date(logDateTo + 'T23:59:59').toISOString());
      const r = await fetch(`/api/admin/email/log?${params}`, { headers: authHeaders() });
      if (r.ok) { const d = await r.json(); setEmailLog(d.entries ?? []); }
    } catch { /* silent */ }
    setLogLoading(false);
  }, [logFilter, logTemplate, logDateFrom, logDateTo]);

  useEffect(() => {
    Promise.all([fetchStatus(), fetchConfig(), fetchLogs(), fetchTemplates()]).finally(() => setLoading(false));
    // Auto-refresh status every 15s
    refreshRef.current = setInterval(() => {
      fetchStatus();
      if (activeTab === 'queue') fetchLogs();
    }, 15_000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [fetchStatus, fetchConfig, fetchLogs, fetchTemplates, activeTab]);

  useEffect(() => {
    if (activeTab === 'emaillog') fetchEmailLog();
  }, [activeTab, fetchEmailLog]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const switchMode = async (mode: 'oauth' | 'manual') => {
    try {
      const r = await fetch('/api/admin/smtp/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ mode }),
      });
      if (r.ok) { setConfig(c => c ? { ...c, mode } : c); fetchStatus(); }
    } catch { /* silent */ }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true); setSaveMsg('');
    try {
      const r = await fetch('/api/admin/smtp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(config),
      });
      const d = await r.json();
      setSaveMsg(d.ok ? '✅ Configuration saved.' : `❌ ${d.error}`);
      if (d.ok) { fetchStatus(); fetchConfig(); }
    } catch (e) { setSaveMsg(`❌ ${e}`); }
    setSaving(false);
  };

  const verifySmtp = async () => {
    setVerifying(true); setVerifyMsg('');
    try {
      const r = await fetch('/api/admin/smtp/verify', { method: 'POST', headers: authHeaders() });
      const d = await r.json();
      setVerifyMsg(d.ok ? '✅ SMTP connection verified.' : `❌ ${d.error}`);
    } catch (e) { setVerifyMsg(`❌ ${e}`); }
    setVerifying(false);
  };

  const sendTest = async () => {
    setTestLoading(true); setTestResult(null);
    try {
      const r = await fetch('/api/admin/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          to: testTo,
          type: testType,
          forceMode: testMode === 'auto' ? undefined : testMode,
        }),
      });
      setTestResult(await r.json());
      fetchLogs();
    } catch (e) { setTestResult({ ok: false, message: String(e) }); }
    setTestLoading(false);
  };

  const retryEmail = async (id: string) => {
    try {
      await fetch('/api/admin/email/queue/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ id }),
      });
      fetchLogs();
    } catch { /* silent */ }
  };

  const retryAllFailed = async () => {
    const failed = logs.filter(l => l.status === 'failed');
    if (!failed.length) { setRetryAllMsg('No failed emails to retry.'); return; }
    setRetryingAll(true); setRetryAllMsg('');
    let count = 0;
    for (const log of failed) {
      try {
        const r = await fetch('/api/admin/email/queue/retry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ id: log.id }),
        });
        if ((await r.json()).ok) count++;
      } catch { /* silent */ }
    }
    setRetryAllMsg(`✅ Re-queued ${count} of ${failed.length} failed emails.`);
    setRetryingAll(false);
    fetchLogs();
  };

  const runOverride = async () => {
    if (!overrideUserId.trim()) return;
    setOverrideLoading(true); setOverrideMsg('');
    try {
      const r = await fetch('/api/admin/users/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId: overrideUserId.trim(), action: overrideAction }),
      });
      const d = await r.json();
      setOverrideMsg(d.ok ? `✅ ${d.message}` : `❌ ${d.error}`);
    } catch (e) { setOverrideMsg(`❌ ${e}`); }
    setOverrideLoading(false);
  };

  const flushOAuth = async () => {
    setFlushLoading(true); setFlushResult(null);
    try {
      const r = await fetch('/api/admin/email/flush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      const d = await r.json();
      setFlushResult(d);
      fetchStatus(); fetchLogs();
    } catch (e) { setFlushResult({ ok: false, durationMs: 0, oauth: { tokenRefreshed: false, tokenError: String(e), hasRefreshToken: false, hasClientSecret: false, clientSecretValid: false, refreshTokenValid: false }, queue: { flushed: 0, sent: 0, failed: 0 } }); }
    setFlushLoading(false);
  };

  const requeueAll = async () => {
    setRequeueLoading(true); setRequeueResult(null);
    try {
      const r = await fetch('/api/admin/email/requeue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      const d = await r.json();
      setRequeueResult({ ok: d.ok, requeued: d.requeued ?? 0 });
      fetchStatus(); fetchLogs();
    } catch (e) { setRequeueResult({ ok: false, requeued: 0 }); void e; }
    setRequeueLoading(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  function selectTemplate(t: EmailTemplate) {
    setSelectedTemplate(t);
    setEditSubject(t.subject);
    setEditBody(t.body);
    setTemplateMsg('');
  }

  async function saveTemplateEdit() {
    if (!selectedTemplate) return;
    setTemplateSaving(true); setTemplateMsg('');
    try {
      const r = await fetch('/api/admin/email/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ id: selectedTemplate.id, subject: editSubject, body: editBody }),
      });
      const d = await r.json();
      if (d.ok) {
        setTemplateMsg('✅ Template saved.');
        setSelectedTemplate(d.template);
        fetchTemplates();
      } else {
        setTemplateMsg(`❌ ${d.error}`);
      }
    } catch (e) { setTemplateMsg(`❌ ${e}`); }
    setTemplateSaving(false);
  }

  async function resetTemplateToDefault() {
    if (!selectedTemplate || !confirm('Reset this template to the default? Your edits will be lost.')) return;
    setTemplateSaving(true); setTemplateMsg('');
    try {
      const r = await fetch('/api/admin/email/templates/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ id: selectedTemplate.id }),
      });
      const d = await r.json();
      if (d.ok) {
        setTemplateMsg('✅ Reset to default.');
        selectTemplate(d.template);
        fetchTemplates();
      } else {
        setTemplateMsg(`❌ ${d.error}`);
      }
    } catch (e) { setTemplateMsg(`❌ ${e}`); }
    setTemplateSaving(false);
  }

  async function sendTestTemplate() {
    if (!selectedTemplate || !testTemplateTo.includes('@')) return;
    setTestTemplateSending(true); setTestTemplateMsg('');
    try {
      const r = await fetch('/api/admin/smtp/test-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ templateId: selectedTemplate.id, to: testTemplateTo }),
      });
      const d = await r.json();
      setTestTemplateMsg(d.ok ? `✅ ${d.message}` : `❌ ${d.error}`);
    } catch (e) { setTestTemplateMsg(`❌ ${e}`); }
    setTestTemplateSending(false);
  }

  function exportEmailLog() {
    const rows = [
      ['ID', 'To', 'Subject', 'Template', 'Status', 'Sent At', 'Error'],
      ...emailLog.map(e => [e.id, e.to, e.subject, e.template, e.status, e.sentAt, e.errorMessage ?? '']),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `cgc-email-log-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const CATEGORY_COLORS: Record<string, string> = {
    auth:        'text-blue-400 bg-blue-400/10',
    kyc:         'text-amber-400 bg-amber-400/10',
    transaction: 'text-emerald-400 bg-emerald-400/10',
    security:    'text-red-400 bg-red-400/10',
    account:     'text-purple-400 bg-purple-400/10',
  };

  const tabs = [
    { id: 'status',    label: 'Status',    icon: Activity },
    { id: 'config',    label: 'Config',    icon: Settings },
    { id: 'test',      label: 'Test',      icon: Send },
    { id: 'queue',     label: 'Queue',     icon: Inbox },
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'emaillog',  label: 'Email Log', icon: BookOpen },
    { id: 'override',  label: 'Override',  icon: Shield },
  ] as const;

  const failedCount = logs.filter(l => l.status === 'failed').length;

  return (
    <AdminLayout title="SMTP Management">
      <Helmet><title>SMTP Management — CGC Admin</title><meta name="description" content="Email delivery and SMTP configuration panel for City Gate Capital." /><meta name="robots" content="noindex, nofollow" /><link rel="canonical" href="https://citygate.capital/admin/smtp" /></Helmet>
      <div className="p-6 max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <Mail size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">SMTP Management</h1>
            <p className="text-xs text-muted-foreground">
              Dual-mode transport · OAuth2 primary · Manual SMTP fallback · Auto-retry queue
            </p>
          </div>
          <button onClick={() => { fetchStatus(); fetchLogs(); }}
            className="ml-auto p-2 rounded-lg hover:bg-muted transition-colors" title="Refresh">
            <RefreshCw size={15} className={`text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Mode toggle */}
        {status && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Active Mode:</span>
            {(['oauth', 'manual'] as const).map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  status.mode === m
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}>
                {m === 'oauth' ? <Zap size={12} /> : <Settings size={12} />}
                {m === 'oauth' ? 'OAuth2 (Zoho)' : 'Manual SMTP'}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <StatusPill ok={status.oauthReady}  label="OAuth" />
              <StatusPill ok={status.manualReady} label="SMTP" />
              {status.queue.queued > 0 && (
                <span className="text-xs text-yellow-400 flex items-center gap-1">
                  <Clock size={11} /> {status.queue.queued} queued
                </span>
              )}
              {failedCount > 0 && (
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <XCircle size={11} /> {failedCount} failed
                </span>
              )}
            </div>
          </div>
        )}

        {/* OAuth warning banner */}
        {status && !status.clientSecretValid && (
          <div className="p-4 rounded-xl bg-red-500/8 border border-red-500/25 flex gap-3">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-400 mb-1">OAuth Not Working — Action Required</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {status.clientSecretReason ?? 'ZOHO_CLIENT_SECRET is invalid.'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <strong className="text-foreground">Fix:</strong> Go to{' '}
                <a href="https://accounts.zoho.com/developerconsole" target="_blank" rel="noreferrer"
                  className="text-primary underline">accounts.zoho.com/developerconsole</a>
                {' '}→ your app → Client Secret → copy the value starting with{' '}
                <code className="text-primary">1000.</code> (~74 chars) → paste in{' '}
                <strong className="text-foreground">Settings → Secrets → ZOHO_CLIENT_SECRET</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 min-w-[80px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}>
              <t.icon size={13} />
              {t.label}
              {t.id === 'queue' && failedCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                  {failedCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── STATUS TAB ── */}
        {activeTab === 'status' && status && (
          <div className="space-y-4">
            {/* OAuth health */}
            <Card>
              <SectionTitle icon={Zap} label="OAuth2 Health" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Account ID',     ok: status.hasAccountId },
                  { label: 'Refresh Token',  ok: status.refreshTokenValid },
                  { label: 'Client Secret',  ok: status.clientSecretValid },
                ].map(({ label, ok }) => (
                  <div key={label} className={`p-3 rounded-lg border ${
                    ok ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
                  }`}>
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <StatusPill ok={ok} label={ok ? 'Configured' : 'Missing / Invalid'} />
                  </div>
                ))}
              </div>
              {status.clientSecretReason && (
                <p className="text-xs text-red-400 mt-3 p-2 bg-red-500/5 rounded-lg">
                  {status.clientSecretReason}
                </p>
              )}
            </Card>

            {/* Queue stats */}
            <Card>
              <SectionTitle icon={TrendingUp} label="Email Queue Stats" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Queued',   value: status.queue.queued,   color: 'text-yellow-400' },
                  { label: 'Retrying', value: status.queue.retrying, color: 'text-orange-400' },
                  { label: 'Sent',     value: status.queue.sent,     color: 'text-emerald-400' },
                  { label: 'Failed',   value: status.queue.failed,   color: 'text-red-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center p-3 bg-muted rounded-lg">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              {status.queue.lastSentAt && (
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                  Last delivery: {fmtDate(status.queue.lastSentAt)} ({fmtAge(status.queue.lastSentAt)})
                </p>
              )}
            </Card>

            {/* Sender info */}
            <Card>
              <SectionTitle icon={Mail} label="Sender Configuration" />
              <div className="space-y-2 text-sm">
                {[
                  ['Mode',        status.mode === 'oauth' ? 'OAuth2 (Zoho REST API)' : 'Manual SMTP'],
                  ['Sender',      status.senderEmail],
                  ['Sender Name', status.senderName],
                  ['SMTP Host',   status.manualHost ?? '—'],
                  ['SMTP Port',   String(status.manualPort)],
                  ['Updated',     fmtDate(status.updatedAt)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="text-foreground font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Force OAuth flush */}
            <Card>
              <SectionTitle icon={RotateCcw} label="Force OAuth Cache Flush & Queue Drain" />
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Clears the in-memory OAuth token cache, fetches a fresh access token using the current{' '}
                <code className="text-primary">ZOHO_REFRESH_TOKEN</code>, auto-requeues any exhausted emails,
                and immediately processes all pending emails in the queue. Use this after updating secrets without redeploying.
              </p>
              <div className="flex flex-wrap gap-3 mb-4">
                <button
                  onClick={flushOAuth}
                  disabled={flushLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <RotateCcw size={14} className={flushLoading ? 'animate-spin' : ''} />
                  {flushLoading ? 'Flushing…' : 'Flush OAuth Cache & Drain Queue'}
                </button>
                <button
                  onClick={requeueAll}
                  disabled={requeueLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/20 border border-secondary/30 text-secondary text-sm font-semibold hover:bg-secondary/30 transition-colors disabled:opacity-50"
                >
                  <RotateCcw size={14} className={requeueLoading ? 'animate-spin' : ''} />
                  {requeueLoading ? 'Requeueing…' : 'Requeue All Failed Emails'}
                </button>
              </div>

              {requeueResult && (
                <div className={`mb-3 p-3 rounded-lg border text-xs ${requeueResult.ok ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
                  {requeueResult.ok
                    ? `✅ Requeued ${requeueResult.requeued} failed email${requeueResult.requeued !== 1 ? 's' : ''} — they will be retried on the next flush or worker cycle`
                    : '❌ Requeue failed — check server logs'}
                </div>
              )}

              {flushResult && (
                <div className={`mt-2 p-4 rounded-xl border text-sm space-y-2 ${
                  flushResult.ok
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-red-500/5 border-red-500/20'
                }`}>
                  <p className={`font-semibold ${flushResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {flushResult.ok ? '✅ Flush succeeded' : '❌ Flush failed'}
                    <span className="text-muted-foreground font-normal ml-2 text-xs">({flushResult.durationMs}ms)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">OAuth</p>
                      <p>Token refreshed: <span className={flushResult.oauth.tokenRefreshed ? 'text-emerald-400' : 'text-red-400'}>{flushResult.oauth.tokenRefreshed ? 'Yes' : 'No'}</span></p>
                      {flushResult.oauth.tokenError && (
                        <p className="text-red-400 break-all">{flushResult.oauth.tokenError}</p>
                      )}
                      {flushResult.oauth.secretSources && (
                        <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                          {Object.entries(flushResult.oauth.secretSources).map(([k, v]) => (
                            <p key={k}><span className="text-foreground/50">{k}:</span> {String(v)}</p>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Queue</p>
                      {(flushResult.queue.requeuedExhausted ?? 0) > 0 && (
                        <p>Requeued exhausted: <span className="text-amber-400">{flushResult.queue.requeuedExhausted}</span></p>
                      )}
                      <p>Flushed: <span className="text-foreground">{flushResult.queue.flushed}</span></p>
                      <p>Sent: <span className="text-emerald-400">{flushResult.queue.sent}</span></p>
                      <p>Failed: <span className="text-red-400">{flushResult.queue.failed}</span></p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── CONFIG TAB ── */}
        {activeTab === 'config' && config && (
          <div className="space-y-5">
            {/* OAuth */}
            <Card>
              <SectionTitle icon={Zap} label="OAuth2 Credentials (Zoho)" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Client ID" value={config.oauthClientId}
                  onChange={v => setConfig(c => c ? { ...c, oauthClientId: v } : c)}
                  placeholder="1000.XXXXXXXX"
                  hint="From accounts.zoho.com/developerconsole" />
                <Field label="Client Secret" value={config.oauthClientSecret}
                  onChange={v => setConfig(c => c ? { ...c, oauthClientSecret: v } : c)}
                  placeholder="1000.XXXXXXXX…" type="password"
                  hint="Starts with 1000. — ~74 chars total" />
                <Field label="Refresh Token" value={config.oauthRefreshToken}
                  onChange={v => setConfig(c => c ? { ...c, oauthRefreshToken: v } : c)}
                  placeholder="1000.XXXXXXXX…" type="password"
                  hint="Obtained via OAuth flow at /api/zoho/connect"
                  className="md:col-span-2" />
              </div>
            </Card>

            {/* Manual SMTP */}
            <Card>
              <SectionTitle icon={Settings} label="Manual SMTP Fallback" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="SMTP Host" value={config.host}
                  onChange={v => setConfig(c => c ? { ...c, host: v } : c)}
                  placeholder="smtp.zoho.com" />
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Port</label>
                  <input type="number" value={config.port}
                    onChange={e => setConfig(c => c ? { ...c, port: parseInt(e.target.value) || 465 } : c)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
                  <p className="text-xs text-muted-foreground mt-1">465 (SSL) or 587 (TLS) — note: 587 may be blocked in production</p>
                </div>
                <Field label="Username" value={config.username}
                  onChange={v => setConfig(c => c ? { ...c, username: v } : c)}
                  placeholder="info@citygate.capital" />
                <Field label="Password" value={config.password}
                  onChange={v => setConfig(c => c ? { ...c, password: v } : c)}
                  placeholder="App password or SMTP password" type="password" />
                <Field label="Sender Email" value={config.senderEmail}
                  onChange={v => setConfig(c => c ? { ...c, senderEmail: v } : c)}
                  placeholder="info@citygate.capital" />
                <Field label="Sender Name" value={config.senderName}
                  onChange={v => setConfig(c => c ? { ...c, senderName: v } : c)}
                  placeholder="City Gate Capital" />
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Encryption</label>
                  <select value={config.encryption}
                    onChange={e => setConfig(c => c ? { ...c, encryption: e.target.value as 'ssl' | 'tls' | 'none' } : c)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary">
                    <option value="ssl">SSL (port 465)</option>
                    <option value="tls">TLS/STARTTLS (port 587)</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
                <button onClick={verifySmtp} disabled={verifying}
                  className="px-4 py-2 rounded-lg bg-muted border border-border text-xs font-semibold hover:bg-muted/80 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {verifying ? <RefreshCw size={12} className="animate-spin" /> : <Wifi size={12} />}
                  Verify SMTP Connection
                </button>
                {verifyMsg && (
                  <span className={`text-xs ${verifyMsg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>
                    {verifyMsg}
                  </span>
                )}
              </div>
            </Card>

            <div className="flex items-center gap-3">
              <button onClick={saveConfig} disabled={saving}
                className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                Save Configuration
              </button>
              {saveMsg && (
                <span className={`text-sm ${saveMsg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>
                  {saveMsg}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── TEST TAB ── */}
        {activeTab === 'test' && (
          <Card>
            <SectionTitle icon={Send} label="Email Test Center" />
            <p className="text-xs text-muted-foreground mb-4">
              Send test emails for every notification type to verify end-to-end delivery.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Field label="Recipient Email" value={testTo} onChange={setTestTo} placeholder="admin@citygate.capital" />
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Email Type</label>
                <select value={testType} onChange={e => setTestType(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary">
                  {EMAIL_TEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Force Transport</label>
                <select value={testMode} onChange={e => setTestMode(e.target.value as 'oauth' | 'manual' | 'auto')}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary">
                  <option value="auto">Auto (use active mode)</option>
                  <option value="oauth">Force OAuth2</option>
                  <option value="manual">Force Manual SMTP</option>
                </select>
              </div>
            </div>

            <button onClick={sendTest} disabled={testLoading || !testTo.includes('@')}
              className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
              {testLoading ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              {testLoading ? 'Sending…' : 'Send Test Email'}
            </button>

            {testResult && (
              <div className={`mt-4 p-4 rounded-xl border ${
                testResult.ok
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-red-500/5 border-red-500/20'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {testResult.ok
                    ? <CheckCircle size={14} className="text-emerald-400" />
                    : <XCircle size={14} className="text-red-400" />}
                  <span className={`text-sm font-bold ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {testResult.ok ? 'Delivered' : 'Failed'}
                  </span>
                  {testResult.transport && (
                    <span className="text-xs text-muted-foreground ml-auto">via {testResult.transport}</span>
                  )}
                  {testResult.durationMs && (
                    <span className="text-xs text-muted-foreground">{testResult.durationMs}ms</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground break-words">{testResult.message}</p>
              </div>
            )}
          </Card>
        )}

        {/* ── QUEUE TAB ── */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-sm font-semibold text-foreground">
                Email Logs ({logs.length})
                {failedCount > 0 && (
                  <span className="ml-2 text-red-400 text-xs">· {failedCount} failed</span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {failedCount > 0 && (
                  <button onClick={retryAllFailed} disabled={retryingAll}
                    className="px-3 py-1.5 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/25 text-xs font-semibold hover:bg-orange-500/25 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                    {retryingAll ? <RefreshCw size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                    Retry All Failed ({failedCount})
                  </button>
                )}
                <button onClick={fetchLogs}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <RefreshCw size={13} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {retryAllMsg && (
              <p className={`text-xs px-3 py-2 rounded-lg ${
                retryAllMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted text-muted-foreground'
              }`}>{retryAllMsg}</p>
            )}

            {logs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                <Inbox size={32} className="mx-auto mb-3 opacity-30" />
                No email logs yet. Send a test email to see entries here.
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className={`p-4 rounded-xl border ${
                    log.status === 'sent'     ? 'bg-card border-border' :
                    log.status === 'failed'   ? 'bg-red-500/5 border-red-500/20' :
                    log.status === 'retrying' ? 'bg-orange-500/5 border-orange-500/20' :
                    'bg-yellow-500/5 border-yellow-500/20'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <StatusPill ok={log.status === 'sent'} label={log.status} />
                          <span className="text-xs text-muted-foreground">
                            {log.attempts} attempt{log.attempts !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">{log.subject}</p>
                        <p className="text-xs text-muted-foreground">To: {log.to}</p>
                        {log.errorMessage && (
                          <p className="text-xs text-red-400 mt-1 break-words line-clamp-2">
                            {log.errorMessage}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{fmtDate(log.sentAt || log.createdAt)}</p>
                        {log.status === 'failed' && (
                          <button onClick={() => retryEmail(log.id)}
                            className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline ml-auto">
                            <RotateCcw size={10} /> Retry
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TEMPLATES TAB ── */}
        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Template list */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">System Templates</p>
              {templates.map(t => (
                <button key={t.id} onClick={() => selectTemplate(t)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedTemplate?.id === t.id
                      ? 'border-primary/40 bg-primary/8'
                      : 'border-border bg-card hover:border-border/80 hover:bg-muted/50'
                  }`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[t.category] ?? 'text-white/40 bg-white/5'}`}>
                      {t.category}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">
                    Updated {fmtAge(t.updatedAt)} by {t.updatedBy}
                  </p>
                </button>
              ))}
              {templates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <FileText size={24} className="mx-auto mb-2 opacity-30" />
                  Loading templates…
                </div>
              )}
            </div>

            {/* Template editor */}
            <div className="lg:col-span-2">
              {selectedTemplate ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-base font-bold text-foreground">{selectedTemplate.name}</h3>
                      <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
                        <input
                          value={testTemplateTo}
                          onChange={e => setTestTemplateTo(e.target.value)}
                          placeholder="test@email.com"
                          className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none w-36"
                        />
                        <button onClick={sendTestTemplate} disabled={testTemplateSending}
                          className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0">
                          {testTemplateSending ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />}
                          Send Test
                        </button>
                      </div>
                    </div>
                  </div>

                  {testTemplateMsg && (
                    <p className={`text-xs px-3 py-2 rounded-lg ${testTemplateMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {testTemplateMsg}
                    </p>
                  )}

                  {/* Variables reference */}
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTemplate.variables.map(v => (
                      <code key={v} className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">{v}</code>
                    ))}
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">Subject Line</label>
                    <input
                      value={editSubject}
                      onChange={e => setEditSubject(e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">Email Body (HTML)</label>
                    <textarea
                      value={editBody}
                      onChange={e => setEditBody(e.target.value)}
                      rows={14}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:border-primary resize-y"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={saveTemplateEdit} disabled={templateSaving}
                      className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
                      {templateSaving ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                      Save Template
                    </button>
                    <button onClick={resetTemplateToDefault} disabled={templateSaving}
                      className="px-4 py-2.5 rounded-lg bg-muted border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 flex items-center gap-2">
                      <RotateCw size={13} /> Reset to Default
                    </button>
                    {templateMsg && (
                      <span className={`text-sm ${templateMsg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>
                        {templateMsg}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <FileText size={32} className="mb-3 opacity-20" />
                  <p className="text-sm">Select a template to edit</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── EMAIL LOG TAB ── */}
        {activeTab === 'emaillog' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-card border border-border">
              <div>
                <label className="block text-xs text-muted-foreground mb-1 font-medium">Status</label>
                <select value={logFilter} onChange={e => setLogFilter(e.target.value as typeof logFilter)}
                  className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary">
                  <option value="all">All</option>
                  <option value="delivered">Delivered</option>
                  <option value="failed">Failed</option>
                  <option value="bounced">Bounced</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1 font-medium">Template</label>
                <input value={logTemplate} onChange={e => setLogTemplate(e.target.value)}
                  placeholder="e.g. welcome"
                  className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary w-36" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1 font-medium">From Date</label>
                <input type="date" value={logDateFrom} onChange={e => setLogDateFrom(e.target.value)}
                  className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1 font-medium">To Date</label>
                <input type="date" value={logDateTo} onChange={e => setLogDateTo(e.target.value)}
                  className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <button onClick={fetchEmailLog} disabled={logLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                <Filter size={13} className={logLoading ? 'animate-spin' : ''} />
                Apply
              </button>
              {emailLog.length > 0 && (
                <button onClick={exportEmailLog}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors ml-auto">
                  <Download size={13} /> Export CSV
                </button>
              )}
            </div>

            {/* Stats row */}
            {emailLog.length > 0 && (
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Total',     value: emailLog.length,                                          color: 'text-foreground' },
                  { label: 'Delivered', value: emailLog.filter(e => e.status === 'delivered').length,    color: 'text-emerald-400' },
                  { label: 'Failed',    value: emailLog.filter(e => e.status === 'failed').length,       color: 'text-red-400' },
                  { label: 'Bounced',   value: emailLog.filter(e => e.status === 'bounced').length,      color: 'text-orange-400' },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl bg-card border border-border text-center">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Log table */}
            {logLoading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw size={20} className="animate-spin text-primary" />
              </div>
            ) : emailLog.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                <BookOpen size={32} className="mx-auto mb-3 opacity-20" />
                No email log entries found. Adjust filters or send some emails first.
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      {['Recipient', 'Subject', 'Template', 'Status', 'Sent At'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {emailLog.map(entry => (
                      <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-foreground/80 font-medium">{entry.to}</td>
                        <td className="px-4 py-3 text-foreground/60 max-w-[200px] truncate">{entry.subject}</td>
                        <td className="px-4 py-3">
                          <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{entry.template}</code>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            entry.status === 'delivered' ? 'bg-emerald-500/15 text-emerald-400' :
                            entry.status === 'failed'    ? 'bg-red-500/15 text-red-400' :
                            entry.status === 'bounced'   ? 'bg-orange-500/15 text-orange-400' :
                            'bg-yellow-500/15 text-yellow-400'
                          }`}>
                            {entry.status === 'delivered' ? <CheckCircle size={9} /> :
                             entry.status === 'failed'    ? <XCircle size={9} /> :
                             <Clock size={9} />}
                            {entry.status}
                          </span>
                          {entry.errorMessage && (
                            <p className="text-[10px] text-red-400 mt-0.5 max-w-[160px] truncate">{entry.errorMessage}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(entry.sentAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── OVERRIDE TAB ── */}
        {activeTab === 'override' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-yellow-400" />
                <span className="text-sm font-bold text-yellow-400">Emergency Override Controls</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Use these controls to manually intervene on stuck user accounts.
                All actions are audit-logged with your admin ID.
              </p>
            </div>

            <Card>
              <SectionTitle icon={User} label="User Account Override" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="User ID" value={overrideUserId} onChange={setOverrideUserId}
                  placeholder="user_1234567890"
                  hint="Find in Admin → Users — click a user row to see their ID" />
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Action</label>
                  <select value={overrideAction} onChange={e => setOverrideAction(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary">
                    {OVERRIDE_ACTIONS.map(a => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button onClick={runOverride} disabled={overrideLoading || !overrideUserId.trim()}
                className="mt-4 px-5 py-2.5 rounded-lg bg-yellow-500/80 text-black text-sm font-bold hover:bg-yellow-500 transition-colors disabled:opacity-50 flex items-center gap-2">
                {overrideLoading ? <RefreshCw size={13} className="animate-spin" /> : <ArrowRight size={13} />}
                Execute Override
              </button>

              {overrideMsg && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  overrideMsg.startsWith('✅')
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  {overrideMsg}
                </div>
              )}
            </Card>

            {/* Quick reference */}
            <Card>
              <SectionTitle icon={AlertCircle} label="Action Reference" />
              <div className="space-y-2">
                {OVERRIDE_ACTIONS.map(a => (
                  <div key={a.value} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                    <code className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0">{a.value}</code>
                    <span className="text-xs text-muted-foreground">{
                      a.value === 'resend_verification' ? 'Generates a new token and resends the verification email.' :
                      a.value === 'manual_verify'       ? 'Marks email as verified without sending an email. Moves status to pending_kyc.' :
                      a.value === 'approve'             ? 'Sets KYC to approved, status to active, sends approval email.' :
                      a.value === 'activate'            ? 'Sets status to active without sending any email.' :
                      'Resends the welcome / account-under-review email.'
                    }</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
