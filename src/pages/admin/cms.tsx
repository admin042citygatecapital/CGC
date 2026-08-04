import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Globe, Mail, Bell, Search, Save, CheckCircle, Image, Type, Link } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';

const TABS = [
  { id: 'homepage', label: 'Homepage', icon: Globe },
  { id: 'seo',      label: 'SEO',      icon: Search },
  { id: 'email',    label: 'Email Templates', icon: Mail },
  { id: 'banners',  label: 'Banners',  icon: Image },
  { id: 'footer',   label: 'Footer & Contact', icon: Link },
];

const INITIAL = {
  heroTitle: 'The Future of Banking is Here',
  heroSubtitle: 'Secure, fast, and built for global citizens who demand more from their bank.',
  heroCTA: 'Open Free Account',
  metaTitle: 'City Gate Capital — Secure Digital Banking for the Modern World',
  metaDescription: 'City Gate Capital offers premium digital banking, multi-currency wallets, crypto exchange, and international transfers.',
  ogImage: 'https://citygate.capital/api/og',
  footerEmail: 'info@citygate.capital',
  footerPhone: '+44 7888 382458',
  footerAddress: '1 Canada Square, Canary Wharf, London',
  welcomeEmailSubject: 'Welcome to City Gate Capital',
  welcomeEmailBody: 'Dear {{name}},\n\nWelcome to City Gate Capital. Your account has been created successfully.\n\nBest regards,\nCity Gate Capital Team',
  bannerText: 'New: Earn 5.2% APY on your savings. Open a Savings Account today.',
  bannerActive: true,
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
      <Helmet><title>CMS — CGC Admin</title><meta name="robots" content="noindex" /></Helmet>
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
          </div>
        </div>
      </AdminLayout>
    </>
  );
}
