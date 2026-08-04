import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, ChevronLeft, ChevronRight, RefreshCw,
  Mail, X, Building2, MessageSquare, Clock,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';

interface Submission {
  id: string; firstName: string; lastName: string; email: string;
  company: string; subject: string; message: string;
  ip: string; createdAt: string;
}

export default function AdminContacts() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [pages, setPages]   = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Submission | null>(null);

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  const fetchData = useCallback(async (p = page) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '25' });
    if (search) params.set('search', search);
    try {
      const res = await fetch(`/api/admin/contacts?${params}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const d = await res.json();
        setSubmissions(d.data ?? []);
        setTotal(d.total ?? 0);
        setPages(d.pages ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchData(1); }, 400);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Helmet><title>Contact Submissions — CGC Admin</title><meta name="robots" content="noindex" /></Helmet>
      <AdminLayout title="Contacts">

        {/* Detail drawer */}
        <AnimatePresence>
          {selected && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 flex items-center justify-end bg-black/60 backdrop-blur-sm"
              onClick={() => setSelected(null)}>
              <motion.div initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="w-full max-w-sm h-full overflow-y-auto border-l border-white/8 p-6 space-y-5"
                style={{ background: 'rgba(10,10,10,0.98)' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold">Submission Detail</h3>
                  <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white"><X size={16} /></button>
                </div>

                {/* Sender */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold text-black shrink-0"
                    style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
                    {selected.firstName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{selected.firstName} {selected.lastName}</p>
                    <p className="text-white/40 text-xs">{selected.email}</p>
                  </div>
                </div>

                {/* Meta fields */}
                {[
                  ['ID',       selected.id],
                  ['Company',  selected.company || '—'],
                  ['Subject',  selected.subject],
                  ['IP',       selected.ip],
                  ['Received', new Date(selected.createdAt).toLocaleString()],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b border-white/[0.04]">
                    <span className="text-white/30 text-xs">{k}</span>
                    <span className="text-white text-xs text-right max-w-[60%] break-all">{v}</span>
                  </div>
                ))}

                {/* Message */}
                <div>
                  <p className="text-white/30 text-[10px] uppercase tracking-wide mb-2">Message</p>
                  <div className="rounded-xl bg-white/[0.04] border border-white/8 p-4 text-white/70 text-sm leading-relaxed whitespace-pre-wrap">
                    {selected.message}
                  </div>
                </div>

                {/* Reply link */}
                <a href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-black text-sm"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
                  <Mail size={14} /> Reply via Email
                </a>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">Contact Submissions</h1>
            <p className="text-white/30 text-sm">{total} total submissions</p>
          </div>
          <button onClick={() => fetchData()} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/50 text-sm hover:text-white transition-colors">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 mb-5 max-w-sm">
          <Search size={13} className="text-white/25 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, subject..."
            className="bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none flex-1" />
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Sender', 'Company', 'Subject', 'Received', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-white/25 text-[10px] uppercase tracking-wide font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-white/[0.04] rounded animate-pulse" /></td></tr>
                  ))
                ) : submissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center">
                      <MessageSquare size={28} className="text-white/10 mx-auto mb-3" />
                      <p className="text-white/25 text-sm">No submissions yet</p>
                    </td>
                  </tr>
                ) : submissions.map((s, i) => (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setSelected(s)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
                          style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
                          {s.firstName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-xs font-medium">{s.firstName} {s.lastName}</p>
                          <p className="text-white/30 text-[10px]">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.company ? (
                        <span className="flex items-center gap-1.5 text-white/50 text-xs">
                          <Building2 size={11} className="text-white/20" />{s.company}
                        </span>
                      ) : <span className="text-white/20 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-white/70 text-xs max-w-[200px] truncate">{s.subject}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-white/30 text-xs whitespace-nowrap">
                        <Clock size={10} />
                        {new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-primary hover:underline whitespace-nowrap">View →</button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-white/25 text-xs">Page {page} of {pages} · {total} submissions</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 disabled:opacity-30 hover:text-white transition-colors">
                <ChevronLeft size={12} />
              </button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
                className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 disabled:opacity-30 hover:text-white transition-colors">
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>

      </AdminLayout>
    </>
  );
}
