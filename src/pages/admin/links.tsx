import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Link2, Save, CheckCircle, Plus, Trash2, ExternalLink,
  Edit3, GripVertical, Globe, Bitcoin, TrendingUp, Briefcase, Star,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

type LinkCategory = 'partner' | 'exchange' | 'auction' | 'investment' | 'other';

interface ExternalLink {
  id: string;
  title: string;
  url: string;
  description: string;
  category: LinkCategory;
  enabled: boolean;
  showInDashboard: boolean;
  showInFooter: boolean;
  icon: string;
  badge: string;
}

const CATEGORIES: { id: LinkCategory; label: string; color: string; icon: typeof Globe }[] = [
  { id: 'partner',    label: 'Partners',         color: '#C9A84C', icon: Briefcase },
  { id: 'exchange',   label: 'Crypto Exchanges', color: '#627EEA', icon: Bitcoin },
  { id: 'auction',    label: 'Auctions',         color: '#F59E0B', icon: Star },
  { id: 'investment', label: 'Investments',      color: '#10B981', icon: TrendingUp },
  { id: 'other',      label: 'Other',            color: '#6B7280', icon: Globe },
];

function newLink(): ExternalLink {
  return {
    id: `link-${Date.now()}`,
    title: '',
    url: '',
    description: '',
    category: 'partner',
    enabled: true,
    showInDashboard: true,
    showInFooter: false,
    icon: '🔗',
    badge: '',
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminLinks() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [links, setLinks]     = useState<ExternalLink[]>([]);
  const [saved, setSaved]     = useState(false);
  const [saving, setSaving]   = useState(false);
  const [editId, setEditId]   = useState<string | null>(null);
  const [filter, setFilter]   = useState<LinkCategory | 'all'>('all');

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  useEffect(() => {
    fetch('/api/admin/links', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d?.links)) setLinks(d.links); })
      .catch(() => {});
  }, []);

  function addLink() {
    const l = newLink();
    setLinks(prev => [...prev, l]);
    setEditId(l.id);
  }

  function updateLink(id: string, patch: Partial<ExternalLink>) {
    setLinks(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }

  function removeLink(id: string) {
    setLinks(prev => prev.filter(l => l.id !== id));
    if (editId === id) setEditId(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/admin/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ links }),
      });
    } catch { /* non-critical */ }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const filtered = filter === 'all' ? links : links.filter(l => l.category === filter);
  const activeCount = links.filter(l => l.enabled).length;

  return (
    <>
      <Helmet><title>External Links — CGC Admin</title><meta name="description" content="Manage external links and redirects for City Gate Capital." /><meta name="robots" content="noindex, nofollow" /><link rel="canonical" href="https://citygate.capital/admin/links" /></Helmet>
      <AdminLayout title="External Links">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">External Links Manager</h1>
            <p className="text-white/30 text-sm">{activeCount} active links across {CATEGORIES.length} categories</p>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-sm">
                <CheckCircle size={14} /> Saved
              </motion.div>
            )}
            <button onClick={addLink}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 border border-white/10 hover:border-primary/30 hover:text-white transition-colors">
              <Plus size={14} /> Add Link
            </button>
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

        {/* Category stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {CATEGORIES.map(cat => {
            const count = links.filter(l => l.category === cat.id && l.enabled).length;
            return (
              <button key={cat.id} onClick={() => setFilter(filter === cat.id ? 'all' : cat.id)}
                className={`rounded-2xl border p-3 text-left transition-all ${
                  filter === cat.id ? 'border-primary/40' : 'border-white/5 hover:border-white/10'
                }`}
                style={{ background: filter === cat.id ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.025)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <cat.icon size={12} style={{ color: cat.color }} />
                  <p className="text-white/40 text-[10px] uppercase tracking-wide">{cat.label}</p>
                </div>
                <p className="text-xl font-bold" style={{ color: cat.color }}>{count}</p>
              </button>
            );
          })}
        </div>

        {/* Links list */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="rounded-2xl border border-white/5 p-10 text-center" style={{ background: 'rgba(255,255,255,0.025)' }}>
              <Link2 size={28} className="text-white/15 mx-auto mb-3" />
              <p className="text-white/30 text-sm">No links yet. Click "Add Link" to create one.</p>
            </div>
          )}

          {filtered.map(link => {
            const cat = CATEGORIES.find(c => c.id === link.category)!;
            const isEditing = editId === link.id;
            return (
              <div key={link.id}
                className="rounded-2xl border transition-all"
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  borderColor: link.enabled ? `${cat.color}25` : 'rgba(255,255,255,0.05)',
                }}>
                {/* Row */}
                <div className="flex items-center gap-3 p-4">
                  <GripVertical size={14} className="text-white/15 shrink-0 cursor-grab" />
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{ background: `${cat.color}15` }}>
                    {link.icon || '🔗'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-semibold truncate">{link.title || 'Untitled Link'}</p>
                      {link.badge && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: `${cat.color}20`, color: cat.color }}>{link.badge}</span>
                      )}
                    </div>
                    <p className="text-white/30 text-xs truncate">{link.url || 'No URL set'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:block text-[10px] px-2 py-1 rounded-lg"
                      style={{ background: `${cat.color}15`, color: cat.color }}>{cat.label}</span>
                    {/* Enable toggle */}
                    <button onClick={() => updateLink(link.id, { enabled: !link.enabled })}
                      className={`relative w-10 h-5 rounded-full transition-colors ${link.enabled ? '' : 'bg-white/10'}`}
                      style={link.enabled ? { background: cat.color } : {}}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${link.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                    {link.url && (
                      <a href={link.url} target="_blank" rel="noopener noreferrer"
                        className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/30 hover:text-white transition-colors">
                        <ExternalLink size={11} />
                      </a>
                    )}
                    <button onClick={() => setEditId(isEditing ? null : link.id)}
                      className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/30 hover:text-white transition-colors">
                      <Edit3 size={11} />
                    </button>
                    <button onClick={() => removeLink(link.id)}
                      className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400/50 hover:text-red-400 transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Edit form */}
                <AnimatePresence>
                  {isEditing && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-white/5">
                      <div className="p-4 grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Title</label>
                          <input value={link.title} onChange={e => updateLink(link.id, { title: e.target.value })}
                            placeholder="e.g. Binance Exchange"
                            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
                        </div>
                        <div>
                          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">URL</label>
                          <input value={link.url} onChange={e => updateLink(link.id, { url: e.target.value })}
                            placeholder="https://..."
                            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
                        </div>
                        <div>
                          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Description</label>
                          <input value={link.description} onChange={e => updateLink(link.id, { description: e.target.value })}
                            placeholder="Short description"
                            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
                        </div>
                        <div>
                          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Category</label>
                          <select value={link.category} onChange={e => updateLink(link.id, { category: e.target.value as LinkCategory })}
                            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors">
                            {CATEGORIES.map(c => <option key={c.id} value={c.id} className="bg-[#0A0A0A]">{c.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Icon (emoji)</label>
                          <input value={link.icon} onChange={e => updateLink(link.id, { icon: e.target.value })}
                            placeholder="🔗"
                            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
                        </div>
                        <div>
                          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Badge Label (optional)</label>
                          <input value={link.badge} onChange={e => updateLink(link.id, { badge: e.target.value })}
                            placeholder="New, Hot, Partner…"
                            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-white/30 text-[10px] uppercase tracking-wide mb-2">Display Locations</p>
                          <div className="flex flex-wrap gap-4">
                            {[
                              { key: 'showInDashboard', label: 'Admin Dashboard' },
                              { key: 'showInFooter',    label: 'Website Footer' },
                            ].map(({ key, label }) => (
                              <label key={key} className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox"
                                  checked={link[key as keyof ExternalLink] as boolean}
                                  onChange={e => updateLink(link.id, { [key]: e.target.checked })}
                                  className="w-3.5 h-3.5 accent-primary" />
                                <span className="text-white/50 text-xs">{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Dashboard quick-links preview */}
        {links.filter(l => l.enabled && l.showInDashboard).length > 0 && (
          <div className="mt-6 rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Globe size={14} className="text-primary" />
              <p className="text-white text-sm font-semibold">Dashboard Quick Links Preview</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {links.filter(l => l.enabled && l.showInDashboard).map(l => {
                const cat = CATEGORIES.find(c => c.id === l.category)!;
                return (
                  <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
                    style={{ background: `${cat.color}12`, color: cat.color, border: `1px solid ${cat.color}20` }}>
                    <span>{l.icon}</span>
                    <span>{l.title}</span>
                    <ExternalLink size={10} className="opacity-50" />
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </AdminLayout>
    </>
  );
}
