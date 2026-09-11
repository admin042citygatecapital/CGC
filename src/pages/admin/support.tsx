import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders,useAdminAuth } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
AlertCircle,
AlertTriangle,
Archive,
BarChart2,
Bell,
BookOpen,
CheckCheck,
CheckCircle,
ChevronLeft,ChevronRight,
Clock,
Edit2,
ExternalLink,
Eye,
Inbox,
Loader2,
Mail,
MessageCircle,
Pencil,
Plus,
RefreshCw,
Route,
Save,
Search,
Send,
Shield,
SlidersHorizontal,
Star,
StickyNote,
Tag,
Timer,
ToggleLeft,
ToggleRight,
Trash2,
TrendingDown,
User,
UserCheck,
X,
Zap,
} from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useCallback,useEffect,useRef,useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SupportMessage {
  id: string; from: 'customer' | 'admin'; text: string; ts: string; adminName?: string;
}
interface InternalNote {
  id: string; text: string; adminId: string; adminName?: string; ts: string;
}
interface Ticket {
  id: string; subject: string;
  userName: string; userId: string; userEmail: string;
  category: string; priority: string; status: string;
  assignedTo?: string;
  messages: SupportMessage[];
  internalNotes: InternalNote[];
  createdAt: string; updatedAt: string; resolvedAt?: string;
}
interface SupportStats {
  totalOpen: number; totalPending: number; resolvedToday: number;
  avgResponseTimeHrs: number; oldestUnresolvedDays: number;
  byStatus: Record<string, number>; byPriority: Record<string, number>; byCategory: Record<string, number>;
}
interface CannedResponse {
  id: string; title: string; body: string; category: string; createdAt: string; updatedAt: string;
}
interface RoutingRule {
  id: string; category: string; assignTo: string; enabled: boolean;
}
interface NotifSettings {
  urgentTicketInPanel: boolean; urgentTicketEmail: boolean;
  noResponseInPanel: boolean; noResponseEmail: boolean; noResponseHours: number;
  reopenedInPanel: boolean; reopenedEmail: boolean; notifyEmail: string;
}
interface UserProfile {
  id: string; name: string; email: string; status: string; kycStatus: string;
  accountTier?: string; balance?: number; createdAt: string;
}

// ── Style maps ────────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, string> = {
  low:    'bg-white/8 text-white/40',
  medium: 'bg-blue-500/15 text-blue-400',
  high:   'bg-amber-500/15 text-amber-400',
  urgent: 'bg-red-500/15 text-red-400',
};
const STATUS_STYLES: Record<string, string> = {
  open:        'bg-emerald-500/15 text-emerald-400',
  pending:     'bg-amber-500/15 text-amber-400',
  in_progress: 'bg-blue-500/15 text-blue-400',
  resolved:    'bg-white/10 text-white/40',
  closed:      'bg-white/5 text-white/20',
};
const STATUS_ICONS: Record<string, React.ReactNode> = {
  open:        <Inbox size={10} />,
  pending:     <Clock size={10} />,
  in_progress: <RefreshCw size={10} />,
  resolved:    <CheckCircle size={10} />,
  closed:      <Archive size={10} />,
};

const STATUS_OPTIONS = ['open', 'pending', 'in_progress', 'resolved', 'closed'] as const;
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'] as const;
const CATEGORY_OPTIONS = ['Account', 'Transfer', 'KYC', 'Card', 'Exchange', 'Other'] as const;
const SORT_OPTIONS = [
  { value: 'newest',   label: 'Newest First' },
  { value: 'oldest',   label: 'Oldest First' },
  { value: 'priority', label: 'Highest Priority' },
  { value: 'longest',  label: 'Longest Unresolved' },
] as const;
const DATE_RANGE_OPTIONS = [
  { value: '',      label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: '7d',    label: 'Last 7 Days' },
  { value: '30d',   label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
] as const;
const CANNED_CATEGORIES = ['General', 'KYC', 'Transfer Delays', 'Card Issues', 'Account Verification'] as const;
const TEAMS = ['KYC Team', 'Banking Team', 'Cards Team', 'General Queue', 'Compliance Team', 'Tech Support'];

type Tab = 'tickets' | 'canned' | 'routing' | 'notifications' | 'messages' | 'contact-forms' | 'feedback' | 'complaints' | 'announcements';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ts: string) {
  try { return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return ts; }
}
function fmtDateShort(ts: string) {
  try { return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  catch { return ts; }
}
function ageLabel(ts: string) {
  const ms = Date.now() - new Date(ts).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminSupport() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('tickets');

  // ── Ticket list state ──────────────────────────────────────────────────────
  const [tickets,       setTickets]       = useState<Ticket[]>([]);
  const [total,         setTotal]         = useState(0);
  const [page,          setPage]          = useState(1);
  const [pages,         setPages]         = useState(1);
  const [loading,       setLoading]       = useState(true);
  const [selected,      setSelected]      = useState<Ticket | null>(null);
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Filter state ───────────────────────────────────────────────────────────
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateRange,     setDateRange]     = useState('');
  const [dateFrom,      setDateFrom]      = useState('');
  const [dateTo,        setDateTo]        = useState('');
  const [sortBy,        setSortBy]        = useState('newest');
  const [showFilters,   setShowFilters]   = useState(false);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<SupportStats | null>(null);

  // ── Bulk selection ─────────────────────────────────────────────────────────
  const [selected_ids,  setSelectedIds]   = useState<Set<string>>(new Set());
  const [bulkAction,    setBulkAction]    = useState('');
  const [bulkValue,     setBulkValue]     = useState('');
  const [bulkLoading,   setBulkLoading]   = useState(false);

  // ── Ticket detail state ────────────────────────────────────────────────────
  const [reply,         setReply]         = useState('');
  const [replySending,  setReplySending]  = useState(false);
  const [noteText,      setNoteText]      = useState('');
  const [noteSending,   setNoteSending]   = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [detailTab,     setDetailTab]     = useState<'chat' | 'notes' | 'user'>('chat');
  const [userProfile,   setUserProfile]   = useState<UserProfile | null>(null);
  const [userLoading,   setUserLoading]   = useState(false);
  const [assignInput,   setAssignInput]   = useState('');
  const [showCannedPicker, setShowCannedPicker] = useState(false);
  const [cannedFilter,  setCannedFilter]  = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Canned responses state ─────────────────────────────────────────────────
  const [canned,        setCanned]        = useState<CannedResponse[]>([]);
  const [cannedLoading, setCannedLoading] = useState(false);
  const [cannedForm,    setCannedForm]    = useState<Partial<CannedResponse> | null>(null);
  const [cannedSaving,  setCannedSaving]  = useState(false);
  const [cannedCatFilter, setCannedCatFilter] = useState('');

  // ── Routing rules state ────────────────────────────────────────────────────
  const [routing,       setRouting]       = useState<RoutingRule[]>([]);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingSaving, setRoutingSaving] = useState(false);

  // ── Notification settings state ────────────────────────────────────────────
  const [notifSettings, setNotifSettings] = useState<NotifSettings | null>(null);
  const [notifLoading,  setNotifLoading]  = useState(false);
  const [notifSaving,   setNotifSaving]   = useState(false);
  const [notifSaved,    setNotifSaved]    = useState(false);

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  // ── Data fetchers ──────────────────────────────────────────────────────────

  const fetchTickets = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', sort: sortBy });
      if (statusFilter)   params.set('status',    statusFilter);
      if (priorityFilter) params.set('priority',  priorityFilter);
      if (categoryFilter) params.set('category',  categoryFilter);
      if (search)         params.set('search',    search);
      if (dateRange)      params.set('dateRange', dateRange);
      if (dateRange === 'custom' && dateFrom) params.set('dateFrom', dateFrom);
      if (dateRange === 'custom' && dateTo)   params.set('dateTo',   dateTo);
      const res = await fetch(`/api/admin/support?${params}`, { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setTickets(d.data ?? []);
        setTotal(d.total ?? 0);
        setPages(d.pages ?? 1);
      }
    } finally { setLoading(false); }
  }, [admin, page, statusFilter, priorityFilter, categoryFilter, search, dateRange, dateFrom, dateTo, sortBy]);

  const fetchStats = useCallback(async () => {
    if (!admin) return;
    const res = await fetch('/api/admin/support/stats', { headers: authHeaders() });
    if (res.ok) setStats(await res.json());
  }, [admin]);

  const fetchCanned = useCallback(async () => {
    if (!admin) return;
    setCannedLoading(true);
    const res = await fetch('/api/admin/support/canned', { headers: authHeaders() });
    if (res.ok) setCanned(await res.json());
    setCannedLoading(false);
  }, [admin]);

  const fetchRouting = useCallback(async () => {
    if (!admin) return;
    setRoutingLoading(true);
    const res = await fetch('/api/admin/support/routing', { headers: authHeaders() });
    if (res.ok) { const d = await res.json(); setRouting(d.rules ?? []); }
    setRoutingLoading(false);
  }, [admin]);

  const fetchNotifSettings = useCallback(async () => {
    if (!admin) return;
    setNotifLoading(true);
    const res = await fetch('/api/admin/support/notifications', { headers: authHeaders() });
    if (res.ok) setNotifSettings(await res.json());
    setNotifLoading(false);
  }, [admin]);

  useEffect(() => { void fetchTickets(); }, [fetchTickets]);
  useEffect(() => { void fetchStats(); }, [fetchStats]);
  useEffect(() => {
    if (activeTab === 'canned')        void fetchCanned();
    if (activeTab === 'routing')       void fetchRouting();
    if (activeTab === 'notifications') void fetchNotifSettings();
  }, [activeTab, fetchCanned, fetchRouting, fetchNotifSettings]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages.length]);

  // Load user profile when ticket selected
  // `selected` is replaced on every conversation append, so the effect below reads it
  // through a latest-value ref and keys on the ticket id — otherwise the assign input
  // would be reset mid-edit on each new message.
  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; });
  useEffect(() => {
    const current = selectedRef.current;
    if (!current) { setUserProfile(null); return; }
    setAssignInput(current.assignedTo ?? '');
    if (detailTab !== 'user') return;
    void loadUserProfile(current.userId);
  }, [selected?.id, detailTab]);

  async function loadUserProfile(userId: string) {
    setUserLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { headers: authHeaders() });
      if (res.ok) setUserProfile(await res.json());
    } catch { /* silent */ }
    setUserLoading(false);
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Ticket actions ─────────────────────────────────────────────────────────

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || !selected) return;
    setReplySending(true);
    try {
      const res = await fetch('/api/admin/support/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ conversationId: selected.id, message: reply.trim() }),
      });
      const d = await res.json();
      if (res.ok) {
        setReply('');
        setShowCannedPicker(false);
        showToast('Reply sent', true);
        if (d.conversation) setSelected(d.conversation);
        void fetchTickets();
        void fetchStats();
      } else { showToast(d.error ?? 'Failed to send', false); }
    } catch { showToast('Network error', false); }
    setReplySending(false);
  }

  async function sendNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim() || !selected) return;
    setNoteSending(true);
    try {
      const res = await fetch('/api/admin/support/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ conversationId: selected.id, text: noteText.trim() }),
      });
      const d = await res.json();
      if (res.ok) {
        setNoteText('');
        showToast('Note added', true);
        if (d.conversation) setSelected(d.conversation);
      } else { showToast(d.error ?? 'Failed', false); }
    } catch { showToast('Network error', false); }
    setNoteSending(false);
  }

  async function updateStatus(ticketId: string, status: string) {
    setUpdatingStatus(true);
    try {
      const res = await fetch('/api/admin/support/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ conversationId: ticketId, status }),
      });
      if (res.ok) {
        showToast(`Status → ${status.replace('_', ' ')}`, true);
        void fetchTickets();
        void fetchStats();
        if (selected?.id === ticketId) setSelected(s => s ? { ...s, status } : s);
      } else { showToast('Failed to update status', false); }
    } finally { setUpdatingStatus(false); }
  }

  async function updatePriority(ticketId: string, priority: string) {
    const res = await fetch('/api/admin/support/priority', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ conversationId: ticketId, priority }),
    });
    if (res.ok) {
      showToast(`Priority → ${priority}`, true);
      void fetchTickets();
      if (selected?.id === ticketId) setSelected(s => s ? { ...s, priority } : s);
    }
  }

  async function saveAssign() {
    if (!selected || !assignInput.trim()) return;
    const res = await fetch('/api/admin/support/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ conversationId: selected.id, assignedTo: assignInput.trim() }),
    });
    if (res.ok) {
      showToast(`Assigned to ${assignInput}`, true);
      setSelected(s => s ? { ...s, assignedTo: assignInput.trim() } : s);
      void fetchTickets();
    }
  }

  // ── Bulk actions ───────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    if (selected_ids.size === tickets.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(tickets.map(t => t.id)));
  }

  async function applyBulkAction() {
    if (!bulkAction || selected_ids.size === 0) return;
    if (bulkAction === 'export') {
      const res = await fetch('/api/admin/support/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ ids: [...selected_ids], action: 'export' }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'tickets.csv'; a.click();
        URL.revokeObjectURL(url);
      }
      return;
    }
    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/support/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ ids: [...selected_ids], action: bulkAction, value: bulkValue }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast(`${d.updated} ticket${d.updated !== 1 ? 's' : ''} updated`, true);
        setSelectedIds(new Set());
        setBulkAction('');
        setBulkValue('');
        void fetchTickets();
        void fetchStats();
      } else { showToast(d.error ?? 'Bulk action failed', false); }
    } catch { showToast('Network error', false); }
    setBulkLoading(false);
  }

  // ── Canned response actions ────────────────────────────────────────────────

  async function saveCanned() {
    if (!cannedForm?.title?.trim() || !cannedForm?.body?.trim()) return;
    setCannedSaving(true);
    try {
      const isEdit = !!cannedForm.id;
      const res = await fetch('/api/admin/support/canned', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(cannedForm),
      });
      if (res.ok) {
        showToast(isEdit ? 'Response updated' : 'Response created', true);
        setCannedForm(null);
        void fetchCanned();
      } else { showToast('Save failed', false); }
    } catch { showToast('Network error', false); }
    setCannedSaving(false);
  }

  async function deleteCanned(id: string) {
    if (!confirm('Delete this canned response?')) return;
    const res = await fetch('/api/admin/support/canned', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id }),
    });
    if (res.ok) { showToast('Deleted', true); void fetchCanned(); }
  }

  // ── Routing actions ────────────────────────────────────────────────────────

  async function saveRouting() {
    setRoutingSaving(true);
    try {
      const res = await fetch('/api/admin/support/routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ rules: routing }),
      });
      if (res.ok) showToast('Routing rules saved', true);
      else showToast('Save failed', false);
    } catch { showToast('Network error', false); }
    setRoutingSaving(false);
  }

  // ── Notification settings actions ──────────────────────────────────────────

  async function saveNotifSettings() {
    if (!notifSettings) return;
    setNotifSaving(true);
    try {
      const res = await fetch('/api/admin/support/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(notifSettings),
      });
      if (res.ok) {
        setNotifSaved(true);
        setTimeout(() => setNotifSaved(false), 3000);
        showToast('Notification settings saved', true);
      } else { showToast('Save failed', false); }
    } catch { showToast('Network error', false); }
    setNotifSaving(false);
  }

  // ── Canned picker (in reply box) ───────────────────────────────────────────
  const filteredCanned = canned.filter(c =>
    !cannedFilter || c.title.toLowerCase().includes(cannedFilter.toLowerCase()) ||
    c.category.toLowerCase().includes(cannedFilter.toLowerCase())
  );

  if (authLoading) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Helmet><title>Support Center — CGC Admin</title><meta name="description" content="Customer support management and ticket system for City Gate Capital." /><meta name="robots" content="noindex, nofollow" /><link rel="canonical" href="https://citygate.capital/admin/support" /></Helmet>
      <AdminLayout title="Support">
        <div className="p-6 max-w-[1400px] mx-auto space-y-6">

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Support Center</h1>
              <p className="text-white/40 text-sm mt-0.5">Manage customer support conversations</p>
            </div>
            <button onClick={() => { void fetchTickets(); void fetchStats(); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white/60 bg-white/5 hover:bg-white/8 border border-white/8 transition-colors">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {/* ── Stats Dashboard ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard icon={Inbox}       label="Open Tickets"      value={stats?.totalOpen ?? 0}                    color="#10B981" suffix="" />
            <StatCard icon={Clock}       label="Pending Reply"     value={stats?.totalPending ?? 0}                 color="#F59E0B" suffix="" />
            <StatCard icon={CheckCheck}  label="Resolved Today"    value={stats?.resolvedToday ?? 0}                color="#6366F1" suffix="" />
            <StatCard icon={Timer}       label="Avg Response"      value={stats?.avgResponseTimeHrs ?? 0}           color="#C9A84C" suffix="h" decimals={1} />
            <StatCard icon={TrendingDown} label="Oldest Unresolved" value={stats?.oldestUnresolvedDays ?? 0}        color="#EF4444" suffix="d" />
          </div>

          {/* ── Tab navigation ───────────────────────────────────────────────── */}
          <div className="flex gap-1 bg-white/[0.03] border border-white/6 rounded-2xl p-1">
            {([
              { id: 'tickets',       label: 'Tickets',           icon: MessageCircle },
              { id: 'messages',      label: 'Messages',          icon: Mail },
              { id: 'contact-forms', label: 'Contact Forms',     icon: StickyNote },
              { id: 'feedback',      label: 'Feedback',          icon: BarChart2 },
              { id: 'complaints',    label: 'Complaints',        icon: AlertTriangle },
              { id: 'announcements', label: 'Announcements',     icon: Bell },
              { id: 'canned',        label: 'Canned Responses',  icon: BookOpen },
              { id: 'routing',       label: 'Auto-Assignment',   icon: Route },
              { id: 'notifications', label: 'Notifications',     icon: Zap },
            ] as const).map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary text-black shadow-lg'
                      : 'text-white/40 hover:text-white'
                  }`}>
                  <Icon size={13} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB: TICKETS                                                       */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'tickets' && (
            <div className="space-y-4">

              {/* ── Filter bar ────────────────────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {/* Search */}
                  <div className="relative flex-1 min-w-48">
                    <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                      placeholder="Search tickets, users…"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/40 transition-colors" />
                  </div>
                  {/* Sort */}
                  <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:border-primary/40 transition-colors">
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {/* Toggle filters */}
                  <button onClick={() => setShowFilters(f => !f)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                      showFilters ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                    }`}>
                    <SlidersHorizontal size={13} /> Filters
                    {(statusFilter || priorityFilter || categoryFilter || dateRange) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                </div>

                {/* Expanded filters */}
                <AnimatePresence>
                  {showFilters && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden">
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                        {/* Status */}
                        <div>
                          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Status</label>
                          <div className="flex flex-wrap gap-1">
                            {['', ...STATUS_OPTIONS].map(s => (
                              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                                  statusFilter === s ? 'bg-primary text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'
                                }`}>
                                {s === '' ? 'All' : s.replace('_', ' ')}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Priority */}
                        <div>
                          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Priority</label>
                          <div className="flex flex-wrap gap-1">
                            {['', ...PRIORITY_OPTIONS].map(p => (
                              <button key={p} onClick={() => { setPriorityFilter(p); setPage(1); }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors capitalize ${
                                  priorityFilter === p ? 'bg-primary text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'
                                }`}>
                                {p === '' ? 'All' : p}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Category */}
                        <div>
                          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Category</label>
                          <div className="flex flex-wrap gap-1">
                            {['', ...CATEGORY_OPTIONS].map(c => (
                              <button key={c} onClick={() => { setCategoryFilter(c); setPage(1); }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                                  categoryFilter === c ? 'bg-primary text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'
                                }`}>
                                {c === '' ? 'All' : c}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Date range */}
                        <div>
                          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Date Range</label>
                          <div className="flex flex-wrap gap-1">
                            {DATE_RANGE_OPTIONS.map(d => (
                              <button key={d.value} onClick={() => { setDateRange(d.value); setPage(1); }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                                  dateRange === d.value ? 'bg-primary text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'
                                }`}>
                                {d.label}
                              </button>
                            ))}
                          </div>
                          {dateRange === 'custom' && (
                            <div className="flex gap-2 mt-2">
                              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-primary/40" />
                              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-primary/40" />
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Bulk actions bar ──────────────────────────────────────── */}
              {selected_ids.size > 0 && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-primary/8 border border-primary/20">
                  <span className="text-primary text-sm font-bold">{selected_ids.size} selected</span>
                  <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary/40">
                    <option value="">Choose action…</option>
                    <option value="resolve">Mark Resolved</option>
                    <option value="pending">Mark Pending</option>
                    <option value="close">Close Tickets</option>
                    <option value="assign">Assign to Team</option>
                    <option value="priority">Change Priority</option>
                    <option value="export">Export as CSV</option>
                  </select>
                  {bulkAction === 'assign' && (
                    <select value={bulkValue} onChange={e => setBulkValue(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary/40">
                      <option value="">Select team…</option>
                      {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  )}
                  {bulkAction === 'priority' && (
                    <select value={bulkValue} onChange={e => setBulkValue(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary/40">
                      <option value="">Select priority…</option>
                      {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  )}
                  <button onClick={() => void applyBulkAction()} disabled={!bulkAction || bulkLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-black text-sm font-bold disabled:opacity-50 transition-colors">
                    {bulkLoading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                    Apply
                  </button>
                  <button onClick={() => setSelectedIds(new Set())}
                    className="text-white/30 hover:text-white text-xs ml-auto transition-colors">Clear</button>
                </motion.div>
              )}

              {/* ── Main split layout ─────────────────────────────────────── */}
              <div className="grid lg:grid-cols-5 gap-4">

                {/* ── Ticket list ── */}
                <div className="lg:col-span-2 rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden flex flex-col" style={{ height: 680 }}>
                  {/* Select all row */}
                  <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5">
                    <input type="checkbox"
                      checked={selected_ids.size === tickets.length && tickets.length > 0}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 accent-primary rounded" />
                    <span className="text-white/30 text-[10px] uppercase tracking-wide flex-1">
                      {total} ticket{total !== 1 ? 's' : ''}
                    </span>
                    {selected_ids.size > 0 && (
                      <span className="text-primary text-[10px] font-semibold">{selected_ids.size} selected</span>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="p-4"><div className="h-12 bg-white/[0.04] rounded-xl animate-pulse" /></div>
                      ))
                    ) : tickets.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                        <MessageCircle size={28} className="text-white/10 mb-3" />
                        <p className="text-sm text-white/25">No tickets found</p>
                      </div>
                    ) : tickets.map(t => (
                      <div key={t.id}
                        className={`flex items-start gap-2 p-3 hover:bg-white/[0.03] transition-colors cursor-pointer ${
                          selected?.id === t.id ? 'bg-white/[0.05] border-l-2 border-primary' : ''
                        }`}>
                        <input type="checkbox" checked={selected_ids.has(t.id)}
                          onChange={() => toggleSelect(t.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-3.5 h-3.5 accent-primary rounded mt-1 shrink-0" />
                        <button className="flex-1 text-left min-w-0" onClick={() => setSelected(t)}>
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <p className="text-white text-xs font-semibold leading-snug line-clamp-1 flex-1">{t.subject}</p>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${PRIORITY_STYLES[t.priority]}`}>
                              {t.priority}
                            </span>
                          </div>
                          <p className="text-white/35 text-[10px] mb-1 truncate">{t.userName} · {t.category}</p>
                          <div className="flex items-center justify-between">
                            <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLES[t.status]}`}>
                              {STATUS_ICONS[t.status]}
                              {t.status.replace('_', ' ')}
                            </span>
                            <span className="text-white/20 text-[9px]">{ageLabel(t.updatedAt)}</span>
                          </div>
                          {t.assignedTo && (
                            <p className="text-white/20 text-[9px] mt-1 flex items-center gap-1">
                              <UserCheck size={8} /> {t.assignedTo}
                            </p>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-white/6 shrink-0">
                    <p className="text-white/25 text-[10px]">Page {page}/{pages}</p>
                    <div className="flex gap-1">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 disabled:opacity-30 hover:bg-white/8 transition-colors">
                        <ChevronLeft size={12} />
                      </button>
                      <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                        className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 disabled:opacity-30 hover:bg-white/8 transition-colors">
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Ticket detail ── */}
                <div className="lg:col-span-3">
                  <AnimatePresence mode="wait">
                    {selected ? (
                      <motion.div key={selected.id}
                        initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                        transition={{ duration: 0.18 }}
                        className="rounded-2xl border border-white/8 bg-white/[0.02] flex flex-col overflow-hidden"
                        style={{ height: 680 }}
                      >
                        {/* Ticket header */}
                        <div className="px-5 py-4 border-b border-white/6 shrink-0 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-bold text-sm leading-snug">{selected.subject}</p>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <span className="flex items-center gap-1 text-[10px] text-white/40">
                                  <User size={9} /> {selected.userName}
                                </span>
                                <span className="flex items-center gap-1 text-[10px] text-white/40">
                                  <Tag size={9} /> {selected.category}
                                </span>
                                <span className="text-[10px] text-white/20 font-mono">{selected.id}</span>
                              </div>
                            </div>
                            <button onClick={() => setSelected(null)}
                              className="p-1.5 rounded-lg hover:bg-white/8 text-white/30 hover:text-white transition-colors shrink-0">
                              <X size={14} />
                            </button>
                          </div>

                          {/* Status + Priority row */}
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-white/25 font-semibold uppercase tracking-wider">Status:</span>
                              <div className="flex gap-1 flex-wrap">
                                {STATUS_OPTIONS.map(s => (
                                  <button key={s} onClick={() => void updateStatus(selected.id, s)}
                                    disabled={updatingStatus}
                                    className={`flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full transition-colors disabled:opacity-50 ${
                                      selected.status === s ? STATUS_STYLES[s] : 'bg-white/5 text-white/25 hover:bg-white/10'
                                    }`}>
                                    {STATUS_ICONS[s]} {s.replace('_', ' ')}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Priority + Assign row */}
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-white/25 font-semibold uppercase tracking-wider">Priority:</span>
                              <div className="flex gap-1">
                                {PRIORITY_OPTIONS.map(p => (
                                  <button key={p} onClick={() => void updatePriority(selected.id, p)}
                                    className={`text-[9px] font-bold px-2 py-1 rounded-full transition-colors capitalize ${
                                      selected.priority === p ? PRIORITY_STYLES[p] : 'bg-white/5 text-white/25 hover:bg-white/10'
                                    }`}>
                                    {p}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {/* Assign */}
                            <div className="flex items-center gap-1.5 ml-auto">
                              <UserCheck size={10} className="text-white/25" />
                              <select value={assignInput} onChange={e => setAssignInput(e.target.value)}
                                className="bg-white/5 border border-white/8 rounded-lg px-2 py-1 text-white/60 text-[10px] focus:outline-none focus:border-primary/40">
                                <option value="">Unassigned</option>
                                {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <button onClick={() => void saveAssign()}
                                className="text-[9px] px-2 py-1 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors font-semibold">
                                Assign
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Detail sub-tabs */}
                        <div className="flex border-b border-white/5 shrink-0">
                          {([
                            { id: 'chat',  label: 'Conversation', icon: MessageCircle },
                            { id: 'notes', label: `Notes${selected.internalNotes?.length ? ` (${selected.internalNotes.length})` : ''}`, icon: StickyNote },
                            { id: 'user',  label: 'User Profile',  icon: User },
                          ] as const).map(tab => {
                            const Icon = tab.icon;
                            return (
                              <button key={tab.id}
                                onClick={() => {
                                  setDetailTab(tab.id);
                                  if (tab.id === 'user') void loadUserProfile(selected.userId);
                                }}
                                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                                  detailTab === tab.id
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-white/30 hover:text-white'
                                }`}>
                                <Icon size={11} /> {tab.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* ── Chat tab ── */}
                        {detailTab === 'chat' && (
                          <>
                            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                              {selected.messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.from === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-xs ${
                                    msg.from === 'admin'
                                      ? 'text-black rounded-br-sm'
                                      : 'bg-white/[0.07] text-white/80 rounded-bl-sm border border-white/6'
                                  }`} style={msg.from === 'admin' ? { background: 'linear-gradient(135deg, #C9A84C, #F0D080)' } : {}}>
                                    {msg.from === 'admin' && (
                                      <p className="text-[9px] font-bold text-black/50 mb-1 uppercase tracking-wider">
                                        {msg.adminName ?? 'Support Team'}
                                      </p>
                                    )}
                                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                    <p className={`text-[9px] mt-1.5 ${msg.from === 'admin' ? 'text-black/40' : 'text-white/25'}`}>
                                      {fmtDate(msg.ts)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                              <div ref={messagesEndRef} />
                            </div>

                            {/* Canned response picker */}
                            <AnimatePresence>
                              {showCannedPicker && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                  className="border-t border-white/5 overflow-hidden shrink-0">
                                  <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                                    <input value={cannedFilter} onChange={e => setCannedFilter(e.target.value)}
                                      placeholder="Search canned responses…"
                                      className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-1.5 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
                                    {filteredCanned.length === 0 ? (
                                      <p className="text-white/20 text-xs text-center py-2">No responses found</p>
                                    ) : filteredCanned.map(c => (
                                      <button key={c.id} onClick={() => { setReply(c.body); setShowCannedPicker(false); setCannedFilter(''); }}
                                        className="w-full text-left p-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-colors">
                                        <div className="flex items-center justify-between mb-0.5">
                                          <span className="text-white/80 text-xs font-semibold">{c.title}</span>
                                          <span className="text-[9px] text-white/25 bg-white/5 px-1.5 py-0.5 rounded">{c.category}</span>
                                        </div>
                                        <p className="text-white/35 text-[10px] line-clamp-1">{c.body}</p>
                                      </button>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Reply box */}
                            <form onSubmit={e => void sendReply(e)} className="p-4 border-t border-white/6 flex gap-2 shrink-0">
                              <div className="flex-1 relative">
                                <textarea value={reply} onChange={e => setReply(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendReply(e as unknown as React.FormEvent); } }}
                                  placeholder="Type your reply… (Enter to send)"
                                  rows={2}
                                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors resize-none pr-10" />
                                <button type="button" onClick={() => { setShowCannedPicker(p => !p); void fetchCanned(); }}
                                  title="Insert canned response"
                                  className={`absolute right-3 top-3 transition-colors ${showCannedPicker ? 'text-primary' : 'text-white/20 hover:text-white/50'}`}>
                                  <BookOpen size={14} />
                                </button>
                              </div>
                              <button type="submit" disabled={replySending || !reply.trim()}
                                className="relative px-4 rounded-xl font-bold text-black text-sm overflow-hidden shrink-0 disabled:opacity-50 self-end py-2.5">
                                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                                <span className="relative flex items-center gap-1.5">
                                  {replySending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                  Send
                                </span>
                              </button>
                            </form>

                            {/* Footer actions */}
                            <div className="px-5 pb-3 flex items-center justify-between shrink-0">
                              <p className="text-[10px] text-white/20">
                                Opened {fmtDateShort(selected.createdAt)} · {selected.messages.length} message{selected.messages.length !== 1 ? 's' : ''}
                              </p>
                              <div className="flex gap-2">
                                <button onClick={() => void updateStatus(selected.id, 'resolved')}
                                  disabled={selected.status === 'resolved' || updatingStatus}
                                  className="flex items-center gap-1 text-[10px] text-emerald-400/60 hover:text-emerald-400 disabled:opacity-30 transition-colors">
                                  <CheckCheck size={11} /> Resolve
                                </button>
                                <button onClick={() => void updateStatus(selected.id, 'closed')}
                                  disabled={selected.status === 'closed' || updatingStatus}
                                  className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 disabled:opacity-30 transition-colors">
                                  <Archive size={11} /> Close
                                </button>
                              </div>
                            </div>
                          </>
                        )}

                        {/* ── Notes tab ── */}
                        {detailTab === 'notes' && (
                          <>
                            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                              {(!selected.internalNotes || selected.internalNotes.length === 0) ? (
                                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                  <StickyNote size={24} className="text-white/10 mb-2" />
                                  <p className="text-white/25 text-sm">No internal notes yet</p>
                                  <p className="text-white/15 text-xs mt-1">Notes are only visible to the support team</p>
                                </div>
                              ) : selected.internalNotes.map(note => (
                                <div key={note.id} className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-amber-400/70 text-[10px] font-semibold flex items-center gap-1">
                                      <Shield size={9} /> {note.adminName ?? note.adminId}
                                    </span>
                                    <span className="text-white/20 text-[9px]">{fmtDate(note.ts)}</span>
                                  </div>
                                  <p className="text-white/70 text-xs leading-relaxed whitespace-pre-wrap">{note.text}</p>
                                </div>
                              ))}
                            </div>
                            <form onSubmit={e => void sendNote(e)} className="p-4 border-t border-white/6 flex gap-2 shrink-0">
                              <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                                placeholder="Add internal note (not visible to customer)…"
                                rows={2}
                                className="flex-1 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-500/30 transition-colors resize-none" />
                              <button type="submit" disabled={noteSending || !noteText.trim()}
                                className="px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/20 text-amber-400 font-bold text-sm disabled:opacity-50 shrink-0 self-end hover:bg-amber-500/25 transition-colors">
                                {noteSending ? <Loader2 size={14} className="animate-spin" /> : <StickyNote size={14} />}
                              </button>
                            </form>
                          </>
                        )}

                        {/* ── User profile tab ── */}
                        {detailTab === 'user' && (
                          <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {userLoading ? (
                              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-white/20" /></div>
                            ) : userProfile ? (
                              <>
                                <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                                  <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-lg">
                                    {userProfile.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-white font-bold">{userProfile.name}</p>
                                    <p className="text-white/40 text-xs">{userProfile.email}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <InfoRow label="Account Status" value={userProfile.status} />
                                  <InfoRow label="KYC Status" value={userProfile.kycStatus} />
                                  <InfoRow label="Account Type" value={userProfile.accountTier ?? 'Personal'} />
                                  <InfoRow label="Member Since" value={fmtDateShort(userProfile.createdAt)} />
                                </div>
                                <div className="flex gap-2 pt-2">
                                  <Link to={`/admin/users?id=${userProfile.id}`}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-white/50 text-xs hover:text-white transition-colors">
                                    <ExternalLink size={11} /> View Full Profile
                                  </Link>
                                  <Link to={`/admin/transactions?userId=${userProfile.id}`}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-white/50 text-xs hover:text-white transition-colors">
                                    <BarChart2 size={11} /> Transaction History
                                  </Link>
                                </div>
                              </>
                            ) : (
                              <div className="text-center py-8">
                                <User size={24} className="text-white/10 mx-auto mb-2" />
                                <p className="text-white/25 text-sm">User profile unavailable</p>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="rounded-2xl border border-white/8 bg-white/[0.02] flex flex-col items-center justify-center text-center"
                        style={{ height: 680 }}>
                        <div className="w-16 h-16 rounded-2xl bg-white/4 flex items-center justify-center mb-4">
                          <MessageCircle size={28} className="text-white/15" />
                        </div>
                        <p className="text-sm font-semibold text-white/30 mb-1">No ticket selected</p>
                        <p className="text-xs text-white/20">Click a ticket from the list to view the conversation</p>
                        {stats && stats.totalOpen > 0 && (
                          <div className="mt-6 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/15">
                            <AlertTriangle size={13} className="text-amber-400" />
                            <p className="text-xs text-amber-400/80">{stats.totalOpen} open ticket{stats.totalOpen !== 1 ? 's' : ''} awaiting reply</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB: CANNED RESPONSES                                              */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'canned' && (
            <motion.div key="canned" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold">Canned Responses</h2>
                  <p className="text-white/30 text-xs mt-0.5">Saved reply templates for common support scenarios</p>
                </div>
                <button onClick={() => setCannedForm({ category: 'General' })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-black font-bold text-sm">
                  <Plus size={14} /> New Response
                </button>
              </div>

              {/* Category filter */}
              <div className="flex gap-1.5 flex-wrap">
                {['', ...CANNED_CATEGORIES].map(cat => (
                  <button key={cat} onClick={() => setCannedCatFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      cannedCatFilter === cat ? 'bg-primary text-black' : 'bg-white/5 text-white/40 hover:bg-white/8'
                    }`}>
                    {cat === '' ? 'All' : cat}
                  </button>
                ))}
              </div>

              {/* Edit/create form */}
              <AnimatePresence>
                {cannedForm !== null && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden">
                    <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5 space-y-3">
                      <h3 className="text-white font-semibold text-sm">{cannedForm.id ? 'Edit Response' : 'New Canned Response'}</h3>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1 block">Title</label>
                          <input value={cannedForm.title ?? ''} onChange={e => setCannedForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="e.g. KYC Under Review"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
                        </div>
                        <div>
                          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1 block">Category</label>
                          <select value={cannedForm.category ?? 'General'} onChange={e => setCannedForm(f => ({ ...f, category: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors">
                            {CANNED_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1 block">Response Body</label>
                        <textarea value={cannedForm.body ?? ''} onChange={e => setCannedForm(f => ({ ...f, body: e.target.value }))}
                          rows={4} placeholder="Type the response text…"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors resize-none" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => void saveCanned()} disabled={cannedSaving}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50">
                          {cannedSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                          {cannedForm.id ? 'Update' : 'Create'}
                        </button>
                        <button onClick={() => setCannedForm(null)}
                          className="px-4 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/8 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Canned list */}
              {cannedLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-white/20" /></div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {canned
                    .filter(c => !cannedCatFilter || c.category === cannedCatFilter)
                    .map(c => (
                      <div key={c.id} className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold text-sm">{c.title}</p>
                            <span className="text-[9px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded mt-0.5 inline-block">{c.category}</span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => setCannedForm({ ...c })}
                              className="p-1.5 rounded-lg bg-white/5 text-white/30 hover:text-white hover:bg-white/10 transition-colors">
                              <Pencil size={11} />
                            </button>
                            <button onClick={() => void deleteCanned(c.id)}
                              className="p-1.5 rounded-lg bg-white/5 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                        <p className="text-white/40 text-xs leading-relaxed line-clamp-3">{c.body}</p>
                      </div>
                    ))}
                  {canned.filter(c => !cannedCatFilter || c.category === cannedCatFilter).length === 0 && (
                    <div className="col-span-2 text-center py-8">
                      <BookOpen size={24} className="text-white/10 mx-auto mb-2" />
                      <p className="text-white/25 text-sm">No canned responses in this category</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB: AUTO-ASSIGNMENT ROUTING                                       */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'routing' && (
            <motion.div key="routing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold">Auto-Assignment Rules</h2>
                  <p className="text-white/30 text-xs mt-0.5">Tickets are automatically routed to the matching team when created. Can be overridden manually.</p>
                </div>
                <button onClick={() => void saveRouting()} disabled={routingSaving}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50">
                  {routingSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Save Rules
                </button>
              </div>

              {/* Info callout */}
              <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/15 flex items-start gap-2.5">
                <Route size={13} className="text-blue-400 shrink-0 mt-0.5" />
                <p className="text-white/40 text-xs leading-relaxed">
                  When a new ticket is created, the system checks the ticket category against these rules (top to bottom) and assigns it to the first matching team.
                  Rules can be toggled on/off without deleting them. Manual assignment always overrides auto-routing.
                </p>
              </div>

              {routingLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-white/20" /></div>
              ) : (
                <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-0 px-5 py-3 border-b border-white/5 text-[10px] uppercase tracking-wide text-white/25">
                    <span className="w-8" />
                    <span>Ticket Category</span>
                    <span>Assign To</span>
                    <span>Enabled</span>
                  </div>
                  <div className="divide-y divide-white/[0.03]">
                    {routing.map((rule, i) => (
                      <div key={rule.id} className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                        <span className="w-8 text-white/20 text-xs font-mono">{i + 1}</span>
                        <select value={rule.category}
                          onChange={e => setRouting(rs => rs.map((r, j) => j === i ? { ...r, category: e.target.value } : r))}
                          className="bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors">
                          {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                          <option value="Wire">Wire</option>
                          <option value="Transfer">Transfer</option>
                        </select>
                        <select value={rule.assignTo}
                          onChange={e => setRouting(rs => rs.map((r, j) => j === i ? { ...r, assignTo: e.target.value } : r))}
                          className="bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors">
                          {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button onClick={() => setRouting(rs => rs.map((r, j) => j === i ? { ...r, enabled: !r.enabled } : r))}
                          className={`transition-colors ${rule.enabled ? 'text-emerald-400' : 'text-white/20'}`}>
                          {rule.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB: NOTIFICATION SETTINGS                                         */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'notifications' && (
            <motion.div key="notifications" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold">Notification Settings</h2>
                  <p className="text-white/30 text-xs mt-0.5">Control when and how you receive support alerts</p>
                </div>
                <button onClick={() => void saveNotifSettings()} disabled={notifSaving || !notifSettings}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50">
                  {notifSaving ? <Loader2 size={13} className="animate-spin" /> : notifSaved ? <CheckCircle size={13} /> : <Save size={13} />}
                  {notifSaved ? 'Saved!' : 'Save Settings'}
                </button>
              </div>

              {notifLoading || !notifSettings ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-white/20" /></div>
              ) : (
                <div className="space-y-3">
                  {/* Notify email */}
                  <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02] space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Mail size={14} className="text-white/40" />
                      <h3 className="text-white font-semibold text-sm">Admin Notification Email</h3>
                    </div>
                    <input value={notifSettings.notifyEmail}
                      onChange={e => setNotifSettings(s => s ? { ...s, notifyEmail: e.target.value } : s)}
                      placeholder="admin@citygate.capital"
                      type="email"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
                    <p className="text-white/25 text-xs">Email address to receive support alert notifications</p>
                  </div>

                  {/* Urgent ticket */}
                  <NotifSection
                    icon={AlertTriangle} color="#EF4444"
                    title="Urgent Priority Ticket Created"
                    description="Alert when a new ticket is created with Urgent priority"
                    inPanel={notifSettings.urgentTicketInPanel}
                    email={notifSettings.urgentTicketEmail}
                    onInPanel={v => setNotifSettings(s => s ? { ...s, urgentTicketInPanel: v } : s)}
                    onEmail={v => setNotifSettings(s => s ? { ...s, urgentTicketEmail: v } : s)}
                  />

                  {/* No response */}
                  <NotifSection
                    icon={Clock} color="#F59E0B"
                    title="No Response Timeout"
                    description={`Alert when a ticket has had no response for more than ${notifSettings.noResponseHours} hours`}
                    inPanel={notifSettings.noResponseInPanel}
                    email={notifSettings.noResponseEmail}
                    onInPanel={v => setNotifSettings(s => s ? { ...s, noResponseInPanel: v } : s)}
                    onEmail={v => setNotifSettings(s => s ? { ...s, noResponseEmail: v } : s)}
                    extra={
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-white/30 text-xs">Timeout threshold:</span>
                        <input type="number" min="1" max="168" value={notifSettings.noResponseHours}
                          onChange={e => setNotifSettings(s => s ? { ...s, noResponseHours: Number(e.target.value) || 24 } : s)}
                          className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors" />
                        <span className="text-white/30 text-xs">hours</span>
                      </div>
                    }
                  />

                  {/* Reopened */}
                  <NotifSection
                    icon={RefreshCw} color="#6366F1"
                    title="Resolved Ticket Reopened"
                    description="Alert when a customer replies to a previously resolved or closed ticket"
                    inPanel={notifSettings.reopenedInPanel}
                    email={notifSettings.reopenedEmail}
                    onInPanel={v => setNotifSettings(s => s ? { ...s, reopenedInPanel: v } : s)}
                    onEmail={v => setNotifSettings(s => s ? { ...s, reopenedEmail: v } : s)}
                  />
                </div>
              )}
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB: MESSAGES                                                      */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'messages' && (
            <MessagesTab showToast={(msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); }} />
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB: CONTACT FORMS                                                 */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'contact-forms' && (
            <ContactFormsTab showToast={(msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); }} />
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB: FEEDBACK                                                      */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'feedback' && (
            <FeedbackTab showToast={(msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); }} />
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB: COMPLAINTS                                                    */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'complaints' && (
            <ComplaintsTab showToast={(msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); }} />
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB: ANNOUNCEMENTS                                                 */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'announcements' && (
            <AnnouncementsTab showToast={(msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); }} />
          )}

        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className={`fixed bottom-6 right-6 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl z-50 ${
                toast.ok
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/20 border border-red-500/30 text-red-400'
              }`}>
              {toast.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>
      </AdminLayout>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, color, suffix = '', decimals = 0,
}: {
  icon: typeof MessageCircle; label: string; value: number; color: string; suffix?: string; decimals?: number;
}) {
  return (
    <div className="rounded-2xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
          <Icon size={13} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value.toFixed(decimals)}{suffix}</p>
      <p className="text-white/30 text-xs mt-0.5 font-medium">{label}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
      <p className="text-white/30 text-[10px] uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-white text-sm font-semibold capitalize">{value.replace('_', ' ')}</p>
    </div>
  );
}

function NotifSection({
  icon: Icon, color, title, description, inPanel, email, onInPanel, onEmail, extra,
}: {
  icon: typeof AlertTriangle; color: string; title: string; description: string;
  inPanel: boolean; email: boolean;
  onInPanel: (v: boolean) => void; onEmail: (v: boolean) => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02]">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}15` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">{title}</p>
          <p className="text-white/35 text-xs mt-0.5">{description}</p>
          {extra}
          <div className="flex gap-4 mt-3">
            <ToggleRow label="In-panel alert" value={inPanel} onChange={onInPanel} />
            <ToggleRow label="Email alert"    value={email}   onChange={onEmail} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex items-center gap-2 group">
      {value
        ? <ToggleRight size={18} className="text-emerald-400" />
        : <ToggleLeft  size={18} className="text-white/20 group-hover:text-white/40 transition-colors" />}
      <span className={`text-xs font-semibold transition-colors ${value ? 'text-white/70' : 'text-white/25 group-hover:text-white/40'}`}>
        {label}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Messages Tab
// ─────────────────────────────────────────────────────────────────────────────
function MessagesTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [msgs,     setMsgs]     = useState<any[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [reply,    setReply]    = useState('');
  const [sending,  setSending]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: '1', limit: '30' });
    if (search) p.set('search', search);
    if (filter === 'unread') p.set('read', 'false');
    if (filter === 'starred') p.set('starred', 'true');
    if (filter === 'archived') p.set('archived', 'true');
    const r = await fetch(`/api/admin/support/messages?${p}`, { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setMsgs(d.data ?? []); setTotal(d.total ?? 0); }
    setLoading(false);
  }, [search, filter]);

  useEffect(() => { load(); }, [load]);

  async function markRead(id: string) {
    await fetch('/api/admin/support/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ action: 'mark_read', id }) });
    load();
  }
  async function star(id: string, starred: boolean) {
    await fetch('/api/admin/support/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ action: 'star', id, starred }) });
    load();
  }
  async function archive(id: string) {
    await fetch('/api/admin/support/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ action: 'archive', id }) });
    setSelected(null); load();
  }
  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    const r = await fetch('/api/admin/support/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ action: 'reply', id: selected.id, body: reply.trim(), adminName: 'Admin' }) });
    setSending(false);
    if (r.ok) { showToast('Reply sent'); setReply(''); load(); } else showToast('Send failed', false);
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages…"
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-8 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
        </div>
        {['', 'unread', 'starred', 'archived'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${filter === f ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/8 text-white/40 hover:text-white'}`}>
            {f === '' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <p className="ml-auto text-white/25 text-xs self-center">{total} messages</p>
      </div>

      <div className="flex gap-4" style={{ minHeight: 400 }}>
        {/* List */}
        <div className="w-72 shrink-0 space-y-1.5">
          {loading ? <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-white/20" /></div>
          : msgs.length === 0 ? <div className="flex flex-col items-center py-10 gap-2 text-white/20"><Mail size={20} /><p className="text-xs">No messages</p></div>
          : msgs.map(m => (
            <button key={m.id} onClick={() => { setSelected(m); if (!m.read) markRead(m.id); }}
              className={`w-full text-left px-3 py-3 rounded-xl border transition-all ${selected?.id === m.id ? 'border-primary/30 bg-primary/5' : 'border-white/5 hover:border-white/10 hover:bg-white/[0.02]'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-xs font-medium truncate ${m.read ? 'text-white/60' : 'text-white'}`}>{m.fromName}</p>
                <div className="flex items-center gap-1">
                  {!m.read && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  {m.starred && <Star size={9} className="text-amber-400 fill-amber-400" />}
                </div>
              </div>
              <p className="text-white/40 text-[10px] truncate">{m.subject}</p>
              <p className="text-white/20 text-[9px] mt-0.5">{fmtDateShort(m.createdAt)}</p>
            </button>
          ))}
        </div>

        {/* Detail */}
        <div className="flex-1 rounded-2xl border border-white/5 flex flex-col overflow-hidden" style={{ background: 'rgba(255,255,255,0.015)' }}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-white/20"><Mail size={28} /><p className="text-sm">Select a message</p></div>
          ) : (
            <>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div>
                  <p className="text-white font-semibold">{selected.subject}</p>
                  <p className="text-white/30 text-xs">{selected.fromName} · {selected.fromEmail}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => star(selected.id, !selected.starred)} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${selected.starred ? 'bg-amber-500/15 text-amber-400' : 'bg-white/5 text-white/30 hover:text-white'}`}><Star size={12} /></button>
                  <button onClick={() => archive(selected.id)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:text-white"><Archive size={12} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{selected.body}</p>
                {selected.replyBody && (
                  <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
                    <p className="text-primary/70 text-[10px] uppercase tracking-wide mb-2">Your Reply · {fmtDate(selected.repliedAt)}</p>
                    <p className="text-white/60 text-sm whitespace-pre-wrap">{selected.replyBody}</p>
                  </div>
                )}
              </div>
              {!selected.replyBody && (
                <div className="flex gap-2 p-4 border-t border-white/5">
                  <textarea value={reply} onChange={e => setReply(e.target.value)} rows={2} placeholder="Write a reply…"
                    className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 resize-none" />
                  <button onClick={sendReply} disabled={sending || !reply.trim()}
                    className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40 self-end"
                    style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
                    {sending ? <Loader2 size={14} className="animate-spin text-black" /> : <Send size={14} className="text-black" />}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact Forms Tab
// ─────────────────────────────────────────────────────────────────────────────
function ContactFormsTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [items,   setItems]   = useState<any[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [status,  setStatus]  = useState('');
  const [search,  setSearch]  = useState('');
  const [selected,setSelected]= useState<any | null>(null);
  const [reply,   setReply]   = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: '1', limit: '30' });
    if (status) p.set('status', status);
    if (search) p.set('search', search);
    const r = await fetch(`/api/admin/support/contact-forms?${p}`, { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setItems(d.data ?? []); setTotal(d.total ?? 0); }
    setLoading(false);
  }, [status, search]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, newStatus: string) {
    await fetch('/api/admin/support/contact-forms', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ action: 'update', id, status: newStatus }) });
    load();
  }
  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    const r = await fetch('/api/admin/support/contact-forms', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ action: 'update', id: selected.id, replyBody: reply.trim(), repliedAt: new Date().toISOString(), status: 'replied' }) });
    setSending(false);
    if (r.ok) { showToast('Reply saved'); setReply(''); load(); } else showToast('Failed', false);
  }

  const STATUS_CF: Record<string, string> = { new: 'bg-emerald-500/15 text-emerald-400', read: 'bg-white/8 text-white/40', replied: 'bg-blue-500/15 text-blue-400', archived: 'bg-white/5 text-white/20' };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search submissions…"
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-8 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
          <option value="">All Statuses</option>
          {['new','read','replied','archived'].map(s => <option key={s} value={s} className="bg-[#0A0A0A] capitalize">{s}</option>)}
        </select>
        <p className="ml-auto text-white/25 text-xs self-center">{total} submissions</p>
      </div>

      <div className="flex gap-4" style={{ minHeight: 400 }}>
        <div className="w-72 shrink-0 space-y-1.5">
          {loading ? <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-white/20" /></div>
          : items.length === 0 ? <div className="flex flex-col items-center py-10 gap-2 text-white/20"><StickyNote size={20} /><p className="text-xs">No submissions</p></div>
          : items.map(item => (
            <button key={item.id} onClick={() => { setSelected(item); updateStatus(item.id, item.status === 'new' ? 'read' : item.status); }}
              className={`w-full text-left px-3 py-3 rounded-xl border transition-all ${selected?.id === item.id ? 'border-primary/30 bg-primary/5' : 'border-white/5 hover:border-white/10 hover:bg-white/[0.02]'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-white/80 text-xs font-medium truncate">{item.name}</p>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_CF[item.status]}`}>{item.status}</span>
              </div>
              <p className="text-white/40 text-[10px] truncate">{item.subject}</p>
              <p className="text-white/20 text-[9px] mt-0.5">{item.source} · {fmtDateShort(item.createdAt)}</p>
            </button>
          ))}
        </div>

        <div className="flex-1 rounded-2xl border border-white/5 flex flex-col overflow-hidden" style={{ background: 'rgba(255,255,255,0.015)' }}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-white/20"><StickyNote size={28} /><p className="text-sm">Select a submission</p></div>
          ) : (
            <>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div>
                  <p className="text-white font-semibold">{selected.subject}</p>
                  <p className="text-white/30 text-xs">{selected.name} · {selected.email} {selected.phone && `· ${selected.phone}`}</p>
                </div>
                <select value={selected.status} onChange={e => { updateStatus(selected.id, e.target.value); setSelected((s: any) => ({ ...s, status: e.target.value })); }}
                  className={`text-[10px] font-bold px-2 py-1 rounded-full border-0 focus:outline-none cursor-pointer ${STATUS_CF[selected.status]}`} style={{ background: 'transparent' }}>
                  {['new','read','replied','archived'].map(s => <option key={s} value={s} className="bg-[#0A0A0A] text-white capitalize">{s}</option>)}
                </select>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{selected.message}</p>
                {selected.replyBody && (
                  <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
                    <p className="text-primary/70 text-[10px] uppercase tracking-wide mb-2">Reply sent · {fmtDate(selected.repliedAt)}</p>
                    <p className="text-white/60 text-sm whitespace-pre-wrap">{selected.replyBody}</p>
                  </div>
                )}
              </div>
              {!selected.replyBody && (
                <div className="flex gap-2 p-4 border-t border-white/5">
                  <textarea value={reply} onChange={e => setReply(e.target.value)} rows={2} placeholder="Write a reply…"
                    className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 resize-none" />
                  <button onClick={sendReply} disabled={sending || !reply.trim()}
                    className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40 self-end"
                    style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
                    {sending ? <Loader2 size={14} className="animate-spin text-black" /> : <Send size={14} className="text-black" />}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Feedback Tab
// ─────────────────────────────────────────────────────────────────────────────
function FeedbackTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [items,   setItems]   = useState<any[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [type,    setType]    = useState('');
  const [status,  setStatus]  = useState('');
  const [search,  setSearch]  = useState('');
  const [selected,setSelected]= useState<any | null>(null);
  const [response,setResponse]= useState('');
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: '1', limit: '30' });
    if (type)   p.set('type',   type);
    if (status) p.set('status', status);
    if (search) p.set('search', search);
    const r = await fetch(`/api/admin/support/feedback?${p}`, { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setItems(d.data ?? []); setTotal(d.total ?? 0); }
    setLoading(false);
  }, [type, status, search]);

  useEffect(() => { load(); }, [load]);

  async function updateItem(id: string, patch: Record<string, unknown>) {
    const r = await fetch('/api/admin/support/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ action: 'update', id, ...patch }) });
    if (r.ok) { showToast('Updated'); load(); } else showToast('Failed', false);
  }
  async function respond() {
    if (!selected || !response.trim()) return;
    setSaving(true);
    await updateItem(selected.id, { adminResponse: response.trim(), respondedAt: new Date().toISOString(), status: 'under_review' });
    setSaving(false); setResponse('');
  }

  const TYPE_COLORS: Record<string, string> = { general: 'bg-white/8 text-white/40', feature_request: 'bg-blue-500/15 text-blue-400', bug_report: 'bg-red-500/15 text-red-400', compliment: 'bg-emerald-500/15 text-emerald-400', other: 'bg-white/5 text-white/25' };
  const STATUS_FB: Record<string, string> = { new: 'bg-emerald-500/15 text-emerald-400', under_review: 'bg-amber-500/15 text-amber-400', planned: 'bg-blue-500/15 text-blue-400', implemented: 'bg-emerald-500/20 text-emerald-300', declined: 'bg-red-500/15 text-red-400', closed: 'bg-white/5 text-white/20' };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search feedback…"
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-8 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
        </div>
        <select value={type} onChange={e => setType(e.target.value)} className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
          <option value="">All Types</option>
          {['general','feature_request','bug_report','compliment','other'].map(t => <option key={t} value={t} className="bg-[#0A0A0A]">{t.replace('_',' ')}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
          <option value="">All Statuses</option>
          {['new','under_review','planned','implemented','declined','closed'].map(s => <option key={s} value={s} className="bg-[#0A0A0A]">{s.replace('_',' ')}</option>)}
        </select>
        <p className="ml-auto text-white/25 text-xs self-center">{total} entries</p>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 size={18} className="animate-spin text-white/20" /></div>
      : items.length === 0 ? <div className="flex flex-col items-center py-12 gap-2 text-white/20"><BarChart2 size={24} /><p className="text-sm">No feedback yet</p></div>
      : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="rounded-2xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${TYPE_COLORS[item.type]}`}>{item.type.replace('_',' ')}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${STATUS_FB[item.status]}`}>{item.status.replace('_',' ')}</span>
                    {item.rating && <div className="flex items-center gap-0.5">{Array.from({ length: item.rating }).map((_, i) => <Star key={i} size={9} className="text-amber-400 fill-amber-400" />)}</div>}
                  </div>
                  <p className="text-white/80 text-sm font-medium">{item.title}</p>
                  <p className="text-white/40 text-xs mt-1 line-clamp-2">{item.body}</p>
                  <p className="text-white/20 text-[10px] mt-1">{item.userName} · {fmtDateShort(item.createdAt)} · {item.upvotes} upvotes</p>
                  {item.adminResponse && (
                    <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/15">
                      <p className="text-primary/60 text-[9px] uppercase tracking-wide mb-1">Admin response</p>
                      <p className="text-white/50 text-xs">{item.adminResponse}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <select value={item.status} onChange={e => updateItem(item.id, { status: e.target.value })}
                    className="bg-white/[0.04] border border-white/8 rounded-lg px-2 py-1 text-white/50 text-[10px] focus:outline-none">
                    {['new','under_review','planned','implemented','declined','closed'].map(s => <option key={s} value={s} className="bg-[#0A0A0A]">{s.replace('_',' ')}</option>)}
                  </select>
                  <button onClick={() => setSelected(selected?.id === item.id ? null : item)}
                    className="px-2 py-1 rounded-lg bg-white/5 text-white/30 text-[10px] hover:text-white hover:bg-white/10">
                    {selected?.id === item.id ? 'Close' : 'Respond'}
                  </button>
                </div>
              </div>
              {selected?.id === item.id && !item.adminResponse && (
                <div className="mt-3 flex gap-2">
                  <textarea value={response} onChange={e => setResponse(e.target.value)} rows={2} placeholder="Write a response…"
                    className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 resize-none" />
                  <button onClick={respond} disabled={saving || !response.trim()}
                    className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40 self-end"
                    style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
                    {saving ? <Loader2 size={14} className="animate-spin text-black" /> : <Send size={14} className="text-black" />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Complaints Tab
// ─────────────────────────────────────────────────────────────────────────────
function ComplaintsTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [items,    setItems]    = useState<any[]>([]);
  const [, setTotal]            = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [status,   setStatus]   = useState('');
  const [severity, setSeverity] = useState('');
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [form,     setForm]     = useState<Record<string, string>>({});
  const [saving,   setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: '1', limit: '30' });
    if (status)   p.set('status',   status);
    if (severity) p.set('severity', severity);
    if (search)   p.set('search',   search);
    const r = await fetch(`/api/admin/support/complaints?${p}`, { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setItems(d.data ?? []); setTotal(d.total ?? 0); }
    setLoading(false);
  }, [status, severity, search]);

  useEffect(() => { load(); }, [load]);

  async function updateItem(id: string, patch: Record<string, unknown>) {
    const r = await fetch('/api/admin/support/complaints', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ action: 'update', id, ...patch }) });
    if (r.ok) {
      const body = await r.json();
      if (selected?.id === id) setSelected(body.complaint);
      showToast('Updated');
      load();
    } else {
      const body = await r.json().catch(() => ({}));
      showToast(body.error ?? 'Update failed', false);
    }
  }
  async function create() {
    setSaving(true);
    const r = await fetch('/api/admin/support/complaints', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(form) });
    setSaving(false);
    if (r.ok) { showToast('Complaint logged'); setCreating(false); setForm({}); load(); }
    else { const body = await r.json().catch(() => ({})); showToast(body.error ?? 'Complaint could not be logged', false); }
  }

  const SEV: Record<string, string> = { low: 'bg-white/8 text-white/40', medium: 'bg-blue-500/15 text-blue-400', high: 'bg-amber-500/15 text-amber-400', critical: 'bg-red-500/15 text-red-400' };
  const STAT_C: Record<string, string> = { open: 'bg-emerald-500/15 text-emerald-400', investigating: 'bg-amber-500/15 text-amber-400', escalated: 'bg-red-500/15 text-red-400', resolved: 'bg-white/10 text-white/40', closed: 'bg-white/5 text-white/20' };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search complaints…"
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-8 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
          <option value="">All Statuses</option>
          {['open','investigating','escalated','resolved','closed'].map(s => <option key={s} value={s} className="bg-[#0A0A0A] capitalize">{s}</option>)}
        </select>
        <select value={severity} onChange={e => setSeverity(e.target.value)} className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
          <option value="">All Severities</option>
          {['low','medium','high','critical'].map(s => <option key={s} value={s} className="bg-[#0A0A0A] capitalize">{s}</option>)}
        </select>
        <button onClick={() => { setCreating(true); setForm({ severity: 'medium', category: 'other' }); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-black"
          style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
          <Plus size={13} /> Log Complaint
        </button>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 size={18} className="animate-spin text-white/20" /></div>
      : items.length === 0 ? <div className="flex flex-col items-center py-12 gap-2 text-white/20"><AlertTriangle size={24} /><p className="text-sm">No complaints</p></div>
      : (
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <table className="w-full">
            <thead><tr className="border-b border-white/5">{['ID','Customer','Subject','Severity','Status','Category','Date','Action'].map(h => <th key={h} className="text-left px-4 py-3 text-white/25 text-[10px] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-white/[0.03]">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white/40 text-[10px] font-mono">{item.id}</td>
                  <td className="px-4 py-3"><p className="text-white/70 text-xs">{item.userName}</p><p className="text-white/25 text-[10px]">{item.userEmail}</p></td>
                  <td className="px-4 py-3 text-white/60 text-xs max-w-[160px] truncate">{item.subject}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${SEV[item.severity]}`}>{item.severity}</span></td>
                  <td className="px-4 py-3">
                    <select value={item.status} onChange={e => updateItem(item.id, { status: e.target.value })}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-0 focus:outline-none cursor-pointer capitalize ${STAT_C[item.status]}`} style={{ background: 'transparent' }}>
                      {['open','investigating','escalated'].map(s => <option key={s} value={s} className="bg-[#0A0A0A] text-white capitalize">{s}</option>)}
                      {(item.status === 'resolved' || item.status === 'closed') && <option value={item.status} className="bg-[#0A0A0A] text-white capitalize">{item.status}</option>}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs capitalize">{item.category}</td>
                  <td className="px-4 py-3 text-white/25 text-[10px] whitespace-nowrap">{fmtDateShort(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelected(selected?.id === item.id ? null : item)} className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10"><Eye size={10} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className="rounded-2xl border border-white/8 p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.025)' }}>
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold">{selected.subject}</p>
              <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white"><X size={14} /></button>
            </div>
            <p className="text-white/50 text-sm leading-relaxed">{selected.description}</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-white/25 block">Internal response target</span><span className="text-white/60">{fmtDateShort(selected.responseDueAt)}</span></div>
              <div><span className="text-white/25 block">Regulatory escalation</span><span className={selected.regulatoryFlag ? 'text-amber-400' : 'text-white/60'}>{selected.regulatoryFlag ? 'Flagged' : 'Not flagged'}</span></div>
            </div>
            <div>
              <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Resolution Notes</label>
              <textarea rows={3} value={selected.resolution ?? ''} onChange={e => setSelected({ ...selected, resolution: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => updateItem(selected.id, { status: 'resolved', resolution: selected.resolution })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20"><CheckCircle size={10} /> Save &amp; Resolve</button>
              <button onClick={() => updateItem(selected.id, { status: 'escalated' })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20"><AlertTriangle size={10} /> Escalate</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create modal */}
      <AnimatePresence>
        {creating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}
            onClick={() => setCreating(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl border border-white/10 p-6 space-y-4" style={{ background: '#111' }}>
              <div className="flex items-center justify-between">
                <p className="text-white font-semibold">Log Complaint</p>
                <button onClick={() => setCreating(false)} className="text-white/30 hover:text-white"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[['userName','Customer Name','John Smith'],['userEmail','Customer Email','john@example.com'],['userPhone','Phone',''],['subject','Subject','']].map(([k,l,p]) => (
                  <div key={k}>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">{l}</label>
                    <input value={form[k] ?? ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={p}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Description</label>
                <textarea rows={3} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Severity</label>
                  <select value={form.severity ?? 'medium'} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                    {['low','medium','high','critical'].map(s => <option key={s} value={s} className="bg-[#0A0A0A] capitalize">{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Category</label>
                  <select value={form.category ?? 'other'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                    {['transaction','account','card','kyc','staff','technical','other'].map(c => <option key={c} value={c} className="bg-[#0A0A0A] capitalize">{c}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={create} disabled={saving || !form.subject}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-black text-sm disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
                Log Complaint
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Announcements Tab
// ─────────────────────────────────────────────────────────────────────────────
function AnnouncementsTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [items,   setItems]   = useState<any[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/support/announcements?limit=50', { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setItems(d.data ?? []); setTotal(d.total ?? 0); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!editing) return;
    setSaving(true);
    const r = await fetch('/api/admin/support/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(editing) });
    setSaving(false);
    if (r.ok) { showToast(editing.id ? 'Announcement updated' : 'Announcement created'); setEditing(null); load(); } else showToast('Failed', false);
  }
  async function del(id: string) {
    const r = await fetch('/api/admin/support/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ action: 'delete', id }) });
    if (r.ok) { showToast('Deleted'); load(); } else showToast('Failed', false);
  }
  async function publish(id: string) {
    const r = await fetch('/api/admin/support/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ id, status: 'active' }) });
    if (r.ok) { showToast('Published'); load(); } else showToast('Failed', false);
  }

  const TYPE_COLORS: Record<string, string> = { info: 'bg-blue-500/15 text-blue-400', warning: 'bg-amber-500/15 text-amber-400', success: 'bg-emerald-500/15 text-emerald-400', maintenance: 'bg-red-500/15 text-red-400', promotion: 'bg-primary/15 text-primary' };
  const STATUS_AN: Record<string, string> = { draft: 'bg-white/8 text-white/40', scheduled: 'bg-blue-500/15 text-blue-400', active: 'bg-emerald-500/15 text-emerald-400', expired: 'bg-white/5 text-white/20' };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-xs">{total} announcements · {items.filter(a => a.status === 'active').length} active</p>
        <button onClick={() => setEditing({ title: '', body: '', type: 'info', audience: 'all', channels: ['banner'], status: 'draft' })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-black"
          style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
          <Plus size={13} /> New Announcement
        </button>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 size={18} className="animate-spin text-white/20" /></div>
      : items.length === 0 ? <div className="flex flex-col items-center py-12 gap-2 text-white/20"><Bell size={24} /><p className="text-sm">No announcements</p></div>
      : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="rounded-2xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${TYPE_COLORS[item.type]}`}>{item.type}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${STATUS_AN[item.status]}`}>{item.status}</span>
                    <span className="text-white/20 text-[9px]">→ {item.audience}</span>
                  </div>
                  <p className="text-white/80 text-sm font-medium">{item.title}</p>
                  <p className="text-white/40 text-xs mt-1 line-clamp-2">{item.body}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {(item.channels ?? []).map((ch: string) => <span key={ch} className="text-[9px] px-1.5 py-0.5 rounded-lg bg-white/5 text-white/30 font-mono">{ch}</span>)}
                    <span className="text-white/20 text-[9px]">{fmtDateShort(item.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.status === 'draft' && (
                    <button onClick={() => publish(item.id)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold hover:bg-emerald-500/20"><Zap size={9} /> Publish</button>
                  )}
                  <button onClick={() => setEditing(item)} className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10"><Edit2 size={10} /></button>
                  <button onClick={() => del(item.id)} className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/20"><Trash2 size={10} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create modal */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}
            onClick={() => setEditing(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl border border-white/10 p-6 space-y-4" style={{ background: '#111' }}>
              <div className="flex items-center justify-between">
                <p className="text-white font-semibold">{editing.id ? 'Edit Announcement' : 'New Announcement'}</p>
                <button onClick={() => setEditing(null)} className="text-white/30 hover:text-white"><X size={16} /></button>
              </div>
              <div>
                <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Title</label>
                <input value={editing.title ?? ''} onChange={e => setEditing((p: any) => ({ ...p, title: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
              </div>
              <div>
                <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Body</label>
                <textarea rows={4} value={editing.body ?? ''} onChange={e => setEditing((p: any) => ({ ...p, body: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Type</label>
                  <select value={editing.type ?? 'info'} onChange={e => setEditing((p: any) => ({ ...p, type: e.target.value }))} className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                    {['info','warning','success','maintenance','promotion'].map(t => <option key={t} value={t} className="bg-[#0A0A0A] capitalize">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Audience</label>
                  <select value={editing.audience ?? 'all'} onChange={e => setEditing((p: any) => ({ ...p, audience: e.target.value }))} className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                    {['all','verified','premium','admins'].map(a => <option key={a} value={a} className="bg-[#0A0A0A] capitalize">{a}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Channels</label>
                <div className="flex flex-wrap gap-2">
                  {['banner','email','push','dashboard'].map(ch => {
                    const active = (editing.channels ?? []).includes(ch);
                    return (
                      <button key={ch} type="button" onClick={() => setEditing((p: any) => ({ ...p, channels: active ? p.channels.filter((c: string) => c !== ch) : [...(p.channels ?? []), ch] }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors capitalize ${active ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/8 text-white/40 hover:text-white'}`}>
                        {ch}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={save} disabled={saving || !editing.title}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-black text-sm disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {editing.id ? 'Update' : 'Create'}
                </button>
                {!editing.id && (
                  <button onClick={() => { setEditing((p: any) => ({ ...p, status: 'active' })); setTimeout(save, 50); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20">
                    <Zap size={12} /> Publish Now
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
