import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Database, Mail, RefreshCw, Server, Shield } from 'lucide-react';
import { Helmet } from '@dr.pogodin/react-helmet';
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';

type Health = Record<string, any>;

export default function AdminSystem() {
  const [health, setHealth] = useState<Health|null>(null);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setMessage('');
    try {
      const h = await fetch('/api/admin/health',{credentials:'same-origin',headers:authHeaders()});
      if (!h.ok) throw new Error('System diagnostics are unavailable.');
      setHealth(await h.json());
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Diagnostics failed.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(()=>{void refresh();},[refresh]);
  const changeMaintenance = async () => {
    setLoading(true); setMessage('');
    try {
      const res = await fetch('/api/admin/config',{method:'POST',credentials:'same-origin',headers:{...authHeaders(),'Content-Type':'application/json'},body:JSON.stringify({section:'maintenanceMode',data:{enabled,message:'Scheduled service maintenance is in progress.'},reason,confirmation})});
      const body=await res.json(); if(!res.ok) throw new Error(body.error??'Maintenance control failed.');
      setMessage(`Maintenance mode ${enabled?'enabled':'disabled'} and audited.`); setReason(''); setConfirmation('');
    } catch(error){setMessage(error instanceof Error?error.message:'Maintenance control failed.');} finally{setLoading(false);}
  };
  const card='rounded-2xl border border-white/10 bg-white/[0.025] p-4';
  const status=(value:boolean)=><span className={`flex items-center gap-1 text-xs ${value?'text-emerald-300':'text-red-300'}`}>{value?<CheckCircle2 size={13}/>:<AlertTriangle size={13}/>} {value?'Operational':'Attention required'}</span>;
  return <AdminLayout title="System Operations">
    <Helmet><title>System Operations — City Gate Capital Admin</title><meta name="robots" content="noindex,nofollow"/></Helmet>
    <div className="space-y-6"><div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><Activity className="text-amber-300"/>System Operations</h1><p className="text-white/40 text-sm mt-1">Read-only service diagnostics and controlled operational actions. No shell or raw secrets are exposed.</p></div><button onClick={refresh} className="rounded-xl border border-white/10 p-2.5 text-white/40 hover:text-white"><RefreshCw size={16} className={loading?'animate-spin':''}/></button></div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className={card}><Database className="text-amber-300 mb-3" size={18}/><p className="text-white font-medium">PostgreSQL</p><p className="text-white/35 text-xs mt-1">Latency {health?.database?.latencyMs??'—'} ms</p><div className="mt-3">{status(Boolean(health?.database?.ok))}</div></div>
        <div className={card}><Mail className="text-amber-300 mb-3" size={18}/><p className="text-white font-medium">Email delivery</p><p className="text-white/35 text-xs mt-1">{health?.email?.provider??'Unavailable'}</p><div className="mt-3">{status(Boolean(health?.email?.configured))}</div></div>
        <div className={card}><Server className="text-amber-300 mb-3" size={18}/><p className="text-white font-medium">Application runtime</p><p className="text-white/35 text-xs mt-1">{health?.runtime?.nodeVersion??'—'} · {health?.uptime?.human??'—'}</p><div className="mt-3">{status(health?.status==='ok')}</div></div>
        <div className={card}><Shield className="text-amber-300 mb-3" size={18}/><p className="text-white font-medium">Protected configuration</p><p className="text-white/35 text-xs mt-1">Validated privately at startup</p><div className="mt-3">{status(health?.status==='ok')}</div></div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <section className={card}><h2 className="text-white font-semibold">Runtime details</h2><div className="mt-4 space-y-2 text-sm text-white/45">{[['Environment',health?.environment],['Active admin sessions',health?.runtime?.activeAdminSessions],['Active customer sessions',health?.runtime?.activeCustomerSessions],['Heap usage',`${health?.memory?.heapUsedMb??'—'} / ${health?.memory?.heapTotalMb??'—'} MB`],['Tracked records',health?.storage?.trackedRecords]].map(([k,v])=><div key={String(k)} className="flex justify-between border-b border-white/5 pb-2"><span>{k}</span><span className="text-white/70">{String(v??'—')}</span></div>)}</div></section>
        <section className={card}><h2 className="text-white font-semibold">Controlled maintenance mode</h2><p className="text-white/35 text-xs mt-1">This customer-impacting action requires a reason, exact confirmation and immutable audit entries.</p><label className="mt-4 flex gap-3 items-center text-sm text-white/70"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Enable maintenance mode</label><input className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" placeholder="Operational reason" value={reason} onChange={e=>setReason(e.target.value)}/><input className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" placeholder="CONFIRM MAINTENANCE MODE" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/><button disabled={loading} onClick={changeMaintenance} className="mt-3 rounded-xl bg-amber-300 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">Apply controlled change</button></section>
      </div>{message&&<p className="text-sm text-amber-200">{message}</p>}
    </div>
  </AdminLayout>;
}
