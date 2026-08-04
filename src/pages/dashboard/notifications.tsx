/**
 * /dashboard/notifications — Full notification center
 * Improved: mark individual read, preferences panel, category badges,
 * bulk actions, notification settings.
 */
import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Bell, Send, CreditCard, Shield, Info,
  CheckCheck, Loader2, Settings, Trash2, Check,
  CheckCircle2, X,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';

interface Notification {
  id: string; title: string; message: string; link?: string;
  read: boolean; createdAt: string; category?: string;
}

function inferCategory(n: Notification): string {
  if (n.category) return n.category;
  const t = (n.title + ' ' + n.message).toLowerCase();
  if (t.includes('transfer') || t.includes('send') || t.includes('deposit') || t.includes('withdraw')) return 'transfer';
  if (t.includes('card') || t.includes('virtual')) return 'card';
  if (t.includes('security') || t.includes('login') || t.includes('password') || t.includes('2fa')) return 'security';
  return 'system';
}

const CAT_ICONS: Record<string, React.ElementType> = { transfer: Send, card: CreditCard, security: Shield, system: Info };
const CAT_COLORS: Record<string, string> = { transfer: '#C9A84C', card: '#9945FF', security: '#EF4444', system: '#627EEA' };
const CAT_LABELS: Record<string, string> = { transfer: 'Transfer', card: 'Card', security: 'Security', system: 'System' };

interface NotifPrefs {
  email: boolean; sms: boolean; push: boolean; marketing: boolean;
}

export default function NotificationsPage() {
  const { customer, token, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading,  setNotifLoading]  = useState(true);
  const [filter,        setFilter]        = useState<string>('all');
  const [markingAll,    setMarkingAll]     = useState(false);
  const [deletingId,    setDeletingId]     = useState<string | null>(null);
  const [showPrefs,     setShowPrefs]      = useState(false);
  const [prefs,         setPrefs]          = useState<NotifPrefs>({
    email: true, sms: false, push: true, marketing: false,
  });
  const [savingPrefs,   setSavingPrefs]    = useState(false);
  const [prefsMsg,      setPrefsMsg]       = useState<string | null>(null);
  const [selected,      setSelected]       = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !customer) navigate('/login?reason=session_expired', { replace: true });
  }, [customer, loading, navigate]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/users/notifications?limit=100', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setNotifications(data.notifications ?? []); })
      .catch(() => {}).finally(() => setNotifLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/users/notifications/preferences', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.preferences) setPrefs(data.preferences); })
      .catch(() => {});
  }, [token]);

  async function markAllRead() {
    if (!token) return;
    setMarkingAll(true);
    try {
      await fetch('/api/users/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /* silent */ }
    finally { setMarkingAll(false); }
  }

  async function markOneRead(id: string) {
    if (!token) return;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    fetch('/api/users/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  async function deleteNotif(id: string) {
    if (!token || deletingId) return;
    setDeletingId(id);
    try {
      await fetch('/api/users/notifications/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { /* silent */ }
    finally { setDeletingId(null); }
  }

  async function deleteSelected() {
    if (!token || selected.size === 0) return;
    const ids = Array.from(selected);
    setNotifications(prev => prev.filter(n => !selected.has(n.id)));
    setSelected(new Set());
    for (const id of ids) {
      fetch('/api/users/notifications/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      }).catch(() => {});
    }
  }

  async function savePrefs() {
    if (!token) return;
    setSavingPrefs(true); setPrefsMsg(null);
    try {
      const res = await fetch('/api/users/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(prefs),
      });
      setPrefsMsg(res.ok ? 'Preferences saved.' : 'Failed to save preferences.');
    } catch { setPrefsMsg('Network error.'); }
    finally { setSavingPrefs(false); }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (loading || !customer) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  const filtered = filter === 'all' ? notifications : notifications.filter(n => inferCategory(n) === filter);
  const unread   = notifications.filter(n => !n.read).length;

  const FILTERS = [
    { id: 'all',      label: 'All' },
    { id: 'transfer', label: 'Transfers' },
    { id: 'card',     label: 'Cards' },
    { id: 'security', label: 'Security' },
    { id: 'system',   label: 'System' },
  ];

  return (
    <>
      <Helmet>
        <title>Notifications — City Gate Capital</title>
        <meta name="description" content="View all your City Gate Capital account notifications and alerts." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/notifications" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <h1 className="sr-only">Notifications</h1>
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link to="/dashboard" className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors">
              <ArrowLeft size={15} />
            </Link>
            <div className="flex items-center gap-2">
              <Bell size={15} style={{ color: '#C9A84C' }} />
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              {unread > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C' }}>
                  {unread}
                </span>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {selected.size > 0 && (
                <button onClick={deleteSelected}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold text-red-400 border border-red-400/20 bg-red-400/8 hover:bg-red-400/12 transition-colors">
                  <Trash2 size={10} /> Delete ({selected.size})
                </button>
              )}
              {unread > 0 && (
                <button onClick={markAllRead} disabled={markingAll}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold text-foreground/40 hover:text-foreground/70 border border-white/8 transition-colors">
                  {markingAll ? <Loader2 size={10} className="animate-spin" /> : <CheckCheck size={10} />}
                  Mark all read
                </button>
              )}
              <button onClick={() => setShowPrefs(s => !s)}
                className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors">
                <Settings size={13} />
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-4">

          {/* Preferences panel */}
          <AnimatePresence>
            {showPrefs && (
              <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                className="p-5 rounded-2xl border border-white/8" style={{ background: 'rgba(255,255,255,0.025)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-foreground/80">Notification Preferences</p>
                  <button onClick={() => setShowPrefs(false)} className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors">
                    <X size={11} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {([
                    { key: 'email',     label: 'Email',     icon: Info },
                    { key: 'push',      label: 'Push',      icon: Bell },
                    { key: 'sms',       label: 'SMS',       icon: Send },
                    { key: 'marketing', label: 'Marketing', icon: Shield },
                  ] as const).map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setPrefs(p => ({ ...p, [key]: !p[key] }))}
                      className="flex items-center gap-2 p-3 rounded-xl border transition-all text-left"
                      style={{
                        background: prefs[key] ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.02)',
                        borderColor: prefs[key] ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.06)',
                      }}>
                      <Icon size={12} style={{ color: prefs[key] ? '#C9A84C' : 'rgba(255,255,255,0.3)' }} />
                      <span className="text-xs font-medium" style={{ color: prefs[key] ? '#C9A84C' : 'rgba(255,255,255,0.4)' }}>{label}</span>
                      <div className="ml-auto w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0"
                        style={{ borderColor: prefs[key] ? '#C9A84C' : 'rgba(255,255,255,0.15)', background: prefs[key] ? '#C9A84C' : 'transparent' }}>
                        {prefs[key] && <Check size={8} className="text-black" />}
                      </div>
                    </button>
                  ))}
                </div>
                {prefsMsg && <p className="text-xs text-foreground/40 mb-3">{prefsMsg}</p>}
                <button onClick={savePrefs} disabled={savingPrefs}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)', color: '#000' }}>
                  {savingPrefs ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                  Save Preferences
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
                style={{
                  background: filter === f.id ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.04)',
                  color: filter === f.id ? '#C9A84C' : 'rgba(255,255,255,0.35)',
                  border: `1px solid ${filter === f.id ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.06)'}`,
                }}>
                {f.label}
                {f.id !== 'all' && (
                  <span className="ml-1.5 text-[9px] opacity-60">
                    {notifications.filter(n => inferCategory(n) === f.id).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Notification list */}
          {notifLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin text-foreground/20" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Bell size={28} className="text-foreground/15" />
              <p className="text-sm text-foreground/40">No {filter === 'all' ? '' : filter} notifications</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map(n => {
                const cat      = inferCategory(n);
                const CatIcon  = CAT_ICONS[cat] ?? Info;
                const catColor = CAT_COLORS[cat] ?? '#627EEA';
                const isSelected = selected.has(n.id);
                return (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${!n.read ? 'border-primary/15' : 'border-white/5'} ${isSelected ? 'ring-1 ring-primary/30' : ''}`}
                    style={{ background: !n.read ? 'rgba(201,168,76,0.04)' : 'rgba(255,255,255,0.015)' }}>
                    {/* Select checkbox */}
                    <button onClick={() => toggleSelect(n.id)}
                      className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all"
                      style={{ borderColor: isSelected ? '#C9A84C' : 'rgba(255,255,255,0.12)', background: isSelected ? '#C9A84C' : 'transparent' }}>
                      {isSelected && <Check size={10} className="text-black" />}
                    </button>

                    {/* Category icon */}
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${catColor}14`, border: `1px solid ${catColor}22` }}>
                      <CatIcon size={13} style={{ color: catColor }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground/80">{n.title}</p>
                        {!n.read && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#C9A84C' }} />}
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ background: `${catColor}15`, color: catColor }}>
                          {CAT_LABELS[cat] ?? cat}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/45 mt-0.5 leading-relaxed">{n.message}</p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <p className="text-[10px] text-foreground/20">
                          {new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {n.link && (
                          <Link to={n.link} className="text-[10px] font-semibold" style={{ color: '#C9A84C' }}>
                            View details →
                          </Link>
                        )}
                        {!n.read && (
                          <button onClick={() => markOneRead(n.id)}
                            className="text-[10px] text-foreground/25 hover:text-foreground/60 transition-colors flex items-center gap-1">
                            <Check size={9} /> Mark read
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Delete */}
                    <button onClick={() => deleteNotif(n.id)} disabled={!!deletingId}
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-foreground/20 hover:text-red-400 hover:bg-red-500/8 transition-colors disabled:opacity-40 shrink-0">
                      {deletingId === n.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}

          <Link to="/dashboard" className="flex items-center gap-1.5 text-xs text-foreground/30 hover:text-foreground/60 transition-colors w-fit">
            <ArrowLeft size={12} />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </>
  );
}
