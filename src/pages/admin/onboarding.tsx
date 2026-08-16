import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders, useAdminAuth } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import { CheckCircle2, Clock, FileCheck2, Loader2, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type Status = 'draft' | 'submitted' | 'under_review' | 'needs_info' | 'approved' | 'rejected' | 'expired';
type CaseRow = { id: string; userId: string; caseType: 'individual' | 'business'; status: Status; version: number; submittedBy?: string; lastEditedBy: string; updatedAt: string; queuePosition?: number|null; intakePosition?: number|null };
type ProviderEvent = { id: string; providerCode: string; providerRef: string; kind: 'identity'|'kyb'|'screening'; status: string; screening?: { sanctions: string; pep: string; adverseMedia: string }; receivedAt: string };
type CustomerDecision = { id: string; name: string; email: string; status: string; emailVerified: boolean; kycStatus: string; amlStatus: string; amlRiskLevel: string; kycApprovedAt?: string; kycReviewedBy?: string; amlReviewedAt?: string; amlNextReviewAt?: string; approvedBy?: string; amlReviewedBy?: string };
type Bundle = { case: CaseRow; evidence: Array<{ id: string; kind: string; referenceType: string; reference: string; sha256?: string }>; events: Array<{ id: string; action: string; actorId: string; createdAt: string; fromStatus?: string; toStatus?: string }>; providerVerifications: { events: ProviderEvent[]; checks: { identityAccepted: boolean; kybAccepted: boolean; screeningClear: boolean } }; customer: CustomerDecision | null };
type ComplianceCase = { id: string; kind: 'aml' | 'sanctions'; status: string; riskLevel: string; summary: string; openedBy: string; lastEditedBy: string };
type ScreeningQueueItem = { caseId: string; userId: string; caseType: string; screeningStatus: string; lastScreenedAt?: string; nextScreeningAt?: string; due: boolean };
type ProgrammeControl = { key: string; label: string; domain: string; status: 'implemented'|'provider_required'|'governance_required'|'jurisdiction_decision_required'; jurisdiction: 'global'|'US'|'UK'; description: string; activationEffect: 'NONE' };
type ProgrammeState = { launchJurisdiction: 'UNDECIDED'; liveIdentityProviderConnected: false; liveScreeningProviderConnected: false; filingsEnabled: false; financialActivationEffect: 'NONE' };
type MonitoringLink = { id:string; transactionId:string; transactionReference:string; amountMinor:string; asset:string; occurredAt:string; snapshotSha256:string };
type MonitoringEvent = { id:string; action:string; actorId:string; actorType:string; fromStatus?:string; toStatus:string; rationale:string; createdAt:string };
type MonitoringAlert = { id:string; reference:string; ruleKey:string; status:string; riskLevel:string; subjectReference:string; summary:string; transactionCount:number; aggregateAmountMinor:string; asset:string; caseId?:string; proposedResolution?:string; submittedBy?:string; submittedAt?:string; links:MonitoringLink[]; events:MonitoringEvent[] };

export default function AdminOnboardingPage() {
  const { admin } = useAdminAuth();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [selected, setSelected] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complianceCases, setComplianceCases] = useState<ComplianceCase[]>([]);
  const [caseSummary, setCaseSummary] = useState('');
  const [caseKind, setCaseKind] = useState<'aml' | 'sanctions'>('aml');
  const [screeningQueue, setScreeningQueue] = useState<ScreeningQueueItem[]>([]);
  const [controls, setControls] = useState<ProgrammeControl[]>([]);
  const [programme, setProgramme] = useState<ProgrammeState | null>(null);
  const [monitoringAlerts, setMonitoringAlerts] = useState<MonitoringAlert[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [response, screeningResponse, monitoringResponse] = await Promise.all([
      fetch('/api/admin/onboarding', { headers: authHeaders() }),
      fetch('/api/admin/onboarding/screening', { headers: authHeaders() }),
      fetch('/api/admin/onboarding/monitoring', { headers: authHeaders() }),
    ]);
    const body = await response.json();
    const screeningBody = await screeningResponse.json();
    const monitoringBody = await monitoringResponse.json();
    setCases(body.data ?? []); setControls(body.controls ?? []); setProgramme(body.programme ?? null); setScreeningQueue(screeningBody.data ?? []); setMonitoringAlerts(monitoringBody.data ?? []); setLoading(false);
  }, []);
  useEffect(() => { if (admin) void load(); }, [admin, load]);

  async function openCase(id: string) {
    const response = await fetch(`/api/admin/onboarding?caseId=${encodeURIComponent(id)}`, { headers: authHeaders() });
    const next = await response.json(); setSelected(next); setReason(''); setError('');
    const casesResponse = await fetch(`/api/admin/onboarding/compliance-cases?userId=${encodeURIComponent(next.case.userId)}`, { headers: authHeaders() });
    setComplianceCases((await casesResponse.json()).data ?? []);
  }
  async function openComplianceCase() {
    if (!selected || caseSummary.trim().length < 10) { setError('A case summary of at least 10 characters is required.'); return; }
    const response = await fetch('/api/admin/onboarding/compliance-cases', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: selected.case.userId, kind: caseKind, riskLevel: 'unrated', summary: caseSummary }) });
    const body = await response.json(); if (!response.ok) setError(body.error ?? 'Unable to open case.'); else { setCaseSummary(''); await openCase(selected.case.id); }
  }
  async function transitionCompliance(record: ComplianceCase, status: string) {
    const rationale = window.prompt(`Enter the required rationale to mark this ${record.kind} case ${status}:`)?.trim() ?? '';
    if (rationale.length < 10) { setError('A rationale of at least 10 characters is required.'); return; }
    const response = await fetch('/api/admin/onboarding/compliance-cases', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: record.id, status, riskLevel: record.riskLevel, reason: rationale }) });
    const body = await response.json(); if (!response.ok) setError(body.error ?? 'Case update failed.'); else if (selected) await openCase(selected.case.id);
  }
  async function decide(decision: Status) {
    if (!selected) return;
    setBusy(true); setError('');
    const response = await fetch('/api/admin/onboarding/review', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: selected.case.id, decision, reason }) });
    const body = await response.json();
    if (!response.ok) setError(body.error ?? 'Review failed.');
    else { await load(); await openCase(selected.case.id); }
    setBusy(false);
  }
  async function finalDecision(action: 'approve' | 'reject') {
    if (!selected?.customer || admin?.role !== 'SUPER_ADMIN') return;
    const label = action === 'approve' ? 'final registration approval' : 'terminal application denial';
    const rationale = window.prompt(`Enter the required rationale for ${label}:`)?.trim() ?? '';
    if (rationale.length < 10) { setError('A rationale of at least 10 characters is required.'); return; }
    if (action === 'reject' && !window.confirm('Deny this application? This terminal decision will be audited.')) return;
    setBusy(true); setError('');
    const response = await fetch(`/api/admin/users/${action}`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: selected.customer.id, reason: rationale }) });
    const body = await response.json();
    if (!response.ok) setError(body.error ?? 'Final decision failed.');
    else { await load(); await openCase(selected.case.id); }
    setBusy(false);
  }
  async function monitoringAction(action:'scan_velocity'|'start_review'|'escalate'|'submit_resolution', alertId?:string) {
    const rationale = action === 'scan_velocity' ? '' : window.prompt(action === 'submit_resolution' ? 'Enter the proposed resolution for independent review:' : 'Enter the required monitoring rationale:')?.trim() ?? '';
    if (action !== 'scan_velocity' && rationale.length < 10) { setError('A monitoring rationale of at least 10 characters is required.'); return; }
    setBusy(true); setError('');
    const response = await fetch('/api/admin/onboarding/monitoring', { method:'POST', headers:{...authHeaders(),'Content-Type':'application/json'}, body:JSON.stringify({action,alertId,rationale}) });
    const body=await response.json(); if(!response.ok)setError(body.error??'Monitoring action failed.'); await load(); setBusy(false);
  }

  return <AdminLayout>
    <Helmet><title>Customer Onboarding | City Gate Capital Admin</title></Helmet>
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Customer Onboarding</h1><p className="text-sm text-foreground/50">KYC/KYB evidence, maker-checker review and immutable case history.</p></div><button onClick={() => void load()} className="p-2 rounded-lg border border-white/10"><RefreshCw size={16}/></button></div>
      <section className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div><h2 className="font-semibold text-amber-100">Onboarding and compliance programme register</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-amber-100/55">Global controls and jurisdiction-specific obligations are separated deliberately. This register cannot approve identity, clear screening, file a regulatory report or enable financial operations.</p></div>
          <div className="flex flex-wrap gap-2 text-[10px] font-bold tracking-wider"><span className="rounded-full border border-amber-400/20 px-3 py-1.5 text-amber-300">JURISDICTION {programme?.launchJurisdiction ?? 'UNDECIDED'}</span><span className="rounded-full border border-red-400/20 px-3 py-1.5 text-red-300">PROVIDERS DISCONNECTED</span><span className="rounded-full border border-white/10 px-3 py-1.5 text-white/40">ACTIVATION NONE</span></div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{controls.map(control => {
          const style = control.status === 'implemented' ? 'border-emerald-400/15 bg-emerald-400/[0.035] text-emerald-300' : control.status === 'jurisdiction_decision_required' ? 'border-red-400/15 bg-red-400/[0.035] text-red-300' : 'border-sky-400/15 bg-sky-400/[0.035] text-sky-300';
          return <article key={control.key} className={`rounded-xl border p-4 ${style}`}><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold text-white/80">{control.label}</h3><span className="shrink-0 rounded-full border border-current/20 px-2 py-1 text-[9px] font-bold uppercase">{control.jurisdiction}</span></div><p className="mt-2 text-[11px] leading-5 text-white/40">{control.description}</p><p className="mt-3 text-[9px] font-bold uppercase tracking-wider">{control.status.replaceAll('_',' ')}</p></article>;
        })}</div>
      </section>
      <section className="rounded-2xl border border-white/10 p-4">
        <div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold">Ongoing sanctions, PEP and adverse-media screening</h2><p className="text-xs text-foreground/45 mt-1">Signed approved-provider results only. Matches automatically open a compliance case; administrators cannot manufacture a clear result.</p></div><span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs text-amber-300">{screeningQueue.filter(item => item.due).length} due</span></div>
        {screeningQueue.length > 0 && <div className="mt-3 grid md:grid-cols-2 xl:grid-cols-3 gap-2">{screeningQueue.slice(0, 6).map(item => <button key={item.caseId} onClick={() => void openCase(item.caseId)} className="rounded-xl bg-white/5 p-3 text-left text-xs"><div className="flex justify-between"><span className="font-semibold">{item.userId}</span><span className={item.screeningStatus === 'clear' ? 'text-emerald-300' : 'text-amber-300'}>{item.screeningStatus}</span></div><p className="mt-1 text-foreground/40">Next: {item.nextScreeningAt ? new Date(item.nextScreeningAt).toLocaleDateString() : 'not scheduled'}</p></button>)}</div>}
      </section>
      <section className="rounded-2xl border border-violet-400/15 bg-violet-400/[0.025] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-semibold">Synthetic transaction-monitoring queue</h2><p className="mt-1 text-xs leading-5 text-foreground/45">Deterministic velocity rules inspect only simulation transactions. Linked snapshots are hashed and immutable; this queue cannot change balances or file SAR/CTR reports.</p></div><button disabled={busy} onClick={()=>void monitoringAction('scan_velocity')} className="rounded-lg border border-violet-300/20 bg-violet-300/10 px-3 py-2 text-xs font-semibold text-violet-200 disabled:opacity-40">Run synthetic velocity scan</button></div>
        {monitoringAlerts.length===0?<p className="py-8 text-center text-sm text-foreground/35">No synthetic monitoring alerts. Create at least three same-source sandbox transactions, then run the scan.</p>:<div className="mt-4 space-y-3">{monitoringAlerts.map(alert=><article key={alert.id} className="rounded-xl border border-white/[0.07] bg-black/20 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold text-white/80">{alert.reference}</span><span className="rounded-full bg-white/5 px-2 py-1 text-[9px] font-bold uppercase text-white/45">{alert.status.replaceAll('_',' ')}</span><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${['high','critical'].includes(alert.riskLevel)?'bg-red-400/10 text-red-300':'bg-amber-400/10 text-amber-300'}`}>{alert.riskLevel}</span></div><p className="mt-2 text-xs text-white/45">{alert.summary}</p><p className="mt-1 font-mono text-[10px] text-white/25">{alert.subjectReference} · {alert.ruleKey} {alert.caseId?`· ${alert.caseId}`:''}</p></div><div className="text-left lg:text-right"><p className="font-semibold text-white/70">{alert.transactionCount} linked · {alert.aggregateAmountMinor} {alert.asset} minor units</p><p className="mt-1 text-[10px] text-white/30">SIMULATION ONLY</p></div></div><details className="mt-3"><summary className="cursor-pointer text-xs text-violet-200/70">Linked transactions and immutable history</summary><div className="mt-3 grid gap-3 lg:grid-cols-2"><div className="space-y-2">{alert.links.map(link=><div key={link.id} className="rounded-lg bg-white/[0.035] p-2 text-[10px]"><div className="flex justify-between gap-2"><span className="font-mono text-white/60">{link.transactionReference}</span><span>{link.amountMinor} {link.asset}</span></div><p className="mt-1 break-all font-mono text-white/25">SHA-256 {link.snapshotSha256}</p></div>)}</div><div className="space-y-2">{alert.events.map(event=><div key={event.id} className="rounded-lg bg-white/[0.035] p-2 text-[10px]"><p className="text-white/60">{event.action} · {event.fromStatus??'created'} → {event.toStatus}</p><p className="mt-1 text-white/35">{event.rationale}</p><p className="mt-1 font-mono text-white/20">{event.actorType}:{event.actorId}</p></div>)}</div></div></details><div className="mt-3 flex flex-wrap gap-2">{alert.status==='new'&&<button disabled={busy} onClick={()=>void monitoringAction('start_review',alert.id)} className="rounded-lg bg-sky-400/10 px-3 py-2 text-xs text-sky-300">Start review</button>}{['new','reviewing'].includes(alert.status)&&<button disabled={busy} onClick={()=>void monitoringAction('escalate',alert.id)} className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-300">Escalate case</button>}{['reviewing','escalated'].includes(alert.status)&&<button disabled={busy} onClick={()=>void monitoringAction('submit_resolution',alert.id)} className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">Submit resolution to checker</button>}{alert.status==='resolution_pending'&&<span className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/40">Awaiting isolated independent checker</span>}</div></article>)}</div>}
      </section>
      <section className="rounded-2xl border border-primary/15 bg-primary/[0.025] p-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Registration intake and review queues</h2><p className="mt-1 text-xs text-foreground/45">Every successful registration enters the persistent intake immediately. Submitted cases then receive a separate compliance-review position.</p></div><div className="flex gap-2"><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-foreground/55">{cases.filter(item=>item.intakePosition).length} active</span><span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">{cases.filter(item=>item.queuePosition).length} in review</span></div></div></section>
      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-5">
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin"/></div> : cases.length === 0 ? <div className="p-8 text-sm text-foreground/45">No onboarding cases yet.</div> : cases.map(item => <button key={item.id} onClick={() => void openCase(item.id)} className="w-full text-left p-4 border-b border-white/8 hover:bg-white/5">
            <div className="flex justify-between gap-3"><span className="font-semibold">{item.userId}</span><span className="text-xs uppercase text-primary">{item.intakePosition ? `Intake #${item.intakePosition} · ` : ''}{item.queuePosition ? `Review #${item.queuePosition} · ` : ''}{item.status.replace('_',' ')}</span></div>
            <div className="text-xs text-foreground/40 mt-1">{item.caseType} · version {item.version} · {new Date(item.updatedAt).toLocaleString()}</div>
          </button>)}
        </div>
        <div className="rounded-2xl border border-white/10 p-5">
          {!selected ? <div className="h-full min-h-64 flex items-center justify-center text-foreground/40"><FileCheck2 className="mr-2"/> Select a case</div> : <div className="space-y-5">
            <div><h2 className="font-bold text-lg">Case {selected.case.id}</h2><p className="text-xs text-foreground/45">Submitter: {selected.case.submittedBy ?? 'not submitted'} · Last editor: {selected.case.lastEditedBy}</p></div>
            {selected.customer && <section className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">Final registration control</h3><p className="text-xs text-foreground/45">{selected.customer.name} · {selected.customer.email}</p></div><span className="rounded-full bg-white/5 px-2 py-1 text-xs uppercase">{selected.customer.status.replace('_',' ')}</span></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">{[
                ['Email', selected.customer.emailVerified, selected.customer.emailVerified ? 'verified' : 'pending'],
                ['KYC', selected.customer.kycStatus === 'approved', selected.customer.kycStatus],
                ['AML', selected.customer.amlStatus === 'cleared', selected.customer.amlStatus],
                ['Final approval', selected.customer.status === 'active', selected.customer.status === 'active' ? 'approved' : 'required'],
              ].map(([label, passed, value]) => <div key={String(label)} className={`rounded-lg p-2 ${passed ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}><div className="font-semibold">{String(label)}</div><div className="uppercase mt-1">{String(value)}</div></div>)}</div>
              <div className="rounded-lg bg-white/[0.03] p-3 text-[11px] text-foreground/45 space-y-1"><p>KYC reviewer: {selected.customer.kycReviewedBy ?? 'not recorded'}</p><p>AML reviewer: {selected.customer.amlReviewedBy ?? 'not recorded'}</p></div>
              <p className="text-xs text-foreground/45">The signed provider checks are the independent maker; the sole super-administrator is the accountable checker. Final approval revalidates provider evidence and activates only the platform profile.</p>
              {admin?.role === 'SUPER_ADMIN' && selected.customer.status !== 'active' && selected.customer.status !== 'rejected' && <div className="flex flex-wrap gap-2"><button disabled={busy || !selected.customer.emailVerified || selected.customer.kycStatus !== 'approved' || selected.customer.amlStatus !== 'cleared' || !selected.customer.kycReviewedBy || !selected.customer.amlReviewedBy} onClick={()=>void finalDecision('approve')} className="px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 disabled:opacity-35 flex gap-1"><CheckCircle2 size={15}/>Approve registration</button><button disabled={busy} onClick={()=>void finalDecision('reject')} className="px-3 py-2 rounded-lg bg-red-500/15 text-red-300 flex gap-1"><XCircle size={15}/>Deny application</button></div>}
            </section>}
            <section><h3 className="text-xs font-bold uppercase text-foreground/50 mb-2">Evidence metadata</h3>{selected.evidence.map(e => <div key={e.id} className="rounded-xl bg-white/5 p-3 mb-2 text-sm"><div className="font-semibold">{e.kind} · {e.referenceType}</div><div className="text-xs text-foreground/45 break-all">{e.reference}</div>{e.sha256 && <div className="text-[10px] font-mono text-foreground/35 break-all">SHA-256 {e.sha256}</div>}</div>)}</section>
            <section><h3 className="text-xs font-bold uppercase text-foreground/50 mb-2">Signed provider verification</h3><div className="grid grid-cols-3 gap-2 mb-3">{[
              ['Identity', selected.case.caseType === 'business' ? selected.providerVerifications.checks.kybAccepted : selected.providerVerifications.checks.identityAccepted],
              ['Screening', selected.providerVerifications.checks.screeningClear],
              ['Maker-checker', selected.case.submittedBy !== admin?.id && selected.case.lastEditedBy !== admin?.id],
            ].map(([label, passed]) => <div key={String(label)} className={`rounded-lg p-2 text-xs ${passed ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}>{passed ? '✓' : '○'} {String(label)}</div>)}</div>{selected.providerVerifications.events.length === 0 ? <p className="text-xs text-foreground/40">No signed provider events received.</p> : selected.providerVerifications.events.map(event => <div key={event.id} className="rounded-xl bg-white/5 p-3 mb-2 text-xs"><div className="flex justify-between gap-2"><span className="font-semibold uppercase">{event.providerCode} · {event.kind}</span><span className={event.status === 'accepted' ? 'text-emerald-300' : 'text-amber-300'}>{event.status}</span></div><p className="text-foreground/40 font-mono mt-1 break-all">{event.providerRef}</p>{event.screening && <p className="text-foreground/45 mt-1">Sanctions {event.screening.sanctions} · PEP {event.screening.pep} · Adverse media {event.screening.adverseMedia}</p>}</div>)}</section>
            <section><h3 className="text-xs font-bold uppercase text-foreground/50 mb-2">Immutable history</h3>{selected.events.map(e => <div key={e.id} className="flex gap-2 text-xs py-2 border-b border-white/5"><Clock size={12}/><span>{new Date(e.createdAt).toLocaleString()} · {e.action} · {e.actorId}</span></div>)}</section>
            <section className="space-y-2"><h3 className="text-xs font-bold uppercase text-foreground/50">AML and sanctions cases</h3>{complianceCases.map(item=><div key={item.id} className="rounded-xl bg-white/5 p-3"><div className="flex justify-between text-sm"><span className="font-semibold uppercase">{item.kind}</span><span>{item.status}</span></div><p className="text-xs text-foreground/45 my-2">{item.summary}</p>{!['cleared','blocked'].includes(item.status)&&<div className="flex gap-2"><button onClick={()=>void transitionCompliance(item,'escalated')} className="text-xs text-amber-300">Escalate</button><button onClick={()=>void transitionCompliance(item,'cleared')} className="text-xs text-emerald-300">Clear</button><button onClick={()=>void transitionCompliance(item,'blocked')} className="text-xs text-red-300">Block</button></div>}</div>)}<div className="grid grid-cols-[auto_1fr_auto] gap-2"><select value={caseKind} onChange={e=>setCaseKind(e.target.value as 'aml'|'sanctions')} className="bg-white/5 border border-white/10 rounded-lg p-2 text-sm"><option value="aml">AML</option><option value="sanctions">Sanctions</option></select><input value={caseSummary} onChange={e=>setCaseSummary(e.target.value)} placeholder="Case summary" className="bg-white/5 border border-white/10 rounded-lg p-2 text-sm"/><button onClick={()=>void openComplianceCase()} className="px-3 rounded-lg bg-primary/20 text-primary text-sm">Open</button></div></section>
            {['submitted','under_review','needs_info'].includes(selected.case.status) && <section className="space-y-3"><textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Required review rationale (minimum 10 characters)" className="w-full min-h-24 rounded-xl bg-white/5 border border-white/10 p-3 text-sm"/>{error && <p className="text-sm text-red-400 flex gap-2"><ShieldAlert size={15}/>{error}</p>}<div className="flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void decide('under_review')} className="px-3 py-2 rounded-lg bg-blue-500/15 text-blue-300">Start review</button><button disabled={busy} onClick={()=>void decide('needs_info')} className="px-3 py-2 rounded-lg bg-amber-500/15 text-amber-300">Request information</button><button disabled={busy} onClick={()=>void decide('approved')} className="px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 flex gap-1"><CheckCircle2 size={15}/>Approve</button><button disabled={busy} onClick={()=>void decide('rejected')} className="px-3 py-2 rounded-lg bg-red-500/15 text-red-300 flex gap-1"><XCircle size={15}/>Reject</button></div></section>}
          </div>}
        </div>
      </div>
    </div>
  </AdminLayout>;
}
