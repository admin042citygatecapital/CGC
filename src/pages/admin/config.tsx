/**
 * /admin/config — Configuration Center
 * Branding · Theme · Homepage · Dashboard Widgets · Notifications
 * Maintenance Mode · Feature Toggles · Exchange Rates
 * Language · Currency · Timezone · Environment Variables
 */
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
AlertCircle,
AlertTriangle,
Bell,
CheckCircle,
Clock,
DollarSign,
Globe,
Home,
Info,
LayoutDashboard,
Loader2,
Monitor,
Palette,
RefreshCw,
Save,
Shield,
ToggleRight,
TrendingUp,
Wrench
} from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useCallback,useEffect,useState } from 'react';

// ─── Types (mirrors configStore.ts) ──────────────────────────────────────────

type SectionKey =
  | 'branding' | 'theme' | 'homepage' | 'dashboardWidgets'
  | 'notificationSettings' | 'maintenanceMode' | 'featureToggles'
  | 'exchangeRates' | 'language' | 'currency' | 'timezone';

interface EnvVar {
  name: string; service: string; level: 'CRITICAL' | 'WARNING' | 'INFO';
  description: string; status: 'PRESENT' | 'MISSING' | 'DEFAULT'; isPublic: boolean;
}

const PLATFORM_MODULES = [
  ['accounts','Accounts'], ['multiCurrency','Multi-Currency'], ['fx','FX & Exchange'],
  ['transfers','Transfers'], ['cards','Cards'], ['wallets','Wallets'],
  ['investments','Investments'], ['markets','Markets'], ['analytics','Analytics'],
  ['savingsGoals','Savings Goals'], ['businessBanking','Business Banking'], ['rewards','Rewards'],
  ['statements','Statements'], ['supportChat','Support Chat'], ['kyc','KYC'],
  ['registration','Registration'], ['notifications','Notifications'], ['emails','Emails'],
  ['beneficiaries','Beneficiaries'], ['payments','Bills & Payments'], ['support','Support Centre'],
] as const;

const PLAN_SCOPES = [['standard', 'Standard'], ['premium', 'Premium'], ['elite', 'Elite']] as const;
type FeatureScopeKind = 'users' | 'countries' | 'internalRoles';

// ─── Nav config ───────────────────────────────────────────────────────────────

const SECTIONS: { id: SectionKey | 'env'; label: string; icon: typeof Palette; desc: string }[] = [
  { id: 'branding',             label: 'Branding',            icon: Palette,        desc: 'App name, colors, logo, contact' },
  { id: 'theme',                label: 'Theme',               icon: Monitor,        desc: 'Dark/light mode, fonts, density' },
  { id: 'homepage',             label: 'Homepage',            icon: Home,           desc: 'Hero text, CTAs, section toggles' },
  { id: 'dashboardWidgets',     label: 'Dashboard Widgets',   icon: LayoutDashboard,desc: 'Widget visibility & defaults' },
  { id: 'notificationSettings', label: 'Notifications',       icon: Bell,           desc: 'Email, SMS, push preferences' },
  { id: 'maintenanceMode',      label: 'Maintenance Mode',    icon: Wrench,         desc: 'Enable/disable with custom message' },
  { id: 'featureToggles',       label: 'Feature Toggles',     icon: ToggleRight,    desc: 'Enable/disable platform features' },
  { id: 'exchangeRates',        label: 'Exchange Rates',      icon: TrendingUp,     desc: 'Provider, markup, currencies' },
  { id: 'language',             label: 'Language',            icon: Globe,          desc: 'Locale, date/time formats' },
  { id: 'currency',             label: 'Currency',            icon: DollarSign,     desc: 'Default currency, formatting' },
  { id: 'timezone',             label: 'Timezone',            icon: Clock,          desc: 'Default TZ, business hours' },
  { id: 'env',                  label: 'Environment Vars',    icon: Shield,         desc: 'Secret status — no values shown' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${value ? 'bg-primary' : 'bg-white/10'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
      {label && <span className={`text-xs font-medium transition-colors ${value ? 'text-white/70' : 'text-white/30'}`}>{label}</span>}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '', hint = '' }: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
      {hint && <p className="text-white/20 text-[10px] mt-1">{hint}</p>}
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none">
        {options.map(o => <option key={o.value} value={o.value} className="bg-[#0A0A0A]">{o.label}</option>)}
      </select>
    </div>
  );
}

function SectionHeader({ title, desc, onReset, saving }: { title: string; desc: string; onReset: () => void; saving: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h2 className="text-white font-bold text-base">{title}</h2>
        <p className="text-white/30 text-xs mt-0.5">{desc}</p>
      </div>
      <button type="button" onClick={onReset} disabled={saving}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-40 shrink-0">
        <RefreshCw size={10} /> Reset
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminConfigPage() {
  const [activeSection, setActiveSection] = useState<SectionKey | 'env'>('branding');
  const [config,   setConfig]   = useState<Record<string, any>>({});
  const [envVars,  setEnvVars]  = useState<EnvVar[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null);
  const [dirty,    setDirty]    = useState(false);
  const [scopeKind, setScopeKind] = useState<FeatureScopeKind>('users');
  const [scopeIdentifier, setScopeIdentifier] = useState('');
  const [scopeFeature, setScopeFeature] = useState('accounts');

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/config', { headers: authHeaders() });
    if (r.ok) setConfig(await r.json());
    setLoading(false);
  }, []);

  const loadEnv = useCallback(async () => {
    const r = await fetch('/api/admin/config?section=env', { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setEnvVars(d.env ?? []); }
  }, []);

  useEffect(() => { loadConfig(); loadEnv(); }, [loadConfig, loadEnv]);

  // ── Patch local state ─────────────────────────────────────────────────────

  function patch(section: string, key: string, value: unknown) {
    setConfig(c => ({ ...c, [section]: { ...c[section], [key]: value } }));
    setDirty(true);
  }

  function patchPlatformFeature(key: string, value: boolean) {
    setConfig(current => ({
      ...current,
      featureToggles: {
        ...current.featureToggles,
        platformFeatures: { ...current.featureToggles?.platformFeatures, [key]: value },
      },
    }));
    setDirty(true);
  }

  function patchScopedFeature(kind: 'plans' | FeatureScopeKind, identifier: string, feature: string, restricted: boolean) {
    const normalizedIdentifier = kind === 'countries' || kind === 'internalRoles' ? identifier.trim().toUpperCase() : identifier.trim();
    if (!normalizedIdentifier) return;
    setConfig(current => {
      const featureToggles = current.featureToggles ?? {};
      const featureAccess = featureToggles.featureAccess ?? {};
      const scope = featureAccess[kind] ?? {};
      const nextOverrides = { ...(scope[normalizedIdentifier] ?? {}) };
      if (restricted) nextOverrides[feature] = false;
      else delete nextOverrides[feature];
      const nextScope = { ...scope };
      if (Object.keys(nextOverrides).length) nextScope[normalizedIdentifier] = nextOverrides;
      else delete nextScope[normalizedIdentifier];
      return { ...current, featureToggles: { ...featureToggles, featureAccess: { ...featureAccess, [kind]: nextScope } } };
    });
    setDirty(true);
  }

  function addScopedRestriction() {
    const identifier = scopeKind === 'countries' || scopeKind === 'internalRoles' ? scopeIdentifier.trim().toUpperCase() : scopeIdentifier.trim();
    const valid = scopeKind === 'users'
      ? /^usr_[a-z0-9]{8,64}$/i.test(identifier)
      : scopeKind === 'countries' ? /^[A-Z]{2}$/.test(identifier) : /^[A-Z][A-Z0-9_]{1,39}$/.test(identifier);
    if (!valid) {
      showToast(scopeKind === 'users' ? 'Enter a valid customer ID beginning with usr_' : scopeKind === 'countries' ? 'Enter a two-letter country code' : 'Enter a valid internal role code', false);
      return;
    }
    patchScopedFeature(scopeKind, identifier, scopeFeature, true);
    setScopeIdentifier('');
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save() {
    if (activeSection === 'env') return;
    setSaving(true);
    const r = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ section: activeSection, data: config[activeSection] }),
    });
    setSaving(false);
    if (r.ok) { showToast('Configuration saved'); setDirty(false); }
    else showToast('Save failed', false);
  }

  async function reset() {
    if (activeSection === 'env') return;
    setSaving(true);
    const r = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ section: activeSection, action: 'reset' }),
    });
    setSaving(false);
    if (r.ok) { const d = await r.json(); setConfig(current => ({ ...current, ...d.config })); showToast('Reset to defaults'); setDirty(false); }
    else showToast('Reset failed', false);
  }

  const s = (section: string) => config[section] ?? {};

  return (
    <>
      <Helmet>
        <title>Configuration Center — City Gate Capital Admin</title>
        <meta name="description" content="Admin configuration center — manage branding, theme, features, exchange rates, language, currency and timezone settings." />
        <link rel="canonical" href="https://citygate.capital/admin/config" />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <main className="sr-only"><h1>Configuration Center</h1></main>

      <AdminLayout title="Configuration Center">
        {loading ? (
          <div className="flex justify-center py-24"><Loader2 size={20} className="animate-spin text-white/20" /></div>
        ) : (
          <div className="flex gap-6 pb-10">

            {/* ── Sidebar ─────────────────────────────────────────────── */}
            <div className="w-52 shrink-0 space-y-0.5">
              {SECTIONS.map(sec => {
                const Icon = sec.icon;
                const active = activeSection === sec.id;
                return (
                  <button key={sec.id} onClick={() => setActiveSection(sec.id)}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${active ? 'text-black' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'}`}
                    style={active ? { background: 'linear-gradient(135deg,#C9A84C,#F0D080)' } : {}}>
                    <Icon size={13} className={active ? 'text-black' : 'text-white/30'} />
                    <span className="truncate">{sec.label}</span>
                  </button>
                );
              })}
            </div>

            {/* ── Content panel ───────────────────────────────────────── */}
            <div className="flex-1 min-w-0">
              <div className="rounded-2xl border border-white/5 p-6" style={{ background: 'rgba(255,255,255,0.025)' }}>

                {/* ── BRANDING ────────────────────────────────────────── */}
                {activeSection === 'branding' && (
                  <>
                    <SectionHeader title="Branding" desc={SECTIONS[0].desc} onReset={reset} saving={saving} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="App Name"      value={s('branding').appName      ?? ''} onChange={v => patch('branding','appName',v)} />
                      <Field label="Tagline"        value={s('branding').tagline       ?? ''} onChange={v => patch('branding','tagline',v)} />
                      <Field label="Support Email"  value={s('branding').supportEmail  ?? ''} onChange={v => patch('branding','supportEmail',v)} type="email" />
                      <Field label="Support Phone"  value={s('branding').supportPhone  ?? ''} onChange={v => patch('branding','supportPhone',v)} />
                      <Field label="Website URL"    value={s('branding').websiteUrl    ?? ''} onChange={v => patch('branding','websiteUrl',v)} type="url" />
                      <div>
                        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Primary Color</label>
                        <div className="flex gap-2">
                          <input type="color" value={s('branding').primaryColor ?? '#C9A84C'} onChange={e => patch('branding','primaryColor',e.target.value)}
                            className="w-10 h-10 rounded-xl border border-white/8 bg-transparent cursor-pointer" />
                          <input value={s('branding').primaryColor ?? ''} onChange={e => patch('branding','primaryColor',e.target.value)}
                            className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-primary/40" />
                        </div>
                      </div>
                      <div>
                        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Accent Color</label>
                        <div className="flex gap-2">
                          <input type="color" value={s('branding').accentColor ?? '#F0D080'} onChange={e => patch('branding','accentColor',e.target.value)}
                            className="w-10 h-10 rounded-xl border border-white/8 bg-transparent cursor-pointer" />
                          <input value={s('branding').accentColor ?? ''} onChange={e => patch('branding','accentColor',e.target.value)}
                            className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-primary/40" />
                        </div>
                      </div>
                      <Field label="Logo URL"       value={s('branding').logoUrl       ?? ''} onChange={v => patch('branding','logoUrl',v)} />
                      <Field label="Favicon URL"    value={s('branding').faviconUrl    ?? ''} onChange={v => patch('branding','faviconUrl',v)} />
                      <div className="md:col-span-2">
                        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Footer Text</label>
                        <input value={s('branding').footerText ?? ''} onChange={e => patch('branding','footerText',e.target.value)}
                          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
                      </div>
                    </div>
                  </>
                )}

                {/* ── THEME ───────────────────────────────────────────── */}
                {activeSection === 'theme' && (
                  <>
                    <SectionHeader title="Theme" desc={SECTIONS[1].desc} onReset={reset} saving={saving} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <SelectField label="Color Mode" value={s('theme').mode ?? 'dark'} onChange={v => patch('theme','mode',v)}
                        options={[{value:'dark',label:'Dark'},{value:'light',label:'Light'},{value:'system',label:'System'}]} />
                      <Field label="Font Family" value={s('theme').fontFamily ?? 'Inter'} onChange={v => patch('theme','fontFamily',v)} />
                      <SelectField label="Border Radius" value={s('theme').borderRadius ?? 'lg'} onChange={v => patch('theme','borderRadius',v)}
                        options={['none','sm','md','lg','xl'].map(v => ({value:v,label:v.toUpperCase()}))} />
                      <SelectField label="Density" value={s('theme').density ?? 'comfortable'} onChange={v => patch('theme','density',v)}
                        options={[{value:'compact',label:'Compact'},{value:'comfortable',label:'Comfortable'},{value:'spacious',label:'Spacious'}]} />
                      <div className="flex items-center justify-between p-4 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div>
                          <p className="text-white/70 text-sm font-medium">Animations</p>
                          <p className="text-white/30 text-xs">Enable UI motion effects</p>
                        </div>
                        <Toggle value={s('theme').animationsEnabled ?? true} onChange={v => patch('theme','animationsEnabled',v)} />
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div>
                          <p className="text-white/70 text-sm font-medium">Collapsed Sidebar</p>
                          <p className="text-white/30 text-xs">Default sidebar state</p>
                        </div>
                        <Toggle value={s('theme').sidebarCollapsed ?? false} onChange={v => patch('theme','sidebarCollapsed',v)} />
                      </div>
                    </div>
                  </>
                )}

                {/* ── HOMEPAGE ────────────────────────────────────────── */}
                {activeSection === 'homepage' && (
                  <>
                    <SectionHeader title="Homepage" desc={SECTIONS[2].desc} onReset={reset} saving={saving} />
                    <div className="space-y-5">

                      {/* ── Hero copy ──────────────────────────────────── */}
                      <div>
                        <p className="text-white/25 text-[10px] uppercase tracking-widest font-bold mb-3">Hero Copy</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <Field
                              label="Trust Badge"
                              value={s('homepage').trustBadge ?? ''}
                              onChange={v => patch('homepage','trustBadge',v)}
                              hint='Small pill above the headline — e.g. "City Gate Capital pre-deployment platform"'
                            />
                          </div>
                          <Field
                            label="Headline — Part 1"
                            value={s('homepage').headline1 ?? ''}
                            onChange={v => patch('homepage','headline1',v)}
                            hint='Plain text before the gold accent — e.g. "The Future of"'
                          />
                          <Field
                            label="Headline — Gold Accent"
                            value={s('homepage').headlineAccent ?? ''}
                            onChange={v => patch('homepage','headlineAccent',v)}
                            hint='Word(s) rendered in gold shimmer — e.g. "Banking"'
                          />
                          <div className="md:col-span-2">
                            <Field
                              label="Headline — Part 2"
                              value={s('homepage').headline2 ?? ''}
                              onChange={v => patch('homepage','headline2',v)}
                              hint='Plain text after the gold accent — e.g. "is Here"'
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Subheadline</label>
                            <textarea
                              rows={3}
                              value={s('homepage').subheadline ?? ''}
                              onChange={e => patch('homepage','subheadline',e.target.value)}
                              className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 resize-none"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Field
                              label="Secondary CTA Label"
                              value={s('homepage').ctaSecondary ?? ''}
                              onChange={v => patch('homepage','ctaSecondary',v)}
                              hint='Ghost button next to the primary CTA — e.g. "Explore Features"'
                            />
                          </div>
                        </div>
                      </div>

                      {/* ── A/B CTA labels ─────────────────────────────── */}
                      <div>
                        <p className="text-white/25 text-[10px] uppercase tracking-widest font-bold mb-3">Primary CTA — A/B Variants</p>
                        <p className="text-white/25 text-xs mb-3">Each visitor is randomly assigned one variant. All three must be filled.</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Field
                            label="Control variant"
                            value={s('homepage').heroCTAControl ?? ''}
                            onChange={v => patch('homepage','heroCTAControl',v)}
                            hint='e.g. "Open Free Account"'
                          />
                          <Field
                            label="Urgency variant"
                            value={s('homepage').heroCTAUrgency ?? ''}
                            onChange={v => patch('homepage','heroCTAUrgency',v)}
                            hint='e.g. "Start Banking Today"'
                          />
                          <Field
                            label="Benefit variant"
                            value={s('homepage').heroCTABenefit ?? ''}
                            onChange={v => patch('homepage','heroCTABenefit',v)}
                            hint='e.g. "Get $0 Fees Forever"'
                          />
                        </div>
                      </div>

                      {/* ── Section visibility ──────────────────────────── */}
                      <div>
                        <p className="text-white/25 text-[10px] uppercase tracking-widest font-bold mb-3">Section Visibility</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            ['showStats',        'Stats Section'],
                            ['showTestimonials', 'Testimonials'],
                            ['showPartners',     'Partners'],
                            ['showNewsSection',  'News Section'],
                          ].map(([k, l]) => (
                            <div key={k} className="flex items-center justify-between p-3 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                              <p className="text-white/60 text-xs">{l}</p>
                              <Toggle value={s('homepage')[k] ?? true} onChange={v => patch('homepage', k, v)} />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── Announcement banner ─────────────────────────── */}
                      <div className="p-4 rounded-xl border border-white/5 space-y-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white/70 text-sm font-medium">Announcement Banner</p>
                            <p className="text-white/25 text-xs">Shown at the top of the homepage when enabled</p>
                          </div>
                          <Toggle value={s('homepage').announcementBannerEnabled ?? false} onChange={v => patch('homepage','announcementBannerEnabled',v)} />
                        </div>
                        {s('homepage').announcementBannerEnabled && (
                          <div className="space-y-3 pt-1">
                            <Field label="Banner Text" value={s('homepage').announcementBannerText ?? ''} onChange={v => patch('homepage','announcementBannerText',v)} />
                            <SelectField
                              label="Banner Type"
                              value={s('homepage').announcementBannerType ?? 'info'}
                              onChange={v => patch('homepage','announcementBannerType',v)}
                              options={[
                                {value:'info',        label:'Info'},
                                {value:'warning',     label:'Warning'},
                                {value:'success',     label:'Success'},
                                {value:'maintenance', label:'Maintenance'},
                              ]}
                            />
                          </div>
                        )}
                      </div>

                    </div>
                  </>
                )}

                {/* ── DASHBOARD WIDGETS ───────────────────────────────── */}
                {activeSection === 'dashboardWidgets' && (
                  <>
                    <SectionHeader title="Dashboard Widgets" desc={SECTIONS[3].desc} onReset={reset} saving={saving} />
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          ['accountApplicationsEnabled','Account Applications', 'Accept and queue new account applications'],
                          ['contactFormsEnabled',       'Contact Forms',        'Accept public contact submissions'],
                          ['newsletterSignupEnabled',   'Newsletter Signup',    'Accept newsletter subscriptions'],
                          ['supportTicketsEnabled',     'Support Tickets',      'Allow customers to open support cases'],
                          ['cardRequestsEnabled',       'Card Requests',        'Allow eligible customers to request cards'],
                          ['showBalanceWidget',      'Balance Widget'],
                          ['showTransactionFeed',    'Transaction Feed'],
                          ['showSpendingChart',      'Spending Chart'],
                          ['showCurrencyRates',      'Currency Rates'],
                          ['showQuickTransfer',      'Quick Transfer'],
                          ['showCardWidget',         'Card Widget'],
                          ['showNotificationsPanel', 'Notifications Panel'],
                          ['showMarketData',         'Market Data'],
                        ].map(([k, l]) => (
                          <div key={k} className="flex items-center justify-between p-3.5 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <p className="text-white/60 text-sm">{l}</p>
                            <Toggle value={s('dashboardWidgets')[k] ?? true} onChange={v => patch('dashboardWidgets', k, v)} />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Default Currency" value={s('dashboardWidgets').defaultCurrency ?? 'USD'} onChange={v => patch('dashboardWidgets','defaultCurrency',v)} />
                        <Field label="Transaction Feed Limit" value={s('dashboardWidgets').transactionFeedLimit ?? 10} onChange={v => patch('dashboardWidgets','transactionFeedLimit',parseInt(v,10)||10)} type="number" />
                      </div>
                    </div>
                  </>
                )}

                {/* ── NOTIFICATIONS ───────────────────────────────────── */}
                {activeSection === 'notificationSettings' && (
                  <>
                    <SectionHeader title="Notification Settings" desc={SECTIONS[4].desc} onReset={reset} saving={saving} />
                    <div className="space-y-3">
                      {[
                        ['emailNotificationsEnabled',  'Email Notifications',    'Send notifications via email'],
                        ['smsNotificationsEnabled',    'SMS Notifications',      'Send notifications via SMS'],
                        ['pushNotificationsEnabled',   'Push Notifications',     'Browser/app push notifications'],
                        ['loginAlertEmail',            'Login Alert (Email)',    'Email on new login'],
                        ['loginAlertSms',              'Login Alert (SMS)',      'SMS on new login'],
                        ['transactionAlertEmail',      'Transaction Alert (Email)', 'Email on transactions'],
                        ['transactionAlertSms',        'Transaction Alert (SMS)',   'SMS on transactions'],
                        ['kycStatusEmail',             'KYC Status Email',       'Email on KYC status change'],
                        ['marketingEmailsEnabled',     'Marketing Emails',       'Promotional communications'],
                      ].map(([k, l, d]) => (
                        <div key={k} className="flex items-center justify-between p-4 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <div>
                            <p className="text-white/70 text-sm font-medium">{l}</p>
                            <p className="text-white/25 text-xs">{d}</p>
                          </div>
                          <Toggle value={s('notificationSettings')[k] ?? false} onChange={v => patch('notificationSettings', k, v)} />
                        </div>
                      ))}
                      <SelectField label="Digest Frequency" value={s('notificationSettings').digestFrequency ?? 'realtime'} onChange={v => patch('notificationSettings','digestFrequency',v)}
                        options={[{value:'realtime',label:'Real-time'},{value:'hourly',label:'Hourly'},{value:'daily',label:'Daily'},{value:'weekly',label:'Weekly'}]} />
                    </div>
                  </>
                )}

                {/* ── MAINTENANCE MODE ────────────────────────────────── */}
                {activeSection === 'maintenanceMode' && (
                  <>
                    <SectionHeader title="Maintenance Mode" desc={SECTIONS[5].desc} onReset={reset} saving={saving} />
                    <div className="space-y-4">
                      <div className={`p-4 rounded-xl border ${s('maintenanceMode').enabled ? 'border-red-500/30 bg-red-500/5' : 'border-white/5'}`} style={!s('maintenanceMode').enabled ? { background: 'rgba(255,255,255,0.02)' } : {}}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white/80 font-semibold text-sm">Maintenance Mode</p>
                            <p className="text-white/30 text-xs mt-0.5">{s('maintenanceMode').enabled ? '⚠ Site is currently in maintenance mode' : 'Site is live and accessible'}</p>
                          </div>
                          <Toggle value={s('maintenanceMode').enabled ?? false} onChange={v => patch('maintenanceMode','enabled',v)} />
                        </div>
                      </div>
                      <div>
                        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Maintenance Message</label>
                        <textarea rows={3} value={s('maintenanceMode').message ?? ''} onChange={e => patch('maintenanceMode','message',e.target.value)}
                          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 resize-none" />
                      </div>
                      <Field label="Estimated End Time (ISO 8601)" value={s('maintenanceMode').estimatedEndTime ?? ''} onChange={v => patch('maintenanceMode','estimatedEndTime',v)} placeholder="2026-07-12T09:00:00Z" />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <p className="text-white/60 text-sm">Allow Admin Access</p>
                          <Toggle value={s('maintenanceMode').allowAdminAccess ?? true} onChange={v => patch('maintenanceMode','allowAdminAccess',v)} />
                        </div>
                        <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <p className="text-white/60 text-sm">Show Countdown</p>
                          <Toggle value={s('maintenanceMode').showCountdown ?? false} onChange={v => patch('maintenanceMode','showCountdown',v)} />
                        </div>
                      </div>
                      <div>
                        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Allowed IPs (one per line)</label>
                        <textarea rows={3} value={(s('maintenanceMode').allowedIPs ?? []).join('\n')} onChange={e => patch('maintenanceMode','allowedIPs',e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean))}
                          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-primary/40 resize-none" />
                      </div>
                    </div>
                  </>
                )}

                {/* ── FEATURE TOGGLES ─────────────────────────────────── */}
                {activeSection === 'featureToggles' && (
                  <>
                    <SectionHeader title="Feature Toggles" desc={SECTIONS[6].desc} onReset={reset} saving={saving} />
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-primary/15 bg-primary/[.035] p-4">
                        <div className="mb-4">
                          <p className="text-sm font-semibold text-white/80">Customer modules</p>
                          <p className="mt-1 text-xs leading-5 text-white/30">Disabled modules disappear from customer navigation and their server endpoints reject new activity. Existing data is retained. These controls never override provider, compliance, or launch safeguards.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {PLATFORM_MODULES.map(([key, label]) => (
                            <div key={key} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 p-3">
                              <span className="text-sm font-medium text-white/60">{label}</span>
                              <Toggle value={s('featureToggles').platformFeatures?.[key] ?? key !== 'rewards'} onChange={value => patchPlatformFeature(key, value)} />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[.02] p-4">
                        <div className="mb-4">
                          <p className="text-sm font-semibold text-white/80">Account-plan access</p>
                          <p className="mt-1 text-xs leading-5 text-white/30">Restrict a module for Standard, Premium, or Elite customers. Inherit follows the global control above, and no plan can reactivate a globally disabled module.</p>
                        </div>
                        <div className="space-y-4">
                          {PLAN_SCOPES.map(([plan, planLabel]) => (
                            <div key={plan} className="rounded-xl border border-white/5 bg-black/20 p-3">
                              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-primary/80">{planLabel}</p>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {PLATFORM_MODULES.map(([key, label]) => {
                                  const restricted = s('featureToggles').featureAccess?.plans?.[plan]?.[key] === false;
                                  return <button key={key} type="button" onClick={() => patchScopedFeature('plans', plan, key, !restricted)}
                                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition ${restricted ? 'border-red-400/25 bg-red-500/[.06] text-red-200/75' : 'border-white/5 bg-white/[.02] text-white/45 hover:border-primary/20'}`}>
                                    <span>{label}</span><span className="text-[9px] font-bold uppercase tracking-wide">{restricted ? 'Restricted' : 'Inherit'}</span>
                                  </button>;
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[.02] p-4">
                        <div className="mb-4">
                          <p className="text-sm font-semibold text-white/80">Targeted access restrictions</p>
                          <p className="mt-1 text-xs leading-5 text-white/30">Restrict modules for one customer, a country, or an internal role. Existing records are retained and every restriction is enforced by the server.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.4fr_1.3fr_auto] md:items-end">
                          <SelectField label="Scope" value={scopeKind} onChange={value => { setScopeKind(value as FeatureScopeKind); setScopeIdentifier(''); }} options={[
                            { value: 'users', label: 'Customer' }, { value: 'countries', label: 'Country' }, { value: 'internalRoles', label: 'Internal role' },
                          ]} />
                          <Field label={scopeKind === 'users' ? 'Customer ID' : scopeKind === 'countries' ? 'Country code' : 'Role code'} value={scopeIdentifier} onChange={setScopeIdentifier}
                            placeholder={scopeKind === 'users' ? 'usr_…' : scopeKind === 'countries' ? 'GB' : 'SUPPORT_ADMIN'} />
                          <SelectField label="Module" value={scopeFeature} onChange={setScopeFeature} options={PLATFORM_MODULES.map(([value, label]) => ({ value, label }))} />
                          <button type="button" onClick={addScopedRestriction} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-black hover:bg-primary/90">Add restriction</button>
                        </div>
                        <div className="mt-4 space-y-2">
                          {(['users', 'countries', 'internalRoles'] as const).flatMap(kind =>
                            Object.entries(s('featureToggles').featureAccess?.[kind] ?? {}).flatMap(([identifier, overrides]) =>
                              Object.entries(overrides as Record<string, boolean>).filter(([, value]) => value === false).map(([feature]) => {
                                const label = PLATFORM_MODULES.find(([key]) => key === feature)?.[1] ?? feature;
                                const kindLabel = kind === 'users' ? 'Customer' : kind === 'countries' ? 'Country' : 'Internal role';
                                return <div key={`${kind}:${identifier}:${feature}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/15 bg-red-500/[.035] px-3 py-2.5">
                                  <div><span className="text-xs font-semibold text-white/65">{kindLabel}: {identifier}</span><span className="ml-2 text-xs text-red-200/55">{label} restricted</span></div>
                                  <button type="button" onClick={() => patchScopedFeature(kind, identifier, feature, false)} className="text-[10px] font-bold uppercase tracking-wide text-white/35 hover:text-white">Remove</button>
                                </div>;
                              })
                            )
                          )}
                          {(['users', 'countries', 'internalRoles'] as const).every(kind => Object.keys(s('featureToggles').featureAccess?.[kind] ?? {}).length === 0) &&
                            <p className="rounded-xl border border-dashed border-white/8 p-4 text-center text-xs text-white/25">No targeted restrictions configured.</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          ['virtualCardsEnabled',     'Virtual Cards',          'Issue virtual debit cards'],
                          ['cryptoWalletEnabled',     'Crypto Wallet',          'Cryptocurrency wallet features'],
                          ['p2pTransfersEnabled',     'P2P Transfers',          'Peer-to-peer money transfers'],
                          ['internationalTransfers',  'International Transfers','Cross-border wire transfers'],
                          ['savingsAccountEnabled',   'Savings Accounts',       'High-yield savings products'],
                          ['loanApplicationEnabled',  'Loan Applications',      'Personal & business loans'],
                          ['referralProgramEnabled',  'Referral Program',       'Customer referral rewards'],
                          ['twoFactorRequired',       '2FA Required',           'Force 2FA for all users'],
                          ['biometricLoginEnabled',   'Biometric Login',        'Fingerprint/face ID login'],
                          ['darkModeEnabled',         'Dark Mode',              'Allow users to toggle dark mode'],
                          ['chatSupportEnabled',      'Chat Support',           'Live chat widget for customers'],
                          ['kycRequiredForTransfers', 'KYC for Transfers',      'Require KYC before transfers'],
                        ].map(([k, l, d]) => (
                          <div key={k} className="flex items-center justify-between p-3.5 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <div>
                              <p className="text-white/70 text-sm font-medium">{l}</p>
                              <p className="text-white/25 text-xs">{d}</p>
                            </div>
                            <Toggle value={s('featureToggles')[k] ?? false} onChange={v => patch('featureToggles', k, v)} />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <Field label="Max Daily Transfer Limit ($)" value={s('featureToggles').maxDailyTransferLimit ?? 50000} onChange={v => patch('featureToggles','maxDailyTransferLimit',parseFloat(v)||0)} type="number" />
                        <Field label="Max Single Transfer Limit ($)" value={s('featureToggles').maxSingleTransferLimit ?? 10000} onChange={v => patch('featureToggles','maxSingleTransferLimit',parseFloat(v)||0)} type="number" />
                      </div>
                    </div>
                  </>
                )}

                {/* ── EXCHANGE RATES ──────────────────────────────────── */}
                {activeSection === 'exchangeRates' && (
                  <>
                    <SectionHeader title="Exchange Rate Settings" desc={SECTIONS[7].desc} onReset={reset} saving={saving} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Base Currency" value={s('exchangeRates').baseCurrency ?? 'USD'} onChange={v => patch('exchangeRates','baseCurrency',v)} />
                      <SelectField label="Provider" value={s('exchangeRates').provider ?? 'manual'} onChange={v => patch('exchangeRates','provider',v)}
                        options={[{value:'manual',label:'Manual'},{value:'openexchangerates',label:'Open Exchange Rates'},{value:'fixer',label:'Fixer.io'},{value:'exchangerate-api',label:'ExchangeRate-API'}]} />
                      <Field label="Provider API Key" value={s('exchangeRates').apiKey ?? ''} onChange={v => patch('exchangeRates','apiKey',v)} placeholder="Enter API key" hint="Stored securely — displayed as ••••••••" />
                      <Field label="Markup %" value={s('exchangeRates').markupPercent ?? 1.5} onChange={v => patch('exchangeRates','markupPercent',parseFloat(v)||0)} type="number" hint="Applied on top of mid-market rate" />
                      <Field label="Update Interval (minutes)" value={s('exchangeRates').updateIntervalMins ?? 60} onChange={v => patch('exchangeRates','updateIntervalMins',parseInt(v,10)||60)} type="number" />
                      <Field label="Decimal Places" value={s('exchangeRates').roundingDecimalPlaces ?? 4} onChange={v => patch('exchangeRates','roundingDecimalPlaces',parseInt(v,10)||4)} type="number" />
                      <div className="md:col-span-2">
                        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Displayed Currencies (comma-separated)</label>
                        <input value={(s('exchangeRates').displayedCurrencies ?? []).join(', ')} onChange={e => patch('exchangeRates','displayedCurrencies',e.target.value.split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean))}
                          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-primary/40" />
                      </div>
                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <p className="text-white/60 text-sm">Auto-Update Rates</p>
                        <Toggle value={s('exchangeRates').autoUpdateEnabled ?? false} onChange={v => patch('exchangeRates','autoUpdateEnabled',v)} />
                      </div>
                    </div>
                  </>
                )}

                {/* ── LANGUAGE ────────────────────────────────────────── */}
                {activeSection === 'language' && (
                  <>
                    <SectionHeader title="Language" desc={SECTIONS[8].desc} onReset={reset} saving={saving} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <SelectField label="Default Locale" value={s('language').defaultLocale ?? 'en-US'} onChange={v => patch('language','defaultLocale',v)}
                        options={['en-US','en-GB','fr-FR','de-DE','es-ES','pt-BR','ar-SA','zh-CN'].map(l => ({value:l,label:l}))} />
                      <SelectField label="Date Format" value={s('language').dateFormat ?? 'DD/MM/YYYY'} onChange={v => patch('language','dateFormat',v)}
                        options={['DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD','D MMM YYYY'].map(f => ({value:f,label:f}))} />
                      <SelectField label="Time Format" value={s('language').timeFormat ?? '24h'} onChange={v => patch('language','timeFormat',v)}
                        options={[{value:'12h',label:'12-hour (AM/PM)'},{value:'24h',label:'24-hour'}]} />
                      <SelectField label="Number Format" value={s('language').numberFormat ?? 'en-US'} onChange={v => patch('language','numberFormat',v)}
                        options={['en-US','en-GB','de-DE','fr-FR'].map(f => ({value:f,label:f}))} />
                      <div className="md:col-span-2">
                        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Supported Locales (comma-separated)</label>
                        <input value={(s('language').supportedLocales ?? []).join(', ')} onChange={e => patch('language','supportedLocales',e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-primary/40" />
                      </div>
                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <p className="text-white/60 text-sm">RTL Support</p>
                        <Toggle value={s('language').rtlEnabled ?? false} onChange={v => patch('language','rtlEnabled',v)} />
                      </div>
                    </div>
                  </>
                )}

                {/* ── CURRENCY ────────────────────────────────────────── */}
                {activeSection === 'currency' && (
                  <>
                    <SectionHeader title="Currency" desc={SECTIONS[9].desc} onReset={reset} saving={saving} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Default Currency" value={s('currency').defaultCurrency ?? 'USD'} onChange={v => patch('currency','defaultCurrency',v.toUpperCase())} />
                      <SelectField label="Currency Position" value={s('currency').currencyPosition ?? 'before'} onChange={v => patch('currency','currencyPosition',v)}
                        options={[{value:'before',label:'Before amount ($100)'},{value:'after',label:'After amount (100$)'}]} />
                      <SelectField label="Thousands Separator" value={s('currency').thousandsSeparator ?? ','} onChange={v => patch('currency','thousandsSeparator',v)}
                        options={[{value:',',label:'Comma (1,000)'},{value:'.',label:'Period (1.000)'},{value:' ',label:'Space (1 000)'}]} />
                      <SelectField label="Decimal Separator" value={s('currency').decimalSeparator ?? '.'} onChange={v => patch('currency','decimalSeparator',v)}
                        options={[{value:'.',label:'Period (1.50)'},{value:',',label:'Comma (1,50)'}]} />
                      <div className="md:col-span-2">
                        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Supported Currencies (comma-separated)</label>
                        <input value={(s('currency').supportedCurrencies ?? []).join(', ')} onChange={e => patch('currency','supportedCurrencies',e.target.value.split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean))}
                          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-primary/40" />
                      </div>
                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <p className="text-white/60 text-sm">Show Currency Code</p>
                        <Toggle value={s('currency').showCurrencyCode ?? false} onChange={v => patch('currency','showCurrencyCode',v)} />
                      </div>
                    </div>
                  </>
                )}

                {/* ── TIMEZONE ────────────────────────────────────────── */}
                {activeSection === 'timezone' && (
                  <>
                    <SectionHeader title="Timezone" desc={SECTIONS[10].desc} onReset={reset} saving={saving} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Default Timezone" value={s('timezone').defaultTimezone ?? 'Africa/Lagos'} onChange={v => patch('timezone','defaultTimezone',v)} hint="IANA timezone identifier e.g. Africa/Lagos" />
                      <Field label="Display Timezone" value={s('timezone').displayTimezone ?? 'Africa/Lagos'} onChange={v => patch('timezone','displayTimezone',v)} />
                      <Field label="Business Hours Start" value={s('timezone').businessHoursStart ?? '09:00'} onChange={v => patch('timezone','businessHoursStart',v)} type="time" />
                      <Field label="Business Hours End"   value={s('timezone').businessHoursEnd   ?? '17:00'} onChange={v => patch('timezone','businessHoursEnd',v)}   type="time" />
                      <div className="md:col-span-2">
                        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Business Days</label>
                        <div className="flex gap-2">
                          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => {
                            const active = (s('timezone').businessDays ?? [1,2,3,4,5]).includes(i);
                            return (
                              <button key={d} type="button" onClick={() => {
                                const days: number[] = s('timezone').businessDays ?? [1,2,3,4,5];
                                patch('timezone','businessDays', active ? days.filter((x: number) => x !== i) : [...days, i].sort());
                              }}
                                className={`w-10 h-10 rounded-xl text-xs font-semibold border transition-colors ${active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/8 text-white/30 hover:text-white'}`}>
                                {d}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div>
                          <p className="text-white/70 text-sm font-medium">Use User Timezone</p>
                          <p className="text-white/25 text-xs">Display times in each user's local timezone</p>
                        </div>
                        <Toggle value={s('timezone').useUserTimezone ?? true} onChange={v => patch('timezone','useUserTimezone',v)} />
                      </div>
                    </div>
                  </>
                )}

                {/* ── ENV VARS ────────────────────────────────────────── */}
                {activeSection === 'env' && (
                  <>
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <div>
                        <h2 className="text-white font-bold text-base">Environment Variables</h2>
                        <p className="text-white/30 text-xs mt-0.5">Secret status only — values are never exposed</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-1 text-emerald-400"><CheckCircle size={10} /> Present</span>
                        <span className="flex items-center gap-1 text-amber-400"><AlertTriangle size={10} /> Default</span>
                        <span className="flex items-center gap-1 text-red-400"><AlertCircle size={10} /> Missing</span>
                      </div>
                    </div>

                    {envVars.length === 0 ? (
                      <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-white/20" /></div>
                    ) : (
                      <div className="space-y-1.5">
                        {['CRITICAL','WARNING','INFO'].map(level => {
                          const vars = envVars.filter(v => v.level === level);
                          if (vars.length === 0) return null;
                          const levelColor = level === 'CRITICAL' ? 'text-red-400' : level === 'WARNING' ? 'text-amber-400' : 'text-white/30';
                          return (
                            <div key={level}>
                              <p className={`text-[10px] uppercase tracking-widest font-bold mb-2 mt-4 ${levelColor}`}>{level}</p>
                              {vars.map(v => (
                                <div key={v.name} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 mb-1.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                  <div className="shrink-0">
                                    {v.status === 'PRESENT'
                                      ? <CheckCircle  size={13} className="text-emerald-400" />
                                      : v.status === 'DEFAULT'
                                      ? <AlertTriangle size={13} className="text-amber-400" />
                                      : <AlertCircle  size={13} className="text-red-400" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white/80 text-xs font-mono font-semibold">{v.name}</p>
                                    <p className="text-white/30 text-[10px] truncate">{v.service} — {v.description}</p>
                                  </div>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                    v.status === 'PRESENT'  ? 'bg-emerald-500/15 text-emerald-400' :
                                    v.status === 'DEFAULT'  ? 'bg-amber-500/15 text-amber-400' :
                                                              'bg-red-500/15 text-red-400'
                                  }`}>{v.status}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* ── Save bar ────────────────────────────────────────── */}
                {activeSection !== 'env' && (
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
                    {dirty && <p className="text-amber-400/70 text-xs flex items-center gap-1.5"><Info size={11} /> Unsaved changes</p>}
                    <div className="ml-auto">
                      <button type="button" onClick={save} disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-black text-sm disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Toast ─────────────────────────────────────────────────────── */}
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
