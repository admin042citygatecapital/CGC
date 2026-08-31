/**
 * /admin/security — Security Center
 * 10 tabs: Roles · Permissions · 2FA · Sessions · Devices
 *          Login History · Audit Logs · Security Alerts · IP Restrictions · Rate Limits
 */
import AdminLayout from '@/layouts/AdminLayout';
import { adminFetch,useAdminAuth } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
Activity,
AlertTriangle,
Ban,
Bot,
CheckCheck,
CheckCircle2,
ChevronLeft,ChevronRight,
Clock,
Download,
Edit3,
FileText,
Globe,
Loader2,
Lock,
LogOut,
Monitor,
RefreshCw,
Save,
ShieldAlert,
ShieldCheck,
ShieldOff,
Smartphone,
Tablet,
Terminal,
ToggleLeft,ToggleRight,
Trash2,
Users,
X,
XCircle,
Zap
} from 'lucide-react';
import { useCallback,useEffect,useState } from 'react';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtRelative(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60_000)    return `${Math.floor(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}
function fmtMs(ms: number) {
  if (ms < 1000)    return `${ms}ms`;
  if (ms < 60_000)  return `${(ms / 1000).toFixed(0)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(0)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function SeverityBadge({ sev }: { sev: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    critical: { cls: 'bg-red-500/15 text-red-400 border-red-500/20',    label: 'Critical' },
    high:     { cls: 'bg-orange-500/15 text-orange-400 border-orange-500/20', label: 'High' },
    medium:   { cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20',    label: 'Medium' },
    low:      { cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20',       label: 'Low' },
    info:     { cls: 'bg-white/5 text-white/40 border-white/10',              label: 'Info' },
  };
  const c = cfg[sev] ?? cfg.info;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${c.cls}`}>{c.label}</span>;
}

function RiskBadge({ risk }: { risk: string }) {
  const cfg: Record<string, string> = {
    critical: 'text-red-400 bg-red-400/10',
    high:     'text-orange-400 bg-orange-400/10',
    medium:   'text-amber-400 bg-amber-400/10',
    low:      'text-emerald-400 bg-emerald-400/10',
  };
  return <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cfg[risk] ?? 'text-white/30 bg-white/5'}`}>{risk}</span>;
}

function DeviceIcon({ device }: { device: string }) {
  if (device === 'mobile')  return <Smartphone size={12} />;
  if (device === 'tablet')  return <Tablet size={12} />;
  if (device === 'bot')     return <Bot size={12} />;
  return <Monitor size={12} />;
}

function Pill({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${active ? 'text-black font-bold' : 'text-white/40 hover:text-white/70 border border-white/8'}`}
      style={active ? { background: 'linear-gradient(135deg,#C9A84C,#F0D080)' } : {}}>
      {children}
    </button>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${className}`}
      style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">{children}</p>;
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-white/20">
      <Icon size={32} className="mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-2 justify-center pt-4">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1}
        className="w-8 h-8 rounded-xl border border-white/8 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-30 transition-colors">
        <ChevronLeft size={14} />
      </button>
      <span className="text-white/40 text-xs">Page {page} of {pages}</span>
      <button onClick={() => onPage(page + 1)} disabled={page >= pages}
        className="w-8 h-8 rounded-xl border border-white/8 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-30 transition-colors">
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'roles' | 'permissions' | '2fa' | 'sessions' | 'devices'
         | 'login-history' | 'audit-logs' | 'alerts' | 'ip-restrictions' | 'rate-limits';

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: '2fa',             label: '2FA Policy',      icon: ShieldCheck },
  { id: 'sessions',        label: 'Sessions',        icon: Activity },
  { id: 'devices',         label: 'Devices',         icon: Smartphone },
  { id: 'login-history',   label: 'Login History',   icon: Clock },
  { id: 'audit-logs',      label: 'Audit Logs',      icon: FileText },
  { id: 'alerts',          label: 'Security Alerts', icon: AlertTriangle },
  { id: 'ip-restrictions', label: 'IP Restrictions', icon: Globe },
  { id: 'rate-limits',     label: 'Rate Limits',     icon: Zap },
];

// ─── Data types ───────────────────────────────────────────────────────────────

interface Role {
  id: string; name: string; label: string; description: string;
  permissions: string[]; isSystem: boolean; color: string;
  createdAt: string; updatedAt: string;
}
interface PermissionDef {
  key: string; label: string; description: string; group: string; risk: string;
}
interface TwoFAPolicy {
  mandatoryForAll: boolean; mandatoryForWithdrawals: boolean;
  withdrawalThreshold: number; mandatoryForWires: boolean;
  updatedAt: string; updatedBy?: string;
}
interface AdminSession {
  token: string; adminId: string; email: string;
  createdAt: string; lastSeenAt: string; ip: string; ua: string;
}
interface TrustedDevice {
  id: string; adminId: string; email: string; name: string;
  ip: string; ua: string; createdAt: string; expiresAt: string; lastUsedAt: string;
}
interface LoginEvent {
  id: string; ts: string; actor: string; email: string;
  result: string; ip: string; ua: string; device: string;
  browser: string; os: string; country: string; reason?: string;
}
interface AuditEntry {
  id: string; ts: string; event: string; adminId?: string;
  userId?: string; email?: string; ip?: string; reason?: string;
  meta?: Record<string, unknown>;
}
interface SecurityAlert {
  id: string; ts: string; type: string; severity: string;
  title: string; detail: string; ip?: string; resolved: boolean;
  resolvedAt?: string; resolvedBy?: string;
}
interface IpEntry { ip: string; note?: string; addedBy?: string; addedAt: string; }
interface CountryBlock { code: string; name: string; blockedAt: string; addedBy?: string; }
interface IpLists {
  blacklist: IpEntry[]; whitelist: IpEntry[];
  countryBlocks: CountryBlock[]; vpnDetection: string;
}
interface RateLimitRule {
  id: string; label: string; description: string; path: string;
  windowMs: number; max: number; enabled: boolean; isSystem: boolean; updatedAt: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SecurityCenter() {
  const { admin } = useAdminAuth();
  const [tab, setTab] = useState<Tab>('2fa');
  const [loading, setLoading] = useState(false);

  async function api<T>(url: string, opts?: RequestInit): Promise<T> {
    const headers = new Headers(opts?.headers);
    headers.set('Content-Type', 'application/json');
    const res = await adminFetch(url, { ...opts, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }

  // ── Roles ──────────────────────────────────────────────────────────────────
  const [roles, setRoles]             = useState<Role[]>([]);
  const [permCatalogue, setPermCat]   = useState<PermissionDef[]>([]);
  const [selectedRole, setSelRole]    = useState<Role | null>(null);
  const [editPerms, setEditPerms]     = useState<string[]>([]);
  const [savingRole, setSavingRole]   = useState(false);
  const [roleMsg, setRoleMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ roles: Role[]; permissions: PermissionDef[] }>('/api/admin/security/roles');
      setRoles(d.roles); setPermCat(d.permissions);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2FA Policy ─────────────────────────────────────────────────────────────
  const [policy, setPolicy]           = useState<TwoFAPolicy | null>(null);
  const [policyDraft, setPolicyDraft] = useState<TwoFAPolicy | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyMsg, setPolicyMsg]     = useState<{ ok: boolean; text: string } | null>(null);

  const loadPolicy = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ policy: TwoFAPolicy }>('/api/admin/security/two-fa');
      setPolicy(d.policy); setPolicyDraft(d.policy);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sessions ───────────────────────────────────────────────────────────────
  const [sessions, setSessions]       = useState<AdminSession[]>([]);
  const [terminating, setTerminating] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ sessions: AdminSession[] }>('/api/admin/security/sessions');
      setSessions(d.sessions ?? []);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Devices ────────────────────────────────────────────────────────────────
  const [devices, setDevices]         = useState<TrustedDevice[]>([]);
  const [revokingDev, setRevokingDev] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ devices: TrustedDevice[] }>('/api/admin/security/devices');
      setDevices(d.devices ?? []);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Login History ──────────────────────────────────────────────────────────
  const [loginLogs, setLoginLogs]     = useState<LoginEvent[]>([]);
  const [loginTotal, setLoginTotal]   = useState(0);
  const [loginPage, setLoginPage]     = useState(1);
  const [loginActor, setLoginActor]   = useState('all');
  const [loginResult, setLoginResult] = useState('all');
  const [loginSearch, setLoginSearch] = useState('');

  const loadLoginLogs = useCallback(async (page = 1) => {
    setLoading(true);
    const p = new URLSearchParams({ type: 'login', limit: '50', offset: String((page - 1) * 50) });
    if (loginActor  !== 'all') p.set('actor',  loginActor);
    if (loginResult !== 'all') p.set('result', loginResult);
    if (loginSearch)           p.set('search', loginSearch);
    try {
      const d = await api<{ data: LoginEvent[]; total: number }>(`/api/admin/security/logs?${p}`);
      setLoginLogs(d.data ?? []); setLoginTotal(d.total ?? 0);
    } finally { setLoading(false); }
  }, [loginActor, loginResult, loginSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Audit Logs ─────────────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs]     = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal]   = useState(0);
  const [auditPage, setAuditPage]     = useState(1);
  const [auditSearch, setAuditSearch] = useState('');

  const loadAuditLogs = useCallback(async (page = 1) => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: '50' });
    if (auditSearch) p.set('search', auditSearch);
    try {
      const d = await api<{ data: AuditEntry[]; total: number; pages: number }>(`/api/admin/audit?${p}`);
      setAuditLogs(d.data ?? []); setAuditTotal(d.total ?? 0);
    } finally { setLoading(false); }
  }, [auditSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Security Alerts ────────────────────────────────────────────────────────
  const [alerts, setAlerts]           = useState<SecurityAlert[]>([]);
  const [alertStats, setAlertStats]   = useState<{ total: number; unresolved: number; bySeverity: Record<string, number> } | null>(null);
  const [resolvingAlert, setResolvingAlert] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<'all' | 'unresolved'>('unresolved');

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ alerts: SecurityAlert[]; stats: typeof alertStats }>('/api/admin/security/alerts?limit=200');
      setAlerts(d.alerts ?? []); setAlertStats(d.stats ?? null);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── IP Restrictions ────────────────────────────────────────────────────────
  const [ipLists, setIpLists]         = useState<IpLists | null>(null);
  const [ipInput, setIpInput]         = useState('');
  const [ipNote, setIpNote]           = useState('');
  const [ipSaving, setIpSaving]       = useState(false);
  const [countryInput, setCountryInput] = useState('');
  const [countryName, setCountryName]   = useState('');

  const loadIpLists = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<IpLists>('/api/admin/security/ip-lists');
      setIpLists(d);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rate Limits ────────────────────────────────────────────────────────────
  const [rateLimits, setRateLimits]   = useState<RateLimitRule[]>([]);
  const [editingRl, setEditingRl]     = useState<string | null>(null);
  const [rlDraft, setRlDraft]         = useState<Partial<RateLimitRule>>({});
  const [savingRl, setSavingRl]       = useState(false);

  const loadRateLimits = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ rules: RateLimitRule[] }>('/api/admin/security/rate-limits');
      setRateLimits(d.rules ?? []);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab load dispatch ──────────────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'roles' || tab === 'permissions') loadRoles();
    if (tab === '2fa')             loadPolicy();
    if (tab === 'sessions')        loadSessions();
    if (tab === 'devices')         loadDevices();
    if (tab === 'login-history')   loadLoginLogs(1);
    if (tab === 'audit-logs')      loadAuditLogs(1);
    if (tab === 'alerts')          loadAlerts();
    if (tab === 'ip-restrictions') loadIpLists();
    if (tab === 'rate-limits')     loadRateLimits();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (tab === 'login-history') { setLoginPage(1); loadLoginLogs(1); } }, [loginActor, loginResult]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'audit-logs')    { setAuditPage(1); loadAuditLogs(1); } }, [auditSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ────────────────────────────────────────────────────────────────

  async function saveRolePermissions() {
    if (!selectedRole) return;
    setSavingRole(true); setRoleMsg(null);
    try {
      const d = await api<{ ok: boolean; role: Role }>('/api/admin/security/roles', {
        method: 'POST',
        body: JSON.stringify({ action: 'update_permissions', roleId: selectedRole.id, permissions: editPerms }),
      });
      setRoles(prev => prev.map(r => r.id === d.role.id ? d.role : r));
      setSelRole(d.role);
      setRoleMsg({ ok: true, text: 'Permissions saved.' });
    } catch (e) {
      setRoleMsg({ ok: false, text: String(e) });
    } finally { setSavingRole(false); }
  }

  async function savePolicy() {
    if (!policyDraft) return;
    setSavingPolicy(true); setPolicyMsg(null);
    try {
      const d = await api<{ ok: boolean; policy: TwoFAPolicy }>('/api/admin/security/two-fa', {
        method: 'POST', body: JSON.stringify(policyDraft),
      });
      setPolicy(d.policy); setPolicyDraft(d.policy);
      setPolicyMsg({ ok: true, text: '2FA policy updated.' });
    } catch (e) {
      setPolicyMsg({ ok: false, text: String(e) });
    } finally { setSavingPolicy(false); }
  }

  async function terminateSession(token: string) {
    if (!confirm('Terminate this administrator session?')) return;
    const reason = prompt('Security reason for revoking this session:')?.trim();
    if (!reason || reason.length < 8) return;
    setTerminating(token);
    try {
      await api('/api/admin/security/sessions', { method: 'DELETE', body: JSON.stringify({ token, reason, confirmation: 'CONFIRM SESSION REVOCATION' }) });
      setSessions(prev => prev.filter(s => s.token !== token));
    } finally { setTerminating(null); }
  }

  async function revokeDevice(deviceId: string) {
    setRevokingDev(deviceId);
    try {
      await api('/api/admin/security/devices', { method: 'DELETE', body: JSON.stringify({ deviceId }) });
      setDevices(prev => prev.filter(d => d.id !== deviceId));
    } finally { setRevokingDev(null); }
  }

  async function revokeAllDevices() {
    try {
      await api('/api/admin/security/devices', { method: 'DELETE', body: JSON.stringify({ all: true }) });
      setDevices([]);
    } catch { /* silent */ }
  }

  async function resolveAlert(id: string) {
    setResolvingAlert(id);
    try {
      await api('/api/admin/security/alerts', { method: 'POST', body: JSON.stringify({ action: 'resolve', id }) });
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));
    } finally { setResolvingAlert(null); }
  }

  async function ipAction(action: string, extra: Record<string, string> = {}) {
    setIpSaving(true);
    try {
      const d = await api<{ ok: boolean; lists: IpLists }>('/api/admin/security/ip-lists', {
        method: 'POST', body: JSON.stringify({ action, ...extra }),
      });
      setIpLists(d.lists);
      setIpInput(''); setIpNote('');
    } finally { setIpSaving(false); }
  }

  async function saveRlRule() {
    if (!editingRl) return;
    setSavingRl(true);
    try {
      const d = await api<{ ok: boolean; rule: RateLimitRule }>('/api/admin/security/rate-limits', {
        method: 'POST', body: JSON.stringify({ id: editingRl, ...rlDraft }),
      });
      setRateLimits(prev => prev.map(r => r.id === editingRl ? d.rule : r));
      setEditingRl(null); setRlDraft({});
    } finally { setSavingRl(false); }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const permGroups = permCatalogue.reduce<Record<string, PermissionDef[]>>((acc, p) => {
    (acc[p.group] = acc[p.group] ?? []).push(p); return acc;
  }, {});

  const filteredAlerts = alertFilter === 'unresolved' ? alerts.filter(a => !a.resolved) : alerts;

  return (
    <>
      <Helmet>
        <title>Security Center — CGC Admin</title>
        <meta name="description" content="Security management for City Gate Capital admin panel." />
        <meta name="robots" content="noindex,nofollow" />
        <link rel="canonical" href="https://citygate.capital/admin/security" />
      </Helmet>
      <AdminLayout title="Security Center">
        <div className="space-y-5 p-1">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>Security Center</h1>
              <p className="text-white/30 text-sm mt-0.5">Roles, permissions, 2FA, sessions, devices, logs, alerts, IP rules &amp; rate limits</p>
            </div>
            <button onClick={() => {
              if (tab === 'roles' || tab === 'permissions') loadRoles();
              if (tab === '2fa')             loadPolicy();
              if (tab === 'sessions')        loadSessions();
              if (tab === 'devices')         loadDevices();
              if (tab === 'login-history')   loadLoginLogs(loginPage);
              if (tab === 'audit-logs')      loadAuditLogs(auditPage);
              if (tab === 'alerts')          loadAlerts();
              if (tab === 'ip-restrictions') loadIpLists();
              if (tab === 'rate-limits')     loadRateLimits();
            }}
              className="w-8 h-8 rounded-xl border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* ── Tab bar ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-1 p-1 rounded-2xl border border-white/5"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            {TABS.map(t => {
              const Icon = t.icon;
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

          {/* ── Loading bar ─────────────────────────────────────────────── */}
          {loading && (
            <div className="flex items-center gap-2 text-white/30 text-xs">
              <Loader2 size={12} className="animate-spin" /> Loading…
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB: ROLES                                                     */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {tab === 'roles' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Role list */}
              <div className="space-y-2">
                <SectionLabel>Admin Roles ({roles.length})</SectionLabel>
                {roles.map(role => (
                  <button key={role.id} onClick={() => { setSelRole(role); setEditPerms(role.permissions); setRoleMsg(null); }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      selectedRole?.id === role.id
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-white/7 bg-white/[0.025] hover:border-white/15'
                    }`}>
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: role.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{role.label}</p>
                        <p className="text-white/30 text-[10px] font-mono">{role.name}</p>
                      </div>
                      {role.isSystem && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-white/20 border border-white/10 px-1.5 py-0.5 rounded">System</span>
                      )}
                    </div>
                    <p className="text-white/35 text-xs mt-2 leading-relaxed line-clamp-2">{role.description}</p>
                    <p className="text-white/20 text-[10px] mt-2">{role.permissions.length} permissions</p>
                  </button>
                ))}
              </div>

              {/* Permission editor */}
              <div className="lg:col-span-2">
                {selectedRole ? (
                  <Card>
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <span className="w-4 h-4 rounded-full" style={{ background: selectedRole.color }} />
                        <div>
                          <p className="text-white font-semibold">{selectedRole.label}</p>
                          <p className="text-white/30 text-xs">{editPerms.length} permissions selected</p>
                        </div>
                      </div>
                      <button onClick={saveRolePermissions} disabled={savingRole}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-black disabled:opacity-50 transition-all"
                        style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
                        {savingRole ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Save
                      </button>
                    </div>

                    {roleMsg && (
                      <div className={`flex items-center gap-2 p-3 rounded-xl text-xs mb-4 ${roleMsg.ok ? 'bg-emerald-400/8 text-emerald-300 border border-emerald-400/15' : 'bg-red-400/8 text-red-300 border border-red-400/15'}`}>
                        {roleMsg.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {roleMsg.text}
                      </div>
                    )}

                    <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
                      {Object.entries(permGroups).map(([group, perms]) => (
                        <div key={group}>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-2">{group}</p>
                          <div className="space-y-1.5">
                            {perms.map(perm => {
                              const checked = editPerms.includes(perm.key);
                              return (
                                <label key={perm.key} className="flex items-start gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/[0.03] transition-colors">
                                  <input type="checkbox" checked={checked}
                                    onChange={e => setEditPerms(prev => e.target.checked ? [...prev, perm.key] : prev.filter(k => k !== perm.key))}
                                    className="mt-0.5 accent-primary shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-white/80 text-xs font-medium">{perm.label}</p>
                                      <RiskBadge risk={perm.risk} />
                                    </div>
                                    <p className="text-white/30 text-[11px] mt-0.5">{perm.description}</p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : (
                  <Card>
                    <EmptyState icon={Users} message="Select a role to edit its permissions" />
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB: PERMISSIONS (catalogue view)                             */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {tab === 'permissions' && (
            <div className="space-y-5">
              <p className="text-white/30 text-sm">Full permission catalogue — {permCatalogue.length} permissions across {Object.keys(permGroups).length} groups.</p>
              {Object.entries(permGroups).map(([group, perms]) => (
                <Card key={group}>
                  <SectionLabel>{group}</SectionLabel>
                  <div className="space-y-2">
                    {perms.map(perm => (
                      <div key={perm.key} className="flex items-start gap-4 p-3 rounded-xl border border-white/5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white/80 text-sm font-medium">{perm.label}</p>
                            <RiskBadge risk={perm.risk} />
                          </div>
                          <p className="text-white/35 text-xs mt-1">{perm.description}</p>
                          <p className="text-white/20 text-[10px] font-mono mt-1">{perm.key}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-white/20 text-[10px]">Used by</p>
                          <p className="text-white/50 text-xs font-medium">
                            {roles.filter(r => r.permissions.includes(perm.key)).map(r => r.label).join(', ') || '—'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB: 2FA POLICY                                               */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {tab === '2fa' && policyDraft && (
            <div className="max-w-2xl space-y-5">
              <Card>
                <SectionLabel>Two-Factor Authentication Policy</SectionLabel>
                <div className="space-y-5">

                  {[
                    { key: 'mandatoryForAll',         label: 'Require 2FA for all customers',          desc: 'Every customer must enroll in 2FA before they can access their account.' },
                    { key: 'mandatoryForWithdrawals', label: 'Require 2FA for withdrawals',            desc: 'Customers must verify with 2FA before any withdrawal is processed.' },
                    { key: 'mandatoryForWires',       label: 'Require 2FA for wire transfers',         desc: 'Wire transfer instructions require a fresh 2FA confirmation.' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-start justify-between gap-4 p-4 rounded-xl border border-white/7">
                      <div>
                        <p className="text-white/80 text-sm font-medium">{label}</p>
                        <p className="text-white/35 text-xs mt-1">{desc}</p>
                      </div>
                      <button onClick={() => setPolicyDraft(prev => prev ? { ...prev, [key]: !prev[key as keyof TwoFAPolicy] } : prev)}
                        className="shrink-0 mt-0.5">
                        {(policyDraft as unknown as Record<string, unknown>)[key]
                          ? <ToggleRight size={28} className="text-primary" />
                          : <ToggleLeft  size={28} className="text-white/20" />}
                      </button>
                    </div>
                  ))}

                  <div className="p-4 rounded-xl border border-white/7">
                    <p className="text-white/80 text-sm font-medium mb-1">Withdrawal threshold for 2FA</p>
                    <p className="text-white/35 text-xs mb-3">Withdrawals above this amount always require 2FA, even if the global policy is off.</p>
                    <div className="flex items-center gap-3">
                      <span className="text-white/40 text-sm">$</span>
                      <input type="number" min={0} value={policyDraft.withdrawalThreshold}
                        onChange={e => setPolicyDraft(prev => prev ? { ...prev, withdrawalThreshold: Number(e.target.value) } : prev)}
                        className="w-40 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/40" />
                      <span className="text-white/30 text-xs">USD</span>
                    </div>
                  </div>

                  {policyMsg && (
                    <div className={`flex items-center gap-2 p-3 rounded-xl text-xs ${policyMsg.ok ? 'bg-emerald-400/8 text-emerald-300 border border-emerald-400/15' : 'bg-red-400/8 text-red-300 border border-red-400/15'}`}>
                      {policyMsg.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {policyMsg.text}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    {policy?.updatedAt && (
                      <p className="text-white/20 text-xs">Last updated {fmtRelative(policy.updatedAt)}{policy.updatedBy ? ` by ${policy.updatedBy}` : ''}</p>
                    )}
                    <button onClick={savePolicy} disabled={savingPolicy}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black disabled:opacity-50 transition-all ml-auto"
                      style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
                      {savingPolicy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save Policy
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB: SESSIONS                                                 */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {tab === 'sessions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-white/40 text-sm">{sessions.length} active admin session{sessions.length !== 1 ? 's' : ''}</p>
                <button onClick={() => {
                  if (confirm('Terminate ALL admin sessions? You will be logged out.')) {
                    const reason = prompt('Security reason for revoking all other administrator sessions:')?.trim();
                    if (!reason || reason.length < 8) return;
                    adminFetch('/api/admin/security/sessions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true, reason, confirmation: 'CONFIRM SESSION REVOCATION' }) })
                      .then(response => { if (response.ok) setSessions([]); });
                  }
                }} className="text-red-400/70 hover:text-red-400 text-xs flex items-center gap-1.5 transition-colors">
                  <LogOut size={12} /> Terminate all
                </button>
              </div>
              {sessions.length === 0 ? <EmptyState icon={Activity} message="No active admin sessions" /> : (
                <div className="space-y-2">
                  {sessions.map(s => (
                    <Card key={s.token}>
                      <div className="flex items-start gap-4">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                          <Monitor size={16} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white/80 text-sm font-medium">{s.email}</p>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-emerald-400 text-[10px] font-bold">Active</span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                            <span className="text-white/30 text-xs flex items-center gap-1"><Globe size={10} />{s.ip}</span>
                            <span className="text-white/30 text-xs flex items-center gap-1"><Clock size={10} />Created {fmtRelative(s.createdAt)}</span>
                            <span className="text-white/30 text-xs flex items-center gap-1"><Activity size={10} />Last seen {fmtRelative(s.lastSeenAt)}</span>
                          </div>
                          <p className="text-white/20 text-[10px] font-mono mt-1 truncate">{s.ua}</p>
                        </div>
                        <button onClick={() => terminateSession(s.token)} disabled={terminating === s.token}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-red-400/70 hover:text-red-400 border border-red-400/15 hover:border-red-400/30 transition-all disabled:opacity-50">
                          {terminating === s.token ? <Loader2 size={11} className="animate-spin" /> : <LogOut size={11} />}
                          Terminate
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB: DEVICES                                                  */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {tab === 'devices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-white/40 text-sm">{devices.length} trusted device{devices.length !== 1 ? 's' : ''} for {admin?.email}</p>
                {devices.length > 0 && (
                  <button onClick={() => { if (confirm('Revoke all trusted devices?')) revokeAllDevices(); }}
                    className="text-red-400/70 hover:text-red-400 text-xs flex items-center gap-1.5 transition-colors">
                    <Trash2 size={12} /> Revoke all
                  </button>
                )}
              </div>
              {devices.length === 0 ? <EmptyState icon={Smartphone} message="No trusted devices registered" /> : (
                <div className="space-y-2">
                  {devices.map(d => (
                    <Card key={d.id}>
                      <div className="flex items-start gap-4">
                        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
                          <Monitor size={16} className="text-white/40" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/80 text-sm font-medium">{d.name}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                            <span className="text-white/30 text-xs flex items-center gap-1"><Globe size={10} />{d.ip}</span>
                            <span className="text-white/30 text-xs flex items-center gap-1"><Clock size={10} />Added {fmtRelative(d.createdAt)}</span>
                            <span className="text-white/30 text-xs flex items-center gap-1"><Activity size={10} />Last used {fmtRelative(d.lastUsedAt)}</span>
                            <span className="text-white/30 text-xs flex items-center gap-1"><Lock size={10} />Expires {fmtTime(d.expiresAt)}</span>
                          </div>
                        </div>
                        <button onClick={() => revokeDevice(d.id)} disabled={revokingDev === d.id}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-red-400/70 hover:text-red-400 border border-red-400/15 hover:border-red-400/30 transition-all disabled:opacity-50">
                          {revokingDev === d.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                          Revoke
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB: LOGIN HISTORY                                            */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {tab === 'login-history' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3 items-center">
                <input value={loginSearch} onChange={e => setLoginSearch(e.target.value)}
                  placeholder="Search email, IP, browser…"
                  className="bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary/40 placeholder:text-white/25 w-56" />
                <div className="flex gap-1.5">
                  {['all','admin','user'].map(v => <Pill key={v} active={loginActor === v} onClick={() => setLoginActor(v)}>{v === 'all' ? 'All actors' : v}</Pill>)}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {['all','success','failed','blocked','totp_failed','account_locked'].map(v => (
                    <Pill key={v} active={loginResult === v} onClick={() => setLoginResult(v)}>{v === 'all' ? 'All results' : v.replace('_',' ')}</Pill>
                  ))}
                </div>
                <button onClick={() => window.open('/api/admin/security/export?type=login&format=csv','_blank')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/40 hover:text-white border border-white/8 transition-colors ml-auto">
                  <Download size={12} /> Export CSV
                </button>
              </div>

              <p className="text-white/30 text-xs">{loginTotal.toLocaleString()} events</p>

              {loginLogs.length === 0 ? <EmptyState icon={Clock} message="No login events found" /> : (
                <div className="space-y-1.5">
                  {loginLogs.map(ev => {
                    const resultColor: Record<string, string> = {
                      success: 'text-emerald-400', failed: 'text-red-400', blocked: 'text-amber-400',
                      account_locked: 'text-amber-400', totp_failed: 'text-red-400', status_denied: 'text-purple-400',
                    };
                    return (
                      <div key={ev.id} className="flex items-center gap-4 px-4 py-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                        style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <DeviceIcon device={ev.device} />
                        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-0.5">
                          <p className="text-white/70 text-xs font-medium truncate">{ev.email}</p>
                          <p className={`text-xs font-semibold ${resultColor[ev.result] ?? 'text-white/40'}`}>{ev.result.replace('_',' ')}</p>
                          <p className="text-white/30 text-xs">{ev.ip} · {ev.country}</p>
                          <p className="text-white/30 text-xs">{ev.browser} / {ev.os}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-white/20 text-[10px]">{fmtRelative(ev.ts)}</p>
                          <p className="text-white/10 text-[9px] font-mono">{ev.actor}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Pagination page={loginPage} pages={Math.ceil(loginTotal / 50)} onPage={p => { setLoginPage(p); loadLoginLogs(p); }} />
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB: AUDIT LOGS                                               */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {tab === 'audit-logs' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <input value={auditSearch} onChange={e => setAuditSearch(e.target.value)}
                  placeholder="Search event, admin, user…"
                  className="bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary/40 placeholder:text-white/25 w-56" />
                <button onClick={() => window.open('/api/admin/security/export?type=audit&format=csv','_blank')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/40 hover:text-white border border-white/8 transition-colors ml-auto">
                  <Download size={12} /> Export CSV
                </button>
              </div>
              <p className="text-white/30 text-xs">{auditTotal.toLocaleString()} entries</p>
              {auditLogs.length === 0 ? <EmptyState icon={FileText} message="No audit entries found" /> : (
                <div className="space-y-1.5">
                  {auditLogs.map(entry => (
                    <div key={entry.id} className="flex items-start gap-4 px-4 py-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                      style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <Terminal size={12} className="text-white/20 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-white/70 text-xs font-mono font-medium">{entry.event}</p>
                          {entry.email && <p className="text-white/40 text-xs">{entry.email}</p>}
                          {entry.ip    && <p className="text-white/25 text-xs">{entry.ip}</p>}
                        </div>
                        {entry.reason && <p className="text-white/30 text-xs mt-0.5">{entry.reason}</p>}
                      </div>
                      <p className="text-white/20 text-[10px] shrink-0">{fmtRelative(entry.ts)}</p>
                    </div>
                  ))}
                </div>
              )}
              <Pagination page={auditPage} pages={Math.ceil(auditTotal / 50)} onPage={p => { setAuditPage(p); loadAuditLogs(p); }} />
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB: SECURITY ALERTS                                          */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {tab === 'alerts' && (
            <div className="space-y-4">
              {/* Stats strip */}
              {alertStats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: 'Total',    value: alertStats.total,                         color: 'text-white/60' },
                    { label: 'Open',     value: alertStats.unresolved,                    color: 'text-amber-400' },
                    { label: 'Critical', value: alertStats.bySeverity['critical'] ?? 0,   color: 'text-red-400' },
                    { label: 'High',     value: alertStats.bySeverity['high']     ?? 0,   color: 'text-orange-400' },
                    { label: 'Medium',   value: alertStats.bySeverity['medium']   ?? 0,   color: 'text-amber-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-2xl p-4 border" style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}>
                      <p className="text-white/30 text-xs mb-1">{label}</p>
                      <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Pill active={alertFilter === 'unresolved'} onClick={() => setAlertFilter('unresolved')}>Open</Pill>
                <Pill active={alertFilter === 'all'}        onClick={() => setAlertFilter('all')}>All</Pill>
              </div>

              {filteredAlerts.length === 0 ? <EmptyState icon={ShieldCheck} message="No alerts to display" /> : (
                <div className="space-y-2">
                  {filteredAlerts.map(alert => (
                    <Card key={alert.id}>
                      <div className="flex items-start gap-4">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          alert.severity === 'critical' ? 'bg-red-500/10 border border-red-500/20' :
                          alert.severity === 'high'     ? 'bg-orange-500/10 border border-orange-500/20' :
                          'bg-amber-500/10 border border-amber-500/20'
                        }`}>
                          <ShieldAlert size={16} className={
                            alert.severity === 'critical' ? 'text-red-400' :
                            alert.severity === 'high'     ? 'text-orange-400' : 'text-amber-400'
                          } />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white/80 text-sm font-semibold">{alert.title}</p>
                            <SeverityBadge sev={alert.severity} />
                            {alert.resolved && <span className="text-[10px] text-emerald-400/70 font-semibold">Resolved</span>}
                          </div>
                          <p className="text-white/40 text-xs mt-1">{alert.detail}</p>
                          <div className="flex flex-wrap gap-x-4 mt-1.5">
                            {alert.ip && <span className="text-white/25 text-xs">{alert.ip}</span>}
                            <span className="text-white/25 text-xs">{fmtRelative(alert.ts)}</span>
                            {alert.resolvedBy && <span className="text-white/25 text-xs">Resolved by {alert.resolvedBy}</span>}
                          </div>
                        </div>
                        {!alert.resolved && (
                          <button onClick={() => resolveAlert(alert.id)} disabled={resolvingAlert === alert.id}
                            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-emerald-400/70 hover:text-emerald-400 border border-emerald-400/15 hover:border-emerald-400/30 transition-all disabled:opacity-50">
                            {resolvingAlert === alert.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCheck size={11} />}
                            Resolve
                          </button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB: IP RESTRICTIONS                                          */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {tab === 'ip-restrictions' && ipLists && (
            <div className="space-y-6">
              {/* VPN mode */}
              <Card>
                <SectionLabel>VPN / Proxy Detection</SectionLabel>
                <div className="flex gap-2">
                  {(['off','flag','block'] as const).map(m => (
                    <button key={m} onClick={() => ipAction('set_vpn_mode', { mode: m })}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${
                        ipLists.vpnDetection === m ? 'text-black' : 'text-white/40 border border-white/8 hover:text-white/70'
                      }`}
                      style={ipLists.vpnDetection === m ? { background: 'linear-gradient(135deg,#C9A84C,#F0D080)' } : {}}>
                      {m}
                    </button>
                  ))}
                  <p className="text-white/30 text-xs self-center ml-3">
                    {ipLists.vpnDetection === 'off'   && 'VPN detection disabled.'}
                    {ipLists.vpnDetection === 'flag'  && 'VPN logins are flagged for review.'}
                    {ipLists.vpnDetection === 'block' && 'VPN logins are blocked.'}
                  </p>
                </div>
              </Card>

              {/* Add IP */}
              <Card>
                <SectionLabel>Add IP Address</SectionLabel>
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">IP Address</label>
                    <input value={ipInput} onChange={e => setIpInput(e.target.value)} placeholder="192.168.1.1"
                      className="bg-white/[0.04] border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 placeholder:text-white/20 w-48" />
                  </div>
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Note</label>
                    <input value={ipNote} onChange={e => setIpNote(e.target.value)} placeholder="Reason…"
                      className="bg-white/[0.04] border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 placeholder:text-white/20 w-48" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => ipAction('add_blacklist', { ip: ipInput, note: ipNote })} disabled={!ipInput || ipSaving}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 disabled:opacity-50 transition-all">
                      <Ban size={12} /> Blacklist
                    </button>
                    <button onClick={() => ipAction('add_whitelist', { ip: ipInput, note: ipNote })} disabled={!ipInput || ipSaving}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 disabled:opacity-50 transition-all">
                      <ShieldCheck size={12} /> Whitelist
                    </button>
                  </div>
                </div>
              </Card>

              {/* Blacklist */}
              <Card>
                <SectionLabel>Blacklist ({ipLists.blacklist.length})</SectionLabel>
                {ipLists.blacklist.length === 0 ? <p className="text-white/20 text-xs">No IPs blacklisted.</p> : (
                  <div className="space-y-1.5">
                    {ipLists.blacklist.map(entry => (
                      <div key={entry.ip} className="flex items-center gap-4 px-3 py-2.5 rounded-xl border border-white/5">
                        <Ban size={12} className="text-red-400 shrink-0" />
                        <p className="text-white/70 text-sm font-mono flex-1">{entry.ip}</p>
                        {entry.note && <p className="text-white/30 text-xs">{entry.note}</p>}
                        <p className="text-white/20 text-[10px]">{fmtRelative(entry.addedAt)}</p>
                        <button onClick={() => ipAction('remove_blacklist', { ip: entry.ip })}
                          className="text-white/20 hover:text-red-400 transition-colors"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Whitelist */}
              <Card>
                <SectionLabel>Whitelist ({ipLists.whitelist.length})</SectionLabel>
                {ipLists.whitelist.length === 0 ? <p className="text-white/20 text-xs">No IPs whitelisted.</p> : (
                  <div className="space-y-1.5">
                    {ipLists.whitelist.map(entry => (
                      <div key={entry.ip} className="flex items-center gap-4 px-3 py-2.5 rounded-xl border border-white/5">
                        <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
                        <p className="text-white/70 text-sm font-mono flex-1">{entry.ip}</p>
                        {entry.note && <p className="text-white/30 text-xs">{entry.note}</p>}
                        <p className="text-white/20 text-[10px]">{fmtRelative(entry.addedAt)}</p>
                        <button onClick={() => ipAction('remove_whitelist', { ip: entry.ip })}
                          className="text-white/20 hover:text-red-400 transition-colors"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Country blocks */}
              <Card>
                <SectionLabel>Country Blocks ({ipLists.countryBlocks.length})</SectionLabel>
                <div className="flex flex-wrap gap-3 items-end mb-4">
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">ISO Code</label>
                    <input value={countryInput} onChange={e => setCountryInput(e.target.value.toUpperCase())} placeholder="NG" maxLength={2}
                      className="bg-white/[0.04] border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 placeholder:text-white/20 w-24" />
                  </div>
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Country Name</label>
                    <input value={countryName} onChange={e => setCountryName(e.target.value)} placeholder="Nigeria"
                      className="bg-white/[0.04] border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 placeholder:text-white/20 w-40" />
                  </div>
                  <button onClick={() => { ipAction('add_country', { code: countryInput, name: countryName }); setCountryInput(''); setCountryName(''); }}
                    disabled={!countryInput || !countryName || ipSaving}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/20 disabled:opacity-50 transition-all">
                    <Globe size={12} /> Block Country
                  </button>
                </div>
                {ipLists.countryBlocks.length === 0 ? <p className="text-white/20 text-xs">No countries blocked.</p> : (
                  <div className="flex flex-wrap gap-2">
                    {ipLists.countryBlocks.map(cb => (
                      <div key={cb.code} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/15 text-red-400 text-xs">
                        <Globe size={11} />
                        <span className="font-bold">{cb.code}</span>
                        <span className="text-red-400/60">{cb.name}</span>
                        <button onClick={() => ipAction('remove_country', { code: cb.code })} className="text-red-400/40 hover:text-red-400 transition-colors ml-1"><X size={10} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB: RATE LIMITS                                              */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {tab === 'rate-limits' && (
            <div className="space-y-3">
              <p className="text-white/30 text-sm">Configure per-endpoint rate limiting. Changes take effect on the next request to that endpoint.</p>
              {rateLimits.map(rule => {
                const isEditing = editingRl === rule.id;
                return (
                  <Card key={rule.id}>
                    <div className="flex items-start gap-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${rule.enabled ? 'bg-primary/10 border border-primary/20' : 'bg-white/5 border border-white/8'}`}>
                        <Zap size={16} className={rule.enabled ? 'text-primary' : 'text-white/20'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white/80 text-sm font-semibold">{rule.label}</p>
                          {rule.isSystem && <span className="text-[9px] font-bold uppercase tracking-wider text-white/20 border border-white/10 px-1.5 py-0.5 rounded">System</span>}
                          {!rule.enabled && <span className="text-[9px] font-bold uppercase tracking-wider text-red-400/60 border border-red-400/15 px-1.5 py-0.5 rounded">Disabled</span>}
                        </div>
                        <p className="text-white/35 text-xs mt-0.5">{rule.description}</p>
                        <p className="text-white/20 text-[10px] font-mono mt-1">{rule.path}</p>

                        {isEditing ? (
                          <div className="mt-4 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Max requests</label>
                                <input type="number" min={1} value={rlDraft.max ?? rule.max}
                                  onChange={e => setRlDraft(p => ({ ...p, max: Number(e.target.value) }))}
                                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/40" />
                              </div>
                              <div>
                                <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Window (ms)</label>
                                <input type="number" min={1000} step={1000} value={rlDraft.windowMs ?? rule.windowMs}
                                  onChange={e => setRlDraft(p => ({ ...p, windowMs: Number(e.target.value) }))}
                                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/40" />
                              </div>
                              <div className="flex items-end">
                                <p className="text-white/30 text-xs pb-2.5">= {fmtMs(rlDraft.windowMs ?? rule.windowMs)} window</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={rlDraft.enabled ?? rule.enabled}
                                  onChange={e => setRlDraft(p => ({ ...p, enabled: e.target.checked }))}
                                  className="accent-primary" />
                                <span className="text-white/60 text-xs">Enabled</span>
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={saveRlRule} disabled={savingRl}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-black disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
                                {savingRl ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save
                              </button>
                              <button onClick={() => { setEditingRl(null); setRlDraft({}); }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs text-white/40 border border-white/8 hover:text-white transition-colors">
                                <X size={11} /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
                            <span className="text-white/50 text-xs"><span className="text-primary font-bold">{rule.max}</span> req / {fmtMs(rule.windowMs)}</span>
                            <span className="text-white/25 text-xs">Updated {fmtRelative(rule.updatedAt)}</span>
                          </div>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex flex-col gap-2 shrink-0">
                          <button onClick={() => { setEditingRl(rule.id); setRlDraft({ max: rule.max, windowMs: rule.windowMs, enabled: rule.enabled }); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/40 hover:text-white border border-white/8 transition-colors">
                            <Edit3 size={11} /> Edit
                          </button>
                          <button onClick={() => {
                            setRlDraft({ enabled: !rule.enabled });
                            setEditingRl(rule.id);
                            setTimeout(saveRlRule, 0);
                          }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                              rule.enabled
                                ? 'text-red-400/70 border-red-400/15 hover:border-red-400/30'
                                : 'text-emerald-400/70 border-emerald-400/15 hover:border-emerald-400/30'
                            }`}>
                            {rule.enabled ? <ShieldOff size={11} /> : <ShieldCheck size={11} />}
                            {rule.enabled ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

        </div>
      </AdminLayout>
    </>
  );
}
