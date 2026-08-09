/**
 * /dashboard/settings — Account preferences and settings
 */
import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft, Settings, Eye, EyeOff, Languages,
  DollarSign, Fingerprint, Key, Shield, Bell, ChevronRight,
  LogOut, Check,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';

interface SettingsState {
  privacyMode: boolean; darkMode: boolean; language: string;
  currency: string; biometric: boolean; notifications: boolean;
}

const LANGUAGES = ['English', 'French', 'Spanish', 'Arabic', 'Portuguese'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'AED', 'CAD', 'AUD'];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className="relative w-10 h-5.5 rounded-full transition-all shrink-0"
      style={{ background: checked ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.08)' }}>
      <div
        className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
        style={{ left: checked ? '22px' : '2px', background: checked ? '#C9A84C' : 'rgba(255,255,255,0.3)', transition: 'left 0.15s' }}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { customer, loading, logout } = useCustomerAuth();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<SettingsState>({
    privacyMode: false, darkMode: true, language: 'English',
    currency: 'USD', biometric: false, notifications: true,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading && !customer) navigate('/login?reason=session_expired', { replace: true });
    try {
      const raw = localStorage.getItem('cgc_dash_settings');
      if (raw) setSettings(JSON.parse(raw));
      const pm = localStorage.getItem('cgc_privacy_mode');
      if (pm) setSettings(prev => ({ ...prev, privacyMode: pm === 'true' }));
    } catch { /* ignore */ }
  }, [customer, loading, navigate]);

  function update(patch: Partial<SettingsState>) {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem('cgc_dash_settings', JSON.stringify(next));
      if ('privacyMode' in patch) localStorage.setItem('cgc_privacy_mode', String(patch.privacyMode));
      return next;
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  if (loading || !customer) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <>
      <Helmet>
        <title>Settings — City Gate Capital</title>
        <meta name="description" content="Manage your City Gate Capital account settings and preferences." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/settings" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
          <div className="max-w-2xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
            <Link to="/dashboard" className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/50 hover:text-foreground transition-colors">
              <ArrowLeft size={15} />
            </Link>
            <div className="flex items-center gap-2.5 flex-1">
              <Settings size={16} style={{ color: '#C9A84C' }} />
              <h1 className="text-sm font-semibold text-foreground">Settings</h1>
            </div>
            {saved && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <Check size={12} /> Saved
              </span>
            )}
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-4">

          {/* Preferences */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/6 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.01)' }}>
            <div className="px-5 py-3.5 border-b border-white/5">
              <p className="text-[11px] font-semibold text-foreground/35 uppercase tracking-[0.12em]">Preferences</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {/* Privacy Mode */}
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
                  {settings.privacyMode ? <EyeOff size={14} className="text-foreground/40" /> : <Eye size={14} className="text-foreground/40" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground/80">Privacy Mode</p>
                  <p className="text-xs text-foreground/30">Hide all monetary values</p>
                </div>
                <Toggle checked={settings.privacyMode} onChange={v => update({ privacyMode: v })} />
              </div>
              {/* Notifications */}
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
                  <Bell size={14} className="text-foreground/40" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground/80">Push Notifications</p>
                  <p className="text-xs text-foreground/30">Transaction and security alerts</p>
                </div>
                <Toggle checked={settings.notifications} onChange={v => update({ notifications: v })} />
              </div>
              {/* Language */}
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
                  <Languages size={14} className="text-foreground/40" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground/80">Language</p>
                  <p className="text-xs text-foreground/30">Display language</p>
                </div>
                <select value={settings.language} onChange={e => update({ language: e.target.value })}
                  className="text-xs text-foreground/60 bg-transparent border-none outline-none cursor-pointer">
                  {LANGUAGES.map(l => <option key={l} value={l} style={{ background: '#0a0a0a' }}>{l}</option>)}
                </select>
              </div>
              {/* Currency */}
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
                  <DollarSign size={14} className="text-foreground/40" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground/80">Display Currency</p>
                  <p className="text-xs text-foreground/30">Default currency for display</p>
                </div>
                <select value={settings.currency} onChange={e => update({ currency: e.target.value })}
                  className="text-xs text-foreground/60 bg-transparent border-none outline-none cursor-pointer">
                  {CURRENCIES.map(c => <option key={c} value={c} style={{ background: '#0a0a0a' }}>{c}</option>)}
                </select>
              </div>
            </div>
          </motion.div>

          {/* Security */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-2xl border border-white/6 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.01)' }}>
            <div className="px-5 py-3.5 border-b border-white/5">
              <p className="text-[11px] font-semibold text-foreground/35 uppercase tracking-[0.12em]">Security</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
                  <Fingerprint size={14} className="text-foreground/40" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground/80">Biometric Interface Preview</p>
                  <p className="text-xs text-foreground/30">Demonstration setting; native login is not active</p>
                </div>
                <Toggle checked={settings.biometric} onChange={v => update({ biometric: v })} />
              </div>
              <Link to="/forgot-password" className="flex items-center gap-3 px-5 py-4 hover:bg-white/[0.025] transition-colors">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
                  <Key size={14} className="text-foreground/40" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground/80">Change Password</p>
                  <p className="text-xs text-foreground/30">Update your account password</p>
                </div>
                <ChevronRight size={13} className="text-foreground/20" />
              </Link>
              <Link to="/dashboard/security" className="flex items-center gap-3 px-5 py-4 hover:bg-white/[0.025] transition-colors">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
                  <Shield size={14} className="text-foreground/40" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground/80">Security Centre</p>
                  <p className="text-xs text-foreground/30">2FA, active sessions & security events</p>
                </div>
                <ChevronRight size={13} className="text-foreground/20" />
              </Link>
            </div>
          </motion.div>

          {/* Account */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-2xl border border-white/6 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.01)' }}>
            <div className="px-5 py-3.5 border-b border-white/5">
              <p className="text-[11px] font-semibold text-foreground/35 uppercase tracking-[0.12em]">Account</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              <Link to="/dashboard/profile" className="flex items-center gap-3 px-5 py-4 hover:bg-white/[0.025] transition-colors">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
                  <Settings size={14} className="text-foreground/40" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground/80">Edit Profile</p>
                  <p className="text-xs text-foreground/30">Update personal information</p>
                </div>
                <ChevronRight size={13} className="text-foreground/20" />
              </Link>
              <button onClick={handleLogout}
                className="flex items-center gap-3 px-5 py-4 hover:bg-red-500/5 transition-colors w-full text-left">
                <div className="w-9 h-9 rounded-xl bg-red-500/8 border border-red-500/12 flex items-center justify-center shrink-0">
                  <LogOut size={14} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-400">Log Out</p>
                  <p className="text-xs text-foreground/30">End your current session</p>
                </div>
              </button>
            </div>
          </motion.div>
        </main>
      </div>
    </>
  );
}
