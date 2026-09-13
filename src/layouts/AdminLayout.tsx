import { isOutsideSandboxKycScope } from '../shared/productScope';
import { adminHealthState, type AdminHealthState } from '@/lib/adminHealthPresentation';
/**
 * AdminLayout — Enterprise Super Admin Control Center Shell
 *
 * Features:
 *  - Grouped, collapsible sidebar with live badge polling
 *  - ⌘K command palette for instant navigation
 *  - Topbar: breadcrumb, global search, notifications, system health pill
 *  - Role chip + admin avatar in sidebar footer
 *  - Mobile drawer with spring animation
 *  - Keyboard shortcut: ⌘K / Ctrl+K opens command palette
 */
import CgcLogo from '@/components/CgcLogo';
import { authHeaders,useAdminAuth } from '@/lib/adminAuth';
import { prefetchRoute } from '@/lib/prefetchRoute';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Activity,
AlertCircle,
AlertTriangle,
ArrowUpDown,
ArrowRight,
BarChart2,
Bell,
Bitcoin,
CheckCircle2,
ChevronLeft,
ChevronRight,
ClipboardList,
Command,
CreditCard,
Database,
ExternalLink,
  FileText,
  FileWarning,
Globe,
HeadphonesIcon,
Image,
Inbox,
Landmark,
LayoutDashboard,
LogOut,
Mailbox,
Menu,
PieChart,
Plug,
Rocket,
Scale,
Search,
Shield,
ShieldCheck,
SlidersHorizontal,
ToggleLeft,
UserCog,
Users,
WalletCards,
X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useCallback,useEffect,useRef,useState,type ReactNode } from 'react';
import { Link,useLocation,useNavigate } from 'react-router-dom';

// ── Nav structure ─────────────────────────────────────────────────────────────
interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge: string | null;
  desc: string;
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Operations',
    items: ([
      { label: 'Control Center', href: '/admin',             icon: LayoutDashboard, badge: null, desc: 'Platform overview, health & operational controls' },
      { label: 'Operations Inbox', href: '/admin/operations', icon: Inbox,          badge: null, desc: 'All customer submissions & approvals' },
      { label: 'Customers',    href: '/admin/customers',    icon: Users,           badge: null, desc: 'Customer profiles, accounts, access and lifecycle controls' },
      { label: 'KYC & Onboarding', href: '/admin/onboarding', icon: ShieldCheck, badge: null, desc: 'Identity evidence, screening and maker-checker decisions' },
      { label: 'Transactions', href: '/admin/transactions', icon: CreditCard,      badge: null, desc: 'All platform transactions' },
      { label: 'Transfers',    href: '/admin/transfers',    icon: ArrowUpDown,     badge: null, desc: 'Transfer review, limits and controlled operations' },
      { label: 'Accounts',     href: '/admin/accounts',     icon: WalletCards,     badge: null, desc: 'Structured customer account controls' },
      { label: 'Finance Controls', href: '/admin/finance', icon: Landmark,        badge: null, desc: 'Ledger adjustments, adjustment history and reconciliation status' },
      { label: 'Cards',        href: '/admin/cards',        icon: CreditCard,      badge: null, desc: 'Card records, controls, limits & lifecycle requests' },
      { label: 'Wallets & Digital Assets', href: '/admin/crypto', icon: Bitcoin, badge: null, desc: 'Customer wallet records and digital-asset controls' },
      { label: 'Trading',      href: '/admin/trading',      icon: BarChart2,       badge: null, desc: 'Positions, orders & risk' },
    ]).filter(item => !isOutsideSandboxKycScope(item.href)),
  },
  {
    label: 'Customer Success',
    items: ([
      { label: 'Support',      href: '/admin/support',      icon: HeadphonesIcon,  badge: null, desc: 'Tickets & live chat' },
      { label: 'Notifications', href: '/admin/notifications', icon: Bell,           badge: null, desc: 'Customer and service communications' },
    ]).filter(item => !isOutsideSandboxKycScope(item.href)),
  },
  {
    label: 'Intelligence',
    items: ([
      { label: 'Reports',      href: '/admin/reports',      icon: PieChart,        badge: null, desc: 'Operational, customer and service reporting' },
      { label: 'Compliance',   href: '/admin/compliance',   icon: Scale,           badge: null, desc: 'Compliance reviews, monitoring and evidence' },
      { label: 'Applications', href: '/admin/applications', icon: FileText,        badge: null, desc: 'Account application review and decisions' },
      { label: 'Audit Log',    href: '/admin/audit',        icon: ClipboardList,   badge: null, desc: 'Full platform audit trail' },
      { label: 'Security',     href: '/admin/security',     icon: Shield,          badge: null, desc: 'Threats, sessions & IPs' },
      { label: 'Administrators', href: '/admin/administrators', icon: UserCog,      badge: null, desc: 'Administrator identities, roles and session posture' },
    ]).filter(item => !isOutsideSandboxKycScope(item.href)),
  },
  {
    label: 'Platform',
    items: ([
      { label: 'CMS',           href: '/admin/cms',          icon: FileText,           badge: null, desc: 'Content management' },
      { label: 'Media Library', href: '/admin/media',        icon: Image,              badge: null, desc: 'Images, videos & documents' },
      { label: 'Website',       href: '/admin/website',      icon: Globe,              badge: null, desc: 'Site settings & SEO' },
      { label: 'Email Center',  href: '/admin/email',        icon: Mailbox,            badge: null, desc: 'Templates, queue & logs' },
    ]).filter(item => !isOutsideSandboxKycScope(item.href)),
  },
  {
    label: 'Configuration',
    items: ([
      { label: 'Config Center',    href: '/admin/config',        icon: SlidersHorizontal,  badge: null, desc: 'App-wide configuration' },
      { label: 'Financial Sandbox', href: '/admin/financial-sandbox', icon: ToggleLeft, badge: null, desc: 'Isolated simulations; no live money movement' },
      { label: 'Feature Flags',    href: '/admin/features',      icon: ToggleLeft, badge: null, desc: 'Customer module availability and workflow controls' },
      { label: 'Integrations',     href: '/admin/integrations',  icon: Plug,               badge: null, desc: 'Third-party service connections' },
      { label: 'Rates & Fees',     href: '/admin/rates',         icon: BarChart2,          badge: null, desc: 'Fee matrix & FX markup' },
      { label: 'System Health',    href: '/admin/system',        icon: Activity,           badge: null, desc: 'Database, email, API and service health' },
      { label: 'Deployments',      href: '/admin/deployments',   icon: Rocket,             badge: null, desc: 'Production revision and safe Render deployment history' },
      { label: 'Database',         href: '/admin/database',      icon: Database,           badge: null, desc: 'Read-only PostgreSQL, migration, RLS and storage diagnostics' },
      { label: 'Reconciliation', href: '/admin/reconciliation', icon: Scale, badge: null, desc: 'Three-way matching, exceptions and evidence' },
      { label: 'Disputes', href: '/admin/disputes', icon: FileWarning, badge: null, desc: 'Payment errors, evidence and controlled remediation' },
    ]).filter(item => !isOutsideSandboxKycScope(item.href)),
  },
];

// Flat list for command palette
const ALL_NAV = NAV_GROUPS.flatMap(g => g.items);

/**
 * Read permission each nav destination requires. Mirrors the server's
 * PERMISSION_RULES in adminAuthorizationMiddleware.ts — filtering is a UX
 * convenience so non-privileged roles don't see dead links; the API remains
 * the authorization authority. Destinations without an entry stay visible
 * for every role.
 */
const NAV_PERMISSIONS: Record<string, string> = {
  '/admin':                 'dashboard.view',
  '/admin/operations':      'operations.view',
  '/admin/customers':       'users.view',
  '/admin/onboarding':      'compliance.view',
  '/admin/legal-entity':    'compliance.view',
  '/admin/transactions':    'transactions.view',
  '/admin/transfers':       'transfers.view',
  '/admin/accounts':        'accounts.view',
  '/admin/finance':         'accounts.view',
  '/admin/cards':           'cards.view',
  '/admin/crypto':          'wallets.view',
  '/admin/trading':         'trading.view',
  '/admin/support':         'support.view',
  '/admin/notifications':   'operations.view',
  '/admin/reports':         'reports.view',
  '/admin/compliance':      'compliance.view',
  '/admin/audit':           'audit.view',
  '/admin/security':        'security.view',
  '/admin/administrators':  'security.view',
  '/admin/cms':             'cms.view',
  '/admin/media':           'media.view',
  '/admin/website':         'cms.view',
  '/admin/email':           'email.view',
  '/admin/config':          'config.view',
  '/admin/financial-sandbox': 'config.view',
  '/admin/integrations':    'integrations.view',
  '/admin/rates':           'rates.view',
  '/admin/system':          'health.view',
  '/admin/deployments':     'health.view',
  '/admin/database':        'health.view',
  '/admin/reconciliation':  'reconciliation.view',
  '/admin/disputes':        'transactions.view',
};

function navItemPermitted(href: string, permissions: string[] | undefined): boolean {
  const baseHref = href.split('?')[0];
  const permission = NAV_PERMISSIONS[baseHref];
  // Fail-open on missing session data — the server enforces authorization.
  if (!permission || !permissions) return true;
  return permissions.includes(permission);
}

const permittedNavGroups = (permissions: string[] | undefined) =>
  NAV_GROUPS
    .map(group => ({ ...group, items: group.items.filter(item => navItemPermitted(item.href, permissions)) }))
    .filter(group => group.items.length > 0);

const permittedAllNav = (permissions: string[] | undefined): typeof ALL_NAV =>
  ALL_NAV.filter(item => navItemPermitted(item.href, permissions));

function isNavItemActive(href: string, pathname: string, search: string): boolean {
  const [hrefPath, hrefSearch = ''] = href.split('?');
  const pathMatches = pathname === hrefPath || (hrefPath !== '/admin' && pathname.startsWith(`${hrefPath}/`));
  if (!pathMatches) return false;

  const querySiblings = ALL_NAV.filter(item => item.href.startsWith(`${hrefPath}?`));
  if (!hrefSearch) return querySiblings.length === 0 || search.length === 0;

  const currentParams = new URLSearchParams(search);
  const expectedParams = new URLSearchParams(hrefSearch);
  return [...expectedParams].every(([key, value]) => currentParams.get(key) === value);
}

interface Props { children: ReactNode; title?: string; }

// ── Sidebar ───────────────────────────────────────────────────────────────────
interface SidebarProps {
  mobile?: boolean;
  collapsed?: boolean;
  admin: import('@/lib/adminAuth').AdminUser | null;
  navLive: typeof ALL_NAV;
  location: ReturnType<typeof useLocation>;
  setSidebarOpen: (v: boolean) => void;
  setCollapsed: (v: boolean) => void;
  handleLogout: () => void;
}

function Sidebar({ mobile = false, collapsed = false, admin, navLive, location, setSidebarOpen, setCollapsed, handleLogout }: SidebarProps) {
  const w = collapsed && !mobile ? 'w-[60px]' : 'w-64';

  return (
    <div className={`flex flex-col h-full ${w} transition-all duration-200`}
      style={{ background: 'rgba(6,6,6,0.99)', borderRight: '1px solid rgba(201,168,76,0.1)' }}>

      {/* Logo */}
      <div className={`flex items-center ${collapsed && !mobile ? 'justify-center px-3' : 'gap-2.5 px-5'} py-5 border-b border-white/[0.05]`}>
        <Link to="/admin" className="flex items-center gap-2.5 min-w-0">
          <CgcLogo size={32} glow imgClassName="h-8 w-auto" />
          {(!collapsed || mobile) && (
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-none" style={{ fontFamily: 'var(--font-heading)' }}>City Gate</p>
              <p className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: '#C9A84C' }}>Control Center</p>
            </div>
          )}
        </Link>
        {!mobile && (
          <button onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand administration navigation' : 'Collapse administration navigation'}
            className="ml-auto text-white/20 hover:text-white/60 transition-colors shrink-0">
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {permittedNavGroups(admin?.permissions).map(group => (
          <div key={group.label}>
            {(!collapsed || mobile) && (
              <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-white/20 px-2 mb-1.5">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const live = navLive.find(n => n.href === item.href);
                const badge = live?.badge;
                const active = isNavItemActive(item.href, location.pathname, location.search);
                return (
                  <Link key={item.href} to={item.href}
                    onClick={() => mobile && setSidebarOpen(false)}
                    onMouseEnter={() => prefetchRoute(item.href)}
                    title={collapsed && !mobile ? item.label : undefined}
                    className={`flex items-center gap-2.5 rounded-xl text-xs font-medium transition-all group relative ${
                      collapsed && !mobile ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
                    } ${active ? 'text-black' : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'}`}
                    style={active ? { background: 'linear-gradient(135deg, #C9A84C, #F0D080)' } : {}}>
                    <item.icon size={14} className={`shrink-0 ${active ? 'text-black' : 'text-white/30 group-hover:text-white/60'}`} />
                    {(!collapsed || mobile) && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                            active ? 'bg-black/20 text-black' : 'bg-primary/15 text-primary'
                          }`}>{badge}</span>
                        )}
                      </>
                    )}
                    {(collapsed && !mobile) && badge && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">{badge}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Admin footer */}
      <div className={`border-t border-white/[0.05] ${collapsed && !mobile ? 'p-2' : 'p-3'}`}>
        {collapsed && !mobile ? (
          <button onClick={handleLogout} title="Logout"
            className="w-full flex items-center justify-center py-2 text-white/25 hover:text-red-400 transition-colors">
            <LogOut size={14} />
          </button>
        ) : (
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold text-black shrink-0"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
              {(admin?.name ?? 'SA').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate leading-none mb-0.5">{admin?.name ?? 'Super Admin'}</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide"
                style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C' }}>
                {admin?.role ?? 'SUPER_ADMIN'}
              </span>
            </div>
            <button onClick={handleLogout} className="text-white/20 hover:text-red-400 transition-colors shrink-0" title="Logout">
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Command Palette ───────────────────────────────────────────────────────────
function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [recordResults, setRecordResults] = useState<NavItem[]>([]);
  const [searchingRecords, setSearchingRecords] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  // Same session the Sidebar filters on — verify populates `permissions`.
  const { admin } = useAdminAuth();

  useEffect(() => {
    if (open) { setQuery(''); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  useEffect(() => {
    const value = query.trim();
    if (!open || value.length < 2) { setRecordResults([]); setSearchingRecords(false); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchingRecords(true);
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(value)}`, { headers: authHeaders(), signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json();
        setRecordResults((payload.results ?? []).map((item: { label: string; description: string; href: string; type: string }) => ({
          label: item.label, desc: `${item.type} · ${item.description}`, href: item.href, icon: Search, badge: null,
        })));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setRecordResults([]);
      } finally { if (!controller.signal.aborted) setSearchingRecords(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, query]);

  const permittedNav = permittedAllNav(admin?.permissions);
  const navigationResults = query.trim()
    ? permittedNav.filter(n =>
        n.label.toLowerCase().includes(query.toLowerCase()) ||
        n.desc.toLowerCase().includes(query.toLowerCase())
      )
    : permittedNav.slice(0, 8);
  const results = [...recordResults, ...navigationResults].slice(0, 20);

  function go(href: string) { navigate(href); onClose(); }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-[100] backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -20 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed top-[15vh] left-1/2 -translate-x-1/2 w-full max-w-xl z-[101] rounded-2xl overflow-hidden"
            style={{ background: 'rgba(10,10,10,0.98)', border: '1px solid rgba(201,168,76,0.2)', boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.05)' }}>
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
              <Command size={15} className="text-white/30 shrink-0" />
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') onClose();
                  if (e.key === 'Enter' && results[0]) go(results[0].href);
                }}
                placeholder="Search pages, users, actions…"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none" />
              <kbd className="text-[10px] text-white/20 border border-white/10 rounded px-1.5 py-0.5">ESC</kbd>
            </div>
            {/* Results */}
            <div className="max-h-80 overflow-y-auto py-2">
              {searchingRecords && results.length === 0 ? (
                <p className="text-center text-white/25 text-sm py-8">Searching records…</p>
              ) : results.length === 0 ? (
                <p className="text-center text-white/25 text-sm py-8">No results for "{query}"</p>
              ) : results.map(item => (
                <button key={item.href} onClick={() => go(item.href)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-left group">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.12)' }}>
                    <item.icon size={13} style={{ color: '#C9A84C' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 font-medium">{item.label}</p>
                    <p className="text-[11px] text-white/30 truncate">{item.desc}</p>
                  </div>
                  <ArrowRight size={12} className="text-white/15 group-hover:text-white/40 transition-colors" />
                </button>
              ))}
            </div>
            <div className="px-4 py-2.5 border-t border-white/[0.05] flex items-center gap-4 text-[10px] text-white/20">
              <span><kbd className="border border-white/10 rounded px-1">↑↓</kbd> navigate</span>
              <span><kbd className="border border-white/10 rounded px-1">↵</kbd> open</span>
              <span><kbd className="border border-white/10 rounded px-1">ESC</kbd> close</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── System health pill ────────────────────────────────────────────────────────
function SystemHealthPill() {
  const [status, setStatus] = useState<AdminHealthState>('unknown');
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch('/api/admin/health', { headers: authHeaders(), signal: controller.signal });
        const data = response.ok ? await response.json() : null;
        if (active) setStatus(adminHealthState(data));
      } catch { if (active) setStatus('unknown'); }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    return () => { active = false; controller.abort(); clearInterval(timer); };
  }, []);
  const cfg = {
    healthy: { color: '#10B981', label: 'Service healthy', Icon: CheckCircle2 },
    warning: { color: '#F59E0B', label: 'Service warning', Icon: AlertCircle },
    degraded: { color: '#EF4444', label: 'Service degraded', Icon: AlertTriangle },
    unknown: { color: '#94A3B8', label: 'Health unverified', Icon: AlertCircle },
  }[status];
  return <Link to="/admin/readiness" title="Service health does not establish financial launch readiness. Open the full readiness report."
    className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium"
    style={{ background: cfg.color + '0d', borderColor: cfg.color + '22', color: cfg.color }}>
    <cfg.Icon size={11} /><span>{cfg.label}</span>
  </Link>;
}

// ── Main layout ───────────────────────────────────────────────────────────────
export default function AdminLayout({ children, title }: Props) {
  const { admin, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed]     = useState(false);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [cmdOpen, setCmdOpen]         = useState(false);
  const [liveBadges, setLiveBadges]   = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<{ id: number; text: string; ts: string; color: string; type: string }[]>([]);

  // ⌘K / Ctrl+K
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(v => !v); }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Live badge + notification polling
  const pollStats = useCallback(() => {
    fetch('/api/admin/stats', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.kpis) return;
        const badges: Record<string, string> = {};
        if (d.kpis.pendingVerifications?.value > 0) badges['/admin/kyc']     = String(d.kpis.pendingVerifications.value);
        if (d.kpis.openTickets?.value > 0)          badges['/admin/support'] = String(d.kpis.openTickets.value);
        setLiveBadges(badges);

        if (d.recentActivity) {
          const colorMap: Record<string, string> = {
            deposit: '#10B981', withdrawal: '#C9A84C', kyc_approved: '#627EEA',
            fraud_alert: '#EF4444', transfer: '#C9A84C', account_created: '#10B981',
          };
          setNotifications(d.recentActivity.slice(0, 8).map((a: { id: string; type: string; user: string; ts: string }, i: number) => ({
            id: i,
            text: `${a.type.replace(/_/g, ' ')}: ${a.user}`,
            ts: new Date(a.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            color: colorMap[a.type] ?? '#C9A84C',
            type: a.type,
          })));
        }
      }).catch(() => {});
  }, []);

  useEffect(() => { pollStats(); const id = setInterval(pollStats, 30_000); return () => clearInterval(id); }, [pollStats]);

  const NAV_LIVE = ALL_NAV.map(item => ({ ...item, badge: liveBadges[item.href] ?? item.badge }));

  async function handleLogout() {
    try {
      await logout();
      navigate('/admin/login');
    } catch {
      // Do not pretend the administrator has signed out when the server-side
      // session could not be revoked. A subsequent retry can complete safely.
      window.alert('Unable to sign out securely. Please check your connection and try again.');
    }
  }

  // Breadcrumb segments
  const segments = location.pathname.replace('/admin', '').split('/').filter(Boolean);

  return (
    <>
      <Helmet>
        <title>{title ? `${title} — CGC Admin` : 'Control Center — City Gate Capital'}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      <div className="admin-accessible min-h-screen flex bg-[#040404]">
        {/* Desktop sidebar */}
        <div className={`hidden lg:flex flex-col shrink-0 fixed inset-y-0 left-0 z-30 transition-all duration-200 ${collapsed ? 'w-[60px]' : 'w-64'}`}>
          <Sidebar admin={admin} navLive={NAV_LIVE} location={location}
            setSidebarOpen={setSidebarOpen} setCollapsed={setCollapsed}
            collapsed={collapsed} handleLogout={handleLogout} />
        </div>

        {/* Mobile sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
              <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                className="fixed inset-y-0 left-0 w-72 z-50 lg:hidden">
                <Sidebar mobile admin={admin} navLive={NAV_LIVE} location={location}
                  setSidebarOpen={setSidebarOpen} setCollapsed={setCollapsed} handleLogout={handleLogout} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main */}
        <div className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ${collapsed ? 'lg:ml-[60px]' : 'lg:ml-64'}`}>

          {/* Topbar */}
          <header className="sticky top-0 z-20 flex items-center gap-3 px-4 md:px-5 h-14 border-b border-white/[0.05]"
            style={{ background: 'rgba(4,4,4,0.97)', backdropFilter: 'blur(20px)' }}>
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-white/40 hover:text-white transition-colors">
              <Menu size={18} />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs flex-1 min-w-0">
              <span className="text-white/20 hidden sm:inline">Admin</span>
              {segments.map((seg, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <ChevronRight size={10} className="text-white/15 hidden sm:inline" />
                  <span className={i === segments.length - 1 ? 'text-white/70 font-semibold capitalize' : 'text-white/30 capitalize'}>{seg.replace(/-/g, ' ')}</span>
                </span>
              ))}
              {segments.length === 0 && <span className="text-white/70 font-semibold">Dashboard</span>}
            </div>

            {/* ⌘K trigger */}
            <button onClick={() => setCmdOpen(true)}
              className="hidden md:flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-1.5 text-xs text-white/30 hover:text-white/60 hover:border-white/15 transition-all w-48">
              <Search size={12} />
              <span className="flex-1 text-left">Search…</span>
              <kbd className="text-[9px] border border-white/10 rounded px-1 py-0.5">⌘K</kbd>
            </button>

            <SystemHealthPill />

            {/* View site */}
            <a href="/" target="_blank" rel="noopener noreferrer"
              className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/35 hover:text-white transition-colors" title="View live site">
              <ExternalLink size={13} />
            </a>

            {/* Notifications */}
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)}
                aria-label={notifOpen ? 'Close activity notifications' : 'Open activity notifications'}
                className="relative w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/35 hover:text-white transition-colors">
                <Bell size={13} />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">{notifications.length}</span>
                )}
              </button>
              <AnimatePresence>
                {notifOpen && (
                  <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="absolute right-0 top-10 w-80 rounded-2xl border border-white/[0.08] overflow-hidden z-50"
                    style={{ background: 'rgba(10,10,10,0.99)', backdropFilter: 'blur(24px)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
                      <p className="text-white text-sm font-semibold">Live Activity</p>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <button onClick={() => setNotifOpen(false)} aria-label="Close activity notifications" className="text-white/30 hover:text-white"><X size={13} /></button>
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.map(n => (
                        <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/[0.03]">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: `${n.color}15` }}>
                            <Activity size={11} style={{ color: n.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white/75 text-xs leading-relaxed capitalize">{n.text}</p>
                            <p className="text-white/20 text-[10px] mt-0.5">{n.ts}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2.5 border-t border-white/[0.05]">
                      <Link to="/admin/audit" onClick={() => setNotifOpen(false)}
                        className="text-xs flex items-center gap-1" style={{ color: '#C9A84C' }}>
                        View full audit log <ChevronRight size={10} />
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 md:p-5 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
