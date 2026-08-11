import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Save, CheckCircle, Palette, Navigation, Image, Type,
  Layout, Code, Eye, Smartphone, Monitor, Tablet, AlertCircle,
  MapPin, ExternalLink, FileText, Upload, Download, History,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';
import { DEFAULT_BUSINESS_ADDRESS, resolveBusinessLocation } from '@/lib/businessLocation';

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
  businessAddressPublished: boolean;
  businessAddressPublicationEvidence: string;
  footerCopyright: string;
  showNewsletterInFooter: boolean;
  showTrustBadgesInFooter: boolean;

  // Announcement
  announcementEnabled: boolean;
  announcementText: string;
  announcementLink: string;

  // Theme
  darkMode: boolean;
  borderRadius: 'sharp' | 'rounded' | 'pill';
  animationsEnabled: boolean;
}

const DEFAULT: WebsiteSettings = {
  siteName: 'City Gate Capital',
  siteTagline: 'Digital Finance Product Preview',
  logoUrl: '/assets/brand/city-gate-capital-horizontal.png',
  faviconUrl: '/assets/brand/city-gate-capital-favicon.png',
  primaryColor: '#C9A84C',
  accentColor: '#627EEA',
  fontHeading: 'Space Grotesk',
  fontBody: 'Inter',

  heroTitle: 'Explore the Future of Digital Finance',
  heroSubtitle: 'A product preview of proposed account, wallet, transfer, card, analytics, and administration experiences.',
  heroCTA: 'Create Preview Profile',
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
  navCTALabel: 'Create Preview Profile',
  navCTALink: '/accounts',
  showSupportInNav: true,
  showLoginInNav: true,

  footerTagline: 'Premium digital banking for the modern world. Secure, fast, and built for global citizens who demand more.',
  footerEmail: 'info@citygate.capital',
  footerPhone: '+44 7888 382458',
  footerAddress: DEFAULT_BUSINESS_ADDRESS,
  businessAddressPublished: false,
  businessAddressPublicationEvidence: '',
  footerCopyright: '© {year} City Gate Capital Ltd. All rights reserved.',
  showNewsletterInFooter: true,
  showTrustBadgesInFooter: true,

  announcementEnabled: true,
  announcementText: 'Product preview: balances and transactions are demonstrations.',
  announcementLink: '/accounts',

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
  { id: 'copy',      label: 'Page Write-up', icon: FileText },
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
  const [homepageDraft, setHomepageDraft] = useState('');
  const [homepageReason, setHomepageReason] = useState('');
  const [homepageVersion, setHomepageVersion] = useState(0);
  const [homepageHistory, setHomepageHistory] = useState<Array<{ version: number; updatedAt: string; updatedBy: string; hash: string; reason: string }>>([]);

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  useEffect(() => {
    fetch('/api/admin/website', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.settings) {
          const location = resolveBusinessLocation(d.settings);
          setCfg(prev => ({ ...prev, ...d.settings, footerAddress: location.address }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/admin/cms/homepage', { headers: authHeaders() })
      .then(async response => response.ok ? response.json() : Promise.reject(new Error('Unable to load homepage copy.')))
      .then(payload => {
        setHomepageDraft(JSON.stringify(payload.document.content, null, 2));
        setHomepageVersion(payload.document.version ?? 0);
        setHomepageHistory(payload.history ?? []);
      })
      .catch(error => setSaveError(error instanceof Error ? error.message : 'Unable to load homepage copy.'));
  }, []);

  async function publishHomepage() {
    setSaving(true);
    setSaveError('');
    try {
      const content = JSON.parse(homepageDraft);
      const response = await fetch('/api/admin/cms/homepage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ content, reason: homepageReason }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error([payload?.error, ...(payload?.details ?? [])].filter(Boolean).join(' '));
      setHomepageVersion(payload.document.version);
      setHomepageReason('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      const refreshed = await fetch('/api/admin/cms/homepage', { headers: authHeaders() }).then(r => r.json());
      setHomepageHistory(refreshed.history ?? []);
    } catch (error) {
      setSaveError(error instanceof SyntaxError ? 'The uploaded write-up is not valid JSON.' : error instanceof Error ? error.message : 'Unable to publish homepage copy.');
    } finally {
      setSaving(false);
    }
  }

  async function importHomepageFile(file: File) {
    if (file.size > 500_000) {
      setSaveError('Homepage write-up files must be 500 KB or smaller.');
      return;
    }
    try {
      const text = await file.text();
      JSON.parse(text);
      setHomepageDraft(text);
      setSaveError('');
    } catch {
      setSaveError('Upload a valid JSON homepage write-up.');
    }
  }

  function downloadHomepage() {
    const blob = new Blob([homepageDraft], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `city-gate-capital-homepage-v${homepageVersion}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

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

  const businessLocation = resolveBusinessLocation({ footerAddress: cfg.footerAddress });

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
                  <Field k="navCTALabel" label="Nav CTA Button Label" placeholder="Create Preview Profile" />
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
                <TextArea k="footerAddress" label="Business Address" rows={3} />
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={17} className="mt-0.5 shrink-0 text-amber-300" />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-amber-200">Location evidence required</p>
                      <p className="text-xs leading-relaxed text-amber-100/60">
                        The matching Companies House record uses a different registered office, while Google identifies the street-level pin as Barclays. Before publication, retain evidence that City Gate Capital is authorised to occupy this address, is staffed there during stated hours, receives customers there, and displays permanent signage.
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <a href="https://find-and-update.company-information.service.gov.uk/company/11575573" target="_blank" rel="noopener noreferrer" className="text-amber-200 hover:underline">Companies House record</a>
                        <a href="https://support.google.com/business/answer/3038177" target="_blank" rel="noopener noreferrer" className="text-amber-200 hover:underline">Google location rules</a>
                      </div>
                    </div>
                  </div>
                </div>
                <TextArea k="businessAddressPublicationEvidence" label="Publication Evidence / Reference" rows={3} />
                <Toggle
                  k="businessAddressPublished"
                  label="Publish Address and Google Map"
                  desc="Enable only after documentary occupancy and Google eligibility checks are complete"
                />
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <MapPin size={15} className="mt-0.5 shrink-0 text-primary" />
                      <div>
                        <p className="text-xs font-semibold text-white">Live Google Map Preview</p>
                        <p className="mt-0.5 max-w-xl text-[11px] text-white/40">{businessLocation.address}</p>
                      </div>
                    </div>
                    <a
                      href={businessLocation.directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-[#F0D080]"
                    >
                      Open in Google Maps <ExternalLink size={12} />
                    </a>
                  </div>
                  <iframe
                    key={businessLocation.mapEmbedUrl}
                    title="Business address map preview"
                    src={businessLocation.mapEmbedUrl}
                    className="h-72 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
                <p className="text-[11px] leading-relaxed text-white/35">
                  The preview changes while you type. Saving keeps it as an admin draft unless the verified publication control above is enabled.
                </p>
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

            {/* Complete homepage write-up */}
            {tab === 'copy' && (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><FileText size={14} className="text-primary" /> Complete Homepage Write-up</h3>
                    <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/40">
                      Controls every homepage headline, paragraph, feature card, plan, scenario, FAQ, trust label, and call to action. Changes publish at runtime without a code deployment.
                    </p>
                  </div>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Published version {homepageVersion}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 transition-colors hover:border-primary/30 hover:text-white">
                    <Upload size={13} /> Upload write-up
                    <input type="file" accept="application/json,.json,.txt" className="hidden" onChange={event => {
                      const file = event.target.files?.[0];
                      if (file) void importHomepageFile(file);
                      event.target.value = '';
                    }} />
                  </label>
                  <button type="button" onClick={downloadHomepage} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 transition-colors hover:border-primary/30 hover:text-white">
                    <Download size={13} /> Download current write-up
                  </button>
                  <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 transition-colors hover:border-primary/30 hover:text-white">
                    <Eye size={13} /> Open live homepage
                  </a>
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] uppercase tracking-wide text-white/30">Full structured content document</label>
                  <textarea
                    value={homepageDraft}
                    onChange={event => setHomepageDraft(event.target.value)}
                    spellCheck={false}
                    rows={24}
                    className="w-full resize-y rounded-xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-xs leading-relaxed text-white/75 focus:border-primary/40 focus:outline-none"
                  />
                  <p className="mt-2 text-[11px] leading-relaxed text-white/35">Keep the JSON field names intact. The server rejects missing fields, wrong data types, empty text, oversized content, and malformed uploads before anything is published.</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-wide text-white/30">Reason for publication</label>
                    <input value={homepageReason} onChange={event => setHomepageReason(event.target.value)} placeholder="Example: Updated homepage positioning and FAQs"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-primary/40 focus:outline-none" />
                  </div>
                  <button type="button" onClick={publishHomepage} disabled={saving || !homepageDraft || homepageReason.trim().length < 5}
                    className="self-end rounded-xl bg-gradient-to-r from-primary to-[#F0D080] px-5 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40">
                    {saving ? 'Validating…' : 'Validate & Publish'}
                  </button>
                </div>

                <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                  <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-white"><History size={13} className="text-primary" /> Publication history</h4>
                  {homepageHistory.length === 0 ? <p className="text-xs text-white/30">No runtime publications yet. The bundled homepage is active.</p> : (
                    <div className="space-y-2">
                      {homepageHistory.slice(0, 8).map(item => (
                        <div key={`${item.version}-${item.hash}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2 text-[11px]">
                          <span className="font-semibold text-primary">v{item.version}</span>
                          <span className="text-white/55">{item.reason}</span>
                          <span className="text-white/30">{item.updatedBy} · {new Date(item.updatedAt).toLocaleString()}</span>
                          <code className="text-white/25">{item.hash.slice(0, 12)}</code>
                        </div>
                      ))}
                    </div>
                  )}
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
