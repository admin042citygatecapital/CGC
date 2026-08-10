import { Helmet } from '@dr.pogodin/react-helmet';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Clock3, Copy, ExternalLink, Globe2, History,
  Link2, Loader2, Save, Send, Share2, ShieldCheck, Trash2,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders, useAdminAuth } from '@/lib/adminAuth';

type PlatformId = 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'telegram' | 'whatsapp' | 'tiktok' | 'youtube' | 'discord';
type View = 'profiles' | 'share' | 'activity';

interface Platform {
  id: PlatformId;
  name: string;
  color: string;
  mark: string;
  placeholder: string;
  shareIntent: boolean;
}

const PLATFORMS: Platform[] = [
  { id: 'twitter', name: 'X / Twitter', color: '#E5E7EB', mark: 'X', placeholder: 'https://x.com/citygatecapital', shareIntent: true },
  { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2', mark: 'in', placeholder: 'https://linkedin.com/company/citygate-capital', shareIntent: true },
  { id: 'instagram', name: 'Instagram', color: '#E1306C', mark: 'IG', placeholder: 'https://instagram.com/citygatecapital', shareIntent: false },
  { id: 'facebook', name: 'Facebook', color: '#1877F2', mark: 'f', placeholder: 'https://facebook.com/citygatecapital', shareIntent: true },
  { id: 'telegram', name: 'Telegram', color: '#26A5E4', mark: 'TG', placeholder: 'https://t.me/citygatecapital', shareIntent: true },
  { id: 'whatsapp', name: 'WhatsApp', color: '#25D366', mark: 'WA', placeholder: 'https://wa.me/447888382458', shareIntent: true },
  { id: 'tiktok', name: 'TikTok', color: '#FF0050', mark: 'TT', placeholder: 'https://tiktok.com/@citygatecapital', shareIntent: false },
  { id: 'youtube', name: 'YouTube', color: '#FF0000', mark: 'YT', placeholder: 'https://youtube.com/@citygatecapital', shareIntent: false },
  { id: 'discord', name: 'Discord', color: '#5865F2', mark: 'DC', placeholder: 'https://discord.gg/citygatecapital', shareIntent: false },
];

interface SocialLink {
  platformId: PlatformId;
  url: string;
  enabled: boolean;
  showInFooter: boolean;
  showInContact: boolean;
  showInDashboard: boolean;
}

interface ShareTarget {
  platformId: PlatformId;
  mode: 'intent' | 'copy';
  url?: string;
  note?: string;
}

interface ShareEvent {
  id: string;
  message: string;
  targetUrl: string;
  platforms: PlatformId[];
  openedPlatforms: PlatformId[];
  status: 'ready' | 'opened';
  createdBy: string;
  createdAt: string;
  targets: ShareTarget[];
}

const DEFAULT_LINKS: SocialLink[] = PLATFORMS.map(platform => ({
  platformId: platform.id, url: '', enabled: false,
  showInFooter: true, showInContact: true, showInDashboard: false,
}));

function platform(id: PlatformId): Platform {
  return PLATFORMS.find(item => item.id === id)!;
}

export default function AdminSocial() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>('profiles');
  const [links, setLinks] = useState<SocialLink[]>(DEFAULT_LINKS);
  const [shares, setShares] = useState<ShareEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [targetUrl, setTargetUrl] = useState('https://citygate.capital/');
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>(['twitter', 'linkedin', 'facebook']);
  const [prepared, setPrepared] = useState<ShareEvent | null>(null);

  useEffect(() => {
    if (!authLoading && !admin) navigate('/admin/login');
  }, [admin, authLoading, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/social', { headers: authHeaders() });
      if (!response.ok) throw new Error('Unable to load social settings');
      const data = await response.json();
      if (Array.isArray(data.links)) {
        const loaded = data.links as SocialLink[];
        setLinks(DEFAULT_LINKS.map(fallback => loaded.find(item => item.platformId === fallback.platformId) ?? fallback));
      }
      if (Array.isArray(data.shares)) setShares(data.shares);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load social settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const enabledCount = useMemo(() => links.filter(link => link.enabled && link.url).length, [links]);

  function updateLink(platformId: PlatformId, patch: Partial<SocialLink>) {
    setLinks(current => current.map(link => link.platformId === platformId ? { ...link, ...patch } : link));
  }

  function flash(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 3500);
  }

  async function saveProfiles() {
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/admin/social', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ links }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save profiles');
      if (Array.isArray(data.links)) setLinks(DEFAULT_LINKS.map(fallback => data.links.find((item: SocialLink) => item.platformId === fallback.platformId) ?? fallback));
      flash('Social profile settings saved');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save profiles');
    } finally {
      setSaving(false);
    }
  }

  function togglePlatform(id: PlatformId) {
    setSelectedPlatforms(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  async function prepareShare() {
    setSaving(true); setError(''); setPrepared(null);
    try {
      const response = await fetch('/api/admin/social/share', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ message, targetUrl, platforms: selectedPlatforms }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to prepare share');
      setPrepared(data.share);
      setShares(current => [data.share, ...current.filter(item => item.id !== data.share.id)]);
      flash('Share actions prepared');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to prepare share');
    } finally {
      setSaving(false);
    }
  }

  async function openShare(target: ShareTarget) {
    if (!prepared) return;
    if (target.mode === 'intent' && target.url) {
      window.open(target.url, '_blank', 'noopener,noreferrer');
    } else {
      await navigator.clipboard.writeText(`${prepared.message}\n\n${prepared.targetUrl}`);
      flash(`${platform(target.platformId).name} content copied`);
    }
    try {
      const response = await fetch('/api/admin/social/share/opened', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ id: prepared.id, platformId: target.platformId }),
      });
      if (response.ok) {
        const data = await response.json();
        setPrepared(data.share);
        setShares(current => current.map(item => item.id === data.share.id ? data.share : item));
      }
    } catch { /* Intent was still opened; activity sync can be retried later. */ }
  }

  return (
    <>
      <Helmet>
        <title>Social Media — CGC Admin</title>
        <meta name="description" content="Social profiles and sharing for City Gate Capital." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <AdminLayout title="Social Media">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">Social Media Center</h1>
            <p className="text-white/40 text-sm mt-1">Manage official profile links and prepare audited social shares.</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300 text-xs">
            <ShieldCheck size={14} /> Super administrator only
          </div>
        </div>

        {(notice || error) && (
          <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-400/20 bg-red-400/[0.06] text-red-300' : 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300'}`}>
            {error || notice}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Linked profiles', value: enabledCount, Icon: Link2 },
            { label: 'Share records', value: shares.length, Icon: History },
            { label: 'Platforms opened', value: shares.reduce((sum, item) => sum + item.openedPlatforms.length, 0), Icon: ExternalLink },
            { label: 'Direct share intents', value: PLATFORMS.filter(item => item.shareIntent).length, Icon: Send },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
              <Icon size={15} className="text-primary mb-3" />
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-white/35 text-xs mt-1">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-6 border-b border-white/[0.06] pb-3">
          {([
            ['profiles', 'Profile Links', Link2], ['share', 'Share Center', Share2], ['activity', 'Activity', Clock3],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setView(id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors ${view === id ? 'bg-primary text-black font-semibold' : 'bg-white/[0.04] text-white/50 hover:text-white'}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-56 flex items-center justify-center text-white/40"><Loader2 className="animate-spin mr-2" size={18} /> Loading social center</div>
        ) : view === 'profiles' ? (
          <section>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-white font-semibold">Official profile links</h2>
                <p className="text-white/35 text-xs mt-1">Only verified platform domains are accepted and published.</p>
              </div>
              <button onClick={saveProfiles} disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-black text-sm font-semibold disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save profiles
              </button>
            </div>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {PLATFORMS.map(item => {
                const link = links.find(current => current.platformId === item.id)!;
                return (
                  <div key={item.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold" style={{ color: item.color, backgroundColor: `${item.color}18` }}>{item.mark}</div>
                      <div className="flex-1"><p className="text-white text-sm font-semibold">{item.name}</p><p className="text-white/30 text-xs">{link.enabled && link.url ? 'Linked and visible' : 'Not active'}</p></div>
                      <button onClick={() => updateLink(item.id, { enabled: !link.enabled })} aria-label={`${link.enabled ? 'Disable' : 'Enable'} ${item.name}`}
                        className={`relative w-10 h-5 rounded-full ${link.enabled ? 'bg-emerald-500' : 'bg-white/10'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${link.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    <label className="text-white/35 text-[10px] uppercase tracking-wider">Profile URL</label>
                    <input value={link.url} onChange={event => updateLink(item.id, { url: event.target.value })} placeholder={item.placeholder}
                      className="w-full mt-1.5 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-primary/50" />
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {([
                        ['showInFooter', 'Footer'], ['showInContact', 'Contact'], ['showInDashboard', 'Dashboard'],
                      ] as const).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-1.5 text-white/45 text-[11px] cursor-pointer">
                          <input type="checkbox" checked={link[key]} onChange={event => updateLink(item.id, { [key]: event.target.checked })} className="accent-primary" /> {label}
                        </label>
                      ))}
                    </div>
                    <button onClick={() => updateLink(item.id, { url: '', enabled: false })} className="mt-4 flex items-center gap-1.5 text-red-300/60 hover:text-red-300 text-xs"><Trash2 size={12} /> Clear</button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : view === 'share' ? (
          <section className="grid xl:grid-cols-[1.05fr_.95fr] gap-5">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
              <h2 className="text-white font-semibold">Prepare a social share</h2>
              <p className="text-white/35 text-xs mt-1 mb-5">Creates provider share dialogs and records the action in the administration audit trail.</p>
              <label className="text-white/40 text-xs">Message</label>
              <textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={1000} rows={7}
                placeholder="Write the approved message to share..."
                className="w-full mt-2 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/50 resize-y" />
              <div className="text-right text-white/25 text-[11px] mt-1">{message.length}/1000</div>
              <label className="text-white/40 text-xs block mt-3">Destination URL</label>
              <input value={targetUrl} onChange={event => setTargetUrl(event.target.value)}
                className="w-full mt-2 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary/50" />
              <p className="text-white/25 text-[11px] mt-4 mb-2">Choose platforms</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PLATFORMS.map(item => (
                  <button key={item.id} onClick={() => togglePlatform(item.id)}
                    className={`rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${selectedPlatforms.includes(item.id) ? 'border-primary/45 bg-primary/[0.08] text-white' : 'border-white/[0.06] text-white/40'}`}>
                    <span className="font-bold mr-2" style={{ color: item.color }}>{item.mark}</span>{item.name}
                  </button>
                ))}
              </div>
              <button onClick={prepareShare} disabled={saving || !message.trim() || !targetUrl.trim() || selectedPlatforms.length === 0}
                className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-black text-sm font-bold disabled:opacity-40">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />} Prepare share actions
              </button>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
              <h2 className="text-white font-semibold">Share actions</h2>
              {!prepared ? (
                <div className="h-64 flex flex-col items-center justify-center text-center">
                  <Globe2 size={28} className="text-white/15 mb-3" />
                  <p className="text-white/35 text-sm">Prepare a message to generate secure platform actions.</p>
                </div>
              ) : (
                <div className="space-y-3 mt-4">
                  {prepared.targets.map(target => {
                    const item = platform(target.platformId);
                    const opened = prepared.openedPlatforms.includes(target.platformId);
                    return (
                      <button key={target.platformId} onClick={() => void openShare(target)}
                        className="w-full flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/15 p-3 text-left hover:border-primary/30 transition-colors">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold" style={{ color: item.color, backgroundColor: `${item.color}18` }}>{item.mark}</div>
                        <div className="flex-1"><p className="text-white text-sm font-medium">{item.name}</p><p className="text-white/30 text-[11px]">{target.mode === 'intent' ? 'Open official share dialog' : 'Copy content for manual posting'}</p></div>
                        {opened ? <CheckCircle2 size={16} className="text-emerald-400" /> : target.mode === 'intent' ? <ExternalLink size={15} className="text-white/35" /> : <Copy size={15} className="text-white/35" />}
                      </button>
                    );
                  })}
                  <p className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3 text-amber-200/70 text-[11px] leading-relaxed">Instagram, TikTok, YouTube, and Discord do not provide a universal web share dialog. Their action securely copies the approved message and link for posting.</p>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-white/[0.06] bg-white/[0.025] overflow-hidden">
            <div className="p-5 border-b border-white/[0.06]"><h2 className="text-white font-semibold">Share activity</h2><p className="text-white/35 text-xs mt-1">Prepared messages and opened provider share flows.</p></div>
            {shares.length === 0 ? <p className="p-8 text-center text-white/30 text-sm">No share activity yet.</p> : shares.map(item => (
              <div key={item.id} className="p-4 border-b border-white/[0.05] last:border-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1"><p className="text-white/80 text-sm line-clamp-2">{item.message}</p><a href={item.targetUrl} target="_blank" rel="noreferrer" className="text-primary/70 text-xs mt-1 inline-block truncate max-w-full">{item.targetUrl}</a></div>
                  <div className="text-right"><p className="text-white/35 text-[11px]">{new Date(item.createdAt).toLocaleString()}</p><p className="text-white/25 text-[11px] mt-1">by {item.createdBy}</p></div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">{item.platforms.map(id => <span key={id} className={`rounded-lg px-2 py-1 text-[10px] ${item.openedPlatforms.includes(id) ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/[0.04] text-white/35'}`}>{platform(id).name}</span>)}</div>
              </div>
            ))}
          </section>
        )}
      </AdminLayout>
    </>
  );
}
