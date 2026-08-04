import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ChevronDown, ChevronLeft, ChevronRight, Download, Eye } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';

type KYCStatus = 'pending' | 'approved' | 'rejected' | 'needs_info' | 'flagged';
const STATUS: Record<KYCStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Pending',    color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  approved:   { label: 'Approved',   color: '#22C55E', bg: 'rgba(34,197,94,0.15)'  },
  rejected:   { label: 'Rejected',   color: '#EF4444', bg: 'rgba(239,68,68,0.15)'  },
  needs_info: { label: 'Needs Info', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  flagged:    { label: 'Flagged',    color: '#A855F7', bg: 'rgba(168,85,247,0.15)' },
};
interface QueueItem {
  id: string; userId: string; fullName: string; email: string;
  submittedAt: string; documentType: string; countryName: string;
  riskScore: number; status: KYCStatus; assignedReviewer: string | null;
}
export default function AdminKYCQueue() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(sp.get('status') ?? 'all');
  const [sort, setSort] = useState('newest');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), perPage: '20', sort,
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }) });
      const r = await fetch(`/api/admin/kyc/queue?${p}`, { headers: authHeaders() });
      if (r.ok) { const d = await r.json(); setItems(d.items); setTotal(d.total); }
    } finally { setLoading(false); }
  }, [page, sort, search, statusFilter]);
  useEffect(() => { load(); }, [load]);
  const totalPages = Math.ceil(total / 20);
  return (
    <AdminLayout title="KYC Review Queue">
      <Helmet><title>KYC Review Queue — CityGate Admin</title></Helmet>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>KYC Review Queue</h1>
          <p className="text-white/50 text-sm mt-0.5">{total} submission{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={async () => {
          const p = new URLSearchParams({ sort, ...(search && { search }), ...(statusFilter !== 'all' && { status: statusFilter }), format: 'csv' });
          const r = await fetch(`/api/admin/kyc/queue/export?${p}`, { headers: authHeaders() });
          if (r.ok) { const b = await r.blob(); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `kyc-queue-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(u); }
        }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 text-sm transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input type="text" placeholder="Search name, email, ID…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/50" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none cursor-pointer">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="needs_info">Needs Info</option>
            <option value="flagged">Flagged</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none cursor-pointer">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="risk_high">Highest Risk</option>
            <option value="risk_low">Lowest Risk</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
        </div>
      </div>
      <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/10">
              {['User','Email','Submitted','Document','Country','Risk','Status','Reviewer',''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-white/50 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-white/30">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-white/30">No submissions found</td></tr>
              ) : items.map(item => {
                const sc = STATUS[item.status];
                return (
                  <tr key={item.id} onClick={() => navigate(`/admin/kyc-review/${item.userId}`)}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors">
                    <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{item.fullName}</td>
                    <td className="px-4 py-3 text-white/70 whitespace-nowrap">{item.email}</td>
                    <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">{new Date(item.submittedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-white/70 text-xs whitespace-nowrap">{item.documentType}</td>
                    <td className="px-4 py-3 text-white/70 text-xs whitespace-nowrap">{item.countryName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ color: item.riskScore >= 60 ? '#EF4444' : item.riskScore >= 30 ? '#EAB308' : '#22C55E', background: item.riskScore >= 60 ? 'rgba(239,68,68,0.15)' : item.riskScore >= 30 ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)' }}>
                        {item.riskScore}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ color: sc.color, background: sc.bg }}>{sc.label}</span>
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">{item.assignedReviewer ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={e => { e.stopPropagation(); navigate(`/admin/kyc-review/${item.userId}`); }}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm text-white/50">
        <span>Showing {Math.min((page-1)*20+1,total)}–{Math.min(page*20,total)} of {total}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page<=1}
            className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white/70">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page>=totalPages}
            className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
