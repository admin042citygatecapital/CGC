/**
 * /admin/audit — Full Platform Audit Log Viewer
 *
 * Features:
 *  - Paginated audit trail from /api/admin/audit
 *  - Filter by: severity, actor, action type, date range
 *  - Expandable row detail (full payload)
 *  - Export to CSV
 *  - Color-coded severity: INFO / WARN / CRITICAL
 *  - User attribution with IP address
 */
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders,useAdminAuth } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
AlertCircle,
AlertTriangle,
ChevronDown,
ChevronLeft,
ChevronRight,
ClipboardList,
Download,
Info,
Loader2,
RefreshCw,
Search
} from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useCallback,useEffect,useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface AuditEntry {
  id: string;
  ts: string;
  actor: string;
  actorId?: string;
  actorRole?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  severity: 'info' | 'warn' | 'critical';
  ip?: string;
  userAgent?: string;
  payload?: Record<string, unknown>;
  result?: 'success' | 'failure';
}

const SEV_CFG = {
  info:     { color: '#627EEA', bg: 'rgba(98,126,234,0.12)',  label: 'INFO',     Icon: Info },
  warn:     { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  label: 'WARN',     Icon: AlertTriangle },
  critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   label: 'CRITICAL', Icon: AlertCircle },
};

function exportCSV(entries: AuditEntry[]) {
  const header = 'Timestamp,Actor,Role,Action,Resource,Severity,IP,Result\n';
  const rows = entries.map(e => [
    new Date(e.ts).toISOString(),
    `"${e.actor}"`,
    e.actorRole ?? '',
    `"${e.action}"`,
    `"${e.resource ?? ''}"`,
    e.severity,
    e.ip ?? '',
    e.result ?? '',
  ].join(',')).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `cgc-audit-${new Date().toISOString().split('T')[0]}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminAudit() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [entries, setEntries]   = useState<AuditEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [severity, setSeverity] = useState('all');
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const PER_PAGE = 25;

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), limit: String(PER_PAGE),
        ...(search   ? { search }   : {}),
        ...(severity !== 'all' ? { severity } : {}),
      });
      const res = await fetch(`/api/admin/audit?${params}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.data ?? data.entries ?? data.logs ?? []);
        setTotal(data.total ?? data.data?.length ?? data.entries?.length ?? 0);
      }
    } finally { setLoading(false); }
  }, [page, search, severity]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <Helmet>
        <title>Audit Log — City Gate Capital Admin</title>
        <meta name="description" content="Full platform audit trail — every admin action, security event, and system change." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/admin/audit" />
      </Helmet>
      <AdminLayout title="Audit Log">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-white text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
              <ClipboardList size={18} style={{ color: '#C9A84C' }} /> Audit Log
            </h1>
            <p className="text-white/30 text-xs mt-0.5">{total.toLocaleString()} total entries · immutable record of all platform actions</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => exportCSV(entries)} disabled={entries.length === 0}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-white/50 hover:text-white text-xs transition-colors disabled:opacity-40">
              <Download size={12} /> Export CSV
            </button>
            <button onClick={fetchAudit}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-white/50 hover:text-white text-xs transition-colors">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 flex-1 min-w-48">
            <Search size={12} className="text-white/30 shrink-0" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search actor, action, resource…"
              className="bg-transparent text-xs text-white placeholder:text-white/25 focus:outline-none flex-1" />
          </div>
          <div className="flex gap-1.5">
            {(['all', 'info', 'warn', 'critical'] as const).map(s => (
              <button key={s} onClick={() => { setSeverity(s); setPage(1); }}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all capitalize"
                style={{
                  background: severity === s ? (s === 'all' ? 'rgba(201,168,76,0.15)' : `${SEV_CFG[s]?.bg ?? 'rgba(201,168,76,0.15)'}`) : 'rgba(255,255,255,0.04)',
                  color: severity === s ? (s === 'all' ? '#C9A84C' : SEV_CFG[s]?.color ?? '#C9A84C') : 'rgba(255,255,255,0.35)',
                  border: `1px solid ${severity === s ? (s === 'all' ? 'rgba(201,168,76,0.25)' : `${SEV_CFG[s]?.color ?? '#C9A84C'}33`) : 'rgba(255,255,255,0.06)'}`,
                }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/[0.05] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-white/25" /></div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/20">
              <ClipboardList size={28} />
              <p className="text-sm">No audit entries found</p>
            </div>
          ) : entries.map((entry, i) => {
            const sev = SEV_CFG[entry.severity] ?? SEV_CFG.info;
            const isExpanded = expanded === entry.id;
            return (
              <div key={entry.id} className={i < entries.length - 1 ? 'border-b border-white/[0.04]' : ''}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : entry.id)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.025] transition-colors text-left">
                  {/* Severity */}
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: sev.bg }}>
                    <sev.Icon size={12} style={{ color: sev.color }} />
                  </div>
                  {/* Timestamp */}
                  <div className="w-32 shrink-0 hidden md:block">
                    <p className="text-white/60 text-[11px] font-mono">
                      {new Date(entry.ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </p>
                    <p className="text-white/30 text-[10px] font-mono">
                      {new Date(entry.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  </div>
                  {/* Actor */}
                  <div className="w-40 shrink-0 hidden lg:block">
                    <p className="text-white/70 text-xs font-medium truncate">{entry.actor}</p>
                    <p className="text-white/25 text-[10px]">{entry.actorRole ?? 'system'}</p>
                  </div>
                  {/* Action */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-xs font-medium truncate">{entry.action}</p>
                    {entry.resource && <p className="text-white/30 text-[10px] truncate">{entry.resource}{entry.resourceId ? ` · ${entry.resourceId.slice(0, 12)}` : ''}</p>}
                  </div>
                  {/* IP */}
                  {entry.ip && <p className="text-white/25 text-[10px] font-mono hidden xl:block shrink-0">{entry.ip}</p>}
                  {/* Result */}
                  {entry.result && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      entry.result === 'success' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                    }`}>{entry.result}</span>
                  )}
                  <ChevronDown size={12} className={`text-white/20 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-white/[0.04]">
                      <div className="px-5 py-4 bg-white/[0.015]">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-xs">
                          <div><p className="text-white/30 mb-0.5">Actor ID</p><p className="text-white/60 font-mono">{entry.actorId ?? '—'}</p></div>
                          <div><p className="text-white/30 mb-0.5">IP Address</p><p className="text-white/60 font-mono">{entry.ip ?? '—'}</p></div>
                          <div><p className="text-white/30 mb-0.5">Severity</p><p style={{ color: sev.color }} className="font-semibold">{sev.label}</p></div>
                          <div><p className="text-white/30 mb-0.5">Result</p><p className={entry.result === 'success' ? 'text-emerald-400' : 'text-red-400'}>{entry.result ?? '—'}</p></div>
                        </div>
                        {entry.userAgent && <p className="text-white/20 text-[10px] mb-3 font-mono truncate">{entry.userAgent}</p>}
                        {entry.payload && (
                          <div>
                            <p className="text-white/30 text-[11px] mb-1.5">Payload</p>
                            <pre className="text-[10px] text-white/50 bg-black/30 rounded-xl p-3 overflow-x-auto font-mono leading-relaxed">
                              {JSON.stringify(entry.payload, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-white/30 text-xs">Page {page} of {pages} · {total.toLocaleString()} entries</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/40 hover:text-white disabled:opacity-30 transition-colors">
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                const pg = page <= 3 ? i + 1 : page + i - 2;
                if (pg < 1 || pg > pages) return null;
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className="w-8 h-8 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: pg === page ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.04)',
                      color: pg === page ? '#C9A84C' : 'rgba(255,255,255,0.4)',
                      border: `1px solid ${pg === page ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.07)'}`,
                    }}>{pg}</button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/40 hover:text-white disabled:opacity-30 transition-colors">
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </AdminLayout>
    </>
  );
}
