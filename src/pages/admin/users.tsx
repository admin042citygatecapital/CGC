import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, ChevronLeft, ChevronRight, CheckCircle,
  Lock, Unlock, RotateCcw, Eye, AlertTriangle, UserCheck, UserX,
  X, Loader2, RefreshCw, ShieldCheck, ShieldX, Wallet, Edit3,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';
import BalanceModal from '@/components/admin/BalanceModal';
import ClientEditModal, { type EditableUser } from '@/components/admin/ClientEditModal';

interface User {
  id: string; name: string; email: string; phone?: string; country?: string;
  status: string; kycStatus: string; emailVerified: boolean;
  createdAt: string; approvedAt?: string; rejectedAt?: string;
  rejectionReason?: string; lastLoginAt?: string; balance?: number;
}

const STATUS_STYLES: Record<string, string> = {
  active:               'bg-emerald-500/15 text-emerald-400',
  pending_verification: 'bg-amber-500/15 text-amber-400',
  pending_kyc:          'bg-blue-500/15 text-blue-400',
  pending_approval:     'bg-purple-500/15 text-purple-400',
  suspended:            'bg-red-500/15 text-red-400',
  frozen:               'bg-cyan-500/15 text-cyan-400',
  rejected:             'bg-red-900/30 text-red-300',
};

const KYC_STYLES: Record<string, string> = {
  not_submitted: 'bg-white/10 text-white/40',
  submitted:     'bg-amber-500/15 text-amber-400',
  approved:      'bg-emerald-500/15 text-emerald-400',
  rejected:      'bg-red-500/15 text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active', pending_verification: 'Pending Email', pending_kyc: 'Pending KYC',
  pending_approval: 'Pending Approval', suspended: 'Suspended', frozen: 'Frozen', rejected: 'Rejected',
};

export default function AdminUsers() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [users, setUsers]         = useState<User[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [pages, setPages]         = useState(1);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('');
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<User | null>(null);
  const [actionLoading, setAL]    = useState<string | null>(null);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ userId: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [balanceUser, setBalanceUser] = useState<User | null>(null);
  const [editUser, setEditUser]       = useState<User | null>(null);

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '15' });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/admin/users?${params}`, { headers: authHeaders() });
    if (res.ok) { const d = await res.json(); setUsers(d.data); setTotal(d.total); setPages(d.pages ?? Math.ceil(d.total / 15)); }
    setLoading(false);
  }, [page, search, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function doAction(userId: string, action: string, extra?: object) {
    setAL(userId + action);
    const res = await fetch('/api/admin/users/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ userId, action, ...extra }),
    });
    const d = await res.json();
    setAL(null);
    if (res.ok) { showToast(d.message ?? 'Action completed'); fetchUsers(); setSelected(null); }
    else showToast(d.error ?? 'Action failed', false);
  }

  async function approveUser(userId: string) {
    setAL(userId + 'approve');
    const res = await fetch('/api/admin/users/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ userId }),
    });
    const d = await res.json();
    setAL(null);
    if (res.ok) { showToast(d.message ?? 'User approved'); fetchUsers(); setSelected(null); }
    else showToast(d.error ?? 'Approval failed', false);
  }

  async function rejectUser() {
    if (!rejectModal) return;
    setAL(rejectModal.userId + 'reject');
    const res = await fetch('/api/admin/users/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ userId: rejectModal.userId, reason: rejectReason || undefined }),
    });
    const d = await res.json();
    setAL(null);
    setRejectModal(null);
    setRejectReason('');
    if (res.ok) { showToast(d.message ?? 'User rejected'); fetchUsers(); setSelected(null); }
    else showToast(d.error ?? 'Rejection failed', false);
  }

  const totalPages = pages;
  const canApprove = (u: User) => ['pending_kyc', 'pending_approval', 'submitted'].includes(u.status) || u.kycStatus === 'submitted';
  const canReject  = (u: User) => !['rejected', 'active'].includes(u.status);

  return (
    <>
      <Helmet><title>Users — CGC Admin</title><meta name="robots" content="noindex" /></Helmet>
      <AdminLayout title="Users">

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl ${
                toast.ok ? 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400' : 'bg-red-500/15 border-red-500/20 text-red-400'
              }`}>
              {toast.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reject modal */}
        <AnimatePresence>
          {rejectModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-md rounded-2xl border border-white/8 p-6"
                style={{ background: 'rgba(15,15,15,0.98)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-bold">Reject Account</h3>
                  <button onClick={() => setRejectModal(null)} className="text-white/30 hover:text-white"><X size={16} /></button>
                </div>
                <p className="text-white/50 text-sm mb-4">Rejecting <strong className="text-white">{rejectModal.name}</strong>. A rejection email with resubmission instructions will be sent automatically.</p>
                <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Rejection Reason (optional)</label>
                <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  placeholder="e.g. Government ID unclear, proof of address expired..."
                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-red-500/40 resize-none mb-4" />
                <div className="flex gap-3">
                  <button onClick={() => setRejectModal(null)} className="flex-1 py-2.5 rounded-xl border border-white/8 text-white/50 text-sm hover:bg-white/[0.04]">Cancel</button>
                  <button onClick={rejectUser} disabled={!!actionLoading}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/30 flex items-center justify-center gap-2">
                    {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <UserX size={13} />}
                    Reject & Notify
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">User Management</h1>
            <p className="text-white/30 text-sm">{total} total users</p>
          </div>
          <button onClick={fetchUsers} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/50 text-sm hover:text-white">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-48">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name, email, ID..."
              className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
          </div>
          <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
            <option value="" className="bg-[#0A0A0A]">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v} className="bg-[#0A0A0A]">{l}</option>)}
          </select>
        </div>

        {/* Pending approval banner */}
        {users.filter(u => u.status === 'pending_approval' || u.status === 'pending_kyc').length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 mb-4">
            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
            <p className="text-amber-300 text-sm">
              <strong>{users.filter(u => u.status === 'pending_approval' || u.status === 'pending_kyc').length}</strong> user(s) awaiting KYC review and approval.
            </p>
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['User', 'Status', 'KYC', 'Email', 'Balance', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-white/25 text-[10px] uppercase tracking-wide font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {loading ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-white/[0.04] rounded animate-pulse" /></td></tr>
                )) : users.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-white/25 text-sm">No users found</td></tr>
                ) : users.map(u => (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
                          style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{u.name}</p>
                          <p className="text-white/30 text-xs">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_STYLES[u.status] ?? 'bg-white/10 text-white/40'}`}>
                        {STATUS_LABELS[u.status] ?? u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${KYC_STYLES[u.kycStatus] ?? 'bg-white/10 text-white/40'}`}>
                        {u.kycStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.emailVerified
                        ? <CheckCircle size={13} className="text-emerald-400" />
                        : <AlertTriangle size={13} className="text-amber-400" />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-white/70 font-mono text-xs">
                          ${Number(u.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <button
                          onClick={() => setBalanceUser(u)}
                          title="Adjust Balance"
                          className="w-5 h-5 rounded flex items-center justify-center text-[#C9A84C]/60 hover:text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors ml-1"
                        >
                          <Wallet size={10} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/30 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {/* Approve */}
                        {canApprove(u) && (
                          <button onClick={() => approveUser(u.id)} disabled={!!actionLoading}
                            title="Approve Account"
                            className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/25 transition-colors">
                            {actionLoading === u.id + 'approve' ? <Loader2 size={11} className="animate-spin" /> : <UserCheck size={11} />}
                          </button>
                        )}
                        {/* Reject */}
                        {canReject(u) && (
                          <button onClick={() => setRejectModal({ userId: u.id, name: u.name })}
                            title="Reject Account"
                            className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center text-red-400 hover:bg-red-500/25 transition-colors">
                            <UserX size={11} />
                          </button>
                        )}
                        {/* Suspend */}
                        {u.status === 'active' && (
                          <button onClick={() => doAction(u.id, 'suspend')} disabled={!!actionLoading}
                            title="Suspend"
                            className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400 hover:bg-amber-500/25 transition-colors">
                            {actionLoading === u.id + 'suspend' ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />}
                          </button>
                        )}
                        {/* Reactivate */}
                        {['suspended', 'frozen'].includes(u.status) && (
                          <button onClick={() => doAction(u.id, 'reactivate')} disabled={!!actionLoading}
                            title="Reactivate"
                            className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400 hover:bg-blue-500/25 transition-colors">
                            {actionLoading === u.id + 'reactivate' ? <Loader2 size={11} className="animate-spin" /> : <Unlock size={11} />}
                          </button>
                        )}
                        {/* Freeze */}
                        {u.status === 'active' && (
                          <button onClick={() => doAction(u.id, 'freeze')} disabled={!!actionLoading}
                            title="Freeze"
                            className="w-7 h-7 rounded-lg bg-cyan-500/15 flex items-center justify-center text-cyan-400 hover:bg-cyan-500/25 transition-colors">
                            {actionLoading === u.id + 'freeze' ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                          </button>
                        )}
                        {/* View */}
                        <button onClick={() => setSelected(u)}
                          title="View Details"
                          className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors">
                          <Eye size={11} />
                        </button>
                        {/* Edit */}
                        <button onClick={() => setEditUser(u)}
                          title="Edit Client"
                          className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary/60 hover:text-primary hover:bg-primary/20 transition-colors">
                          <Edit3 size={11} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-white/25 text-xs">Page {page} of {totalPages || 1}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 disabled:opacity-30"><ChevronLeft size={12} /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 disabled:opacity-30"><ChevronRight size={12} /></button>
            </div>
          </div>
        </div>

        {/* User detail drawer */}
        <AnimatePresence>
          {selected && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 flex items-center justify-end bg-black/60 backdrop-blur-sm"
              onClick={() => setSelected(null)}>
              <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="w-full max-w-sm h-full overflow-y-auto border-l border-white/8 p-6 space-y-5"
                style={{ background: 'rgba(10,10,10,0.98)' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold">User Details</h3>
                  <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white"><X size={16} /></button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-black"
                    style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
                    {selected.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{selected.name}</p>
                    <p className="text-white/40 text-xs">{selected.email}</p>
                  </div>
                </div>

                {[
                  ['ID', selected.id],
                  ['Phone', selected.phone ?? '—'],
                  ['Country', selected.country ?? '—'],
                  ['Status', STATUS_LABELS[selected.status] ?? selected.status],
                  ['KYC', selected.kycStatus.replace('_', ' ')],
                  ['Email Verified', selected.emailVerified ? 'Yes' : 'No'],
                  ['Registered', new Date(selected.createdAt).toLocaleString()],
                  ['Approved', selected.approvedAt ? new Date(selected.approvedAt).toLocaleString() : '—'],
                  ['Rejected', selected.rejectedAt ? new Date(selected.rejectedAt).toLocaleString() : '—'],
                  ['Rejection Reason', selected.rejectionReason ?? '—'],
                  ['Last Login', selected.lastLoginAt ? new Date(selected.lastLoginAt).toLocaleString() : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b border-white/[0.04]">
                    <span className="text-white/30 text-xs">{k}</span>
                    <span className="text-white text-xs text-right max-w-[60%] break-all">{v}</span>
                  </div>
                ))}

                {/* Action buttons in drawer */}
                <div className="space-y-2 pt-2">
                  {canApprove(selected) && (
                    <button onClick={() => approveUser(selected.id)} disabled={!!actionLoading}
                      className="w-full py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-500/25">
                      {actionLoading === selected.id + 'approve' ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                      Approve & Activate Account
                    </button>
                  )}
                  {canReject(selected) && (
                    <button onClick={() => setRejectModal({ userId: selected.id, name: selected.name })}
                      className="w-full py-2.5 rounded-xl bg-red-500/15 border border-red-500/20 text-red-400 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-500/25">
                      <ShieldX size={13} /> Reject Application
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </AdminLayout>

      {/* Balance adjustment modal */}
      <AnimatePresence>
        {balanceUser && (
          <BalanceModal
            user={balanceUser}
            onClose={() => setBalanceUser(null)}
            onSuccess={(userId, newBalance) => {
              setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: newBalance } : u));
              showToast(`Balance updated successfully`);
              setBalanceUser(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Client edit modal */}
      <AnimatePresence>
        {editUser && (
          <ClientEditModal
            user={editUser as EditableUser}
            onClose={() => setEditUser(null)}
            onSuccess={(updated) => {
              setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));
              showToast('Client account updated');
              setEditUser(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
