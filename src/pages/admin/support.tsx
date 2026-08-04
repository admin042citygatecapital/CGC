import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MessageCircle, X, Send, Loader2, CheckCircle } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';

interface Ticket {
  id: string; subject: string; userName: string; userId: string; userEmail: string;
  category: string; priority: string; status: string;
  messages: { from: string; text: string; ts: string }[];
  createdAt: string; updatedAt: string;
}



const PRIORITY_STYLES: Record<string, string> = {
  low:    'bg-white/10 text-white/40',
  medium: 'bg-blue-500/15 text-blue-400',
  high:   'bg-amber-500/15 text-amber-400',
  urgent: 'bg-red-500/15 text-red-400',
};
const STATUS_STYLES: Record<string, string> = {
  open:        'bg-emerald-500/15 text-emerald-400',
  pending:     'bg-amber-500/15 text-amber-400',
  in_progress: 'bg-blue-500/15 text-blue-400',
  resolved:    'bg-white/10 text-white/30',
  closed:      'bg-white/5 text-white/20',
};

export default function AdminSupport() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [pages, setPages]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter]   = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [reply, setReply]     = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replySent, setReplySent] = useState(false);

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter) params.set('status', statusFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    const res = await fetch(`/api/admin/support?${params}`, { headers: authHeaders() });
    if (res.ok) { const d = await res.json(); setTickets(d.data); setTotal(d.total); setPages(d.pages); }
    setLoading(false);
  }, [page, statusFilter, priorityFilter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || !selected) return;
    setReplySending(true);
    try {
      const res = await fetch('/api/admin/support/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ id: selected.id, text: reply.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        setSelected(d.conversation);
        setTickets(ts => ts.map(t => t.id === d.conversation.id ? d.conversation : t));
        setReply('');
        setReplySent(true);
        setTimeout(() => setReplySent(false), 4000);
      }
    } catch { /* network error — no success shown, reply box keeps the draft */ }
    setReplySending(false);
  }

  async function changeStatus(status: string) {
    if (!selected) return;
    const res = await fetch('/api/admin/support/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id: selected.id, status }),
    });
    if (res.ok) {
      const d = await res.json();
      setSelected(d.conversation);
      setTickets(ts => ts.map(t => t.id === d.conversation.id ? d.conversation : t));
    }
  }

  return (
    <>
      <Helmet><title>Support Center — CGC Admin</title><meta name="robots" content="noindex" /></Helmet>
      <AdminLayout title="Support">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">Support Center</h1>
            <p className="text-white/30 text-sm">{total} tickets total</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/60 focus:outline-none">
            <option value="">All Status</option>
            {['open','in_progress','resolved','closed'].map(s => <option key={s} value={s} className="bg-[#0A0A0A]">{s.replace('_',' ')}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
            className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/60 focus:outline-none">
            <option value="">All Priority</option>
            {['low','medium','high','urgent'].map(p => <option key={p} value={p} className="bg-[#0A0A0A]">{p}</option>)}
          </select>
        </div>

        <div className="grid lg:grid-cols-5 gap-4">
          {/* Ticket list */}
          <div className="lg:col-span-2 rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="divide-y divide-white/[0.03] max-h-[600px] overflow-y-auto">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-4"><div className="h-12 bg-white/[0.04] rounded animate-pulse" /></div>
                ))
              ) : tickets.map(t => (
                <button key={t.id} onClick={() => setSelected(t)}
                  className={`w-full text-left p-4 hover:bg-white/[0.03] transition-colors ${selected?.id === t.id ? 'bg-white/[0.04] border-l-2 border-primary' : ''}`}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-white text-xs font-medium leading-snug line-clamp-1">{t.subject}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span>
                  </div>
                  <p className="text-white/30 text-[10px] mb-1.5">{t.userName} · {t.category}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLES[t.status]}`}>{t.status.replace('_',' ')}</span>
                    <p className="text-white/20 text-[10px]">{new Date(t.createdAt).toLocaleDateString()}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
              <p className="text-white/25 text-[10px]">Page {page}/{pages}</p>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-6 h-6 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 disabled:opacity-30"><ChevronLeft size={11} /></button>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                  className="w-6 h-6 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 disabled:opacity-30"><ChevronRight size={11} /></button>
              </div>
            </div>
          </div>

          {/* Ticket detail */}
          <div className="lg:col-span-3">
            {selected ? (
              <div className="rounded-2xl border border-white/5 overflow-hidden flex flex-col" style={{ background: 'rgba(255,255,255,0.02)', maxHeight: '600px' }}>
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-white/5">
                  <div>
                    <p className="text-white font-semibold text-sm">{selected.subject}</p>
                    <p className="text-white/30 text-xs mt-0.5">{selected.id} · {selected.userName} · {selected.userEmail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[selected.priority]}`}>{selected.priority}</span>
                    <select value={selected.status} onChange={e => changeStatus(e.target.value)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border-0 focus:outline-none ${STATUS_STYLES[selected.status]}`}>
                      {['open','pending','in_progress','resolved','closed'].map(s => (
                        <option key={s} value={s} className="bg-[#0A0A0A] text-white">{s.replace('_',' ')}</option>
                      ))}
                    </select>
                    <button onClick={() => setSelected(null)} className="text-white/25 hover:text-white"><X size={14} /></button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {selected.messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.from === 'admin' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs rounded-2xl px-4 py-3 text-xs ${
                        msg.from === 'admin'
                          ? 'text-black rounded-br-sm'
                          : 'bg-white/[0.06] text-white/80 rounded-bl-sm'
                      }`} style={msg.from === 'admin' ? { background: 'linear-gradient(135deg, #C9A84C, #F0D080)' } : {}}>
                        <p className="leading-relaxed">{msg.text}</p>
                        <p className={`text-[9px] mt-1 ${msg.from === 'admin' ? 'text-black/40' : 'text-white/25'}`}>{new Date(msg.ts).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reply */}
                <form onSubmit={sendReply} className="p-4 border-t border-white/5 flex gap-2">
                  <input value={reply} onChange={e => setReply(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
                  <button type="submit" disabled={replySending || !reply.trim()} className="relative px-4 py-2.5 rounded-xl font-bold text-black text-sm overflow-hidden shrink-0 disabled:opacity-50">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                    <span className="relative">
                      {replySending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </span>
                  </button>
                </form>
                {replySent && (
                  <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                    <CheckCircle size={12} /> Reply sent successfully
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/5 flex items-center justify-center h-64" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="text-center">
                  <MessageCircle size={32} className="text-white/10 mx-auto mb-3" />
                  <p className="text-white/20 text-sm">Select a ticket to view</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </>
  );
}
