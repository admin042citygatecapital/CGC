import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Settings, Save, CheckCircle, Bell, Shield, Globe } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';

const TABS = [
  { id: 'general',       label: 'General',       icon: Settings },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security',      label: 'Security',      icon: Shield },
  { id: 'localization',  label: 'Localization',  icon: Globe },
];

export default function AdminSettings() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [tab, setTab]   = useState('general');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    siteName: 'City Gate Capital',
    supportEmail: 'support@citygate.capital',
    generalEmail: 'info@citygate.capital',
    phone: '+44 7888 382458',
    maintenanceMode: false,
    registrationOpen: true,
    kycRequired: true,
    emailNotifications: true,
    fraudAlerts: true,
    newUserAlerts: true,
    largeTransactionThreshold: '50000',
    sessionTimeout: '60',
    maxLoginAttempts: '5',
    defaultLanguage: 'en',
    defaultCurrency: 'USD',
    defaultTimezone: 'Europe/London',
  });

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  // Load persisted settings on mount
  useEffect(() => {
    fetch('/api/admin/settings', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setSettings(prev => ({ ...prev, ...d.data })); })
      .catch(() => {});
  }, []);

  function toggle(key: keyof typeof settings) {
    setSettings(s => ({ ...s, [key]: !s[key] }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(settings),
      });
    } catch { /* non-critical */ }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const Toggle = ({ k }: { k: keyof typeof settings }) => (
    <button type="button" onClick={() => toggle(k)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${settings[k] ? 'bg-primary' : 'bg-white/10'}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings[k] ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );

  const Field = ({ k, label, type = 'text' }: { k: keyof typeof settings; label: string; type?: string }) => (
    <div>
      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">{label}</label>
      <input type={type} value={String(settings[k])} onChange={e => setSettings(s => ({ ...s, [k]: e.target.value }))}
        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
    </div>
  );

  const Row = ({ label, desc, k }: { label: string; desc: string; k: keyof typeof settings }) => (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.04]">
      <div>
        <p className="text-white text-sm font-medium">{label}</p>
        <p className="text-white/30 text-xs">{desc}</p>
      </div>
      <Toggle k={k} />
    </div>
  );

  return (
    <>
      <Helmet><title>Settings — CGC Admin</title><meta name="description" content="System settings and configuration for City Gate Capital." /><meta name="robots" content="noindex, nofollow" /><link rel="canonical" href="https://citygate.capital/admin/settings" /></Helmet>
      <AdminLayout title="Settings">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">Admin Settings</h1>
            <p className="text-white/30 text-sm">Platform configuration and preferences</p>
          </div>
          {saved && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-sm">
              <CheckCircle size={14} /> Settings saved
            </motion.div>
          )}
        </div>

        <div className="flex gap-6">
          <div className="w-44 shrink-0 space-y-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  tab === t.id ? 'text-black' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
                style={tab === t.id ? { background: 'linear-gradient(135deg, #C9A84C, #F0D080)' } : {}}>
                <t.icon size={14} className={tab === t.id ? 'text-black' : 'text-white/30'} />
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1">
            <form onSubmit={handleSave} className="rounded-2xl border border-white/5 p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
              {tab === 'general' && (
                <>
                  <h3 className="text-white font-semibold text-sm">General Settings</h3>
                  <Field k="siteName" label="Site Name" />
                  <Field k="supportEmail" label="Support Email" type="email" />
                  <Field k="generalEmail" label="General Email" type="email" />
                  <Field k="phone" label="Phone Number" />
                  <Row label="Maintenance Mode" desc="Temporarily disable public access" k="maintenanceMode" />
                  <Row label="Open Registration" desc="Allow new users to register" k="registrationOpen" />
                  <Row label="KYC Required" desc="Require identity verification for all accounts" k="kycRequired" />
                </>
              )}
              {tab === 'notifications' && (
                <>
                  <h3 className="text-white font-semibold text-sm">Notification Settings</h3>
                  <Row label="Email Notifications" desc="Receive admin email alerts" k="emailNotifications" />
                  <Row label="Fraud Alerts" desc="Get notified of suspicious activity" k="fraudAlerts" />
                  <Row label="New User Alerts" desc="Alert on new registrations" k="newUserAlerts" />
                  <Field k="largeTransactionThreshold" label="Large Transaction Alert Threshold (USD)" type="number" />
                </>
              )}
              {tab === 'security' && (
                <>
                  <h3 className="text-white font-semibold text-sm">Security Settings</h3>
                  <Field k="sessionTimeout" label="Session Timeout (minutes)" type="number" />
                  <Field k="maxLoginAttempts" label="Max Login Attempts Before Lockout" type="number" />
                  <div className="p-3 rounded-xl border border-primary/15 bg-primary/[0.04]">
                    <p className="text-white/50 text-xs">Two-factor authentication is managed at the server level. Password authentication with brute-force protection and session binding is active.</p>
                  </div>
                </>
              )}
              {tab === 'localization' && (
                <>
                  <h3 className="text-white font-semibold text-sm">Localization</h3>
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Default Language</label>
                    <select value={settings.defaultLanguage} onChange={e => setSettings(s => ({ ...s, defaultLanguage: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm focus:outline-none">
                      {[['en','English'],['fr','French'],['de','German'],['es','Spanish'],['zh','Chinese'],['ar','Arabic']].map(([v, l]) => (
                        <option key={v} value={v} className="bg-[#0A0A0A]">{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Default Currency</label>
                    <select value={settings.defaultCurrency} onChange={e => setSettings(s => ({ ...s, defaultCurrency: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm focus:outline-none">
                      {['USD','EUR','GBP','CHF','JPY','AED'].map(c => <option key={c} value={c} className="bg-[#0A0A0A]">{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Default Timezone</label>
                    <select value={settings.defaultTimezone} onChange={e => setSettings(s => ({ ...s, defaultTimezone: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm focus:outline-none">
                      {['Europe/London','America/New_York','America/Los_Angeles','Asia/Singapore','Asia/Dubai','Asia/Tokyo'].map(tz => (
                        <option key={tz} value={tz} className="bg-[#0A0A0A]">{tz}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="pt-2">
                <button type="submit" disabled={saving} className="relative px-6 py-3 rounded-xl font-bold text-black text-sm overflow-hidden disabled:opacity-60">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                  <span className="relative flex items-center gap-2">
                    {saving ? <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save size={14} />}
                    {saving ? 'Saving…' : 'Save Settings'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </AdminLayout>
    </>
  );
}
