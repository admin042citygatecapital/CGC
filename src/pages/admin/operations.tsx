import { Helmet } from '@dr.pogodin/react-helmet';
import { AlertTriangle, CheckCircle2, Clock3, Inbox, RefreshCw, Search, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';

type Status = 'new' | 'in_review' | 'waiting_customer' | 'approved' | 'rejected' | 'resolved' | 'archived';
type Priority = 'low' | 'normal' | 'high' | 'urgent';
interface Item {
  id: string; source: string; referenceId: string; title: string; summary: string;
  requesterName?: string; requesterEmail?: string; userId?: string; status: Status; priority: Priority;
  assignedTo?: string; adminNotes: Array<{ id: string; text: string; author: string; at: string }>;
  metadata: Record<string, string | number | boolean>; createdAt: string; updatedAt: string;
}
interface Stats { total: number; new: number; inReview: number; urgent: number; open: number }

const labels: Record<string, string> = {
  account_application: 'Account application', contact_form: 'Contact form', card_request: 'Card request',
  newsletter_signup: 'Newsletter signup', support_ticket: 'Support ticket',
};
const statuses: Status[] = ['new', 'in_review', 'waiting_customer', 'approved', 'rejected', 'resolved', 'archived'];
const priorities: Priority[] = ['low', 'normal', 'high', 'urgent'];

function Chip({ value, kind }: { value: string; kind: 'status' | 'priority' }) {
  const danger = value === 'urgent' || value === 'rejected';
  const success = value === 'approved' || value === 'resolved';
  return <span className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-1 ${danger ? 'bg-red-500/15 text-red-300' : success ? 'bg-emerald-500/15 text-emerald-300' : kind === 'priority' && value === 'high' ? 'bg-amber-500/15 text-amber-300' : 'bg-white/[0.06] text-white/50'}`}>{value.replaceAll('_', ' ')}</span>;
}

export default function AdminOperations() {
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, new: 0, inReview: 0, urgent: 0, open: 0 });
  const [selected, setSelected] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const statCards: Array<[string, number, LucideIcon]> = [
    ['Open', stats.open, Inbox], ['New', stats.new, Clock3],
    ['In review', stats.inReview, CheckCircle2], ['Urgent', stats.urgent, AlertTriangle],
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: '100' });
    if (search) qs.set('search', search);
    if (status) qs.set('status', status);
    if (source) qs.set('source', source);
    try {
      const response = await fetch(`/api/admin/operations?${qs}`, { headers: authHeaders() });
      if (response.ok) { const body = await response.json(); setItems(body.data ?? []); setStats(body.stats ?? stats); }
    } finally { setLoading(false); }
  }, [search, status, source]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);

  async function update(changes: Partial<Pick<Item, 'status' | 'priority' | 'assignedTo'>> & { note?: string }) {
    if (!selected) return;
    setSaving(true);
    try {
      const response = await fetch('/api/admin/operations', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, ...changes }) });
      if (response.ok) { const body = await response.json(); setSelected(body.item); setNote(''); await load(); }
    } finally { setSaving(false); }
  }

  return <>
    <Helmet><title>Operations Inbox — CGC Admin</title><meta name="robots" content="noindex,nofollow" /></Helmet>
    <AdminLayout title="Operations Inbox">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div><h1 className="text-white text-xl font-bold">Operations Inbox</h1><p className="text-white/30 text-sm">Every customer submission in one controlled queue</p></div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/60 text-sm"><RefreshCw size={13}/> Refresh</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {statCards.map(([label, value, Icon]) => <div key={label} className="rounded-2xl border border-white/5 bg-white/[0.025] p-4"><div className="flex items-center justify-between"><div><p className="text-white/30 text-xs">{label}</p><p className="text-white text-2xl font-bold mt-1">{value}</p></div><Icon size={20} className={label === 'Urgent' ? 'text-red-400' : 'text-primary'}/></div></div>)}
      </div>
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 min-w-64"><Search size={13} className="text-white/25"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search inbox..." className="bg-transparent text-sm text-white outline-none flex-1"/></div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="bg-[#111] border border-white/8 rounded-xl px-3 text-sm text-white/60"><option value="">All statuses</option>{statuses.map(v => <option key={v} value={v}>{v.replaceAll('_',' ')}</option>)}</select>
        <select value={source} onChange={e => setSource(e.target.value)} className="bg-[#111] border border-white/8 rounded-xl px-3 text-sm text-white/60"><option value="">All sources</option>{Object.entries(labels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>
      <div className="rounded-2xl border border-white/5 overflow-x-auto bg-white/[0.02]">
        <table className="w-full text-sm"><thead><tr className="border-b border-white/5">{['Submission','Customer','Status','Priority','Owner','Updated'].map(h => <th key={h} className="text-left px-4 py-3 text-white/25 text-[10px] uppercase">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-white/[0.03]">{loading ? <tr><td colSpan={6} className="p-12 text-center text-white/30">Loading inbox…</td></tr> : items.length === 0 ? <tr><td colSpan={6} className="p-12 text-center text-white/30">No matching submissions</td></tr> : items.map(item => <tr key={item.id} onClick={() => setSelected(item)} className="hover:bg-white/[0.03] cursor-pointer"><td className="px-4 py-3"><p className="text-white font-medium">{item.title}</p><p className="text-white/25 text-[10px]">{labels[item.source] ?? item.source} · {item.referenceId}</p></td><td className="px-4 py-3"><p className="text-white/60">{item.requesterName || '—'}</p><p className="text-white/25 text-[10px]">{item.requesterEmail}</p></td><td className="px-4 py-3"><Chip value={item.status} kind="status"/></td><td className="px-4 py-3"><Chip value={item.priority} kind="priority"/></td><td className="px-4 py-3 text-white/40">{item.assignedTo || 'Unassigned'}</td><td className="px-4 py-3 text-white/30 whitespace-nowrap">{new Date(item.updatedAt).toLocaleDateString()}</td></tr>)}</tbody>
        </table>
      </div>
      {selected && <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setSelected(null)}><div className="w-full max-w-md h-full overflow-y-auto bg-[#0b0b0b] border-l border-white/10 p-6 space-y-5" onClick={e => e.stopPropagation()}><div className="flex justify-between"><div><p className="text-primary text-xs uppercase">{labels[selected.source]}</p><h2 className="text-white font-bold text-lg">{selected.title}</h2></div><button onClick={() => setSelected(null)}><X className="text-white/40" size={18}/></button></div><p className="text-white/60 text-sm whitespace-pre-wrap">{selected.summary}</p>
        <div className="grid grid-cols-2 gap-3"><label className="text-white/30 text-xs">Status<select value={selected.status} disabled={saving} onChange={e => update({status:e.target.value as Status})} className="mt-1 w-full bg-[#151515] border border-white/10 rounded-lg p-2 text-white">{statuses.map(v=><option key={v}>{v}</option>)}</select></label><label className="text-white/30 text-xs">Priority<select value={selected.priority} disabled={saving} onChange={e => update({priority:e.target.value as Priority})} className="mt-1 w-full bg-[#151515] border border-white/10 rounded-lg p-2 text-white">{priorities.map(v=><option key={v}>{v}</option>)}</select></label></div>
        <label className="text-white/30 text-xs">Assigned owner<input defaultValue={selected.assignedTo} onBlur={e => update({assignedTo:e.target.value})} className="mt-1 w-full bg-[#151515] border border-white/10 rounded-lg p-2 text-white" placeholder="Team member or department"/></label>
        <div><p className="text-white/30 text-xs mb-2">Internal notes</p>{selected.adminNotes.map(n=><div key={n.id} className="mb-2 rounded-lg bg-white/[0.04] p-3"><p className="text-white/70 text-sm">{n.text}</p><p className="text-white/20 text-[10px] mt-1">{n.author} · {new Date(n.at).toLocaleString()}</p></div>)}<textarea value={note} onChange={e=>setNote(e.target.value)} className="w-full bg-[#151515] border border-white/10 rounded-lg p-3 text-white text-sm" placeholder="Add an internal note"/><button disabled={!note.trim()||saving} onClick={()=>update({note})} className="mt-2 w-full rounded-lg bg-primary text-black font-bold py-2 disabled:opacity-40">Add note</button></div>
        <div className="border-t border-white/5 pt-4 text-xs text-white/30 space-y-1"><p>Reference: {selected.referenceId}</p><p>Created: {new Date(selected.createdAt).toLocaleString()}</p>{Object.entries(selected.metadata).map(([k,v])=><p key={k}>{k}: {String(v)}</p>)}</div>
      </div></div>}
    </AdminLayout>
  </>;
}
