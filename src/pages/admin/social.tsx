import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Save, CheckCircle, Trash2, Eye, EyeOff,
  ExternalLink, Globe,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';

// ── Platform definitions ──────────────────────────────────────────────────────

interface Platform {
  id: string;
  name: string;
  color: string;
  placeholder: string;
  icon: string; // emoji fallback
}

const PLATFORMS: Platform[] = [
  { id: 'twitter',   name: 'X / Twitter', color: '#1DA1F2', placeholder: 'https://twitter.com/CityGateCapital',  icon: '𝕏' },
  { id: 'linkedin',  name: 'LinkedIn',    color: '#0A66C2', placeholder: 'https://linkedin.com/company/citygate-capital', icon: 'in' },
  { id: 'instagram', name: 'Instagram',   color: '#E1306C', placeholder: 'https://instagram.com/citygatecapital', icon: '📸' },
  { id: 'facebook',  name: 'Facebook',    color: '#1877F2', placeholder: 'https://facebook.com/citygatecapital',  icon: 'f' },
  { id: 'telegram',  name: 'Telegram',    color: '#26A5E4', placeholder: 'https://t.me/citygatecapital',          icon: '✈' },
  { id: 'whatsapp',  name: 'WhatsApp',    color: '#25D366', placeholder: 'https://wa.me/447888382458',            icon: '💬' },
  { id: 'tiktok',    name: 'TikTok',      color: '#FF0050', placeholder: 'https://tiktok.com/@citygatecapital',   icon: '♪' },
  { id: 'youtube',   name: 'YouTube',     color: '#FF0000', placeholder: 'https://youtube.com/@citygatecapital',  icon: '▶' },
  { id: 'discord',   name: 'Discord',     color: '#5865F2', placeholder: 'https://discord.gg/citygatecapital',    icon: '⚡' },
];

interface SocialLink {
  platformId: string;
  url: string;
  enabled: boolean;
  showInFooter: boolean;
  showInContact: boolean;
  showInDashboard: boolean;
}

const DEFAULT_LINKS: SocialLink[] = PLATFORMS.map(p => ({
  platformId: p.id,
  url: '',
  enabled: false,
  showInFooter: true,
  showInContact: true,
  showInDashboard: false,
}));

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminSocial() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [links, setLinks]   = useState<SocialLink[]>(DEFAULT_LINKS);
  const [saved, setSaved]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  // Load persisted social config
  useEffect(() => {
    fetch('/api/admin/social', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d?.links)) setLinks(d.links); })
      .catch(() => {});
  }, []);

  function updateLink(platformId: string, patch: Partial<SocialLink>) {
    setLinks(prev => prev.map(l => l.platformId === platformId ? { ...l, ...patch } : l));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/admin/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ links }),
      });
    } catch { /* non-critical */ }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const enabledCount = links.filter(l => l.enabled && l.url).length;

  return (
    <>
      <Helmet><title>Social Media — CGC Admin</title><meta name="robots" content="noindex" /></Helmet>
      <AdminLayout title="Social Media">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">Social Media Manager</h1>
            <p className="text-white/30 text-sm">{enabledCount} of {PLATFORMS.length} platforms active</p>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-sm">
                <CheckCircle size={14} /> Saved
              </motion.div>
            )}
            <button onClick={handleSave} disabled={saving}
              className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-black text-sm overflow-hidden disabled:opacity-60">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
              <span className="relative flex items-center gap-2">
                {saving ? <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save size={14} />}
                Save All
              </span>
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active Platforms', value: enabledCount, color: '#10B981' },
            { label: 'Footer Display',   value: links.filter(l => l.enabled && l.showInFooter).length,   color: '#C9A84C' },
            { label: 'Contact Display',  value: links.filter(l => l.enabled && l.showInContact).length,  color: '#627EEA' },
            { label: 'Dashboard Links',  value: links.filter(l => l.enabled && l.showInDashboard).length, color: '#F59E0B' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.025)' }}>
              <p className="text-white/30 text-xs mb-1">{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Platform cards */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {PLATFORMS.map(platform => {
            const link = links.find(l => l.platformId === platform.id)!;
            const isOpen = selected === platform.id;
            return (
              <div key={platform.id}
                className="rounded-2xl border transition-all"
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  borderColor: link.enabled && link.url ? `${platform.color}30` : 'rgba(255,255,255,0.05)',
                }}>
                {/* Card header */}
                <div className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: `${platform.color}20`, color: platform.color }}>
                    {platform.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold">{platform.name}</p>
                    <p className="text-white/30 text-xs truncate">{link.url || 'No URL set'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Enable toggle */}
                    <button
                      onClick={() => updateLink(platform.id, { enabled: !link.enabled })}
                      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${link.enabled ? '' : 'bg-white/10'}`}
                      style={link.enabled ? { background: platform.color } : {}}
                      title={link.enabled ? 'Disable' : 'Enable'}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${link.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                    {/* Expand */}
                    <button onClick={() => setSelected(isOpen ? null : platform.id)}
                      className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/30 hover:text-white transition-colors">
                      {isOpen ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                </div>

                {/* Expanded settings */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-white/5">
                      <div className="p-4 space-y-3">
                        {/* URL input */}
                        <div>
                          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Profile URL</label>
                          <div className="flex gap-2">
                            <input
                              value={link.url}
                              onChange={e => updateLink(platform.id, { url: e.target.value })}
                              placeholder={platform.placeholder}
                              className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
                            />
                            {link.url && (
                              <a href={link.url} target="_blank" rel="noopener noreferrer"
                                className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/8 flex items-center justify-center text-white/40 hover:text-white transition-colors shrink-0">
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Display locations */}
                        <div>
                          <p className="text-white/30 text-[10px] uppercase tracking-wide mb-2">Display Locations</p>
                          <div className="space-y-2">
                            {[
                              { key: 'showInFooter',    label: 'Website Footer' },
                              { key: 'showInContact',   label: 'Contact Page' },
                              { key: 'showInDashboard', label: 'Admin Dashboard' },
                            ].map(({ key, label }) => (
                              <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                                <input type="checkbox"
                                  checked={link[key as keyof SocialLink] as boolean}
                                  onChange={e => updateLink(platform.id, { [key]: e.target.checked })}
                                  className="w-3.5 h-3.5 accent-primary" />
                                <span className="text-white/50 text-xs">{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Clear */}
                        <button onClick={() => updateLink(platform.id, { url: '', enabled: false })}
                          className="flex items-center gap-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors">
                          <Trash2 size={11} /> Clear
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Footer preview */}
        <div className="mt-6 rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Globe size={14} className="text-primary" />
            <p className="text-white text-sm font-semibold">Footer Preview</p>
            <span className="text-white/25 text-xs">— active platforms shown in footer</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {links.filter(l => l.enabled && l.url && l.showInFooter).map(l => {
              const p = PLATFORMS.find(p => p.id === l.platformId)!;
              return (
                <a key={l.platformId} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}25` }}>
                  <span>{p.icon}</span> {p.name}
                </a>
              );
            })}
            {links.filter(l => l.enabled && l.url && l.showInFooter).length === 0 && (
              <p className="text-white/20 text-xs">No active platforms with footer display enabled.</p>
            )}
          </div>
        </div>
      </AdminLayout>
    </>
  );
}
