/**
 * /admin/email — City Gate Capital Email Center
 *
 * Unified hub for all email operations:
 *   1.  SMTP Status          — live transport health (OAuth + manual)
 *   2.  Zoho Status          — OAuth token health, re-auth link
 *   3.  Templates            — edit all 10 system templates inline
 *   4.  OTP                  — pre-deployment & test OTP email
 *   5.  Password Reset       — pre-deployment & test password-reset email
 *   6.  Welcome              — pre-deployment & test welcome email
 *   7.  Security Alerts      — pre-deployment & test security-alert email
 *   8.  Transaction Emails   — pre-deployment & test transaction notification
 *   9.  Deposit Emails       — pre-deployment & test deposit confirmation
 *  10.  Withdrawal Emails    — pre-deployment & test withdrawal approval
 *  11.  Transfer Emails      — pre-deployment & test transfer sent/received
 *  12.  Newsletter           — link to /admin/newsletter
 *  13.  Send Test Email      — send any type to any address
 *  14.  Retry Failed Emails  — queue viewer + bulk retry
 *  15.  Email Logs           — full delivery log with filters
 */
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders,useAdminAuth } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
Activity,
AlertTriangle,
ArrowDownToLine,
ArrowLeftRight,
ArrowUpFromLine,
Bell,
Check,
CheckCircle,
ChevronRight,
CreditCard,
ExternalLink,
Eye,
Inbox,
Key,
Loader2,
Mail,
Newspaper,
RefreshCw,
RotateCcw,
Save,
Send,
Shield,
Trash2,
UserCheck,
Wifi,
X,
XCircle
} from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useCallback,useEffect,useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface SmtpStatus {
  mode: 'resend' | 'oauth' | 'manual';
  provider: 'resend' | 'zoho' | 'smtp';
  resendReady: boolean;
  providerHealthy: boolean;
  healthStatus: 'healthy' | 'configured_unverified' | 'degraded';
  oauthReady: boolean;
  manualReady: boolean;
  hasRefreshToken: boolean;
  hasClientSecret: boolean;
  refreshTokenValid: boolean;
  clientSecretValid: boolean;
  clientSecretReason?: string;
  queueSize: number;
  failedCount: number;
  lastSentAt: string | null;
  lastError: string | null;
}

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

interface EmailBrandingConfig {
  brandName: string;
  logoUrl: string;
  websiteUrl: string;
  websiteButtonLabel: string;
  supportEmail: string;
  supportPhone: string;
  postalAddress: string;
  primaryColor: string;
  footerMessage: string;
  updatedAt: string;
  updatedBy: string;
}

interface QueueItem {
  id: string;
  to: string;
  subject: string;
  status: 'pending' | 'failed' | 'sent';
  attempts: number;
  lastAttempt: string | null;
  error: string | null;
  createdAt: string;
}

interface LogEntry {
  id: string;
  to: string;
  subject: string;
  status: 'sent' | 'failed' | 'bounced';
  transport: string;
  ts: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'status',      label: 'Status',         icon: Wifi },
  { id: 'templates',   label: 'Templates',      icon: Mail },
  { id: 'test',        label: 'Send Test',      icon: Send },
  { id: 'queue',       label: 'Queue & Retry',  icon: RotateCcw },
  { id: 'logs',        label: 'Email Logs',     icon: Activity },
] as const;
type TabId = typeof TABS[number]['id'];

const TEST_TYPES = [
  { id: 'connectivity',    label: 'Connectivity',      icon: Wifi,            color: '#10B981' },
  { id: 'otp',             label: 'OTP Code',           icon: Key,             color: '#C9A84C' },
  { id: 'password_reset',  label: 'Password Reset',     icon: Shield,          color: '#8B5CF6' },
  { id: 'verification',    label: 'Verification',       icon: UserCheck,       color: '#06B6D4' },
  { id: 'transaction',     label: 'Transaction',        icon: CreditCard,      color: '#10B981' },
  { id: 'login_alert',     label: 'Login Alert',        icon: Bell,            color: '#F59E0B' },
  { id: 'withdrawal',      label: 'Withdrawal',         icon: ArrowUpFromLine, color: '#EF4444' },
  { id: 'admin_alert',     label: 'Admin Alert',        icon: AlertTriangle,   color: '#F97316' },
] as const;

const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  welcome:              UserCheck,
  email_verification:   UserCheck,
  kyc_approved:         CheckCircle,
  kyc_rejected:         XCircle,
  deposit_confirmed:    ArrowDownToLine,
  withdrawal_approved:  ArrowUpFromLine,
  transfer_sent:        ArrowLeftRight,
  transfer_received:    ArrowLeftRight,
  password_reset:       Shield,
  two_fa_code:          Key,
  security_alert:       Bell,
  login_alert:          Bell,
  support_reply:        Mail,
};

const TEMPLATE_COLORS: Record<string, string> = {
  welcome:              '#10B981',
  kyc_approved:         '#10B981',
  kyc_rejected:         '#EF4444',
  deposit_confirmed:    '#06B6D4',
  withdrawal_approved:  '#F59E0B',
  transfer_sent:        '#8B5CF6',
  transfer_received:    '#8B5CF6',
  password_reset:       '#C9A84C',
  two_fa_code:          '#C9A84C',
  security_alert:       '#F97316',
};

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────
function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
      className={`fixed top-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl ${
        ok ? 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400' : 'bg-red-500/15 border-red-500/20 text-red-400'
      }`}>
      {ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
      {msg}
    </motion.div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
      ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Status
// ─────────────────────────────────────────────────────────────────────────────
function StatusTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [status,   setStatus]   = useState<SmtpStatus | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const r = await fetch('/api/admin/email/status', { headers: authHeaders(), signal: controller.signal });
      if (!r.ok) throw new Error(`Status request failed (${r.status})`);
      setStatus(await r.json());
    } catch (error) {
      setStatus(null);
      setLoadError(error instanceof DOMException && error.name === 'AbortError'
        ? 'The email diagnostics request timed out. No delivery settings were changed.'
        : error instanceof Error ? error.message : 'Email diagnostics are temporarily unavailable.');
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function retryFailed() {
    setRetrying(true);
    const r = await fetch('/api/admin/email/flush', { method: 'POST', headers: authHeaders() });
    const d = await r.json();
    setRetrying(false);
    showToast(d.message ?? (r.ok ? 'Retry queued' : 'Retry failed'), r.ok);
    if (r.ok) load();
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 size={20} className="animate-spin text-white/20" />
    </div>
  );

  if (!status) return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-400/15 bg-red-400/5 p-4 text-red-300 text-sm">
      <AlertTriangle size={14} />
      <span>{loadError ?? 'Failed to load email diagnostics.'}</span>
      <button type="button" onClick={load} className="ml-auto rounded-lg border border-red-300/20 px-3 py-1.5 text-xs font-semibold hover:bg-red-300/10">
        Retry
      </button>
    </div>
  );

  const smtpOk  = status.providerHealthy;
  const zohoOk  = status.oauthReady && status.hasRefreshToken && status.refreshTokenValid;

  return (
    <div className="space-y-4 pt-4">
      {/* Transport health cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* SMTP */}
        <div className="rounded-2xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wifi size={14} className={smtpOk ? 'text-emerald-400' : 'text-red-400'} />
              <p className="text-white font-semibold text-sm">Production Delivery</p>
            </div>
            <StatusPill ok={smtpOk} label={smtpOk ? 'Healthy' : status.resendReady ? 'Configured · unverified' : 'Degraded'} />
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-white/30">Provider</span>
              <span className="text-white/70 font-mono uppercase">{status.resendReady ? 'Resend HTTPS API' : status.mode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/30">Queue size</span>
              <span className={`font-mono ${status.queueSize > 0 ? 'text-amber-400' : 'text-white/70'}`}>{status.queueSize}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/30">Failed</span>
              <span className={`font-mono ${status.failedCount > 0 ? 'text-red-400' : 'text-white/70'}`}>{status.failedCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/30">Last sent</span>
              <span className="text-white/50 font-mono text-[10px]">
                {status.lastSentAt ? new Date(status.lastSentAt).toLocaleString() : '—'}
              </span>
            </div>
          </div>
          {status.lastError && (
            <div className="mt-3 px-3 py-2 rounded-xl bg-red-500/8 border border-red-500/15 text-red-400 text-[10px] font-mono break-all">
              {status.lastError}
            </div>
          )}
        </div>

        {/* Zoho OAuth */}
        <div className="rounded-2xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield size={14} className={zohoOk ? 'text-emerald-400' : 'text-amber-400'} />
              <p className="text-white font-semibold text-sm">Zoho Sending API</p>
            </div>
            <StatusPill ok={status.resendReady || zohoOk} label={zohoOk ? 'Authorised' : status.resendReady ? 'Optional' : 'Needs Auth'} />
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-white/30">Refresh token</span>
              <StatusPill ok={status.hasRefreshToken && status.refreshTokenValid} label={status.hasRefreshToken ? (status.refreshTokenValid ? 'Valid' : 'Invalid') : 'Missing'} />
            </div>
            <div className="flex justify-between">
              <span className="text-white/30">Client secret</span>
              <StatusPill ok={status.hasClientSecret && status.clientSecretValid} label={status.hasClientSecret ? (status.clientSecretValid ? 'Valid' : 'Invalid') : 'Missing'} />
            </div>
            {status.clientSecretReason && (
              <p className="text-amber-400/60 text-[10px] pt-1">{status.clientSecretReason}</p>
            )}
          </div>
          {!zohoOk && !status.resendReady && (
            <Link to="/admin/zoho-setup"
              className="mt-3 flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-colors">
              <ExternalLink size={11} /> Re-authorise Zoho
            </Link>
          )}
          {!zohoOk && status.resendReady && (
            <p className="mt-3 text-white/30 text-[10px] leading-relaxed">
              Outgoing email uses Resend. Zoho OAuth is optional and does not affect the active production provider or Zoho-hosted inboxes.
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/50 text-sm hover:text-white transition-colors">
          <RefreshCw size={12} /> Refresh Status
        </button>
        {status.failedCount > 0 && (
          <button onClick={retryFailed} disabled={retrying}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-semibold hover:bg-amber-500/20 transition-colors disabled:opacity-50">
            {retrying ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            Retry {status.failedCount} Failed
          </button>
        )}
        <Link to="/admin/smtp"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/50 text-sm hover:text-white transition-colors">
          <ExternalLink size={12} /> Full SMTP Config
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Templates
// ─────────────────────────────────────────────────────────────────────────────
function TemplatesTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [branding,  setBranding]  = useState<EmailBrandingConfig | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState<EmailTemplate | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [preview,   setPreview]   = useState(false);
  const [testTo,    setTestTo]    = useState('admin@citygate.capital');
  const [testingTemplate, setTestingTemplate] = useState(false);

  useEffect(() => {
    fetch('/api/admin/email/templates', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.templates) setTemplates(d.templates);
        if (d?.branding) setBranding(d.branding);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!editing) return;
    setSaving(true);
    const r = await fetch('/api/admin/email/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id: editing.id, subject: editing.subject, body: editing.body }),
    });
    const d = await r.json();
    setSaving(false);
    if (r.ok) {
      showToast('Template saved');
      setTemplates(prev => prev.map(t => t.id === editing.id ? { ...t, subject: editing.subject, body: editing.body } : t));
      setEditing(null);
    } else showToast(d.error ?? 'Save failed', false);
  }

  async function saveBranding() {
    if (!branding) return;
    setSavingBranding(true);
    const r = await fetch('/api/admin/email/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ kind: 'branding', branding }),
    });
    const d = await r.json();
    setSavingBranding(false);
    if (r.ok && d.branding) {
      setBranding(d.branding);
      showToast('Email branding and website link saved');
    } else showToast(d.error ?? 'Branding save failed', false);
  }

  function patchBranding<K extends keyof EmailBrandingConfig>(key: K, value: EmailBrandingConfig[K]) {
    setBranding(current => current ? { ...current, [key]: value } : current);
  }

  async function sendTemplateTest() {
    if (!editing || !testTo.trim()) return;
    setTestingTemplate(true);
    const r = await fetch('/api/admin/smtp/test-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ templateId: editing.id, to: testTo.trim() }),
    });
    const d = await r.json();
    setTestingTemplate(false);
    showToast(d.message ?? d.error ?? (r.ok ? 'Template test sent' : 'Template test failed'), r.ok);
  }

  const CATEGORY_ORDER = ['account', 'auth', 'kyc', 'transaction', 'security'];
  const grouped = CATEGORY_ORDER.reduce<Record<string, EmailTemplate[]>>((acc, cat) => {
    acc[cat] = templates.filter(t => t.category === cat);
    return acc;
  }, {});

  const CATEGORY_LABELS: Record<string, string> = {
    account: 'Account', auth: 'Authentication', kyc: 'KYC & Compliance',
    transaction: 'Transactions', security: 'Security',
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-white/20" /></div>;

  if (editing) {
    const Icon  = TEMPLATE_ICONS[editing.id] ?? Mail;
    const color = TEMPLATE_COLORS[editing.id] ?? '#C9A84C';
    return (
      <div className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
              <Icon size={13} style={{ color }} />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{editing.name}</p>
              <p className="text-white/30 text-[10px]">{editing.description}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPreview(p => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition-colors ${
                preview ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/8 text-white/40 hover:text-white'
              }`}>
              <Eye size={11} /> {preview ? 'Edit' : 'Example'}
            </button>
            <button onClick={() => setEditing(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/8 text-white/40 text-xs hover:text-white">
              <X size={11} /> Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/20 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/30 disabled:opacity-50">
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save
            </button>
          </div>
        </div>

        {/* Variables */}
        <div className="flex flex-wrap gap-1.5">
          {editing.variables.map(v => (
            <span key={v} className="px-2 py-0.5 rounded-lg bg-white/[0.04] border border-white/8 text-white/40 text-[10px] font-mono">{v}</span>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <label className="flex-1 min-w-[240px]">
            <span className="text-white/30 text-[10px] uppercase tracking-wide mb-1 block">Send this template as a test</span>
            <input type="email" value={testTo} onChange={event => setTestTo(event.target.value)}
              placeholder="admin@citygate.capital"
              className="w-full bg-black/20 border border-white/8 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-primary/40" />
          </label>
          <button onClick={sendTemplateTest} disabled={testingTemplate || !testTo.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/25 bg-primary/10 text-primary text-xs font-semibold disabled:opacity-50">
            {testingTemplate ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
            Send Test
          </button>
        </div>

        {preview ? (
          <div className="rounded-2xl border border-white/5 overflow-hidden bg-[#0A0A0A]">
            <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02]">
              <p className="text-white/50 text-xs"><span className="text-white/25">Subject: </span>{editing.subject}</p>
            </div>
            {branding && (
              <div className="p-5 border-b border-white/5 bg-black flex justify-center">
                <img src={branding.logoUrl} alt={branding.brandName} className="max-h-24 max-w-[360px] w-full object-contain" />
              </div>
            )}
            <div className="p-6">
              <h2 className="text-white text-xl font-semibold mb-4">{editing.name}</h2>
              {/* Administrator-authored HTML must never execute in the admin
                  panel. An empty sandbox denies scripts AND same-origin, so
                  template bodies (including pasted or stored HTML) cannot touch
                  admin cookies or CSRF tokens even in dev CSP mode. */}
              <iframe
                title={`${editing.name} preview`}
                sandbox=""
                srcDoc={`<!doctype html><html><body style="margin:0;font-family:Inter,Arial,sans-serif;color:#d0d0d0;font-size:14px;line-height:1.7;">${editing.body}</body></html>`}
                className="w-full border-0"
                style={{ minHeight: 320 }}
              />
              {branding && (
                <div className="text-center mt-7">
                  <a href={branding.websiteUrl} target="_blank" rel="noreferrer"
                    className="inline-flex px-5 py-2.5 rounded-lg text-black text-xs font-bold"
                    style={{ backgroundColor: branding.primaryColor }}>
                    {branding.websiteButtonLabel}
                  </a>
                  <p className="text-white/25 text-[10px] mt-4">{branding.footerMessage}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Subject Line</label>
              <input value={editing.subject} onChange={e => setEditing(prev => prev ? { ...prev, subject: e.target.value } : prev)}
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
            </div>
            <div>
              <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">HTML Body</label>
              <textarea value={editing.body} rows={14}
                onChange={e => setEditing(prev => prev ? { ...prev, body: e.target.value } : prev)}
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-xs font-mono focus:outline-none focus:border-primary/40 resize-y" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pt-4 space-y-5">
      {branding && (
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-white font-semibold text-sm">Email Branding & Banking Website</p>
              <p className="text-white/35 text-xs mt-1">Applied to every production email. The logo and website button are clickable.</p>
            </div>
            <button onClick={saveBranding} disabled={savingBranding}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/20 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/30 disabled:opacity-50">
              {savingBranding ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              Save Branding
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {([
              ['brandName', 'Brand Name', 'City Gate Capital'],
              ['logoUrl', 'Email Logo URL', 'https://citygate.capital/assets/brand/city-gate-capital-horizontal.png'],
              ['websiteUrl', 'Banking Website URL', 'https://citygate.capital'],
              ['websiteButtonLabel', 'Website Button Text', 'Open City Gate Capital'],
              ['supportEmail', 'Support Email', 'support@citygate.capital'],
              ['supportPhone', 'Support Phone', '+44 7888 382458'],
              ['postalAddress', 'Postal Address', 'Business address pending verification'],
              ['primaryColor', 'Primary Color', '#C9A84C'],
            ] as Array<[keyof EmailBrandingConfig, string, string]>).map(([key, label, placeholder]) => (
              <label key={key} className={key === 'logoUrl' || key === 'postalAddress' ? 'md:col-span-2' : ''}>
                <span className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">{label}</span>
                <input value={String(branding[key] ?? '')} placeholder={placeholder}
                  onChange={event => patchBranding(key, event.target.value as never)}
                  className="w-full bg-black/20 border border-white/8 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-primary/40" />
              </label>
            ))}
          </div>

          <label className="block">
            <span className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Footer Message</span>
            <textarea value={branding.footerMessage} rows={3}
              onChange={event => patchBranding('footerMessage', event.target.value)}
              placeholder="Message displayed in the footer of every system email."
              className="w-full bg-black/20 border border-white/8 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-primary/40 resize-y" />
          </label>

          <div className="rounded-xl border border-white/8 bg-[#0b0b0b] p-4">
            <p className="text-white/25 text-[10px] uppercase tracking-widest mb-3">Live Branding Example</p>
            <div className="flex flex-col items-center text-center gap-3">
              <a href={branding.websiteUrl} target="_blank" rel="noreferrer" className="block">
                <img src={branding.logoUrl} alt={branding.brandName} className="max-h-24 max-w-full object-contain" />
              </a>
              <a href={branding.websiteUrl} target="_blank" rel="noreferrer"
                className="inline-flex px-5 py-2.5 rounded-lg text-black text-xs font-bold"
                style={{ backgroundColor: branding.primaryColor }}>
                {branding.websiteButtonLabel}
              </a>
              <p className="text-white/35 text-xs">{branding.footerMessage}</p>
              <p className="text-white/20 text-[10px]">{branding.supportEmail} · {branding.websiteUrl}</p>
            </div>
          </div>
        </div>
      )}

      {CATEGORY_ORDER.map(cat => {
        const items = grouped[cat];
        if (!items?.length) return null;
        return (
          <div key={cat}>
            <p className="text-white/25 text-[10px] uppercase tracking-widest mb-2">{CATEGORY_LABELS[cat]}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map(t => {
                const Icon  = TEMPLATE_ICONS[t.id] ?? Mail;
                const color = TEMPLATE_COLORS[t.id] ?? '#C9A84C';
                return (
                  <button key={t.id} onClick={() => setEditing(t)}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/5 hover:border-white/10 hover:bg-white/[0.03] transition-all text-left group">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
                      <Icon size={14} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-sm font-medium">{t.name}</p>
                      <p className="text-white/30 text-[10px] truncate">{t.description}</p>
                    </div>
                    <ChevronRight size={12} className="text-white/20 group-hover:text-white/50 transition-colors shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Send Test Email
// ─────────────────────────────────────────────────────────────────────────────
function TestTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [to,       setTo]       = useState('');
  const [type,     setType]     = useState('connectivity');
  const [sending,  setSending]  = useState(false);
  const [result,   setResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  async function send() {
    if (!to.trim()) { showToast('Enter a recipient email', false); return; }
    setSending(true); setResult(null);
    const r = await fetch('/api/admin/smtp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ to: to.trim(), type }),
    });
    const d = await r.json();
    setSending(false);
    const ok = r.ok && !d.error;
    setResult({ ok, msg: d.message ?? d.error ?? (ok ? 'Test email sent' : 'Send failed') });
    showToast(ok ? `Test email sent to ${to}` : (d.error ?? 'Send failed'), ok);
  }

  return (
    <div className="pt-4 space-y-5">
      {/* Email type grid */}
      <div>
        <p className="text-white/30 text-[10px] uppercase tracking-wide mb-3">Email Type</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {TEST_TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                type === t.id
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-white/8 bg-white/[0.02] text-white/40 hover:bg-white/[0.05] hover:text-white/70'
              }`}>
              <t.icon size={12} style={{ color: type === t.id ? undefined : t.color }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recipient */}
      <div>
        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Recipient Address</label>
        <div className="flex gap-2">
          <input type="email" value={to} onChange={e => setTo(e.target.value)}
            placeholder="admin@citygate.capital"
            className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
          <button onClick={send} disabled={sending || !to.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)', color: '#000' }}>
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Send
          </button>
        </div>
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
              result.ok
                ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/8 border-red-500/20 text-red-400'
            }`}>
            {result.ok ? <CheckCircle size={14} className="shrink-0 mt-0.5" /> : <XCircle size={14} className="shrink-0 mt-0.5" />}
            <span>{result.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Template pre-deployment cards */}
      <div>
        <p className="text-white/25 text-[10px] uppercase tracking-widest mb-3">Transactional Template Quick-Send</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { id: 'otp',            label: 'OTP Code',           icon: Key,             color: '#C9A84C', desc: 'Two-factor authentication code' },
            { id: 'password_reset', label: 'Password Reset',     icon: Shield,          color: '#8B5CF6', desc: 'Reset link for customer accounts' },
            { id: 'verification',   label: 'Email Verification', icon: UserCheck,       color: '#06B6D4', desc: 'Account email verification' },
            { id: 'transaction',    label: 'Transaction Alert',  icon: CreditCard,      color: '#10B981', desc: 'Payment / transaction notification' },
            { id: 'login_alert',    label: 'Security Alert',     icon: Bell,            color: '#F59E0B', desc: 'New device / suspicious login' },
            { id: 'withdrawal',     label: 'Withdrawal',         icon: ArrowUpFromLine, color: '#EF4444', desc: 'Withdrawal approved notification' },
          ].map(item => (
            <button key={item.id} onClick={() => { setType(item.id); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left ${
                type === item.id ? 'border-primary/20 bg-primary/5' : 'border-white/5 hover:border-white/10 hover:bg-white/[0.02]'
              }`}>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${item.color}15` }}>
                <item.icon size={13} style={{ color: item.color }} />
              </div>
              <div>
                <p className="text-white/70 text-xs font-medium">{item.label}</p>
                <p className="text-white/25 text-[10px]">{item.desc}</p>
              </div>
              {type === item.id && <Check size={11} className="text-primary ml-auto shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Queue & Retry
// ─────────────────────────────────────────────────────────────────────────────
function QueueTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [items,    setItems]    = useState<QueueItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<'all' | 'failed' | 'pending'>('all');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [flushing, setFlushing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/email/queue?view=logs&limit=100', { headers: authHeaders() });
    if (r.ok) {
      const d = await r.json();
      setItems(d.items ?? d.queue ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function retryOne(id: string) {
    setRetrying(id);
    const r = await fetch('/api/admin/email/queue/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id }),
    });
    const d = await r.json();
    setRetrying(null);
    showToast(d.message ?? (r.ok ? 'Retry queued' : 'Retry failed'), r.ok);
    if (r.ok) load();
  }

  async function retryAll() {
    setFlushing(true);
    const r = await fetch('/api/admin/email/flush', { method: 'POST', headers: authHeaders() });
    const d = await r.json();
    setFlushing(false);
    showToast(d.message ?? (r.ok ? 'All failed emails re-queued' : 'Flush failed'), r.ok);
    if (r.ok) load();
  }

  async function deleteItem(id: string) {
    const r = await fetch(`/api/admin/email/queue/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok) { showToast('Item removed'); load(); }
    else showToast('Delete failed', false);
  }

  const filtered = items.filter(i => filter === 'all' || i.status === filter);
  const failedCount = items.filter(i => i.status === 'failed').length;

  const STATUS_STYLE: Record<string, string> = {
    pending: 'bg-amber-500/15 text-amber-400',
    failed:  'bg-red-500/15 text-red-400',
    sent:    'bg-emerald-500/15 text-emerald-400',
  };

  return (
    <div className="pt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {(['all', 'failed', 'pending'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-colors ${
                filter === f ? 'bg-primary/15 text-primary border border-primary/20' : 'text-white/40 hover:text-white border border-transparent'
              }`}>
              {f} {f === 'failed' && failedCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[9px]">{failedCount}</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/8 text-white/40 text-xs hover:text-white">
            <RefreshCw size={11} /> Refresh
          </button>
          {failedCount > 0 && (
            <button onClick={retryAll} disabled={flushing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 disabled:opacity-50">
              {flushing ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
              Retry All Failed ({failedCount})
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={18} className="animate-spin text-white/20" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-white/20">
          <Inbox size={24} />
          <p className="text-sm">{filter === 'all' ? 'Queue is empty' : `No ${filter} emails`}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Recipient', 'Subject', 'Status', 'Attempts', 'Created', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-white/25 text-[10px] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white/70 text-xs font-mono">{item.to}</td>
                  <td className="px-4 py-3 text-white/50 text-xs max-w-[200px] truncate">{item.subject}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[item.status] ?? 'bg-white/10 text-white/40'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs font-mono">{item.attempts}</td>
                  <td className="px-4 py-3 text-white/30 text-[10px] whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {item.status === 'failed' && (
                        <button onClick={() => retryOne(item.id)} disabled={retrying === item.id}
                          className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/20 transition-colors">
                          {retrying === item.id ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                        </button>
                      )}
                      <button onClick={() => deleteItem(item.id)}
                        className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/20 transition-colors">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Email Logs
// ─────────────────────────────────────────────────────────────────────────────
function LogsTab() {
  const [logs,    setLogs]    = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [status,  setStatus]  = useState('');
  const [page,    setPage]    = useState(1);
  const [total,   setTotal]   = useState(0);
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search) p.set('search', search);
    if (status) p.set('status', status);
    const r = await fetch(`/api/admin/email/log?${p}`, { headers: authHeaders() });
    if (r.ok) {
      const d = await r.json();
      setLogs(d.data ?? d.logs ?? []);
      setTotal(d.total ?? 0);
    }
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  const STATUS_STYLE: Record<string, string> = {
    sent:    'bg-emerald-500/15 text-emerald-400',
    failed:  'bg-red-500/15 text-red-400',
    bounced: 'bg-amber-500/15 text-amber-400',
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="pt-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Mail size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search recipient or subject..."
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-8 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
          <option value="" className="bg-[#0A0A0A]">All Statuses</option>
          <option value="sent"    className="bg-[#0A0A0A]">Sent</option>
          <option value="failed"  className="bg-[#0A0A0A]">Failed</option>
          <option value="bounced" className="bg-[#0A0A0A]">Bounced</option>
        </select>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-white/8 text-white/40 text-sm hover:text-white">
          <RefreshCw size={12} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={18} className="animate-spin text-white/20" /></div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-white/20">
          <Activity size={24} />
          <p className="text-sm">No log entries found</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Recipient', 'Subject', 'Status', 'Transport', 'Time'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-white/25 text-[10px] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white/70 text-xs font-mono">{log.to}</td>
                    <td className="px-4 py-3 text-white/50 text-xs max-w-[200px] truncate">{log.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[log.status] ?? 'bg-white/10 text-white/40'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/30 text-[10px] font-mono">{log.transport ?? '—'}</td>
                    <td className="px-4 py-3 text-white/30 text-[10px] whitespace-nowrap">
                      {new Date(log.ts).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-white/25 text-xs">
              {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} of {total.toLocaleString()}
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-xl border border-white/8 text-white/40 text-xs disabled:opacity-30 hover:bg-white/[0.04]">
                Prev
              </button>
              <span className="flex items-center px-3 text-white/30 text-xs">{page} / {pages || 1}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
                className="px-3 py-1.5 rounded-xl border border-white/8 text-white/40 text-xs disabled:opacity-30 hover:bg-white/[0.04]">
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminEmailCenter() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [tab,   setTab]   = useState<TabId>('status');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4500);
  };

  return (
    <>
      <Helmet>
        <title>Email Center — CGC Admin</title>
        <meta name="description" content="Manage all email delivery, templates, queue, and logs." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/admin/email" />
      </Helmet>
      <AdminLayout title="Email Center">

        <AnimatePresence>{toast && <Toast {...toast} />}</AnimatePresence>

        {/* ── Page header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">Email Center</h1>
            <p className="text-white/30 text-sm">Delivery, templates, queue management, and logs</p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/smtp"
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/50 text-sm hover:text-white transition-colors">
              <ExternalLink size={12} /> SMTP Config
            </Link>
            <Link to="/admin/zoho-setup"
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/50 text-sm hover:text-white transition-colors">
              <ExternalLink size={12} /> Zoho OAuth
            </Link>
            <Link to="/admin/newsletter"
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/50 text-sm hover:text-white transition-colors">
              <Newspaper size={12} /> Newsletter
            </Link>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex gap-1 mb-6 p-1 rounded-2xl border border-white/5 w-fit" style={{ background: 'rgba(255,255,255,0.02)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-primary/15 text-primary border border-primary/20'
                  : 'text-white/40 hover:text-white/70'
              }`}>
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            {tab === 'status'    && <StatusTab    showToast={showToast} />}
            {tab === 'templates' && <TemplatesTab showToast={showToast} />}
            {tab === 'test'      && <TestTab      showToast={showToast} />}
            {tab === 'queue'     && <QueueTab     showToast={showToast} />}
            {tab === 'logs'      && <LogsTab />}
          </motion.div>
        </AnimatePresence>

      </AdminLayout>
    </>
  );
}
