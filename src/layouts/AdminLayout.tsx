import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, Users, CreditCard, Bitcoin, HeadphonesIcon,
  FileText, Shield, Settings, LogOut, Bell, Search, Menu, X,
  ChevronRight, ExternalLink, TrendingUp, AlertTriangle, Mail, MessageSquare, Mailbox,
  Share2, Bot, Link2, Globe, AtSign,
} from 'lucide-react';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';
import { prefetchRoute } from '@/lib/prefetchRoute';

const NAV = [
  { label: 'Dashboard',    href: '/admin',              icon: LayoutDashboard, badge: null },
  { label: 'Users',        href: '/admin/users',        icon: Users,           badge: '48.2k' },
  { label: 'Transactions', href: '/admin/transactions', icon: CreditCard,      badge: null },
  { label: 'Crypto',       href: '/admin/crypto',       icon: Bitcoin,         badge: null },
  { label: 'Banking',      href: '/admin/banking',      icon: TrendingUp,      badge: null },
  { label: 'Support',      href: '/admin/support',      icon: HeadphonesIcon,  badge: '247' },
  { label: 'Contacts',     href: '/admin/contacts',     icon: MessageSquare,   badge: null },
  { label: 'CMS',          href: '/admin/cms',          icon: FileText,        badge: null },
  { label: 'Website',      href: '/admin/website',      icon: Globe,           badge: null },
  { label: 'Newsletter',   href: '/admin/newsletter',   icon: Mail,            badge: null },
  { label: 'SMTP',         href: '/admin/smtp',         icon: Mailbox,         badge: null },
  { label: 'Email Diag.', href: '/admin/email',       icon: AtSign,          badge: null },
  { label: 'Social Media', href: '/admin/social',        icon: Share2,          badge: null },
  { label: 'Chatbot',      href: '/admin/chatbot',       icon: Bot,             badge: null },
  { label: 'Ext. Links',   href: '/admin/links',         icon: Link2,           badge: null },
  { label: 'Security',     href: '/admin/security',      icon: Shield,          badge: '3' },
  { label: 'Settings',     href: '/admin/settings',      icon: Settings,        badge: null },
];

interface Props { children: ReactNode; title?: string; }

export default function AdminLayout({ children, title }: Props) {
  const { admin, logout } = useAdminAuth();
  const location = useLocation();
  const navigate  = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [liveBadges, setLiveBadges]   = useState<Record<string, string>>({});

  // Fetch live badge counts once on mount
  useEffect(() => {
    fetch('/api/admin/stats', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.kpis) return;
        setLiveBadges({
          '/admin/users':   d.kpis.pendingVerifications?.value > 0 ? String(d.kpis.pendingVerifications.value) : '',
          '/admin/support': d.kpis.openTickets?.value > 0 ? String(d.kpis.openTickets.value) : '',
        });
      })
      .catch(() => {});
  }, []);

  const NAV_LIVE = NAV.map(item => ({
    ...item,
    badge: liveBadges[item.href] ?? item.badge,
  }));

  const notifications = [
    { id: 1, type: 'alert',   text: 'Fraud alert: suspicious tx flagged',  ts: '2m ago',  color: '#EF4444' },
    { id: 2, type: 'kyc',     text: '14 KYC verifications pending',        ts: '8m ago',  color: '#C9A84C' },
    { id: 3, type: 'ticket',  text: 'New urgent support ticket #04821',    ts: '15m ago', color: '#627EEA' },
    { id: 4, type: 'deposit', text: 'Large deposit: $142,000 USD received', ts: '1h ago',  color: '#10B981' },
  ];

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex flex-col h-full ${mobile ? '' : 'w-64'}`}
      style={{ background: 'rgba(8,8,8,0.98)', borderRight: '1px solid rgba(201,168,76,0.08)' }}>
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <Link to="/admin" className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full blur-md opacity-40" style={{ background: 'radial-gradient(circle, #D4AF37 0%, transparent 70%)' }} />
            <img
              src="/assets/IMG-20260519-WA0000.jpg"
              alt="City Gate Capital"
              width={36}
              height={36}
              className="relative h-9 w-auto object-contain shrink-0"
              style={{ filter: 'drop-shadow(0 0 5px rgba(212,175,55,0.45))' }}
            />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none" style={{ fontFamily: 'var(--font-heading)' }}>City Gate</p>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: '#C9A84C' }}>Admin Panel</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_LIVE.map(item => {
          const active = location.pathname === item.href || (item.href !== '/admin' && location.pathname.startsWith(item.href));
          return (
            <Link key={item.href} to={item.href}
              onClick={() => mobile && setSidebarOpen(false)}
              onMouseEnter={() => prefetchRoute(item.href)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                active
                  ? 'text-black'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'
              }`}
              style={active ? { background: 'linear-gradient(135deg, #C9A84C, #F0D080)' } : {}}>
              <item.icon size={16} className={active ? 'text-black' : 'text-white/30 group-hover:text-white/60'} />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-black/20 text-black' : 'bg-primary/15 text-primary'
                }`}>{item.badge}</span>
              )}
              {active && <ChevronRight size={12} className="text-black/50" />}
            </Link>
          );
        })}
      </nav>

      {/* Admin profile */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-black shrink-0"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
            {admin?.avatar ?? 'SA'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{admin?.name ?? 'Super Admin'}</p>
            <p className="text-white/30 text-[10px] truncate">{admin?.role ?? 'superadmin'}</p>
          </div>
          <button onClick={handleLogout} className="text-white/25 hover:text-red-400 transition-colors" title="Logout">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#050505]">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col w-64 shrink-0 fixed inset-y-0 left-0 z-30">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 w-72 z-50 lg:hidden">
              <Sidebar mobile />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center gap-4 px-4 md:px-6 h-16 border-b border-white/5"
          style={{ background: 'rgba(5,5,5,0.95)', backdropFilter: 'blur(20px)' }}>
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-white/40 hover:text-white transition-colors">
            <Menu size={20} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm flex-1">
            <span className="text-white/25">Admin</span>
            <ChevronRight size={12} className="text-white/15" />
            <span className="text-white/70 font-medium">{title ?? 'Dashboard'}</span>
          </div>

          {/* Search */}
          <div className="hidden md:flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 w-56">
            <Search size={13} className="text-white/25" />
            <input placeholder="Search users, tx..." className="bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none flex-1 w-full" />
          </div>

          {/* View site link */}
          <a href="/" target="_blank" rel="noopener noreferrer"
            className="hidden md:flex w-8 h-8 rounded-lg bg-white/[0.04] border border-white/8 items-center justify-center text-white/40 hover:text-white transition-colors" title="View live site">
            <ExternalLink size={14} />
          </a>

          {/* Notifications */}
          <div className="relative">
            <button onClick={() => setNotifOpen(!notifOpen)}
              className="relative w-8 h-8 rounded-lg bg-white/[0.04] border border-white/8 flex items-center justify-center text-white/40 hover:text-white transition-colors">
              <Bell size={14} />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">4</span>
            </button>
            <AnimatePresence>
              {notifOpen && (
                <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute right-0 top-10 w-80 rounded-2xl border border-white/8 overflow-hidden z-50"
                  style={{ background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(24px)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                    <p className="text-white text-sm font-semibold">Notifications</p>
                    <button onClick={() => setNotifOpen(false)} className="text-white/30 hover:text-white"><X size={14} /></button>
                  </div>
                  {notifications.map(n => (
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/[0.03]">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: `${n.color}15` }}>
                        <AlertTriangle size={12} style={{ color: n.color }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-white/80 text-xs leading-relaxed">{n.text}</p>
                        <p className="text-white/25 text-[10px] mt-1">{n.ts}</p>
                      </div>
                    </div>
                  ))}
                  <div className="px-4 py-3">
                    <button className="text-xs text-primary hover:underline">View all notifications</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
