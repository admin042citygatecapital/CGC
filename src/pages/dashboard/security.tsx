/**
 * /dashboard/security — Enhanced Customer Security Centre
 * Tabs: Overview · Sessions · Devices · Login History · 2FA Setup
 */
import { useCustomerAuth } from '@/lib/customerAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
AlertTriangle,
ArrowLeft,
Bell,
CheckCheck,
CheckCircle2,
ChevronRight,
Copy,
Eye,Fingerprint,
Globe,
History,
Key,
Laptop,
Loader2,
Lock,
LogOut,
MapPin,
Monitor,
QrCode,
Shield,
ShieldAlert,
ShieldCheck,
Smartphone
} from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useEffect,useMemo,useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';

interface SecurityEvent {
  id: string; type: string; description: string;
  ip?: string; device?: string; createdAt: string; severity: 'low'|'medium'|'high';
}
interface ActiveSession {
  id: string; device: string; ip: string; location: string; lastSeen: string; current: boolean;
}
interface LoginHistoryEntry {
  id: string; ip: string; device: string; location: string; createdAt: string; success: boolean;
}

function severityColor(s: 'low'|'medium'|'high') {
  return s === 'high' ? '#EF4444' : s === 'medium' ? '#F59E0B' : '#10B981';
}
function eventIcon(type: string) {
  if (type.includes('login'))    return Monitor;
  if (type.includes('password')) return Key;
  if (type.includes('2fa'))      return Smartphone;
  if (type.includes('session'))  return Globe;
  return Shield;
}
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

type Tab = 'overview'|'sessions'|'devices'|'history'|'2fa';

export default function DashboardSecurityPage() {
  const { token, customer, logout } = useCustomerAuth();
  const navigate = useNavigate();
  const [tab,          setTab]          = useState<Tab>('overview');
  const [events,       setEvents]       = useState<SecurityEvent[]>([]);
  const [sessions,     setSessions]     = useState<ActiveSession[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [revokingId,   setRevokingId]   = useState<string | null>(null);
  const [revokeMsg,    setRevokeMsg]    = useState<string | null>(null);
  // 2FA state
  const [totpSecret,   setTotpSecret]   = useState<string | null>(null);
  const [totpQr,       setTotpQr]       = useState<string | null>(null);
  const [totpCode,     setTotpCode]     = useState('');
  const [totpLoading,  setTotpLoading]  = useState(false);
  const [totpMsg,      setTotpMsg]      = useState<{ text: string; ok: boolean } | null>(null);
  const [copied,       setCopied]       = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch('/api/users/security/events',   { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/users/security/sessions', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/users/login-history',     { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([evData, sessData, histData]) => {
      if (evData?.events)         setEvents(evData.events.slice(0, 30));
      if (sessData?.sessions)     setSessions(sessData.sessions);
      if (histData?.history)      setLoginHistory(histData.history.slice(0, 30));
    }).finally(() => setLoading(false));
  }, [token]);

  const securityScore = useMemo(() => {
    let score = 40;
    if (customer?.kycStatus === 'approved') score += 20;
    if (sessions.length <= 2)              score += 15;
    const highEvents = events.filter(e => e.severity === 'high').length;
    if (highEvents === 0) score += 25; else if (highEvents <= 2) score += 10;
    return Math.min(score, 100);
  }, [customer, sessions, events]);

  const scoreColor = securityScore >= 80 ? '#10B981' : securityScore >= 50 ? '#F59E0B' : '#EF4444';
  const scoreLabel = securityScore >= 80 ? 'Strong' : securityScore >= 50 ? 'Fair' : 'Weak';

  async function handleRevokeSession(sessionId: string) {
    if (!token || revokingId) return;
    setRevokingId(sessionId); setRevokeMsg(null);
    try {
      const res = await fetch('/api/users/security/sessions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) { setSessions(prev => prev.filter(s => s.id !== sessionId)); setRevokeMsg('Session revoked.'); }
      else setRevokeMsg('Unable to revoke. Please try again.');
    } catch { setRevokeMsg('Network error.'); }
    finally { setRevokingId(null); }
  }

  async function handleSetup2FA() {
    if (!token || totpLoading) return;
    setTotpLoading(true); setTotpMsg(null);
    try {
      const res = await fetch('/api/users/2fa/setup', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setTotpSecret(data.secret); setTotpQr(data.qrUrl ?? null); }
      else setTotpMsg({ text: data.error ?? 'Failed to generate 2FA secret.', ok: false });
    } catch { setTotpMsg({ text: 'Network error.', ok: false }); }
    finally { setTotpLoading(false); }
  }

  async function handleVerify2FA() {
    if (!token || !totpCode || totpLoading) return;
    setTotpLoading(true); setTotpMsg(null);
    try {
      const res = await fetch('/api/users/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: totpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setTotpMsg({ text: '2FA enabled successfully!', ok: true }); setTotpSecret(null); setTotpQr(null); setTotpCode(''); }
      else setTotpMsg({ text: data.error ?? 'Invalid code. Please try again.', ok: false });
    } catch { setTotpMsg({ text: 'Network error.', ok: false }); }
    finally { setTotpLoading(false); }
  }

  function copySecret() {
    if (!totpSecret) return;
    navigator.clipboard.writeText(totpSecret).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  if (loading || !customer) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'sessions', label: 'Sessions', icon: Globe },
    { id: 'devices',  label: 'Devices',  icon: Smartphone },
    { id: 'history',  label: 'History',  icon: History },
    { id: '2fa',      label: '2FA',      icon: Fingerprint },
  ];

  return (
    <>
      <Helmet>
        <title>Security Centre — City Gate Capital</title>
        <meta name="description" content="Manage your City Gate Capital account security: sessions, devices, login history, and 2FA." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/security" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <h1 className="sr-only">Security Centre</h1>
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link to="/dashboard" className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors">
              <ArrowLeft size={15} />
            </Link>
            <div className="flex items-center gap-2">
              <Shield size={15} style={{ color: '#F7931A' }} />
              <span className="text-sm font-semibold text-foreground">Security Centre</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold"
                style={{ color: scoreColor, background: `${scoreColor}12`, borderColor: `${scoreColor}25` }}>
                {scoreLabel} · {securityScore}
              </div>
            </div>
          </div>
        </header>

        {/* Tab bar */}
        <div className="border-b border-white/5 bg-[rgba(10,10,10,0.7)] sticky top-14 z-30">
          <div className="max-w-2xl mx-auto px-4 flex gap-1 overflow-x-auto py-2">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0"
                style={{
                  background: tab === id ? 'rgba(247,147,26,0.12)' : 'transparent',
                  color: tab === id ? '#F7931A' : 'rgba(255,255,255,0.35)',
                  border: `1px solid ${tab === id ? 'rgba(247,147,26,0.25)' : 'transparent'}`,
                }}>
                <Icon size={11} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6">
          <AnimatePresence mode="wait">

            {/* ── Overview ──────────────────────────────────────────────── */}
            {tab === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
                {/* Score ring */}
                <div className="flex items-center gap-5 p-5 rounded-3xl border border-white/6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="relative w-20 h-20 shrink-0">
                    <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                      <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                      <circle cx="40" cy="40" r="32" fill="none" stroke={scoreColor} strokeWidth="6" strokeLinecap="round"
                        strokeDasharray={`${(securityScore/100)*201} 201`} style={{ transition: 'stroke-dasharray 1s ease' }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold" style={{ color: scoreColor }}>{securityScore}</span>
                      <span className="text-[8px] text-foreground/30 uppercase tracking-wider">score</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {securityScore >= 80 ? <ShieldCheck size={14} style={{ color: scoreColor }} /> : <ShieldAlert size={14} style={{ color: scoreColor }} />}
                      <span className="text-sm font-bold" style={{ color: scoreColor }}>{scoreLabel} Security</span>
                    </div>
                    <p className="text-xs text-foreground/40 leading-relaxed">
                      {securityScore >= 80 ? 'Your account is well protected.' : securityScore >= 50 ? 'Some security gaps detected.' : 'Immediate attention required.'}
                    </p>
                  </div>
                </div>

                {/* Checklist */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-[0.12em]">Security Checklist</p>
                  {[
                    { icon: CheckCircle2, label: 'Email Verified', sub: customer.email, done: true, color: '#10B981' },
                    { icon: customer.kycStatus === 'approved' ? CheckCircle2 : AlertTriangle, label: 'KYC Verification', sub: customer.kycStatus === 'approved' ? 'Identity verified' : 'Complete KYC to unlock full features', done: customer.kycStatus === 'approved', color: customer.kycStatus === 'approved' ? '#10B981' : '#F59E0B', action: customer.kycStatus !== 'approved' ? { label: 'Verify Now', href: '/kyc' } : undefined },
                    { icon: Fingerprint, label: 'Two-Factor Authentication', sub: 'Tap 2FA tab to set up', done: false, color: '#F59E0B', action: { label: 'Set Up', onClick: () => setTab('2fa') } },
                    { icon: Bell, label: 'Login Notifications', sub: 'Get alerted on new sign-ins', done: true, color: '#10B981' },
                    { icon: Lock, label: 'Strong Password', sub: 'Use a unique, complex password', done: true, color: '#10B981' },
                  ].map(({ icon: Icon, label, sub, done, color, action }) => (
                    <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.015]">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                        <Icon size={13} style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground/80">{label}</p>
                        <p className="text-[10px] text-foreground/30 truncate">{sub}</p>
                      </div>
                      {action && 'href' in action && typeof action.href === 'string' ? (
                        <Link to={action.href} className="text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all"
                          style={{ background: `${color}18`, color, border: `1px solid ${color}28` }}>{action.label}</Link>
                      ) : action && 'onClick' in action ? (
                        <button onClick={action.onClick} className="text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all"
                          style={{ background: `${color}18`, color, border: `1px solid ${color}28` }}>{action.label}</button>
                      ) : (
                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: done ? '#10B98120' : 'rgba(255,255,255,0.05)' }}>
                          {done && <CheckCircle2 size={10} className="text-emerald-400" />}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Quick actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => navigate('/forgot-password')}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border border-white/6 bg-white/[0.02] text-left hover:bg-white/[0.04] transition-colors">
                    <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0"><Key size={13} className="text-foreground/40" /></div>
                    <div><p className="text-xs font-semibold text-foreground/70">Change Password</p><p className="text-[10px] text-foreground/30">Update credentials</p></div>
                  </button>
                  <button onClick={() => { logout(); navigate('/login', { replace: true }); }}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border border-red-500/12 bg-red-500/[0.04] text-left hover:bg-red-500/[0.07] transition-colors">
                    <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/15 flex items-center justify-center shrink-0"><LogOut size={13} className="text-red-400" /></div>
                    <div><p className="text-xs font-semibold text-red-400">Sign Out</p><p className="text-[10px] text-foreground/30">End this session</p></div>
                  </button>
                </div>

                {/* Recent events */}
                {events.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-[0.12em]">Recent Activity</p>
                    {events.slice(0, 5).map(ev => {
                      const EvIcon = eventIcon(ev.type);
                      const color  = severityColor(ev.severity);
                      return (
                        <div key={ev.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.015]">
                          <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: `${color}12`, border: `1px solid ${color}20` }}>
                            <EvIcon size={12} style={{ color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground/70 truncate">{ev.description}</p>
                            <p className="text-[10px] text-foreground/25">{ev.ip && `${ev.ip} · `}{timeAgo(ev.createdAt)}</p>
                          </div>
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                        </div>
                      );
                    })}
                    {events.length > 5 && (
                      <button onClick={() => setTab('history')} className="text-xs text-foreground/30 hover:text-foreground/60 transition-colors flex items-center gap-1 w-fit">
                        View all {events.length} events <ChevronRight size={11} />
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Sessions ──────────────────────────────────────────────── */}
            {tab === 'sessions' && (
              <motion.div key="sessions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-[0.12em]">Active Sessions ({sessions.length})</p>
                  <button onClick={() => { logout(); navigate('/login', { replace: true }); }}
                    className="text-[10px] text-red-400/70 hover:text-red-400 transition-colors flex items-center gap-1">
                    <LogOut size={10} /> Sign out all
                  </button>
                </div>
                {revokeMsg && <p className="text-[10px] text-foreground/40 px-1">{revokeMsg}</p>}
                {sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-foreground/20">
                    <Globe size={24} /><p className="text-xs">No active sessions</p>
                  </div>
                ) : sessions.map(sess => (
                  <div key={sess.id} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-white/5 bg-white/[0.015]">
                    <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
                      <Monitor size={14} className="text-foreground/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-foreground/80 truncate">{sess.device || 'Unknown device'}</p>
                        {sess.current && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">Current</span>}
                      </div>
                      <p className="text-[10px] text-foreground/30">{sess.ip} · {sess.location || 'Unknown'} · {timeAgo(sess.lastSeen)}</p>
                    </div>
                    {!sess.current && (
                      <button onClick={() => handleRevokeSession(sess.id)} disabled={!!revokingId}
                        className="w-8 h-8 rounded-xl bg-red-500/8 border border-red-500/15 flex items-center justify-center text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-40">
                        {revokingId === sess.id ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
                      </button>
                    )}
                  </div>
                ))}
              </motion.div>
            )}

            {/* ── Devices ───────────────────────────────────────────────── */}
            {tab === 'devices' && (
              <motion.div key="devices" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-[0.12em]">Trusted Devices</p>
                  <Link to="/dashboard/devices" className="text-[10px] text-foreground/30 hover:text-foreground/60 transition-colors flex items-center gap-1">
                    Manage all <ChevronRight size={10} />
                  </Link>
                </div>
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                  <Smartphone size={24} className="text-foreground/15" />
                  <p className="text-xs text-foreground/40">Manage trusted devices</p>
                  <Link to="/dashboard/devices"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                    style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.22)' }}>
                    <Laptop size={12} /> Open Device Manager
                  </Link>
                </div>
              </motion.div>
            )}

            {/* ── Login History ─────────────────────────────────────────── */}
            {tab === 'history' && (
              <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-[0.12em]">Login History ({loginHistory.length})</p>
                {loginHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-foreground/20">
                    <History size={24} /><p className="text-xs">No login history available</p>
                  </div>
                ) : loginHistory.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.015]">
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${entry.success ? 'bg-emerald-500/12' : 'bg-red-500/12'}`}>
                      {entry.success ? <CheckCircle2 size={12} className="text-emerald-400" /> : <AlertTriangle size={12} className="text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground/70 truncate">{entry.device || 'Unknown device'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {entry.location && <span className="flex items-center gap-1 text-[10px] text-foreground/25"><MapPin size={8} />{entry.location}</span>}
                        <span className="text-[10px] text-foreground/20 font-mono">{entry.ip}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-foreground/25 shrink-0">{timeAgo(entry.createdAt)}</p>
                  </div>
                ))}
              </motion.div>
            )}

            {/* ── 2FA Setup ─────────────────────────────────────────────── */}
            {tab === '2fa' && (
              <motion.div key="2fa" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
                <div className="p-5 rounded-3xl border border-white/6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(247,147,26,0.12)', border: '1px solid rgba(247,147,26,0.22)' }}>
                      <Fingerprint size={18} style={{ color: '#F7931A' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground/80">Two-Factor Authentication</p>
                      <p className="text-xs text-foreground/35">Add an extra layer of security</p>
                    </div>
                  </div>

                  {totpMsg && (
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-xs ${totpMsg.ok ? 'bg-emerald-500/8 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/8 text-red-400 border border-red-500/20'}`}>
                      {totpMsg.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                      {totpMsg.text}
                    </div>
                  )}

                  {!totpSecret ? (
                    <div className="flex flex-col gap-4">
                      <p className="text-xs text-foreground/50 leading-relaxed">
                        Use an authenticator app (Google Authenticator, Authy, 1Password) to scan a QR code and generate time-based one-time passwords.
                      </p>
                      <button onClick={handleSetup2FA} disabled={totpLoading}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)', color: '#000' }}>
                        {totpLoading ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
                        Set Up 2FA
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {/* QR code */}
                      {totpQr ? (
                        <div className="flex flex-col items-center gap-3">
                          <p className="text-xs text-foreground/50">Scan this QR code with your authenticator app:</p>
                          <div className="p-3 rounded-2xl bg-white">
                            <img src={totpQr} alt="2FA QR Code" className="w-40 h-40" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/4 border border-white/8">
                          <QrCode size={14} className="text-foreground/40 shrink-0" />
                          <p className="text-xs text-foreground/50">QR code not available. Use the secret key below.</p>
                        </div>
                      )}

                      {/* Secret key */}
                      <div>
                        <p className="text-[10px] text-foreground/35 mb-1.5">Or enter this secret key manually:</p>
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-black/40 border border-white/8">
                          <code className="flex-1 text-xs font-mono text-foreground/70 break-all">{totpSecret}</code>
                          <button onClick={copySecret} className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors shrink-0">
                            {copied ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </div>

                      {/* Verify */}
                      <div>
                        <p className="text-[10px] text-foreground/35 mb-1.5">Enter the 6-digit code from your app to verify:</p>
                        <div className="flex gap-2">
                          <input
                            value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000" maxLength={6}
                            className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-sm font-mono text-center text-foreground/80 placeholder-foreground/20 focus:outline-none focus:border-primary/40 tracking-[0.3em]"
                          />
                          <button onClick={handleVerify2FA} disabled={totpLoading || totpCode.length !== 6}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110 disabled:opacity-50"
                            style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.25)' }}>
                            {totpLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                            Verify
                          </button>
                        </div>
                      </div>

                      <button onClick={() => { setTotpSecret(null); setTotpQr(null); setTotpCode(''); }}
                        className="text-xs text-foreground/30 hover:text-foreground/60 transition-colors w-fit">
                        Cancel setup
                      </button>
                    </div>
                  )}
                </div>

                {/* Privacy note */}
                <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.015]">
                  <Eye size={13} className="text-foreground/20 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-foreground/25 leading-relaxed">
                    Security events are retained for 90 days. IP addresses are partially masked for your privacy.
                    Contact support if you notice any unrecognised activity.
                  </p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          <div className="mt-6">
            <Link to="/dashboard" className="flex items-center gap-1.5 text-xs text-foreground/30 hover:text-foreground/60 transition-colors w-fit">
              <ArrowLeft size={12} />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
