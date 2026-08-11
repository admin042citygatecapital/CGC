/**
 * /admin/media — Media Library
 * Upload · Browse · Delete · Replace
 * Supports: Images · Videos · PDFs · Documents
 */
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
AlertCircle,
CheckCircle,
ChevronLeft,ChevronRight,
Copy,
Download,
Edit2,
Eye,
File,
FileText,
Filter,
Folder,
Grid3X3,
Image,
List,
Loader2,
RefreshCw,
Search,
Trash2,
Upload,
Video,
X,
Zap
} from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useCallback,useEffect,useRef,useState } from 'react';

const MEDIA_OPTIMIZATION_CONFIGURED = false;

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaType = 'image' | 'video' | 'pdf' | 'document';

interface MediaRecord {
  id:           string;
  filename:     string;
  originalName: string;
  mimeType:     string;
  type:         MediaType;
  size:         number;
  url:          string;
  alt:          string;
  tags:         string[];
  folder:       string;
  width?:       number;
  height?:      number;
  duration?:    number;
  optimized:    boolean;
  optimizedSize?: number;
  uploadedBy:   string;
  createdAt:    string;
  updatedAt:    string;
}

interface Stats {
  total: number; images: number; videos: number; pdfs: number; documents: number;
  totalSize: number; optimizedCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtDate(ts: string): string {
  try { return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }); }
  catch { return ts; }
}

const TYPE_ICON: Record<MediaType, typeof Image> = {
  image:    Image,
  video:    Video,
  pdf:      FileText,
  document: File,
};

const TYPE_COLOR: Record<MediaType, string> = {
  image:    '#C9A84C',
  video:    '#6366F1',
  pdf:      '#EF4444',
  document: '#3B82F6',
};

const ACCEPT_MAP: Record<string, string> = {
  '':         'image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt',
  'image':    'image/*',
  'video':    'video/*',
  'pdf':      'application/pdf',
  'document': '.doc,.docx,.xls,.xlsx,.csv,.txt',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminMediaPage() {
  const [records,   setRecords]   = useState<MediaRecord[]>([]);
  const [stats,     setStats]     = useState<Stats | null>(null);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [page,      setPage]      = useState(1);
  const LIMIT = 40;

  // Filters
  const [typeFilter,   setTypeFilter]   = useState<MediaType | ''>('');
  const [folderFilter, setFolderFilter] = useState('');
  const [search,       setSearch]       = useState('');
  const [folders,      setFolders]      = useState<string[]>([]);

  // UI state
  const [viewMode,  setViewMode]  = useState<'grid' | 'list'>('grid');
  const [selected,  setSelected]  = useState<MediaRecord | null>(null);
  const [editing,   setEditing]   = useState<MediaRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [optimizing,setOptimizing]= useState<string | null>(null);
  const [replacing, setReplacing] = useState<MediaRecord | null>(null);

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    const r = await fetch('/api/admin/media?view=stats', { headers: authHeaders() });
    if (r.ok) setStats(await r.json());
  }, []);

  const loadFolders = useCallback(async () => {
    const r = await fetch('/api/admin/media?view=folders', { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setFolders(d.folders ?? []); }
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (typeFilter)   p.set('type',   typeFilter);
    if (folderFilter) p.set('folder', folderFilter);
    if (search)       p.set('search', search);
    const r = await fetch(`/api/admin/media?${p}`, { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setRecords(d.data ?? []); setTotal(d.total ?? 0); }
    setLoading(false);
  }, [page, typeFilter, folderFilter, search]);

  useEffect(() => { loadStats(); loadFolders(); }, [loadStats, loadFolders]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  // ── Upload ────────────────────────────────────────────────────────────────

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    let successCount = 0;
    for (const file of Array.from(files)) {
      try {
        const dataBase64 = await fileToBase64(file);
        const r = await fetch('/api/admin/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            originalName: file.name,
            mimeType:     file.type || 'application/octet-stream',
            dataBase64,
            folder:       folderFilter || 'uncategorized',
          }),
        });
        if (r.ok) successCount++;
      } catch { /* skip failed file */ }
    }
    setUploading(false);
    showToast(`${successCount} file${successCount !== 1 ? 's' : ''} uploaded`);
    loadRecords(); loadStats(); loadFolders();
  }

  async function handleReplace(file: File | null) {
    if (!file || !replacing) return;
    const dataBase64 = await fileToBase64(file);
    const r = await fetch('/api/admin/media/replace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id: replacing.id, originalName: file.name, mimeType: file.type, dataBase64 }),
    });
    if (r.ok) { showToast('File replaced'); setReplacing(null); loadRecords(); loadStats(); }
    else showToast('Replace failed', false);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    const r = await fetch('/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ action: 'delete', id }),
    });
    if (r.ok) {
      showToast('Deleted');
      if (selected?.id === id) setSelected(null);
      loadRecords(); loadStats();
    } else showToast('Delete failed', false);
  }

  // ── Optimize ──────────────────────────────────────────────────────────────

  async function handleOptimize(id: string) {
    setOptimizing(id);
    const r = await fetch('/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ action: 'optimize', id }),
    });
    setOptimizing(null);
    if (r.ok) {
      const d = await r.json();
      showToast(`Saved ${fmtSize(d.savedBytes ?? 0)}`);
      loadRecords(); loadStats();
    } else showToast('Optimize failed', false);
  }

  // ── Update metadata ───────────────────────────────────────────────────────

  async function saveEdit() {
    if (!editing) return;
    const r = await fetch('/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ action: 'update', id: editing.id, alt: editing.alt, tags: editing.tags, folder: editing.folder }),
    });
    if (r.ok) { showToast('Metadata saved'); setEditing(null); loadRecords(); }
    else showToast('Save failed', false);
  }

  // ── Copy URL ──────────────────────────────────────────────────────────────

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => showToast('URL copied'));
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      <Helmet>
        <title>Media Library — City Gate Capital Admin</title>
        <meta name="description" content="Admin media library for uploading, browsing, replacing and managing stored assets." />
        <link rel="canonical" href="https://citygate.capital/admin/media" />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <main className="sr-only"><h1>Media Library</h1></main>

      <AdminLayout title="Media Library">
        <div className="space-y-6 pb-10">

          {/* ── Stats strip ─────────────────────────────────────────────── */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: 'Total Files',  value: stats.total,          color: '#C9A84C', icon: Folder },
                { label: 'Images',       value: stats.images,         color: '#C9A84C', icon: Image },
                { label: 'Videos',       value: stats.videos,         color: '#6366F1', icon: Video },
                { label: 'PDFs',         value: stats.pdfs,           color: '#EF4444', icon: FileText },
                { label: 'Documents',    value: stats.documents,      color: '#3B82F6', icon: File },
                { label: 'Total Size',   value: fmtSize(stats.totalSize), color: '#10B981', icon: Download, isStr: true },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="rounded-2xl border border-white/5 p-3" style={{ background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${s.color}15` }}>
                        <Icon size={11} style={{ color: s.color }} />
                      </div>
                    </div>
                    <p className="text-xl font-bold text-white">{s.value}</p>
                    <p className="text-white/30 text-[10px] font-medium mt-0.5">{s.label}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search files…"
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-8 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
            </div>

            {/* Type filter */}
            <div className="flex gap-1">
              {(['', 'image', 'video', 'pdf', 'document'] as const).map(t => (
                <button key={t} onClick={() => { setTypeFilter(t); setPage(1); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${typeFilter === t ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/8 text-white/40 hover:text-white'}`}>
                  {t === '' ? <Filter size={11} /> : (() => { const I = TYPE_ICON[t]; return <I size={11} />; })()}
                  <span className="hidden sm:inline capitalize">{t === '' ? 'All' : t}</span>
                </button>
              ))}
            </div>

            {/* Folder filter */}
            {folders.length > 0 && (
              <select value={folderFilter} onChange={e => { setFolderFilter(e.target.value); setPage(1); }}
                className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                <option value="" className="bg-[#0A0A0A]">All Folders</option>
                {folders.map(f => <option key={f} value={f} className="bg-[#0A0A0A] capitalize">{f}</option>)}
              </select>
            )}

            {/* View toggle */}
            <div className="flex gap-1 border border-white/8 rounded-xl p-1">
              <button onClick={() => setViewMode('grid')} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-white/30 hover:text-white'}`}><Grid3X3 size={12} /></button>
              <button onClick={() => setViewMode('list')} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-white/30 hover:text-white'}`}><List size={12} /></button>
            </div>

            {/* Upload button */}
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-black disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {uploading ? 'Uploading…' : 'Upload'}
            </button>

            <input ref={fileInputRef} type="file" multiple accept={ACCEPT_MAP[typeFilter]}
              className="hidden" onChange={e => handleUpload(e.target.files)} />
            <input ref={replaceInputRef} type="file" accept="*/*"
              className="hidden" onChange={e => handleReplace(e.target.files?.[0] ?? null)} />
          </div>

          {/* ── Drop zone hint ───────────────────────────────────────────── */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
            className="border-2 border-dashed border-white/8 rounded-2xl py-4 flex items-center justify-center gap-3 text-white/20 hover:border-primary/30 hover:text-white/40 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} />
            <p className="text-sm">Drop files here or click to upload</p>
          </div>

          {/* ── Grid / List ──────────────────────────────────────────────── */}
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-white/20" /></div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-white/20">
              <Image size={32} />
              <p className="text-sm">No media files found</p>
              <button onClick={() => fileInputRef.current?.click()} className="text-primary/60 text-xs hover:text-primary">Upload your first file</button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {records.map(rec => (
                <MediaCard key={rec.id} rec={rec}
                  onSelect={() => setSelected(rec)}
                  onDelete={() => handleDelete(rec.id)}
                  onOptimize={() => handleOptimize(rec.id)}
                  onReplace={() => { setReplacing(rec); replaceInputRef.current?.click(); }}
                  onEdit={() => setEditing({ ...rec })}
                  onCopy={() => copyUrl(rec.url)}
                  optimizing={optimizing === rec.id}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Pre-deployment','Name','Type','Size','Folder','Optimized','Date','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-white/25 text-[10px] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {records.map(rec => {
                    const Icon = TYPE_ICON[rec.type];
                    return (
                      <tr key={rec.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          {rec.type === 'image' ? (
                            <img src={rec.url} alt={rec.alt} className="w-10 h-10 rounded-lg object-cover border border-white/8" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center border border-white/8" style={{ background: `${TYPE_COLOR[rec.type]}15` }}>
                              <Icon size={16} style={{ color: TYPE_COLOR[rec.type] }} />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white/80 text-xs font-medium truncate max-w-[160px]">{rec.originalName}</p>
                          {rec.alt && <p className="text-white/25 text-[10px] truncate max-w-[160px]">{rec.alt}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize" style={{ background: `${TYPE_COLOR[rec.type]}15`, color: TYPE_COLOR[rec.type] }}>{rec.type}</span>
                        </td>
                        <td className="px-4 py-3 text-white/40 text-xs whitespace-nowrap">{fmtSize(rec.size)}</td>
                        <td className="px-4 py-3 text-white/40 text-xs capitalize">{rec.folder}</td>
                        <td className="px-4 py-3">
                          {rec.optimized
                            ? <span className="text-[10px] text-emerald-400 flex items-center gap-1"><Zap size={9} /> {rec.optimizedSize ? fmtSize(rec.optimizedSize) : 'Yes'}</span>
                            : <span className="text-[10px] text-white/20">—</span>}
                        </td>
                        <td className="px-4 py-3 text-white/25 text-[10px] whitespace-nowrap">{fmtDate(rec.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setSelected(rec)} className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10"><Eye size={10} /></button>
                            <button onClick={() => setEditing({ ...rec })} className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10"><Edit2 size={10} /></button>
                            <button onClick={() => copyUrl(rec.url)} className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10"><Copy size={10} /></button>
                            {MEDIA_OPTIMIZATION_CONFIGURED && rec.type === 'image' && !rec.optimized && (
                              <button onClick={() => handleOptimize(rec.id)} disabled={optimizing === rec.id} className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/20 disabled:opacity-40">
                                {optimizing === rec.id ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                              </button>
                            )}
                            <button onClick={() => { setReplacing(rec); replaceInputRef.current?.click(); }} className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400/60 hover:text-blue-400 hover:bg-blue-500/20"><RefreshCw size={10} /></button>
                            <button onClick={() => handleDelete(rec.id)} className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/20"><Trash2 size={10} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination ───────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-white/25 text-xs">{total} files · page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-30"><ChevronLeft size={14} /></button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-30"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>

        {/* ── Pre-deployment modal ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {selected && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}
              onClick={() => setSelected(null)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-2xl rounded-2xl border border-white/10 overflow-hidden" style={{ background: '#111' }}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                  <div>
                    <p className="text-white font-semibold text-sm">{selected.originalName}</p>
                    <p className="text-white/30 text-xs">{fmtSize(selected.size)} · {selected.mimeType} · {fmtDate(selected.createdAt)}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white"><X size={16} /></button>
                </div>

                <div className="p-5">
                  {selected.type === 'image' && (
                    <img src={selected.url} alt={selected.alt} className="w-full rounded-xl object-contain max-h-80 border border-white/8" />
                  )}
                  {selected.type === 'video' && (
                    <video src={selected.url} controls className="w-full rounded-xl max-h-80 border border-white/8" />
                  )}
                  {(selected.type === 'pdf' || selected.type === 'document') && (
                    <div className="flex flex-col items-center py-10 gap-3 text-white/30">
                      {(() => { const I = TYPE_ICON[selected.type]; return <I size={40} style={{ color: TYPE_COLOR[selected.type] }} />; })()}
                      <p className="text-sm">{selected.originalName}</p>
                      <a href={selected.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-black"
                        style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
                        <Download size={12} /> Open File
                      </a>
                    </div>
                  )}
                </div>

                <div className="px-5 pb-4 space-y-2">
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <p className="text-white/30 text-xs font-mono flex-1 truncate">{selected.url}</p>
                    <button onClick={() => copyUrl(selected.url)} className="text-primary/60 hover:text-primary"><Copy size={12} /></button>
                  </div>
                  {selected.alt && <p className="text-white/30 text-xs">Alt: {selected.alt}</p>}
                  {selected.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selected.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/30">{t}</span>)}
                    </div>
                  )}
                  {selected.optimized && (
                    <p className="text-emerald-400 text-xs flex items-center gap-1"><Zap size={10} /> Optimized · {selected.optimizedSize ? fmtSize(selected.optimizedSize) : ''}</p>
                  )}
                </div>

                <div className="flex gap-2 px-5 pb-5">
                  <button onClick={() => { setEditing({ ...selected }); setSelected(null); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 text-white/60 hover:text-white hover:bg-white/10">
                    <Edit2 size={11} /> Edit
                  </button>
                  {MEDIA_OPTIMIZATION_CONFIGURED && selected.type === 'image' && !selected.optimized && (
                    <button onClick={() => { handleOptimize(selected.id); setSelected(null); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-400 hover:bg-amber-500/20">
                      <Zap size={11} /> Optimize
                    </button>
                  )}
                  <button onClick={() => { setReplacing(selected); setSelected(null); replaceInputRef.current?.click(); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">
                    <RefreshCw size={11} /> Replace
                  </button>
                  <button onClick={() => { handleDelete(selected.id); setSelected(null); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20">
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Edit metadata modal ───────────────────────────────────────── */}
        <AnimatePresence>
          {editing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}
              onClick={() => setEditing(null)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-md rounded-2xl border border-white/10 p-6 space-y-4" style={{ background: '#111' }}>
                <div className="flex items-center justify-between">
                  <p className="text-white font-semibold">Edit Metadata</p>
                  <button onClick={() => setEditing(null)} className="text-white/30 hover:text-white"><X size={16} /></button>
                </div>

                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Alt Text</label>
                  <input value={editing.alt} onChange={e => setEditing(p => p ? { ...p, alt: e.target.value } : p)}
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
                </div>

                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Folder</label>
                  <input value={editing.folder} onChange={e => setEditing(p => p ? { ...p, folder: e.target.value } : p)}
                    list="folder-list"
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
                  <datalist id="folder-list">{folders.map(f => <option key={f} value={f} />)}</datalist>
                </div>

                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Tags (comma-separated)</label>
                  <input value={editing.tags.join(', ')}
                    onChange={e => setEditing(p => p ? { ...p, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : p)}
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
                </div>

                <button onClick={saveEdit}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-black text-sm"
                  style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
                  Save Metadata
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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

// ─── Media Card ───────────────────────────────────────────────────────────────

function MediaCard({
  rec, onSelect, onDelete, onOptimize, onReplace, onEdit, onCopy, optimizing,
}: {
  rec: MediaRecord;
  onSelect: () => void; onDelete: () => void; onOptimize: () => void;
  onReplace: () => void; onEdit: () => void; onCopy: () => void;
  optimizing: boolean;
}) {
  const [hover, setHover] = useState(false);
  const Icon = TYPE_ICON[rec.type];

  return (
    <div
      className="relative rounded-2xl border border-white/5 overflow-hidden group cursor-pointer"
      style={{ background: 'rgba(255,255,255,0.025)' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onSelect}>

      {/* Thumbnail */}
      <div className="aspect-square flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
        {rec.type === 'image' ? (
          <img src={rec.url} alt={rec.alt} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <Icon size={28} style={{ color: TYPE_COLOR[rec.type] }} />
        )}
      </div>

      {/* Optimized badge */}
      {rec.optimized && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
          <Zap size={8} className="text-emerald-400" />
          <span className="text-[8px] text-emerald-400 font-bold">OPT</span>
        </div>
      )}

      {/* Hover overlay */}
      <AnimatePresence>
        {hover && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col justify-end pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)' }}>
            <div className="p-2 pointer-events-auto" onClick={e => e.stopPropagation()}>
              <div className="flex gap-1 justify-center">
                <button onClick={onEdit}     className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20"><Edit2 size={9} /></button>
                <button onClick={onCopy}     className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20"><Copy size={9} /></button>
                {MEDIA_OPTIMIZATION_CONFIGURED && rec.type === 'image' && !rec.optimized && (
                  <button onClick={onOptimize} disabled={optimizing} className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 hover:bg-amber-500/30 disabled:opacity-40">
                    {optimizing ? <Loader2 size={9} className="animate-spin" /> : <Zap size={9} />}
                  </button>
                )}
                <button onClick={onReplace}  className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 hover:bg-blue-500/30"><RefreshCw size={9} /></button>
                <button onClick={onDelete}   className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/30"><Trash2 size={9} /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="px-2.5 py-2 border-t border-white/5">
        <p className="text-white/60 text-[10px] font-medium truncate">{rec.originalName}</p>
        <p className="text-white/25 text-[9px] mt-0.5">{fmtSize(rec.size)}</p>
      </div>
    </div>
  );
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
