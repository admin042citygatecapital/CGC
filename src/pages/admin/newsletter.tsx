import { useState, useEffect, useCallback } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Users, TrendingUp, Send, RefreshCw, Download,
  CheckCircle, XCircle, Clock, Search, ChevronLeft, ChevronRight,
  Loader2, AlertTriangle,
} from 'lucide-react';

interface Subscriber {
  id: string;
  email: string;
  name?: string;
  status: 'active' | 'unsubscribed';
  subscribedAt: string;
  source?: string;
  sequenceStep?: number;
}

interface Stats {
  total: number;
  active: number;
  unsubscribed: number;
  sources: Record<string, number>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function AdminNewsletter() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();

  const localAuthHeaders = () => ({
    'Content-Type': 'application/json',
    ...authHeaders(),
  });

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats]             = useState<Stats | null>(null);
  const [pagination, setPagination]   = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 0 });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [filter, setFilter]           = useState<'all' | 'active' | 'unsubscribed'>('all');
  const [search, setSearch]           = useState('');
  const [sending, setSending]         = useState(false);
  const [sendResult, setSendResult]   = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !admin) navigate('/admin/login');
  }, [admin, authLoading, navigate]);

  const fetchSubscribers = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (filter !== 'all') params.set('status', filter);
      const res = await fetch(`/api/newsletter/subscribers?${params}`, {
        headers: localAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load subscribers');
      const data = await res.json();
      setSubscribers(data.subscribers ?? []);
      setStats(data.stats ?? null);
      setPagination(data.pagination ?? { page: 1, limit: 50, total: 0, pages: 0 });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchSubscribers(1); }, [fetchSubscribers]);

  async function handleSendSequence() {
    if (!confirm('Send the next nurture email to all active subscribers?')) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/newsletter/send-sequence', {
        method: 'POST',
        headers: localAuthHeaders(),
      });
      const data = await res.json();
      setSendResult(data.message ?? 'Sequence triggered successfully');
    } catch {
      setSendResult('Failed to trigger sequence');
    } finally {
      setSending(false);
    }
  }

  function exportCSV() {
    const rows = [
      ['ID', 'Email', 'Name', 'Status', 'Source', 'Subscribed At', 'Sequence Step'],
      ...subscribers.map(s => [
        s.id, s.email, s.name ?? '', s.status, s.source ?? '', s.subscribedAt, String(s.sequenceStep ?? 0),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `cgc-subscribers-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const filtered = subscribers.filter(s =>
    search ? s.email.toLowerCase().includes(search.toLowerCase()) || (s.name ?? '').toLowerCase().includes(search.toLowerCase()) : true
  );

  if (authLoading) return null;

  return (
    <>
      <Helmet><title>Newsletter — CGC Admin</title><meta name="robots" content="noindex" /></Helmet>
      <AdminLayout title="Newsletter">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Newsletter Management</h1>
            <p className="text-sm text-white/40 mt-0.5">Manage subscribers and email sequences</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/60 border border-white/10 hover:border-white/20 hover:text-white transition-colors"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={handleSendSequence}
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send Sequence
            </button>
          </div>
        </div>

        {sendResult && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10B981' }}>
            <CheckCircle size={14} /> {sendResult}
          </div>
        )}

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Subscribers', value: stats.total,        icon: Users,       color: '#C9A84C' },
              { label: 'Active',            value: stats.active,       icon: CheckCircle, color: '#10B981' },
              { label: 'Unsubscribed',      value: stats.unsubscribed, icon: XCircle,     color: '#EF4444' },
              { label: 'Open Rate (est.)',  value: '24.8%',            icon: TrendingUp,  color: '#627EEA' },
            ].map(card => (
              <div key={card.label} className="rounded-2xl p-5 border border-white/5"
                style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-white/40 font-medium">{card.label}</p>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${card.color}15` }}>
                    <card.icon size={14} style={{ color: card.color }} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{typeof card.value === 'number' ? Number(card.value ?? 0).toLocaleString() : card.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Sources breakdown */}
        {stats?.sources && Object.keys(stats.sources).length > 0 && (
          <div className="rounded-2xl p-5 border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <h3 className="text-sm font-semibold text-white mb-4">Subscription Sources</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.sources).map(([source, count]) => (
                <div key={source} className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.15)' }}>
                  <span className="text-xs text-white/60 capitalize">{source}</span>
                  <span className="text-xs font-bold text-primary">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subscriber table */}
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          {/* Table controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-white/5">
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 w-full sm:w-64">
              <Search size={13} className="text-white/25 shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search subscribers..."
                className="bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              {(['all', 'active', 'unsubscribed'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    filter === f ? 'text-black' : 'text-white/40 hover:text-white/70'
                  }`}
                  style={filter === f ? { background: 'linear-gradient(135deg, #C9A84C, #F0D080)' } : {}}>
                  {f}
                </button>
              ))}
              <button onClick={() => fetchSubscribers(pagination.page)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white border border-white/8 transition-colors">
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 m-4 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/30">
              <Mail size={32} className="mb-3 opacity-30" />
              <p className="text-sm">No subscribers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Email', 'Name', 'Status', 'Source', 'Step', 'Subscribed'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-white/25 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(sub => (
                    <tr key={sub.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-white/80 font-medium">{sub.email}</td>
                      <td className="px-4 py-3 text-white/50">{sub.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          sub.status === 'active'
                            ? 'text-emerald-400 bg-emerald-400/10'
                            : 'text-red-400 bg-red-400/10'
                        }`}>
                          {sub.status === 'active' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/40 capitalize">{sub.source ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs text-white/40">
                          <Clock size={10} />
                          {sub.sequenceStep ?? 0}/5
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/35 text-xs">
                        {new Date(sub.subscribedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
              <p className="text-xs text-white/30">
                Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchSubscribers(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white border border-white/8 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="flex items-center px-3 text-xs text-white/50">
                  {pagination.page} / {pagination.pages}
                </span>
                <button
                  onClick={() => fetchSubscribers(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white border border-white/8 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
    </>
  );
}
