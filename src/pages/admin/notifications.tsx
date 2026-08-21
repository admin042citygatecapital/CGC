import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { Helmet } from '@dr.pogodin/react-helmet';
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';

interface Dispatch { id:string; category:string; targetType:string; title:string; reason:string; status:string; recipientCount:number; deliveredCount:number; failedCount:number; createdAt:string }

export default function AdminNotifications() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const idempotencyKey = useRef(crypto.randomUUID());
  const [form, setForm] = useState({ category:'customer', targetType:'customer', userId:'', title:'', message:'', link:'', reason:'', confirmation:'', status:'', country:'', accountTier:'' });
  const load = useCallback(async () => {
    const res = await fetch('/api/admin/notifications', { credentials:'same-origin', headers:authHeaders() });
    if (res.ok) setDispatches((await res.json()).dispatches ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const set = (key:string, value:string) => {
    idempotencyKey.current = crypto.randomUUID();
    setForm(current => ({ ...current, [key]:value }));
  };
  const submit = async () => {
    setBusy(true); setNotice('');
    try {
      const res = await fetch('/api/admin/notifications', {
        method:'POST',
        credentials:'same-origin',
        headers:{ ...authHeaders(), 'Content-Type':'application/json', 'Idempotency-Key':`notification:${idempotencyKey.current}` },
        body:JSON.stringify({ ...form, group:{ status:form.status, country:form.country, accountTier:form.accountTier } }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Notification dispatch failed.');
      setNotice(`Dispatch ${body.dispatchId} completed: ${body.delivered} delivered, ${body.failed} failed.`);
      idempotencyKey.current = crypto.randomUUID();
      setForm(current => ({ ...current, title:'', message:'', link:'', reason:'', confirmation:'' }));
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Dispatch failed.'); }
    finally { setBusy(false); }
  };
  const field = 'w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300/40';
  return <AdminLayout title="Notification Center">
    <Helmet><title>Notification Center — City Gate Capital Admin</title><meta name="robots" content="noindex,nofollow" /></Helmet>
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><Bell className="text-amber-300" /> Notification Center</h1><p className="text-white/40 text-sm mt-1">Controlled customer, security, service, maintenance and support communications.</p></div>
      <section className="rounded-2xl border border-amber-300/15 bg-[#0d0c09] p-5 space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <select className={field} value={form.category} onChange={e=>set('category',e.target.value)}>{['customer','security','maintenance','service','support'].map(v=><option key={v} value={v} className="bg-black">{v}</option>)}</select>
          <select className={field} value={form.targetType} onChange={e=>set('targetType',e.target.value)}>{['customer','group','all'].map(v=><option key={v} value={v} className="bg-black">{v}</option>)}</select>
          {form.targetType === 'customer' ? <input className={field} placeholder="Customer ID" value={form.userId} onChange={e=>set('userId',e.target.value)} /> : <input className={field} placeholder="Confirmation: CONFIRM BULK SEND" value={form.confirmation} onChange={e=>set('confirmation',e.target.value)} />}
        </div>
        {form.targetType === 'group' && <div className="grid md:grid-cols-3 gap-3"><input className={field} placeholder="Status filter" value={form.status} onChange={e=>set('status',e.target.value)} /><input className={field} placeholder="Country filter" value={form.country} onChange={e=>set('country',e.target.value)} /><input className={field} placeholder="Account tier filter" value={form.accountTier} onChange={e=>set('accountTier',e.target.value)} /></div>}
        <input className={field} placeholder="Notification title" maxLength={140} value={form.title} onChange={e=>set('title',e.target.value)} />
        <textarea className={`${field} min-h-28`} placeholder="Message" maxLength={2000} value={form.message} onChange={e=>set('message',e.target.value)} />
        <div className="grid md:grid-cols-2 gap-3"><input className={field} placeholder="Optional customer-safe link" value={form.link} onChange={e=>set('link',e.target.value)} /><input className={field} placeholder="Required operational reason" value={form.reason} onChange={e=>set('reason',e.target.value)} /></div>
        <div className="flex items-center justify-between gap-4"><p className="text-xs text-white/35 flex items-center gap-2"><ShieldCheck size={14}/> Every dispatch is permission checked and written to the immutable audit trail.</p><button disabled={busy} onClick={submit} className="rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50 flex items-center gap-2"><Send size={14}/>{busy?'Sending…':'Send notification'}</button></div>
        {notice && <p className="text-sm text-amber-200">{notice}</p>}
      </section>
      <section className="rounded-2xl border border-white/10 overflow-hidden"><div className="p-4 flex justify-between"><h2 className="font-semibold text-white">Delivery history</h2><button onClick={load} className="text-white/40 hover:text-white"><RefreshCw size={15}/></button></div><div className="divide-y divide-white/5">{dispatches.length===0?<p className="p-5 text-sm text-white/35">No notification dispatches recorded.</p>:dispatches.map(item=><div key={item.id} className="p-4 grid md:grid-cols-[1fr_auto] gap-3"><div><p className="text-white text-sm font-medium">{item.title}</p><p className="text-white/35 text-xs mt-1">{item.category} · {item.targetType} · {item.reason}</p><p className="text-white/25 text-[11px] mt-1">{item.id} · {new Date(item.createdAt).toLocaleString()}</p></div><div className="text-right text-xs"><p className="text-amber-300 uppercase">{item.status}</p><p className="text-white/40 mt-1">{item.deliveredCount}/{item.recipientCount} delivered · {item.failedCount} failed</p></div></div>)}</div></section>
    </div>
  </AdminLayout>;
}
