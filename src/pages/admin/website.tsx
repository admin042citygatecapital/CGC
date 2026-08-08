import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Save, CheckCircle, Palette, Navigation, Image, Type,
  Layout, Code, Eye, Smartphone, Monitor, Tablet, ShieldCheck, AlertCircle,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WebsiteSettings {
  // Branding
  siteName: string;
  siteTagline: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  fontHeading: string;
  fontBody: string;

  // Hero
  heroTitle: string;
  heroSubtitle: string;
  heroCTA: string;
  heroCTALink: string;
  heroSecondaryCTA: string;
  heroSecondaryCTALink: string;
  heroBackgroundType: 'image' | 'gradient' | 'video';

  // Navigation
  navLinks: { label: string; href: string }[];
  navCTALabel: string;
  navCTALink: string;
  showSupportInNav: boolean;
  showLoginInNav: boolean;

  // Footer
  footerTagline: string;
  footerEmail: string;
  footerPhone: string;
  footerAddress: string;
  footerCopyright: string;
  showNewsletterInFooter: boolean;
  showTrustBadgesInFooter: boolean;

  // Announcement
  announcementEnabled: boolean;
  announcementText: string;
  announcementLink: string;

  // Product preview safeguard
  previewNoticeText: string;
  previewNoticePosition: 'top' | 'bottom';
  previewNoticeTone: 'amber' | 'neutral';
  previewNoticeCompact: boolean;

  // Theme
  darkMode: boolean;
  borderRadius: 'sharp' | 'rounded' | 'pill';
  animationsEnabled: boolean;
}

const DEFAULT: WebsiteSettings = {
  siteName: 'City Gate Capital',
  siteTagline: 'Secure Digital Banking for the Modern World',
  logoUrl: '/assets/brand/city-gate-capital-horizontal.png',
  faviconUrl: '/assets/brand/city-gate-capital-favicon.png',
  primaryColor: '#C9A84C',
  accentColor: '#627EEA',
  fontHeading: 'Space Grotesk',
  fontBody: 'Inter',

  heroTitle: 'The Future of Banking is Here',
  heroSubtitle: 'Secure, fast, and built for global citizens who demand more from their bank.',
  heroCTA: 'Open Free Account',
  heroCTALink: '/accounts',
  heroSecondaryCTA: 'Explore Features',
  heroSecondaryCTALink: '/digital-banking',
  heroBackgroundType: 'image',

  navLinks: [
    { label: 'Digital Banking', href: '/digital-banking' },
    { label: 'Wallet',          href: '/wallet' },
    { label: 'Accounts',        href: '/accounts' },
    { label: 'Transfers',       href: '/transfers' },
    { label: 'About',           href: '/about' },
  ],
  navCTALabel: 'Open Account',
  navCTALink: '/accounts',
  showSupportInNav: true,
  showLoginInNav: true,

  footerTagline: 'Premium digital banking for the modern world. Secure, fast, and built for global citizens who demand more.',
  footerEmail: 'info@citygate.capital',
  footerPhone: '+44 7888 382458',
  footerAddress: '1 Canada Square, Canary Wharf, London',
  footerCopyright: '© {year} City Gate Capital Ltd. All rights reserved.',
  showNewsletterInFooter: true,
  showTrustBadgesInFooter: true,

  announcementEnabled: true,
  announcementText: 'Product preview: balances and transactions are demonstrations.',
  announcementLink: '/accounts',

  previewNoticeText: 'Product preview — City Gate Capital is not operating as a bank in this environment. Balances and trading are demonstrations; deposits, custody, insurance, and live financial transactions are unavailable.',
  previewNoticePosition: 'bottom',
  previewNoticeTone: 'amber',
  previewNoticeCompact: false,

  darkMode: true,
  borderRadius: 'rounded',
  animationsEnabled: true,
};

const TABS = [
  { id: 'branding',  label: 'Branding',    icon: Palette },
  { id: 'hero',      label: 'Hero Section', icon: Image },
  { id: 'nav',       label: 'Navigation',  icon: Navigation },
  { id: 'footer',    label: 'Footer',      icon: Layout },
  { id: 'announce',  label: 'Announcement', icon: Type },
  { id: 'preview',   label: 'Preview Notice', icon: ShieldCheck },
  { id: 'theme',     label: 'Theme',       icon: Code },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminWebsite() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [tab, setTab]     = useState('branding');
  const [cfg, setCfg]     = useState<WebsiteSettings>(DEFAULT);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [preview, setPreview] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  useEffect(() => {
    fetch('/api/admin/website', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.settings) setCfg(prev => ({ ...prev, ...d.settings })); })
      .catch(() => {});
  }, []);

  function set<K extends keyof WebsiteSettings>(key: K, value: WebsiteSettings[K]) {
    setCfg(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    try {
      const response = await fetch('/api/admin/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ settings: cfg }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Unable to save website settings.');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save website settings.');
    } finally {
      setSaving(false);
    }
  }

  const Field = ({ k, label, type = 'text', placeholder = '' }: { k: keyof WebsiteSettings; label: string; type?: string; placeholder?: string }) => (
    <div>
      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">{label}</label>
      <input type={type} value={String(cfg[k])} onChange={e => set(k, e.target.value as WebsiteSettings[typeof k])}
        placeholder={placeholder}
        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
    </div>
  );

  const TextArea = ({ k, label, rows = 3 }: { k: keyof WebsiteSettings; label: string; rows?: number }) => (
    <div>
      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">{label}</label>
      <textarea rows={rows} value={String(cfg[k])} onChange={e => set(k, e.target.value as WebsiteSettings[typeof k])}
        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors resize-none" />
    </div>
  );

  const Toggle = ({ k, label, desc }: { k: keyof WebsiteSettings; label: string; desc?: string }) => (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.04]">
      <div>
        <p className="text-white text-sm font-medium">{label}</p>
        {desc && <p className="text-white/30 text-xs">{desc}</p>}
      </div>
      <button type="button" onClick={() => set(k, !cfg[k] as WebsiteSettings[typeof k])}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${cfg[k] ? 'bg-primary' : 'bg-white/10'}`}>
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${cfg[k] ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );

  const ColorField = ({ k, label }: { k: keyof WebsiteSettings; label: string }) => (
    <div>
      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">{label}</label>
      <div className="flex items-center gap-3">
        <input type="color" value={String(cfg[k])} onChange={e => set(k, e.target.value as WebsiteSettings[typeof k])}
          className="w-10 h-10 rounded-xl border border-white/8 bg-transparent cursor-pointer shrink-0" />
        <input value={String(cfg[k])} onChange={e => set(k, e.target.value as WebsiteSettings[typeof k])}
          className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors" />
      </div>
    </div>
  );

  return (
    <>
      <Helmet><title>Website Settings — CGC Admin</title><meta name="description" content="Website configuration and CMS settings for City Gate Capital." /><meta name="robots" content="noindex, nofollow" /><link rel="canonical" href="https://citygate.capital/admin/website" /></Helmet>
      <AdminLayout title="Website Settings">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">Website Settings</h1>
            <p className="text-white/30 text-sm">Full control over branding, layout, navigation, and content</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Preview device toggle */}
            <div className="hidden md:flex items-center gap-1 bg-white/[0.04] border border-white/8 rounded-xl p-1">
              {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([d, Icon]) => (
                <button key={d} onClick={() => setPreview(d)}
                  className={`p-1.5 rounded-lg transition-colors ${preview === d ? 'bg-primary/20 text-primary' : 'text-white/25 hover:text-white/50'}`}>
                  <Icon size={13} />
                </button>
              ))}
            </div>
            <a href="/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-white/40 border border-white/8 hover:text-white hover:border-white/20 transition-colors">
              <Eye size={13} /> Preview
            </a>
            {saved && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-sm">
                <CheckCircle size={14} /> Saved
              </motion.div>
            )}
            {saveError && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                <AlertCircle size={14} /> {saveError}
              </div>
            )}
            <button onClick={handleSave} disabled={saving}
              className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-black text-sm overflow-hidden disabled:opacity-60">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
              <span className="relative flex items-center gap-2">
                {saving ? <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save size={14} />}
                Save Changes
              </span>
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
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

          {/* Content */}
          <div className="flex-1 rounded-2xl border border-white/5 p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.025)' }}>

            {/* Branding */}
            {tab === 'branding' && (
              <>
                <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Palette size={14} className="text-primary" /> Branding & Identity</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field k="siteName" label="Site Name" placeholder="City Gate Capital" />
                  <Field k="siteTagline" label="Tagline" placeholder="Secure Digital Banking…" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field k="logoUrl" label="Logo URL" placeholder="/assets/logo.jpg" />
                  <Field k="faviconUrl" label="Favicon URL" placeholder="/assets/favicon.ico" />
                </div>
                {/* Logo preview */}
                {cfg.logoUrl && (
                  <div className="p-4 rounded-xl border border-white/8 flex items-center gap-4" style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <img src={cfg.logoUrl} alt="Logo preview" className="h-12 w-auto object-contain" />
                    <div>
                      <p className="text-white text-sm font-bold">{cfg.siteName}</p>
                      <p className="text-white/30 text-xs">{cfg.siteTagline}</p>
                    </div>
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <ColorField k="primaryColor" label="Primary / Brand Color" />
                  <ColorField k="accentColor" label="Accent Color" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Heading Font</label>
                    <select value={cfg.fontHeading} onChange={e => set('fontHeading', e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors">
                      {['Space Grotesk','Inter','Montserrat','Playfair Display','Lora','Merriweather'].map(f => (
                        <option key={f} value={f} className="bg-[#0A0A0A]">{f}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Body Font</label>
                    <select value={cfg.fontBody} onChange={e => set('fontBody', e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors">
                      {['Inter','Space Grotesk','Roboto','Open Sans','Lato','Source Sans Pro'].map(f => (
                        <option key={f} value={f} className="bg-[#0A0A0A]">{f}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Hero */}
            {tab === 'hero' && (
              <>
                <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Image size={14} className="text-primary" /> Hero Section</h3>
                <Field k="heroTitle" label="Hero Headline" placeholder="The Future of Banking is Here" />
                <TextArea k="heroSubtitle" label="Hero Subtitle" />
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field k="heroCTA" label="Primary CTA Label" placeholder="Open Free Account" />
                  <Field k="heroCTALink" label="Primary CTA Link" placeholder="/accounts" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field k="heroSecondaryCTA" label="Secondary CTA Label" placeholder="Explore Features" />
                  <Field k="heroSecondaryCTALink" label="Secondary CTA Link" placeholder="/digital-banking" />
                </div>
                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Background Type</label>
                  <div className="flex gap-3">
                    {(['image', 'gradient', 'video'] as const).map(t => (
                      <button key={t} type="button" onClick={() => set('heroBackgroundType', t)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border capitalize ${
                          cfg.heroBackgroundType === t
                            ? 'border-primary/40 text-primary bg-primary/10'
                            : 'border-white/8 text-white/40 hover:text-white/70'
                        }`}>{t}</button>
                    ))}
                  </div>
                </div>
                {/* Hero preview */}
                <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: '#0A0A0A' }}>
                  <div className="px-6 py-8 text-center">
                    <p className="text-white text-lg font-bold mb-2">{cfg.heroTitle || 'Hero Title'}</p>
                    <p className="text-white/40 text-xs mb-4">{cfg.heroSubtitle || 'Hero subtitle text'}</p>
                    <div className="flex justify-center gap-2">
                      <span className="px-4 py-2 rounded-xl text-xs font-bold text-black"
                        style={{ background: `linear-gradient(135deg, ${cfg.primaryColor}, #F0D080)` }}>
                        {cfg.heroCTA || 'CTA'}
                      </span>
                      <span className="px-4 py-2 rounded-xl text-xs font-medium text-white/60 border border-white/10">
                        {cfg.heroSecondaryCTA || 'Secondary'}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Navigation */}
            {tab === 'nav' && (
              <>
                <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Navigation size={14} className="text-primary" /> Navigation</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field k="navCTALabel" label="Nav CTA Button Label" placeholder="Open Account" />
                  <Field k="navCTALink" label="Nav CTA Link" placeholder="/accounts" />
                </div>
                <Toggle k="showSupportInNav" label="Show Support Link" desc="Display Support in header" />
                <Toggle k="showLoginInNav" label="Show Login Link" desc="Display Log In button in header" />
                <div>
                  <p className="text-white/30 text-[10px] uppercase tracking-wide mb-3">Nav Links</p>
                  <div className="space-y-2">
                    {cfg.navLinks.map((link, i) => (
                      <div key={i} className="flex gap-2">
                        <input value={link.label} onChange={e => {
                          const updated = [...cfg.navLinks];
                          updated[i] = { ...updated[i], label: e.target.value };
                          set('navLinks', updated);
                        }} placeholder="Label"
                          className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
                        <input value={link.href} onChange={e => {
                          const updated = [...cfg.navLinks];
                          updated[i] = { ...updated[i], href: e.target.value };
                          set('navLinks', updated);
                        }} placeholder="/path"
                          className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
                        <button onClick={() => set('navLinks', cfg.navLinks.filter((_, j) => j !== i))}
                          className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400/50 hover:text-red-400 transition-colors shrink-0 text-xs">✕</button>
                      </div>
                    ))}
                    <button onClick={() => set('navLinks', [...cfg.navLinks, { label: '', href: '' }])}
                      className="flex items-center gap-1.5 text-xs text-primary/60 hover:text-primary transition-colors">
                      + Add nav link
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Footer */}
            {tab === 'footer' && (
              <>
                <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Layout size={14} className="text-primary" /> Footer</h3>
                <TextArea k="footerTagline" label="Footer Tagline" />
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field k="footerEmail" label="Contact Email" placeholder="info@citygate.capital" />
                  <Field k="footerPhone" label="Phone Number" placeholder="+44 7888 382458" />
                </div>
                <Field k="footerAddress" label="Address" placeholder="1 Canada Square, London" />
                <Field k="footerCopyright" label="Copyright Text (use {year} for dynamic year)" placeholder="© {year} City Gate Capital Ltd." />
                <Toggle k="showNewsletterInFooter" label="Newsletter Signup" desc="Show newsletter form in footer" />
                <Toggle k="showTrustBadgesInFooter" label="Trust Badges" desc="Show preview safeguards and launch-status badges" />
              </>
            )}

            {/* Announcement */}
            {tab === 'announce' && (
              <>
                <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Type size={14} className="text-primary" /> Announcement Banner</h3>
                <Toggle k="announcementEnabled" label="Show Announcement Banner" desc="Display ticker/banner below header" />
                <Field k="announcementText" label="Announcement Text" placeholder="Product preview: no live deposits or transactions." />
                <Field k="announcementLink" label="Announcement Link (optional)" placeholder="/accounts" />
                {/* Preview */}
                <div className="rounded-xl overflow-hidden border border-white/8">
                  <div className={`px-4 py-2 text-center text-xs font-medium text-black transition-opacity ${cfg.announcementEnabled ? 'opacity-100' : 'opacity-30'}`}
                    style={{ background: `linear-gradient(90deg, ${cfg.primaryColor}, #F0D080)` }}>
                    {cfg.announcementText || 'Announcement text here'}
                  </div>
                </div>
              </>
            )}

            {/* Product preview safeguard */}
            {tab === 'preview' && (
              <>
                <h3 className="text-white font-semibold text-sm flex items-center gap-2"><ShieldCheck size={14} className="text-primary" /> Product Preview Notice</h3>
                <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.05]">
                  <p className="text-amber-100/90 text-sm font-medium">Preview mode is server-enforced</p>
                  <p className="text-amber-100/50 text-xs mt-1">You can manage the wording and appearance here. The notice remains visible until the deployment passes live-readiness checks and is switched to live mode.</p>
                </div>
                <TextArea k="previewNoticeText" label="Public Preview Notice" rows={5} />
                <p className="text-white/25 text-xs -mt-3">Use 40–600 characters and clearly describe which services are demonstrations or unavailable.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Position</label>
                    <select value={cfg.previewNoticePosition} onChange={e => set('previewNoticePosition', e.target.value as WebsiteSettings['previewNoticePosition'])}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors">
                      <option value="bottom" className="bg-[#0A0A0A]">Bottom of screen</option>
                      <option value="top" className="bg-[#0A0A0A]">Top of screen</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Appearance</label>
                    <select value={cfg.previewNoticeTone} onChange={e => set('previewNoticeTone', e.target.value as WebsiteSettings['previewNoticeTone'])}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors">
                      <option value="amber" className="bg-[#0A0A0A]">Amber compliance</option>
                      <option value="neutral" className="bg-[#0A0A0A]">Neutral dark</option>
                    </select>
                  </div>
                </div>
                <Toggle k="previewNoticeCompact" label="Compact Height" desc="Use a slimmer notice on smaller screens" />
                <div className="rounded-xl overflow-hidden border border-white/8">
                  <div className={`px-4 text-center text-[11px] font-medium ${cfg.previewNoticeCompact ? 'py-1' : 'py-2'} ${cfg.previewNoticeTone === 'amber' ? 'bg-[#17120a] text-amber-100' : 'bg-[#111318] text-white/80'}`}>
                    {cfg.previewNoticeText}
                  </div>
                </div>
              </>
            )}

            {/* Theme */}
            {tab === 'theme' && (
              <>
                <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Code size={14} className="text-primary" /> Theme & Display</h3>
                <Toggle k="darkMode" label="Dark Mode" desc="Use dark background (recommended for CGC)" />
                <Toggle k="animationsEnabled" label="Animations" desc="Enable scroll and entrance animations" />
                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-2 block">Border Radius Style</label>
                  <div className="flex gap-3">
                    {(['sharp', 'rounded', 'pill'] as const).map(r => (
                      <button key={r} type="button" onClick={() => set('borderRadius', r)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border capitalize ${
                          cfg.borderRadius === r
                            ? 'border-primary/40 text-primary bg-primary/10'
                            : 'border-white/8 text-white/40 hover:text-white/70'
                        }`}>{r}</button>
                    ))}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-white/8 space-y-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
                  <p className="text-white/25 text-xs">Theme Preview</p>
                  <div className="flex gap-2">
                    <div className={`px-4 py-2 text-xs font-bold text-black ${cfg.borderRadius === 'sharp' ? 'rounded' : cfg.borderRadius === 'pill' ? 'rounded-full' : 'rounded-xl'}`}
                      style={{ background: `linear-gradient(135deg, ${cfg.primaryColor}, #F0D080)` }}>
                      Primary Button
                    </div>
                    <div className={`px-4 py-2 text-xs font-medium text-white/60 border border-white/10 ${cfg.borderRadius === 'sharp' ? 'rounded' : cfg.borderRadius === 'pill' ? 'rounded-full' : 'rounded-xl'}`}>
                      Secondary
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </AdminLayout>
    </>
  );
}
