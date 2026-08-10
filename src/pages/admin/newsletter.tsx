/**
 * Admin Newsletter Management — /admin/newsletter
 * ─────────────────────────────────────────────────
 * 4 tabs:
 *   1. Subscribers — list, search, filter, manual unsub, CSV export/import
 *   2. Campaign Builder — create/edit, segment, schedule, preview, save draft
 *   3. Campaign History — sent campaigns with stats, duplicate & resend
 *   4. Compliance — unsubscribe info, GDPR notes
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Users, Send, RefreshCw, Download, Upload,
  CheckCircle, XCircle, Clock, Search, ChevronLeft, ChevronRight,
  Loader2, AlertTriangle, Plus, Edit3, Copy, Eye,
  BarChart2, Globe, Shield, AlertCircle,
  Smartphone, Monitor,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Subscriber {
  id: string;
  email: string;
  name?: string;
  status: 'active' | 'unsubscribed';
  subscribedAt: string;
  source?: string;
  sequenceStep?: number;
  tags?: string[];
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

interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  segment: { group: string; registeredAfter?: string; registeredBefore?: string; country?: string };
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
  stats: {
    totalRecipients: number;
    sent: number;
    failed: number;
    openRate: number | null;
    clickRate: number | null;
    engagementTracking: 'not_configured';
    unsubscribes: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}

const RECIPIENT_GROUPS = [
  { value: 'all',      label: 'All Subscribers' },
  { value: 'personal', label: 'Personal Account Holders' },
  { value: 'savings',  label: 'Savings Account Holders' },
  { value: 'business', label: 'Business Account Holders' },
  { value: 'custom',   label: 'Custom Segment' },
];

const DYNAMIC_VARS = [
  '{user_name}', '{email}', '{balance}', '{currency}', '{date}', '{account_number}',
];

// ── Campaign Status Badge ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Campaign['status'] }) {
  const map: Record<Campaign['status'], string> = {
    draft:     'bg-white/10 text-white/50',
    scheduled: 'bg-blue-500/15 text-blue-400',
    sending:   'bg-amber-500/15 text-amber-400',
    sent:      'bg-emerald-500/15 text-emerald-400',
    failed:    'bg-red-500/15 text-red-400',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${map[status]}`}>
      {status === 'sent' && <CheckCircle size={9} />}
      {status === 'failed' && <XCircle size={9} />}
      {status === 'scheduled' && <Clock size={9} />}
      {status}
    </span>
  );
}

// ── Preview Modal ─────────────────────────────────────────────────────────────

function PreviewModal({ subject, body, onClose }: { subject: string; body: string; onClose: () => void }) {
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop');
  const html = `
<div style="font-family:Inter,Arial,sans-serif;background:#111;color:#e5e5e5;padding:32px;border-radius:12px;border:1px solid rgba(201,168,76,0.2)">
  <div style="text-align:center;margin-bottom:24px">
    <span style="font-size:20px;font-weight:700;color:#C9A84C">City Gate Capital</span>
  </div>
  ${body.replace(/{user_name}/g, 'John Doe').replace(/{email}/g, 'john@example.com').replace(/{balance}/g, '5,000.00').replace(/{currency}/g, 'USD').replace(/{date}/g, new Date().toLocaleDateString('en-GB')).replace(/{account_number}/g, 'CGC-123456')}
  <hr style="margin:32px 0;border-color:rgba(255,255,255,0.1)"/>
  <p style="font-size:12px;color:#666;text-align:center">
    You are receiving this because you subscribed to City Gate Capital newsletters.<br/>
    <a href="#" style="color:#C9A84C">Unsubscribe</a>
  </p>
</div>`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <p className="text-sm font-bold text-white">Email Preview</p>
            <p className="text-xs text-white/40 truncate max-w-sm">{subject}</p>
          </div>
          <div className="flex items-center gap-2">
            {(['desktop', 'mobile'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  view === v ? 'bg-primary text-black' : 'text-white/40 hover:text-white'
                }`}>
                {v === 'desktop' ? <Monitor size={12} /> : <Smartphone size={12} />}
                {v === 'desktop' ? 'Desktop' : 'Mobile'}
              </button>
            ))}
            <button onClick={onClose} className="ml-2 text-white/40 hover:text-white transition-colors">
              <XCircle size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-5 bg-[#0a0a0a]">
          <div className={`mx-auto transition-all ${view === 'mobile' ? 'max-w-[375px]' : 'max-w-full'}`}>
            <iframe
              srcDoc={html}
              className="w-full border-0 rounded-xl"
              style={{ height: '600px', background: '#111' }}
              title="Email preview"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminNewsletter() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();

  const localHeaders = () => ({ 'Content-Type': 'application/json', ...authHeaders() });

  const [activeTab, setActiveTab] = useState<'subscribers' | 'builder' | 'history' | 'compliance'>('subscribers');

  // ── Subscriber state ───────────────────────────────────────────────────────
  const [subscribers, setSubscribers]   = useState<Subscriber[]>([]);
  const [stats, setStats]               = useState<Stats | null>(null);
  const [pagination, setPagination]     = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 0 });
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [filter, setFilter]             = useState<'all' | 'active' | 'unsubscribed'>('all');
  const [search, setSearch]             = useState('');
  const [unsubbing, setUnsubbing]       = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importMsg, setImportMsg]       = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Campaign builder state ─────────────────────────────────────────────────
  const [campaigns, setCampaigns]       = useState<Campaign[]>([]);
  const [campsLoading, setCampsLoading] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Partial<Campaign> | null>(null);
  const [campSaving, setCampSaving]     = useState(false);
  const [campMsg, setCampMsg]           = useState('');
  const [sendingId, setSendingId]       = useState<string | null>(null);
  const [previewCamp, setPreviewCamp]   = useState<Campaign | null>(null);
  const [showBuilder, setShowBuilder]   = useState(false);

  useEffect(() => {
    if (!authLoading && !admin) navigate('/admin/login');
  }, [admin, authLoading, navigate]);

  // ── Fetch subscribers ──────────────────────────────────────────────────────

  const fetchSubscribers = useCallback(async (page = 1) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (filter !== 'all') params.set('status', filter);
      const res = await fetch(`/api/newsletter/subscribers?${params}`, { headers: localHeaders() });
      if (!res.ok) throw new Error('Failed to load subscribers');
      const data = await res.json();
      setSubscribers(data.subscribers ?? []);
      setStats(data.stats ?? null);
      setPagination(data.pagination ?? { page: 1, limit: 50, total: 0, pages: 0 });
    } catch (e) { setError(String(e)); }
    setLoading(false);
  }, [filter]);  

  useEffect(() => { fetchSubscribers(1); }, [fetchSubscribers]);

  // ── Fetch campaigns ────────────────────────────────────────────────────────

  const fetchCampaigns = useCallback(async () => {
    setCampsLoading(true);
    try {
      const res = await fetch('/api/admin/newsletter/campaigns', { headers: localHeaders() });
      if (res.ok) { const d = await res.json(); setCampaigns(d.campaigns ?? []); }
    } catch { /* silent */ }
    setCampsLoading(false);
  }, []);  

  useEffect(() => {
    if (activeTab === 'builder' || activeTab === 'history') fetchCampaigns();
  }, [activeTab, fetchCampaigns]);

  // ── Subscriber actions ─────────────────────────────────────────────────────

  async function handleUnsubscribe(email: string) {
    if (!confirm(`Unsubscribe ${email} from all newsletters?`)) return;
    setUnsubbing(email);
    try {
      await fetch('/api/admin/newsletter/subscribers/unsubscribe', {
        method: 'POST', headers: localHeaders(), body: JSON.stringify({ email }),
      });
      fetchSubscribers(pagination.page);
    } catch { /* silent */ }
    setUnsubbing(null);
  }

  function exportCSV() {
    const rows = [
      ['ID', 'Email', 'Name', 'Status', 'Source', 'Subscribed At', 'Sequence Step'],
      ...subscribers.map(s => [s.id, s.email, s.name ?? '', s.status, s.source ?? '', s.subscribedAt, String(s.sequenceStep ?? 0)]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `cgc-subscribers-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function handleImportCSV(file: File) {
    setImportLoading(true); setImportMsg('');
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
      const emailIdx = headers.indexOf('email');
      const nameIdx  = headers.indexOf('name');
      if (emailIdx < 0) { setImportMsg('❌ CSV must have an "email" column.'); setImportLoading(false); return; }
      const rows = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
        return { email: cols[emailIdx] ?? '', name: nameIdx >= 0 ? cols[nameIdx] : undefined };
      }).filter(r => r.email.includes('@'));
      const res = await fetch('/api/admin/newsletter/subscribers/import', {
        method: 'POST', headers: localHeaders(), body: JSON.stringify({ rows }),
      });
      const d = await res.json();
      setImportMsg(d.ok ? `✅ Imported ${d.imported} subscribers (${d.skipped} skipped).` : `❌ ${d.error}`);
      fetchSubscribers(1);
    } catch (e) { setImportMsg(`❌ ${e}`); }
    setImportLoading(false);
  }

  // ── Campaign actions ───────────────────────────────────────────────────────

  function newCampaign() {
    setEditCampaign({
      name: '', subject: '', body: '',
      segment: { group: 'all' },
      status: 'draft',
    });
    setShowBuilder(true);
    setCampMsg('');
  }

  function editExisting(c: Campaign) {
    setEditCampaign({ ...c });
    setShowBuilder(true);
    setCampMsg('');
  }

  async function saveCampaign(asDraft: boolean) {
    if (!editCampaign?.name || !editCampaign.subject || !editCampaign.body) {
      setCampMsg('❌ Name, subject, and body are required.');
      return;
    }
    setCampSaving(true); setCampMsg('');
    try {
      const isNew = !editCampaign.id;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch('/api/admin/newsletter/campaigns', {
        method, headers: localHeaders(),
        body: JSON.stringify({
          ...editCampaign,
          status: asDraft ? 'draft' : (editCampaign.scheduledAt ? 'scheduled' : 'draft'),
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setCampMsg(asDraft ? '✅ Saved as draft.' : '✅ Campaign saved.');
        setEditCampaign(d.campaign);
        fetchCampaigns();
      } else {
        setCampMsg(`❌ ${d.error}`);
      }
    } catch (e) { setCampMsg(`❌ ${e}`); }
    setCampSaving(false);
  }

  async function sendCampaign(id: string) {
    if (!confirm('Send this campaign now to all selected recipients?')) return;
    setSendingId(id);
    try {
      const res = await fetch('/api/admin/newsletter/campaigns/send', {
        method: 'POST', headers: localHeaders(), body: JSON.stringify({ id }),
      });
      const d = await res.json();
      if (d.ok) {
        setCampMsg(`✅ Campaign sent to ${d.stats?.sent ?? 0} recipients.`);
        fetchCampaigns();
      } else {
        setCampMsg(`❌ ${d.error}`);
      }
    } catch (e) { setCampMsg(`❌ ${e}`); }
    setSendingId(null);
  }

  async function duplicateCampaign(id: string) {
    try {
      const res = await fetch('/api/admin/newsletter/campaigns/duplicate', {
        method: 'POST', headers: localHeaders(), body: JSON.stringify({ id }),
      });
      const d = await res.json();
      if (d.ok) { fetchCampaigns(); editExisting(d.campaign); }
    } catch { /* silent */ }
  }

  function insertVar(v: string) {
    setEditCampaign(c => c ? { ...c, body: (c.body ?? '') + v } : c);
  }

  const filtered = subscribers.filter(s =>
    search ? s.email.toLowerCase().includes(search.toLowerCase()) || (s.name ?? '').toLowerCase().includes(search.toLowerCase()) : true
  );

  if (authLoading) return null;

  return (
    <>
      <Helmet><title>Newsletter — CGC Admin</title><meta name="description" content="Newsletter and subscriber management for City Gate Capital." /><meta name="robots" content="noindex, nofollow" /><link rel="canonical" href="https://citygate.capital/admin/newsletter" /></Helmet>
      <AdminLayout title="Newsletter">
        <div className="space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">Newsletter Management</h1>
              <p className="text-sm text-white/40 mt-0.5">Manage subscribers, campaigns, and email compliance</p>
            </div>
            {activeTab === 'builder' && (
              <button onClick={newCampaign}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
                <Plus size={14} /> New Campaign
              </button>
            )}
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Subscribers', value: stats.total,        icon: Users,       color: '#C9A84C' },
                { label: 'Active',            value: stats.active,       icon: CheckCircle, color: '#10B981' },
                { label: 'Unsubscribed',      value: stats.unsubscribed, icon: XCircle,     color: '#EF4444' },
                { label: 'Campaigns Sent',    value: campaigns.filter(c => c.status === 'sent').length, icon: Send, color: '#627EEA' },
              ].map(card => (
                <div key={card.label} className="rounded-2xl p-5 border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-white/40 font-medium">{card.label}</p>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${card.color}15` }}>
                      <card.icon size={14} style={{ color: card.color }} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {[
              { id: 'subscribers', label: 'Subscribers',       icon: Users },
              { id: 'builder',     label: 'Campaign Builder',  icon: Edit3 },
              { id: 'history',     label: 'Campaign History',  icon: BarChart2 },
              { id: 'compliance',  label: 'Compliance',        icon: Shield },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === t.id
                    ? 'text-black'
                    : 'text-white/40 hover:text-white/70'
                }`}
                style={activeTab === t.id ? { background: 'linear-gradient(135deg, #C9A84C, #F0D080)' } : {}}>
                <t.icon size={13} />
                {t.label}
              </button>
            ))}
          </div>

          {/* ── SUBSCRIBERS TAB ── */}
          {activeTab === 'subscribers' && (
            <div className="space-y-4">
              {/* Actions bar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
                  <Search size={13} className="text-white/25 shrink-0" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search subscribers…"
                    className="bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none flex-1" />
                </div>
                <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {(['all', 'active', 'unsubscribed'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                        filter === f ? 'text-black' : 'text-white/40 hover:text-white/70'
                      }`}
                      style={filter === f ? { background: 'linear-gradient(135deg, #C9A84C, #F0D080)' } : {}}>
                      {f}
                    </button>
                  ))}
                </div>
                <button onClick={exportCSV}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/60 border border-white/10 hover:border-white/20 hover:text-white transition-colors">
                  <Download size={14} /> Export CSV
                </button>
                <button onClick={() => fileRef.current?.click()} disabled={importLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/60 border border-white/10 hover:border-white/20 hover:text-white transition-colors disabled:opacity-50">
                  {importLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Import CSV
                </button>
                <input ref={fileRef} type="file" accept=".csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImportCSV(f); e.target.value = ''; }} />
                <button onClick={() => fetchSubscribers(pagination.page)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white border border-white/8 transition-colors">
                  <RefreshCw size={13} />
                </button>
              </div>

              {importMsg && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
                  importMsg.startsWith('✅') ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-red-400 bg-red-500/10 border border-red-500/20'
                }`}>
                  {importMsg.startsWith('✅') ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  {importMsg}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-red-400 bg-red-500/10 border border-red-500/20">
                  <AlertTriangle size={14} /> {error}
                </div>
              )}

              {/* Table */}
              <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
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
                          {['Email', 'Name', 'Status', 'Source', 'Subscribed', 'Actions'].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-white/25 uppercase tracking-wider">{h}</th>
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
                                sub.status === 'active' ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
                              }`}>
                                {sub.status === 'active' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                                {sub.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-white/40 capitalize">{sub.source ?? '—'}</td>
                            <td className="px-4 py-3 text-white/35 text-xs">{fmtDate(sub.subscribedAt)}</td>
                            <td className="px-4 py-3">
                              {sub.status === 'active' && (
                                <button onClick={() => handleUnsubscribe(sub.email)}
                                  disabled={unsubbing === sub.email}
                                  className="text-xs text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-50 flex items-center gap-1">
                                  {unsubbing === sub.email ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
                                  Unsubscribe
                                </button>
                              )}
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
                      <button onClick={() => fetchSubscribers(pagination.page - 1)} disabled={pagination.page <= 1}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white border border-white/8 disabled:opacity-30 transition-colors">
                        <ChevronLeft size={14} />
                      </button>
                      <span className="flex items-center px-3 text-xs text-white/50">{pagination.page} / {pagination.pages}</span>
                      <button onClick={() => fetchSubscribers(pagination.page + 1)} disabled={pagination.page >= pagination.pages}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white border border-white/8 disabled:opacity-30 transition-colors">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── CAMPAIGN BUILDER TAB ── */}
          {activeTab === 'builder' && (
            <div className="space-y-5">
              {campMsg && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
                  campMsg.startsWith('✅') ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-red-400 bg-red-500/10 border border-red-500/20'
                }`}>
                  {campMsg.startsWith('✅') ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  {campMsg}
                </div>
              )}

              {/* Draft campaigns list */}
              {!showBuilder && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-white/30 uppercase tracking-wider">Draft Campaigns</p>
                  {campsLoading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-primary" /></div>
                  ) : campaigns.filter(c => c.status === 'draft' || c.status === 'scheduled').length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-white/30 rounded-2xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <Edit3 size={32} className="mb-3 opacity-30" />
                      <p className="text-sm mb-4">No draft campaigns. Create your first one.</p>
                      <button onClick={newCampaign}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black"
                        style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
                        <Plus size={14} /> Create Campaign
                      </button>
                    </div>
                  ) : (
                    campaigns.filter(c => c.status === 'draft' || c.status === 'scheduled').map(c => (
                      <div key={c.id} className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-colors" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                            <StatusBadge status={c.status} />
                          </div>
                          <p className="text-xs text-white/40 truncate">{c.subject}</p>
                          <p className="text-[11px] text-white/25 mt-0.5">
                            {RECIPIENT_GROUPS.find(g => g.value === c.segment.group)?.label}
                            {c.scheduledAt && ` · Scheduled: ${fmtDateTime(c.scheduledAt)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => editExisting(c)}
                            className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => setPreviewCamp(c)}
                            className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => sendCampaign(c.id)} disabled={sendingId === c.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-black disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
                            {sendingId === c.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                            Send Now
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Campaign editor */}
              {showBuilder && editCampaign && (
                <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
                    <p className="text-sm font-bold text-white">{editCampaign.id ? 'Edit Campaign' : 'New Campaign'}</p>
                    <button onClick={() => setShowBuilder(false)} className="text-white/40 hover:text-white transition-colors">
                      <XCircle size={16} />
                    </button>
                  </div>
                  <div className="p-5 space-y-5">
                    {/* Name + Subject */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">Campaign Name *</label>
                        <input value={editCampaign.name ?? ''} onChange={e => setEditCampaign(c => c ? { ...c, name: e.target.value } : c)}
                          placeholder="e.g. June Newsletter"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-primary/50 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">Subject Line *</label>
                        <input value={editCampaign.subject ?? ''} onChange={e => setEditCampaign(c => c ? { ...c, subject: e.target.value } : c)}
                          placeholder="e.g. Your June Banking Update"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-primary/50 transition-colors" />
                      </div>
                    </div>

                    {/* Recipient group */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">Recipient Group</label>
                        <select value={editCampaign.segment?.group ?? 'all'}
                          onChange={e => setEditCampaign(c => c ? { ...c, segment: { ...c.segment, group: e.target.value } } : c)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors appearance-none">
                          {RECIPIENT_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">Schedule Send (optional)</label>
                        <input type="datetime-local"
                          value={editCampaign.scheduledAt ? editCampaign.scheduledAt.slice(0, 16) : ''}
                          onChange={e => setEditCampaign(c => c ? { ...c, scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : undefined } : c)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors" />
                      </div>
                    </div>

                    {/* Custom segment */}
                    {editCampaign.segment?.group === 'custom' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border border-white/8 bg-white/[0.02]">
                        <div>
                          <label className="block text-xs text-white/40 mb-1.5 font-medium">Registered After</label>
                          <input type="date" value={editCampaign.segment.registeredAfter ?? ''}
                            onChange={e => setEditCampaign(c => c ? { ...c, segment: { ...c.segment, registeredAfter: e.target.value } as Campaign['segment'] } : c)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50" />
                        </div>
                        <div>
                          <label className="block text-xs text-white/40 mb-1.5 font-medium">Registered Before</label>
                          <input type="date" value={editCampaign.segment.registeredBefore ?? ''}
                            onChange={e => setEditCampaign(c => c ? { ...c, segment: { ...c.segment, registeredBefore: e.target.value } as Campaign['segment'] } : c)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50" />
                        </div>
                        <div>
                          <label className="block text-xs text-white/40 mb-1.5 font-medium">Country</label>
                          <input value={editCampaign.segment.country ?? ''}
                            onChange={e => setEditCampaign(c => c ? { ...c, segment: { ...c.segment, country: e.target.value } as Campaign['segment'] } : c)}
                            placeholder="e.g. nigeria"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-primary/50" />
                        </div>
                      </div>
                    )}

                    {/* Dynamic variables */}
                    <div>
                      <label className="block text-xs text-white/40 mb-2 font-medium uppercase tracking-wider">Insert Dynamic Variable</label>
                      <div className="flex flex-wrap gap-2">
                        {DYNAMIC_VARS.map(v => (
                          <button key={v} onClick={() => insertVar(v)}
                            className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-mono hover:bg-primary/20 transition-colors">
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Body editor */}
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">Email Body (HTML) *</label>
                      <textarea value={editCampaign.body ?? ''} onChange={e => setEditCampaign(c => c ? { ...c, body: e.target.value } : c)}
                        rows={12} placeholder="<p>Dear {user_name},</p><p>Your message here...</p>"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors resize-y" />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-white/6">
                      <button onClick={() => setPreviewCamp(editCampaign as Campaign)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white/60 border border-white/10 hover:border-white/20 hover:text-white transition-colors">
                        <Eye size={14} /> Preview
                      </button>
                      <button onClick={() => saveCampaign(true)} disabled={campSaving}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white/60 border border-white/10 hover:border-white/20 hover:text-white transition-colors disabled:opacity-50">
                        {campSaving ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                        Save Draft
                      </button>
                      {editCampaign.id && (
                        <button onClick={() => sendCampaign(editCampaign.id!)} disabled={sendingId === editCampaign.id}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
                          {sendingId === editCampaign.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                          Send Now
                        </button>
                      )}
                      {!editCampaign.id && (
                        <button onClick={() => saveCampaign(false)} disabled={campSaving}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
                          {campSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                          Save Campaign
                        </button>
                      )}
                      {campMsg && (
                        <span className={`text-sm ${campMsg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>{campMsg}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── CAMPAIGN HISTORY TAB ── */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {campsLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
              ) : campaigns.filter(c => c.status === 'sent' || c.status === 'failed').length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/30 rounded-2xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <BarChart2 size={32} className="mb-3 opacity-30" />
                  <p className="text-sm">No campaigns sent yet.</p>
                </div>
              ) : (
                campaigns.filter(c => c.status === 'sent' || c.status === 'failed').map(c => (
                  <div key={c.id} className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-white truncate">{c.name}</p>
                          <StatusBadge status={c.status} />
                        </div>
                        <p className="text-xs text-white/40 truncate">{c.subject}</p>
                        <p className="text-[11px] text-white/25 mt-0.5">
                          Sent {fmtDateTime(c.sentAt ?? c.createdAt)} · {RECIPIENT_GROUPS.find(g => g.value === c.segment.group)?.label}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setPreviewCamp(c)}
                          className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => duplicateCampaign(c.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/60 border border-white/10 hover:border-white/20 hover:text-white transition-colors">
                          <Copy size={11} /> Duplicate
                        </button>
                      </div>
                    </div>
                    {/* Stats */}
                    <div className="grid grid-cols-3 md:grid-cols-6 divide-x divide-white/5">
                      {[
                        { label: 'Recipients', value: c.stats.totalRecipients.toLocaleString(), color: 'text-white' },
                        { label: 'Sent',       value: c.stats.sent.toLocaleString(),            color: 'text-emerald-400' },
                        { label: 'Failed',     value: c.stats.failed.toLocaleString(),          color: c.stats.failed > 0 ? 'text-red-400' : 'text-white/30' },
                        { label: 'Open Rate',  value: c.stats.openRate === null ? 'Not tracked' : `${c.stats.openRate}%`, color: c.stats.openRate === null ? 'text-white/35' : 'text-blue-400' },
                        { label: 'Click Rate', value: c.stats.clickRate === null ? 'Not tracked' : `${c.stats.clickRate}%`, color: c.stats.clickRate === null ? 'text-white/35' : 'text-purple-400' },
                        { label: 'Unsubs',     value: c.stats.unsubscribes.toLocaleString(),    color: c.stats.unsubscribes > 0 ? 'text-amber-400' : 'text-white/30' },
                      ].map(s => (
                        <div key={s.label} className="px-4 py-3 text-center">
                          <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── COMPLIANCE TAB ── */}
          {activeTab === 'compliance' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={16} className="text-emerald-400" />
                  <p className="text-sm font-bold text-emerald-400">Unsubscribe Compliance</p>
                </div>
                <div className="space-y-3 text-sm text-white/60">
                  <p>All newsletter emails sent through the campaign builder automatically include an unsubscribe link in the footer.</p>
                  <div className="rounded-xl bg-black/30 p-3 font-mono text-xs text-white/50">
                    https://citygate.capital/api/newsletter/unsubscribe?email=&#123;encoded_email&#125;
                  </div>
                  <p>When a user clicks the unsubscribe link:</p>
                  <ul className="space-y-1.5 ml-4">
                    {[
                      'Their status is immediately set to "unsubscribed" in the subscriber list',
                      'A confirmation page is shown: "You have been unsubscribed from City Gate Capital newsletters"',
                      'The unsubscribe is logged in the subscriber list with a timestamp',
                      'Transactional emails (KYC, transfers, security alerts) are NOT affected — they are always sent',
                    ].map(item => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Globe size={16} className="text-primary" />
                  <p className="text-sm font-bold text-white">Transactional vs Marketing Emails</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8">
                        <th className="text-left px-4 py-2 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Email Type</th>
                        <th className="text-left px-4 py-2 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Category</th>
                        <th className="text-left px-4 py-2 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Affected by Unsubscribe?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Welcome Email',          'Transactional', false],
                        ['KYC Approved/Rejected',  'Transactional', false],
                        ['Deposit/Withdrawal',     'Transactional', false],
                        ['Transfer Notifications', 'Transactional', false],
                        ['Password Reset',         'Transactional', false],
                        ['2FA / OTP Code',         'Transactional', false],
                        ['Security Alerts',        'Transactional', false],
                        ['Newsletter Campaigns',   'Marketing',     true],
                        ['Nurture Sequences',      'Marketing',     true],
                      ].map(([name, cat, affected]) => (
                        <tr key={String(name)} className="border-b border-white/[0.04]">
                          <td className="px-4 py-3 text-white/70">{name}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              cat === 'Transactional' ? 'bg-blue-500/15 text-blue-400' : 'bg-amber-500/15 text-amber-400'
                            }`}>{String(cat)}</span>
                          </td>
                          <td className="px-4 py-3">
                            {affected
                              ? <span className="text-xs text-amber-400 flex items-center gap-1"><AlertCircle size={11} /> Yes — respects unsubscribe</span>
                              : <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle size={11} /> No — always sent</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={16} className="text-amber-400" />
                  <p className="text-sm font-bold text-amber-400">Manual Unsubscribe</p>
                </div>
                <p className="text-sm text-white/60 mb-3">
                  To manually unsubscribe a user, go to the <strong className="text-white">Subscribers</strong> tab, find the user, and click the Unsubscribe button. This immediately removes them from all marketing emails.
                </p>
                <p className="text-xs text-white/40">
                  Note: Manual unsubscribes are logged with the admin's action. Users can re-subscribe by signing up again through the newsletter form on the website.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Preview modal */}
        {previewCamp && (
          <PreviewModal
            subject={previewCamp.subject ?? ''}
            body={previewCamp.body ?? ''}
            onClose={() => setPreviewCamp(null)}
          />
        )}
      </AdminLayout>
    </>
  );
}
