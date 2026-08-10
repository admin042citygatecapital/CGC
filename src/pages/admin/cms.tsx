import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders,useAdminAuth } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
Bell,
BookOpen,
Camera,
CheckCircle,
CreditCard,
Edit2,
Globe,
Image,
Layers,
Link,
Loader2,
Mail,
Navigation,
Newspaper,
Plus,
Save,
Search,
Star,
Trash2,
Type,
X
} from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useCallback,useEffect,useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TABS = [
  { id: 'homepage',        label: 'Homepage',        icon: Globe },
  { id: 'hero',            label: 'Hero Media',       icon: Camera },
  { id: 'logo',            label: 'Logo',             icon: Image },
  { id: 'navigation',      label: 'Navigation',       icon: Navigation },
  { id: 'features',        label: 'Features',         icon: Layers },
  { id: 'digital-banking', label: 'Digital Banking',  icon: CreditCard },
  { id: 'news',            label: 'News',             icon: Newspaper },
  { id: 'blog',            label: 'Blog',             icon: BookOpen },
  { id: 'seo',             label: 'SEO',              icon: Search },
  { id: 'email',           label: 'Email Templates',  icon: Mail },
  { id: 'banners',         label: 'Banners',          icon: Bell },
  { id: 'footer',          label: 'Footer & Contact', icon: Link },
];

const INITIAL = {
  heroTitle: 'Explore the Future of Digital Finance',
  heroSubtitle: 'A product preview of proposed multi-currency, transfer, wallet, card, and administration experiences.',
  heroCTA: 'Create Preview Profile',
  metaTitle: 'City Gate Capital — Digital Finance Product Preview',
  metaDescription: 'Explore the City Gate Capital product preview. No deposits, custody, insurance, or live financial transactions are available.',
  ogImage: 'https://citygate.capital/api/og',
  footerEmail: 'info@citygate.capital',
  footerPhone: '+44 7888 382458',
  footerAddress: 'Citygate, 51 Mosley Street, Manchester, M2 3HQ, United Kingdom',
  welcomeEmailSubject: 'Welcome to City Gate Capital',
  welcomeEmailBody: 'Dear {{name}},\n\nWelcome to the City Gate Capital product preview. Your demonstration profile has been created successfully. No live financial account or payment service has been opened.\n\nBest regards,\nCity Gate Capital Team',
  bannerText: 'Product preview: balances and transactions are demonstrations.',
  bannerActive: true,
  // Digital Banking page fields
  dbHeroTitle:        'Preview a Digital Finance Experience',
  dbHeroSubtitle:     'Explore proposed card controls, analytics, payments, and insights using demonstration data.',
  dbHeroCTA:          'Create Preview Profile',
  dbHeroSecondaryCTA: 'Book a Demo',
  dbCtaTitle:         'Explore the Product Preview',
  dbCtaSubtitle:      'Create a demonstration profile. No bank account, payment card, or financial service is issued.',
  dbCtaPrimary:       'Create Preview Profile',
  dbCtaSecondary:     'Book a Demo',
  // Feature cards
  dbFeature1Title: 'Virtual Card Prototype', dbFeature1Desc: 'Preview proposed virtual-card controls. No payment card is issued.',
  dbFeature2Title: 'Freeze & Unfreeze Preview', dbFeature2Desc: 'Explore proposed card-lock controls using demonstration data.',
  dbFeature3Title: 'Alert Prototype', dbFeature3Desc: 'Preview how transaction notifications could appear after provider integration.',
  dbFeature4Title: 'Top-up Simulation', dbFeature4Desc: 'Explore proposed top-up rules without linking a bank or moving funds.',
  dbFeature5Title: 'Spend Analytics Preview', dbFeature5Desc: 'Explore illustrative purchase categorisation and charts.',
  dbFeature6Title: 'Wallet Integration Concept', dbFeature6Desc: 'Mobile-wallet support is proposed and not currently active.',
  dbFeature7Title: 'FX Pricing Concept', dbFeature7Desc: 'View illustrative currency conversions. Rates and fees are not live offers.',
  dbFeature8Title: 'Payment Security Design', dbFeature8Desc: 'Provider authentication and fraud controls must be validated before launch.',
  dbFeature9Title: 'Insights Prototype', dbFeature9Desc: 'Explore proposed insights generated from demonstration activity.',
  // Stats strip
  dbStat1Value: '1',      dbStat1Label: 'Unified Preview',
  dbStat2Value: '$0',     dbStat2Label: 'Live Funds Processed',
  dbStat3Value: '50+',    dbStat3Label: 'Prototype Currencies',
  dbStat4Value: '2FA',    dbStat4Label: 'Account Protection',
};

export default function AdminCMS() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [tab, setTab]     = useState('homepage');
  const [form, setForm]   = useState(INITIAL);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  // Load persisted CMS content on mount
  useEffect(() => {
    fetch('/api/admin/cms', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setForm(prev => ({ ...prev, ...d.data })); })
      .catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/admin/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(form),
      });
    } catch { /* non-critical */ }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const field = (key: keyof typeof form, label: string, type: 'input' | 'textarea' | 'toggle' = 'input') => (
    <div key={key}>
      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">{label}</label>
      {type === 'textarea' ? (
        <textarea rows={5} value={String(form[key])} onChange={e => setForm({ ...form, [key]: e.target.value })}
          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors resize-none" />
      ) : type === 'toggle' ? (
        <button type="button" onClick={() => setForm({ ...form, [key]: !form[key] })}
          className={`relative w-12 h-6 rounded-full transition-colors ${form[key] ? 'bg-primary' : 'bg-white/10'}`}>
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${form[key] ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
      ) : (
        <input value={String(form[key])} onChange={e => setForm({ ...form, [key]: e.target.value })}
          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
      )}
    </div>
  );

  return (
    <>
      <Helmet><title>CMS — CGC Admin</title><meta name="description" content="Content management system for City Gate Capital website." /><meta name="robots" content="noindex, nofollow" /><link rel="canonical" href="https://citygate.capital/admin/cms" /></Helmet>
      <AdminLayout title="CMS">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">Content Management</h1>
            <p className="text-white/30 text-sm">Edit website content, SEO, email templates, and banners</p>
          </div>
          {saved && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-sm">
              <CheckCircle size={14} /> Changes saved
            </motion.div>
          )}
        </div>

        <div className="flex gap-6">
          {/* Sidebar tabs */}
          <div className="w-48 shrink-0 space-y-1">
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
          <div className="flex-1">
            <form onSubmit={handleSave} className="rounded-2xl border border-white/5 p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
              {tab === 'homepage' && (
                <>
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Type size={14} className="text-primary" /> Homepage Content</h3>
                  {field('heroTitle', 'Hero Title')}
                  {field('heroSubtitle', 'Hero Subtitle', 'textarea')}
                  {field('heroCTA', 'Hero CTA Button Text')}
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Announcement Banner</label>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-white/50 text-xs">Active</span>
                      {field('bannerActive', '', 'toggle')}
                    </div>
                    {field('bannerText', 'Banner Text')}
                  </div>
                </>
              )}
              {tab === 'digital-banking' && (
                <>
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2"><CreditCard size={14} className="text-primary" /> Digital Banking Page</h3>
                  <p className="text-white/30 text-xs -mt-2 mb-1">Controls copy on <code className="text-primary/70 font-mono">/digital-banking</code>. Changes go live within 60 seconds.</p>
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-white/5 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">Hero Section</p>
                      {field('dbHeroTitle', 'Headline')}
                      {field('dbHeroSubtitle', 'Subheadline', 'textarea')}
                      {field('dbHeroCTA', 'Primary CTA Label  (links → /accounts)')}
                      {field('dbHeroSecondaryCTA', 'Secondary CTA Label  (links → /contact)')}
                    </div>
                    <div className="p-4 rounded-xl border border-white/5 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">Bottom CTA Banner</p>
                      {field('dbCtaTitle', 'CTA Headline')}
                      {field('dbCtaSubtitle', 'CTA Subheadline', 'textarea')}
                      {field('dbCtaPrimary', 'Primary Button Label  (links → /accounts)')}
                      {field('dbCtaSecondary', 'Secondary Button Label  (links → /contact)')}
                    </div>
                    <div className="p-4 rounded-xl border border-white/5 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">Feature Cards (9 cards)</p>
                      {([1,2,3,4,5,6,7,8,9] as const).map(n => (
                        <div key={n} className="p-3 rounded-lg border border-white/5 space-y-3" style={{ background: 'rgba(255,255,255,0.015)' }}>
                          <p className="text-white/30 text-[10px] uppercase tracking-wide font-semibold">Card {n}</p>
                          {field(`dbFeature${n}Title` as keyof typeof form, `Title`)}
                          {field(`dbFeature${n}Desc` as keyof typeof form, `Description`, 'textarea')}
                        </div>
                      ))}
                    </div>
                    <div className="p-4 rounded-xl border border-white/5 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">Stats Strip (4 stats)</p>
                      {([1,2,3,4] as const).map(n => (
                        <div key={n} className="grid grid-cols-2 gap-3">
                          {field(`dbStat${n}Value` as keyof typeof form, `Stat ${n} — Value`)}
                          {field(`dbStat${n}Label` as keyof typeof form, `Stat ${n} — Label`)}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {tab === 'seo' && (
                <>
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Search size={14} className="text-primary" /> SEO Settings</h3>
                  {field('metaTitle', 'Meta Title (60 chars max)')}
                  {field('metaDescription', 'Meta Description (160 chars max)', 'textarea')}
                  {field('ogImage', 'OG Image URL')}
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/15">
                    <p className="text-white/40 text-xs">Title: {form.metaTitle.length}/60 chars · Description: {form.metaDescription.length}/160 chars</p>
                  </div>
                </>
              )}
              {tab === 'email' && (
                <>
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Mail size={14} className="text-primary" /> Email Templates</h3>
                  {field('welcomeEmailSubject', 'Welcome Email Subject')}
                  {field('welcomeEmailBody', 'Welcome Email Body (use {{name}} for personalization)', 'textarea')}
                </>
              )}
              {tab === 'banners' && (
                <>
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Bell size={14} className="text-primary" /> Site Banners</h3>
                  {field('bannerText', 'Banner Message')}
                  <div className="flex items-center gap-3">
                    <span className="text-white/50 text-sm">Banner Active</span>
                    {field('bannerActive', '', 'toggle')}
                  </div>
                  <div className="p-4 rounded-xl border border-primary/20" style={{ background: 'rgba(201,168,76,0.05)' }}>
                    <p className="text-xs text-white/50 mb-1">Preview:</p>
                    <div className={`px-4 py-2 rounded-lg text-xs font-medium text-black ${form.bannerActive ? 'opacity-100' : 'opacity-30'}`}
                      style={{ background: 'linear-gradient(90deg, #C9A84C, #F0D080)' }}>
                      {form.bannerText}
                    </div>
                  </div>
                </>
              )}
              {tab === 'footer' && (
                <>
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Link size={14} className="text-primary" /> Footer & Contact</h3>
                  {field('footerEmail', 'General Email')}
                  {field('footerPhone', 'Phone Number')}
                  {field('footerAddress', 'Headquarters Address')}
                </>
              )}

              <div className="pt-2">
                <button type="submit" disabled={saving} className="relative px-6 py-3 rounded-xl font-bold text-black text-sm overflow-hidden disabled:opacity-60">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                  <span className="relative flex items-center gap-2">
                    {saving ? <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save size={14} />}
                    {saving ? 'Saving…' : 'Save Changes'}
                  </span>
                </button>
              </div>
            </form>

            {/* ── Non-form tabs rendered outside the <form> ── */}
            {tab === 'hero'       && <HeroMediaTab       showToast={(m, ok = true) => { setSaved(ok); setTimeout(() => setSaved(false), 3000); }} />}
            {tab === 'logo'       && <LogoTab            showToast={(m, ok = true) => { setSaved(ok); setTimeout(() => setSaved(false), 3000); }} />}
            {tab === 'navigation' && <NavigationTab      showToast={(m, ok = true) => { setSaved(ok); setTimeout(() => setSaved(false), 3000); }} />}
            {tab === 'features'   && <FeaturesTab        showToast={(m, ok = true) => { setSaved(ok); setTimeout(() => setSaved(false), 3000); }} />}
            {tab === 'news'       && <NewsTab            showToast={(m, ok = true) => { setSaved(ok); setTimeout(() => setSaved(false), 3000); }} />}
            {tab === 'blog'       && <BlogTab            showToast={(m, ok = true) => { setSaved(ok); setTimeout(() => setSaved(false), 3000); }} />}
          </div>
        </div>
      </AdminLayout>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = 'input', rows = 3 }: { label: string; value: string; onChange: (v: string) => void; type?: 'input' | 'textarea'; rows?: number }) {
  return (
    <div>
      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">{label}</label>
      {type === 'textarea'
        ? <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)} className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 resize-none" />
        : <input value={value} onChange={e => onChange(e.target.value)} className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />}
    </div>
  );
}
function SaveBtn({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={saving}
      className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-black text-sm disabled:opacity-60"
      style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
      {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
      {saving ? 'Saving…' : 'Save Changes'}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero Media Tab
// ─────────────────────────────────────────────────────────────────────────────
function HeroMediaTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [cfg,     setCfg]     = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    fetch('/api/admin/cms/hero', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.hero) setCfg(d.hero); }).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    const r = await fetch('/api/admin/cms/hero', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(cfg) });
    setSaving(false);
    showToast(r.ok ? 'Hero media saved' : 'Save failed', r.ok);
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={18} className="animate-spin text-white/20" /></div>;

  return (
    <div className="rounded-2xl border border-white/5 p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Camera size={14} className="text-primary" /> Hero Media</h3>

      <div>
        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Media Type</label>
        <div className="flex gap-2">
          {(['none','image','video'] as const).map(t => (
            <button key={t} type="button" onClick={() => setCfg((p: any) => ({ ...p, heroMediaType: t }))}
              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors capitalize ${cfg.heroMediaType === t ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/8 text-white/40 hover:text-white'}`}>
              {t === 'none' ? 'Color Only' : t === 'image' ? 'Image' : 'Video'}
            </button>
          ))}
        </div>
      </div>

      {cfg.heroMediaType === 'image' && (
        <div className="space-y-4">
          <Field label="Hero Image URL" value={cfg.heroImageUrl ?? ''} onChange={v => setCfg((p: any) => ({ ...p, heroImageUrl: v }))} />
          <Field label="Image Alt Text" value={cfg.heroImageAlt ?? ''} onChange={v => setCfg((p: any) => ({ ...p, heroImageAlt: v }))} />
          {cfg.heroImageUrl && (
            <div className="rounded-xl overflow-hidden border border-white/8" style={{ maxHeight: 180 }}>
              <img src={cfg.heroImageUrl} alt="preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      )}

      {cfg.heroMediaType === 'video' && (
        <div className="space-y-4">
          <Field label="Video URL (mp4 / YouTube / Vimeo)" value={cfg.heroVideoUrl ?? ''} onChange={v => setCfg((p: any) => ({ ...p, heroVideoUrl: v }))} />
          <div>
            <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Video Type</label>
            <select value={cfg.heroVideoType ?? 'mp4'} onChange={e => setCfg((p: any) => ({ ...p, heroVideoType: e.target.value }))}
              className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none">
              {['mp4','webm','youtube','vimeo'].map(t => <option key={t} value={t} className="bg-[#0A0A0A] uppercase">{t.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="flex gap-4">
            {[['heroVideoAutoplay','Autoplay'],['heroVideoMuted','Muted'],['heroVideoLoop','Loop']].map(([k,l]) => (
              <button key={k} type="button" onClick={() => setCfg((p: any) => ({ ...p, [k]: !p[k] }))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${cfg[k] ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/8 text-white/40'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Background Overlay Opacity: {cfg.backgroundOverlay ?? 40}%</label>
        <input type="range" min={0} max={100} value={cfg.backgroundOverlay ?? 40} onChange={e => setCfg((p: any) => ({ ...p, backgroundOverlay: parseInt(e.target.value, 10) }))}
          className="w-full accent-primary" />
      </div>

      <SaveBtn saving={saving} onClick={save} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Logo Tab
// ─────────────────────────────────────────────────────────────────────────────
function LogoTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [cfg,     setCfg]     = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    fetch('/api/admin/cms/logo', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.logo) setCfg(d.logo); }).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    const r = await fetch('/api/admin/cms/logo', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(cfg) });
    setSaving(false);
    showToast(r.ok ? 'Logo settings saved' : 'Save failed', r.ok);
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={18} className="animate-spin text-white/20" /></div>;

  return (
    <div className="rounded-2xl border border-white/5 p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Image size={14} className="text-primary" /> Logo Configuration</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-4">
          {[
            ['primaryLogoUrl', 'Primary Logo URL (light background)'],
            ['darkLogoUrl',    'Dark Logo URL (dark background)'],
            ['faviconUrl',     'Favicon URL (.ico / .png)'],
            ['logoAlt',        'Logo Alt Text'],
          ].map(([k, l]) => (
            <Field key={k} label={l} value={cfg[k] ?? ''} onChange={v => setCfg((p: any) => ({ ...p, [k]: v }))} />
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Width (px)</label>
              <input type="number" value={cfg.logoWidth ?? 160} onChange={e => setCfg((p: any) => ({ ...p, logoWidth: parseInt(e.target.value, 10) }))}
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
            </div>
            <div>
              <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Height (px)</label>
              <input type="number" value={cfg.logoHeight ?? 40} onChange={e => setCfg((p: any) => ({ ...p, logoHeight: parseInt(e.target.value, 10) }))}
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {cfg.primaryLogoUrl && (
            <div className="p-4 rounded-xl border border-white/8 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.9)', minHeight: 80 }}>
              <img src={cfg.primaryLogoUrl} alt="primary logo preview" style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }} />
            </div>
          )}
          {cfg.darkLogoUrl && (
            <div className="p-4 rounded-xl border border-white/8 flex items-center justify-center" style={{ background: '#0A0A0A', minHeight: 80 }}>
              <img src={cfg.darkLogoUrl} alt="dark logo preview" style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }} />
            </div>
          )}
          {!cfg.primaryLogoUrl && !cfg.darkLogoUrl && (
            <div className="p-8 rounded-xl border border-white/5 flex flex-col items-center justify-center gap-2 text-white/20">
              <Image size={24} />
              <p className="text-xs">Enter a URL to preview</p>
            </div>
          )}
        </div>
      </div>

      <SaveBtn saving={saving} onClick={save} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Tab
// ─────────────────────────────────────────────────────────────────────────────
function NavigationTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [links,   setLinks]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/cms/navigation', { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setLinks(d.navigation ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    const r = await fetch('/api/admin/cms/navigation', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ links }) });
    setSaving(false);
    showToast(r.ok ? 'Navigation saved' : 'Save failed', r.ok);
  }

  function updateLink(id: string, patch: Record<string, unknown>) {
    setLinks(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l));
  }
  function addLink() {
    const id = Date.now().toString(36);
    setLinks(ls => [...ls, { id, label: 'New Link', href: '/', target: '_self', order: ls.length + 1, section: 'main', enabled: true, children: [] }]);
  }
  function removeLink(id: string) { setLinks(ls => ls.filter(l => l.id !== id)); }

  const sections = ['main', 'footer', 'legal'];

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={18} className="animate-spin text-white/20" /></div>;

  return (
    <div className="rounded-2xl border border-white/5 p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Navigation size={14} className="text-primary" /> Navigation Links</h3>
        <button type="button" onClick={addLink} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-black" style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
          <Plus size={11} /> Add Link
        </button>
      </div>

      {sections.map(section => {
        const sectionLinks = links.filter(l => l.section === section).sort((a, b) => a.order - b.order);
        return (
          <div key={section}>
            <p className="text-white/25 text-[10px] uppercase tracking-widest mb-2 capitalize">{section} Navigation</p>
            <div className="space-y-1.5">
              {sectionLinks.map(link => (
                <div key={link.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/5 hover:border-white/10" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <button type="button" onClick={() => updateLink(link.id, { enabled: !link.enabled })}
                    className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${link.enabled ? 'bg-primary' : 'bg-white/10'}`}>
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${link.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <input value={link.label} onChange={e => updateLink(link.id, { label: e.target.value })}
                    className="w-28 bg-transparent text-white/80 text-xs font-medium focus:outline-none focus:text-white" />
                  <input value={link.href} onChange={e => updateLink(link.id, { href: e.target.value })}
                    className="flex-1 bg-transparent text-white/40 text-xs font-mono focus:outline-none focus:text-white/70" />
                  <select value={link.target} onChange={e => updateLink(link.id, { target: e.target.value })}
                    className="bg-white/[0.04] border border-white/8 rounded-lg px-2 py-1 text-white/40 text-[10px] focus:outline-none">
                    <option value="_self" className="bg-[#0A0A0A]">Same tab</option>
                    <option value="_blank" className="bg-[#0A0A0A]">New tab</option>
                  </select>
                  <select value={link.section} onChange={e => updateLink(link.id, { section: e.target.value })}
                    className="bg-white/[0.04] border border-white/8 rounded-lg px-2 py-1 text-white/40 text-[10px] focus:outline-none">
                    {sections.map(s => <option key={s} value={s} className="bg-[#0A0A0A] capitalize">{s}</option>)}
                  </select>
                  <button type="button" onClick={() => removeLink(link.id)} className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/20 shrink-0">
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              {sectionLinks.length === 0 && <p className="text-white/20 text-xs py-2 px-3">No links in this section</p>}
            </div>
          </div>
        );
      })}

      <SaveBtn saving={saving} onClick={save} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Features Tab
// ─────────────────────────────────────────────────────────────────────────────
function FeaturesTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [items,   setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/cms/features', { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setItems(d.features ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!editing) return;
    setSaving(true);
    const r = await fetch('/api/admin/cms/features', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(editing) });
    setSaving(false);
    if (r.ok) { showToast(editing.id ? 'Feature updated' : 'Feature added'); setEditing(null); load(); } else showToast('Save failed', false);
  }
  async function del(id: string) {
    const r = await fetch('/api/admin/cms/features', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ action: 'delete', id }) });
    if (r.ok) { showToast('Deleted'); load(); } else showToast('Delete failed', false);
  }
  async function toggle(item: any) {
    await fetch('/api/admin/cms/features', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ id: item.id, enabled: !item.enabled }) });
    load();
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={18} className="animate-spin text-white/20" /></div>;

  return (
    <div className="rounded-2xl border border-white/5 p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Layers size={14} className="text-primary" /> Feature Cards</h3>
        <button type="button" onClick={() => setEditing({ title: '', description: '', icon: 'Star', badge: '', page: 'home', enabled: true })}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-black" style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
          <Plus size={11} /> Add Feature
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map(item => (
          <div key={item.id} className={`rounded-2xl border p-4 transition-all ${item.enabled ? 'border-white/5' : 'border-white/[0.03] opacity-50'}`} style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-lg bg-white/5 text-white/30 font-mono">{item.icon}</span>
                  {item.badge && <span className="text-[9px] px-1.5 py-0.5 rounded-lg bg-primary/10 text-primary/70">{item.badge}</span>}
                  <span className="text-[9px] text-white/20">{item.page}</span>
                </div>
                <p className="text-white/80 text-sm font-medium">{item.title}</p>
                <p className="text-white/40 text-xs mt-1 line-clamp-2">{item.description}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => toggle(item)}
                  className={`relative w-8 h-4 rounded-full transition-colors ${item.enabled ? 'bg-primary' : 'bg-white/10'}`}>
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${item.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <button type="button" onClick={() => setEditing(item)} className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10"><Edit2 size={10} /></button>
                <button type="button" onClick={() => del(item.id)} className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/20"><Trash2 size={10} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}
            onClick={() => setEditing(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-white/10 p-6 space-y-4" style={{ background: '#111' }}>
              <div className="flex items-center justify-between">
                <p className="text-white font-semibold">{editing.id ? 'Edit Feature' : 'Add Feature'}</p>
                <button type="button" onClick={() => setEditing(null)} className="text-white/30 hover:text-white"><X size={16} /></button>
              </div>
              {[['title','Title'],['description','Description'],['icon','Icon Name (Lucide)'],['badge','Badge Label (optional)'],['imageUrl','Image URL (optional)']].map(([k,l]) => (
                <div key={k}>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">{l}</label>
                  <input value={editing[k] ?? ''} onChange={e => setEditing((p: any) => ({ ...p, [k]: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
                </div>
              ))}
              <div>
                <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Page</label>
                <input value={editing.page ?? 'home'} onChange={e => setEditing((p: any) => ({ ...p, page: e.target.value }))} placeholder="home, digital-banking, etc."
                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
              </div>
              <button type="button" onClick={save} disabled={saving || !editing.title}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-black text-sm disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {editing.id ? 'Update' : 'Add Feature'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Article Editor (News + Blog)
// ─────────────────────────────────────────────────────────────────────────────
function ArticleEditor({
  title, endpoint, icon: Icon, categories,
  showToast,
}: {
  title: string; endpoint: string; icon: React.ElementType;
  categories: string[];
  showToast: (m: string, ok?: boolean) => void;
}) {
  const [items,   setItems]   = useState<any[]>([]);
  const [, setTotal]          = useState(0);
  const [loading, setLoading] = useState(true);
  const [status,  setStatus]  = useState('');
  const [search,  setSearch]  = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: '1', limit: '30' });
    if (status) p.set('status', status);
    if (search) p.set('search', search);
    const r = await fetch(`/api/admin/cms/${endpoint}?${p}`, { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setItems(d.data ?? []); setTotal(d.total ?? 0); }
    setLoading(false);
  }, [endpoint, status, search]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!editing) return;
    setSaving(true);
    const r = await fetch(`/api/admin/cms/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(editing) });
    setSaving(false);
    if (r.ok) { showToast(editing.id ? 'Updated' : 'Created'); setEditing(null); load(); } else showToast('Save failed', false);
  }
  async function del(id: string) {
    const r = await fetch(`/api/admin/cms/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ action: 'delete', id }) });
    if (r.ok) { showToast('Deleted'); load(); } else showToast('Delete failed', false);
  }
  async function publish(id: string) {
    const r = await fetch(`/api/admin/cms/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ id, status: 'published' }) });
    if (r.ok) { showToast('Published'); load(); } else showToast('Failed', false);
  }

  const STATUS_ART: Record<string, string> = { draft: 'bg-white/8 text-white/40', published: 'bg-emerald-500/15 text-emerald-400', archived: 'bg-white/5 text-white/20' };

  return (
    <div className="rounded-2xl border border-white/5 p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Icon size={14} className="text-primary" /> {title}</h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="bg-white/[0.04] border border-white/8 rounded-xl pl-7 pr-3 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-primary/40 w-40" />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)} className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-white text-xs focus:outline-none">
            <option value="">All</option>
            {['draft','published','archived'].map(s => <option key={s} value={s} className="bg-[#0A0A0A] capitalize">{s}</option>)}
          </select>
          <button type="button" onClick={() => setEditing({ title: '', excerpt: '', body: '', category: categories[0], tags: [], author: 'CGC Editorial', status: 'draft', featured: false })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-black" style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
            <Plus size={11} /> New
          </button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-white/20" /></div>
      : items.length === 0 ? <div className="flex flex-col items-center py-10 gap-2 text-white/20"><Icon size={24} /><p className="text-sm">No {title.toLowerCase()} yet</p></div>
      : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 hover:border-white/10" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${STATUS_ART[item.status]}`}>{item.status}</span>
                  {item.featured && <Star size={9} className="text-amber-400 fill-amber-400" />}
                  <span className="text-white/20 text-[9px]">{item.category}</span>
                </div>
                <p className="text-white/80 text-sm font-medium truncate">{item.title}</p>
                <p className="text-white/30 text-[10px]">{item.author} · {fmtDateShort(item.createdAt)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {item.status === 'draft' && (
                  <button type="button" onClick={() => publish(item.id)} className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold hover:bg-emerald-500/20">Publish</button>
                )}
                <button type="button" onClick={() => setEditing(item)} className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10"><Edit2 size={10} /></button>
                <button type="button" onClick={() => del(item.id)} className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/20"><Trash2 size={10} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}
            onClick={() => setEditing(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-2xl rounded-2xl border border-white/10 overflow-hidden"
              style={{ background: '#111', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <p className="text-white font-semibold">{editing.id ? `Edit ${title.slice(0,-1)}` : `New ${title.slice(0,-1)}`}</p>
                <button type="button" onClick={() => setEditing(null)} className="text-white/30 hover:text-white"><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Title</label>
                    <input value={editing.title ?? ''} onChange={e => setEditing((p: any) => ({ ...p, title: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
                  </div>
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Category</label>
                    <input value={editing.category ?? ''} onChange={e => setEditing((p: any) => ({ ...p, category: e.target.value }))} list="art-cats"
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
                    <datalist id="art-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
                  </div>
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Author</label>
                    <input value={editing.author ?? ''} onChange={e => setEditing((p: any) => ({ ...p, author: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
                  </div>
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Status</label>
                    <select value={editing.status ?? 'draft'} onChange={e => setEditing((p: any) => ({ ...p, status: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none">
                      {['draft','published','archived'].map(s => <option key={s} value={s} className="bg-[#0A0A0A] capitalize">{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Tags (comma-separated)</label>
                    <input value={(editing.tags ?? []).join(', ')} onChange={e => setEditing((p: any) => ({ ...p, tags: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) }))}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Cover Image URL</label>
                    <input value={editing.imageUrl ?? ''} onChange={e => setEditing((p: any) => ({ ...p, imageUrl: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Excerpt</label>
                    <textarea rows={2} value={editing.excerpt ?? ''} onChange={e => setEditing((p: any) => ({ ...p, excerpt: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 resize-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Body (Markdown / HTML)</label>
                    <textarea rows={10} value={editing.body ?? ''} onChange={e => setEditing((p: any) => ({ ...p, body: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-primary/40 resize-none" />
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    <button type="button" onClick={() => setEditing((p: any) => ({ ...p, featured: !p.featured }))}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${editing.featured ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-white/8 text-white/40'}`}>
                      <Star size={11} /> Featured
                    </button>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-white/5">
                <button type="button" onClick={save} disabled={saving || !editing.title}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-black text-sm disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {editing.id ? 'Update' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NewsTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  return <ArticleEditor title="News Articles" endpoint="news" icon={Newspaper} categories={['General','Regulatory','Product','Partnership','Market','Company']} showToast={showToast} />;
}

function BlogTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  return <ArticleEditor title="Blog Posts" endpoint="blog" icon={BookOpen} categories={['Finance','Banking','Crypto','Savings','Transfers','Security','Guides']} showToast={showToast} />;
}

function fmtDateShort(ts: string) {
  try { return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }); }
  catch { return ts; }
}
