import { Helmet } from '@dr.pogodin/react-helmet';
import {
  CheckCircle2, FileCheck2, KeyRound, Loader2, LockKeyhole,
  LogOut, RefreshCw, ShieldCheck, XCircle,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import CgcLogo from '@/components/CgcLogo';

interface ReviewEvidence {
  id: string;
  controlKey: string;
  controlTitle: string;
  category: string;
  phase: number | null;
  title: string;
  status: 'submitted';
  referenceType: 'url' | 'internal';
  reference: string;
  sha256: string | null;
  owner: string;
  issuedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  revision: number;
  submittedRevision: number;
  evidenceClass: 'internal_design' | 'external_authority' | 'operating_evidence';
  externalIssuer: string | null;
  authorityType: string | null;
  receivedAt: string | null;
  submittedAt: string | null;
}
interface ReviewLegalEntity { id: string; legalName: string; jurisdiction: string; registrationNumber: string; legalForm: string; registryUrl: string; registrySha256: string | null; authorityType: string | null; authorityReference: string | null; authoritySha256: string | null; authorizedOfficerRef: string | null; authorityIssuedAt: string | null; authorityExpiresAt: string | null; expiresAt: string | null; submittedAt: string | null; status: 'submitted'; }
interface ReviewOwner { id: string; controllerRef: string; ownershipBand: string; controlNature: string; providerCode: string; providerRef: string; evidenceSha256: string | null; expiresAt: string | null; submittedAt: string | null; status: 'submitted'; }
interface MonitoringReview { id:string; reference:string; ruleKey:string; riskLevel:string; subjectReference:string; summary:string; transactionCount:number; aggregateAmountMinor:string; asset:string; caseId:string|null; proposedResolution:string; submittedBy:string; submittedAt:string; linkedTransactions:Array<{transactionId:string;transactionReference:string;amountMinor:string;asset:string;occurredAt:string;snapshotSha256:string}> }
interface ReconciliationReview { id:string; status:string; owner?:string; proposedResolution?:string; submittedBy?:string; submittedAt?:string; ageingDays:number; outcome:string; severity:string; transactionReference?:string; providerInstructionId?:string; asset?:string; amountMinor?:string; snapshotSha256:string }

interface ReviewQueue {
  reviewer: { id: string };
  queue: {
    reconciliationExceptions: ReconciliationReview[];
    monitoringAlerts: MonitoringReview[];
    evidence: ReviewEvidence[];
    legalEntity: ReviewLegalEntity | null;
    beneficialOwners: ReviewOwner[];
    package: { id: string; version: string; status: string; label: string; submittedAt: string | null; reviewable: boolean };
    summary: { submittedEvidence: number; submittedStructuredRecords: number; approvedControls: number; totalControls: number; outstandingControls: number };
    gaps: Array<{ key: string; title: string; status: string }>;
  };
  financialOperationsLocked: true;
}

function readableDate(value: string | null): string {
  if (!value) return 'Not supplied';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
}

export default function SponsorReviewPage() {
  // The credential deliberately lives only in component memory. It is never
  // placed in browser storage, a URL, a cookie or an administration session.
  const [credential, setCredential] = useState('');
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [packageNote, setPackageNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (key = credential) => {
    if (!key) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/sponsor-readiness/external-review', {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store',
        headers: { 'x-sponsor-reviewer-key': key },
      });
      const body = await response.json() as ReviewQueue & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Independent reviewer authentication failed.');
      setQueue(body);
    } catch (cause) {
      setQueue(null);
      setError(cause instanceof Error ? cause.message : 'Unable to load the independent review queue.');
    } finally {
      setBusy(false);
    }
  }, [credential]);

  async function decide(target: 'evidence' | 'legal_entity' | 'beneficial_owner' | 'monitoring_alert' | 'reconciliation_exception' | 'package', decision: 'approved' | 'rejected', recordId?: string, monitoringDecision?:'false_positive'|'case', reconciliationDecision?:'resolved'|'accepted_risk') {
    const note = target === 'package' ? packageNote : notes[recordId ?? target] ?? '';
    if (note.trim().length < 10) {
      setError('Enter a review note of at least 10 characters before recording a decision.');
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/sponsor-readiness/external-review', {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json', 'x-sponsor-reviewer-key': credential },
        body: JSON.stringify({ target, decision, evidenceId: target === 'evidence' ? recordId : undefined, recordId: target === 'beneficial_owner' ? recordId : undefined, alertId: target === 'monitoring_alert' ? recordId : undefined, exceptionId: target === 'reconciliation_exception' ? recordId : undefined, monitoringDecision, reconciliationDecision, note: note.trim() }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'The review decision could not be recorded.');
      setNotice(`${target === 'package' ? 'Package' : target === 'legal_entity' ? 'Legal entity' : target === 'beneficial_owner' ? 'Controller record' : target === 'monitoring_alert' ? 'Monitoring alert' : target === 'reconciliation_exception' ? 'Reconciliation exception' : 'Evidence'} ${target === 'monitoring_alert' ? monitoringDecision : target === 'reconciliation_exception' ? reconciliationDecision : decision}. The immutable review history has been updated.`);
      if (recordId || target === 'legal_entity') setNotes(current => ({ ...current, [recordId ?? target]: '' }));
      else setPackageNote('');
      await load(credential);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The review decision could not be recorded.');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setCredential('');
    setQueue(null);
    setNotes({});
    setPackageNote('');
    setError('');
    setNotice('');
  }

  return <>
    <Helmet>
      <title>Independent Sponsor Review — City Gate Capital</title>
      <meta name="robots" content="noindex, nofollow, noarchive" />
      <meta name="referrer" content="no-referrer" />
    </Helmet>
    <main className="min-h-screen bg-[#050505] text-white p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4 border-b border-amber-300/15 pb-5">
          <CgcLogo size={52} withWordmark glow />
          {queue && <button onClick={logout} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 hover:text-white"><LogOut className="h-4 w-4" />Clear access</button>}
        </header>

        <section className="py-8">
          <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold"><ShieldCheck className="h-5 w-5" />Independent sponsor checker</div>
          <h1 className="mt-2 text-3xl font-bold">Evidence review workspace</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/45">This isolated workspace shows only submitted sponsor-control metadata. It cannot create an administration session, edit evidence, access customer information or enable financial services.</p>
          <div className="mt-5 flex gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4"><LockKeyhole className="h-5 w-5 shrink-0 text-red-300" /><div><p className="text-sm font-semibold text-red-200">Financial operations remain locked</p><p className="mt-1 text-xs text-red-200/60">Evidence decisions never activate payments, balances, FX, cards, crypto, custody or provider adapters.</p></div></div>
        </section>

        {error && <div role="alert" className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
        {notice && <div role="status" className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</div>}

        {!queue ? <section className="mx-auto max-w-lg rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-8">
          <div className="flex items-center gap-3"><div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3"><KeyRound className="h-5 w-5 text-amber-300" /></div><div><h2 className="font-semibold">Reviewer access</h2><p className="mt-1 text-xs text-white/35">Use the credential issued directly to the independent checker.</p></div></div>
          <form className="mt-6" onSubmit={event => { event.preventDefault(); void load(credential); }}>
            <label htmlFor="reviewer-credential" className="text-xs uppercase tracking-wider text-white/40">Independent reviewer credential</label>
            <input id="reviewer-credential" type="password" autoComplete="off" required maxLength={512} value={credential} onChange={event => setCredential(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-300/40" />
            <button disabled={busy || !credential} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-3 text-sm font-bold text-black disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Open submitted queue</button>
          </form>
          <p className="mt-4 text-[11px] leading-relaxed text-white/25">The credential is sent only in an encrypted request header and remains in memory until this page is closed or access is cleared.</p>
        </section> : <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Submitted queue', queue.queue.summary.submittedEvidence],
              ['Entity/owner queue', queue.queue.summary.submittedStructuredRecords],
              ['Approved controls', `${queue.queue.summary.approvedControls}/${queue.queue.summary.totalControls}`],
              ['Outstanding gates', queue.queue.summary.outstandingControls],
              ['Package', queue.queue.package.status],
            ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><p className="text-[11px] uppercase tracking-wide text-white/30">{label}</p><p className="mt-1 break-words text-lg font-bold">{value}</p></div>)}
          </section>

          <div className="flex justify-end"><button disabled={busy} onClick={() => void load(credential)} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Refresh queue</button></div>

          <section>
            <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#D8B85A]" /><h2 className="text-lg font-semibold">Reconciliation exception approvals</h2></div>
            {queue.queue.reconciliationExceptions.length===0?<div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 text-center text-sm text-white/35">No reconciliation exceptions are awaiting checker approval.</div>:<div className="space-y-4">{queue.queue.reconciliationExceptions.map(item=><article key={item.id} className="rounded-2xl border border-[#C9A84C]/15 bg-[#C9A84C]/[0.025] p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><p className="font-semibold capitalize">{item.outcome.replaceAll('_',' ')}</p><p className="mt-1 text-xs text-white/35">{item.severity} · {item.transactionReference??item.providerInstructionId??item.id} · ageing {item.ageingDays} day(s)</p></div><span className="h-fit rounded-full border border-blue-300/20 px-2.5 py-1 text-[10px] uppercase text-blue-200">resolution pending</span></div><div className="mt-3 rounded-xl bg-black/25 p-3 text-xs"><p className="text-white/30">Maker proposal</p><p className="mt-1 text-white/65">{item.proposedResolution}</p><p className="mt-2 font-mono text-white/25">Submitted by {item.submittedBy} · {readableDate(item.submittedAt??null)}</p></div><p className="mt-3 break-all font-mono text-[10px] text-white/25">SHA-256 {item.snapshotSha256}</p><label className="mt-4 block text-xs text-white/40">Independent checker rationale<textarea rows={3} value={notes[item.id]??''} onChange={event=>setNotes(current=>({...current,[item.id]:event.target.value}))} maxLength={1000} className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 p-3 text-sm text-white"/></label><div className="mt-3 flex gap-2"><button disabled={busy} onClick={()=>void decide('reconciliation_exception','approved',item.id,undefined,'resolved')} className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300">Approve resolution</button><button disabled={busy} onClick={()=>void decide('reconciliation_exception','approved',item.id,undefined,'accepted_risk')} className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-300">Accept documented risk</button></div></article>)}</div>}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-violet-300" /><h2 className="text-lg font-semibold">Synthetic monitoring resolutions</h2></div>
            {queue.queue.monitoringAlerts.length===0?<div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 text-center text-sm text-white/35">No synthetic alerts are awaiting independent resolution.</div>:<div className="space-y-4">{queue.queue.monitoringAlerts.map(item=><article key={item.id} className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.025] p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><p className="font-mono font-semibold">{item.reference}</p><p className="mt-1 text-xs text-white/35">{item.ruleKey} · {item.riskLevel} · {item.subjectReference}</p></div><span className="h-fit rounded-full border border-violet-300/20 px-2.5 py-1 text-[10px] uppercase text-violet-200">resolution pending</span></div><p className="mt-3 text-sm text-white/55">{item.summary}</p><div className="mt-3 rounded-xl bg-black/25 p-3 text-xs"><p className="text-white/30">Maker proposal</p><p className="mt-1 text-white/65">{item.proposedResolution}</p><p className="mt-2 font-mono text-white/25">Submitted by {item.submittedBy} · {readableDate(item.submittedAt)}</p></div><div className="mt-3 space-y-2">{item.linkedTransactions.map(link=><div key={link.transactionId} className="rounded-lg border border-white/[0.06] p-2 text-[10px]"><div className="flex justify-between gap-2"><span className="font-mono text-white/60">{link.transactionReference}</span><span>{link.amountMinor} {link.asset}</span></div><p className="mt-1 break-all font-mono text-white/25">SHA-256 {link.snapshotSha256}</p></div>)}</div><label className="mt-4 block text-xs text-white/40">Independent resolution rationale<textarea rows={3} value={notes[item.id]??''} onChange={event=>setNotes(current=>({...current,[item.id]:event.target.value}))} maxLength={1000} className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 p-3 text-sm text-white"/></label><div className="mt-3 flex gap-2"><button disabled={busy} onClick={()=>void decide('monitoring_alert','approved',item.id,'false_positive')} className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300">Close false positive</button><button disabled={busy} onClick={()=>void decide('monitoring_alert','approved',item.id,'case')} className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-300">Confirm case</button></div></article>)}</div>}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-300" /><h2 className="text-lg font-semibold">Submitted legal authority records</h2></div>
            {!queue.queue.legalEntity && queue.queue.beneficialOwners.length === 0 ? <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 text-center text-sm text-white/35">No legal-entity or controller records are awaiting independent review.</div> : <div className="space-y-4">
              {queue.queue.legalEntity && <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"><div className="flex justify-between gap-3"><div><p className="font-semibold">{queue.queue.legalEntity.legalName}</p><p className="mt-1 text-xs text-white/35">{queue.queue.legalEntity.registrationNumber} · {queue.queue.legalEntity.jurisdiction} · {queue.queue.legalEntity.legalForm}</p></div><span className="h-fit rounded-full border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 text-[10px] uppercase text-sky-200">submitted</span></div><dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-white/30">Official registry</dt><dd className="mt-1 break-all text-white/65">{queue.queue.legalEntity.registryUrl}</dd></div><div><dt className="text-white/30">Registry SHA-256</dt><dd className="mt-1 break-all font-mono text-white/65">{queue.queue.legalEntity.registrySha256 ?? 'Missing'}</dd></div><div><dt className="text-white/30">Authority type · controlled reference</dt><dd className="mt-1 break-all text-white/65">{queue.queue.legalEntity.authorityType ?? 'Missing'} · {queue.queue.legalEntity.authorityReference ?? 'Missing'}</dd></div><div><dt className="text-white/30">Authority SHA-256</dt><dd className="mt-1 break-all font-mono text-white/65">{queue.queue.legalEntity.authoritySha256 ?? 'Missing'}</dd></div><div><dt className="text-white/30">Authorised officer reference</dt><dd className="mt-1 break-all font-mono text-white/65">{queue.queue.legalEntity.authorizedOfficerRef ?? 'Missing'}</dd></div><div><dt className="text-white/30">Authority dates</dt><dd className="mt-1 text-white/65">Issued {readableDate(queue.queue.legalEntity.authorityIssuedAt)} · expires {readableDate(queue.queue.legalEntity.authorityExpiresAt)}</dd></div></dl><div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs leading-relaxed text-amber-100/60">Confirm both the public registry record and the separate signing-authority evidence. A matching company name or number alone must be rejected.</div><label className="mt-4 block text-xs text-white/40">Independent review note<textarea rows={3} value={notes.legal_entity ?? ''} onChange={event => setNotes(current => ({ ...current, legal_entity: event.target.value }))} maxLength={1000} className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 p-3 text-sm text-white" /></label><div className="mt-3 flex gap-2"><button disabled={busy} onClick={() => void decide('legal_entity','approved')} className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300">Verify entity and authority</button><button disabled={busy} onClick={() => void decide('legal_entity','rejected')} className="rounded-lg bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-300">Reject entity</button></div></article>}
              {queue.queue.beneficialOwners.map(item => <article key={item.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"><div className="flex justify-between gap-3"><div><p className="font-mono font-semibold">{item.controllerRef}</p><p className="mt-1 text-xs text-white/35">{item.ownershipBand}% · {item.controlNature} · {item.providerCode}:{item.providerRef}</p></div><span className="h-fit rounded-full border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 text-[10px] uppercase text-sky-200">submitted</span></div><p className="mt-3 break-all font-mono text-xs text-white/45">SHA-256: {item.evidenceSha256 ?? 'Missing'}</p><label className="mt-4 block text-xs text-white/40">Independent review note<textarea rows={3} value={notes[item.id] ?? ''} onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))} maxLength={1000} className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 p-3 text-sm text-white" /></label><div className="mt-3 flex gap-2"><button disabled={busy} onClick={() => void decide('beneficial_owner','approved',item.id)} className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300">Verify controller</button><button disabled={busy} onClick={() => void decide('beneficial_owner','rejected',item.id)} className="rounded-lg bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-300">Reject controller</button></div></article>)}
            </div>}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-amber-300" /><h2 className="text-lg font-semibold">Submitted evidence</h2></div>
            {queue.queue.evidence.length === 0 ? <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 text-center text-sm text-white/35">No evidence is currently awaiting independent review.</div> : <div className="space-y-4">{queue.queue.evidence.map(item => <article key={item.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row"><div><p className="font-semibold">{item.controlTitle}</p><p className="mt-1 font-mono text-[11px] text-white/30">{item.controlKey} · {item.category.replaceAll('_', ' ')} · Phase {item.phase ?? '—'}</p></div><span className="h-fit rounded-full border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 text-[10px] uppercase text-sky-200">submitted</span></div>
              <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                <div><dt className="text-white/30">Controlled reference</dt><dd className="mt-1 break-all text-white/65">{item.reference}</dd></div>
                <div><dt className="text-white/30">SHA-256</dt><dd className="mt-1 break-all font-mono text-white/65">{item.sha256 ?? 'Missing'}</dd></div>
                <div><dt className="text-white/30">Immutable revision</dt><dd className="mt-1 text-white/65">v{item.revision} · submitted v{item.submittedRevision}</dd></div>
                <div><dt className="text-white/30">Evidence class</dt><dd className="mt-1 text-white/65">{item.evidenceClass.replaceAll('_', ' ')}</dd></div>
                {item.evidenceClass === 'external_authority' && <><div><dt className="text-white/30">External issuer</dt><dd className="mt-1 text-white/65">{item.externalIssuer}</dd></div><div><dt className="text-white/30">Authority type</dt><dd className="mt-1 break-all font-mono text-white/65">{item.authorityType}</dd></div><div><dt className="text-white/30">Received</dt><dd className="mt-1 text-white/65">{readableDate(item.receivedAt)}</dd></div></>}
                <div><dt className="text-white/30">Evidence owner</dt><dd className="mt-1 text-white/65">{item.owner}</dd></div>
                <div><dt className="text-white/30">Submitted</dt><dd className="mt-1 text-white/65">{readableDate(item.submittedAt)}</dd></div>
                <div><dt className="text-white/30">Issued</dt><dd className="mt-1 text-white/65">{readableDate(item.issuedAt)}</dd></div>
                <div><dt className="text-white/30">Expires</dt><dd className="mt-1 text-white/65">{readableDate(item.expiresAt)}</dd></div>
              </dl>
              {item.notes && <div className="mt-4 rounded-xl bg-black/25 p-3 text-xs leading-relaxed text-white/45">{item.notes}</div>}
              <label className="mt-4 block text-xs text-white/40">Independent review note<textarea rows={3} value={notes[item.id] ?? ''} onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))} maxLength={1000} className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 p-3 text-sm text-white outline-none focus:border-amber-300/40" /></label>
              <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void decide('evidence', 'approved', item.id)} className="flex items-center gap-2 rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />Approve evidence</button><button disabled={busy} onClick={() => void decide('evidence', 'rejected', item.id)} className="flex items-center gap-2 rounded-lg bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-300 disabled:opacity-40"><XCircle className="h-4 w-4" />Reject evidence</button></div>
            </article>)}</div>}
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
            <div className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-amber-300" /><div><h2 className="font-semibold">Final package</h2><p className="mt-1 text-xs text-white/40">{queue.queue.package.label} · Version {queue.queue.package.version}</p></div></div>
            {queue.queue.package.reviewable ? <><label className="mt-4 block text-xs text-white/40">Package review note<textarea rows={3} value={packageNote} onChange={event => setPackageNote(event.target.value)} maxLength={1000} className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 p-3 text-sm text-white outline-none focus:border-amber-300/40" /></label><div className="mt-3 flex gap-2"><button disabled={busy} onClick={() => void decide('package', 'approved')} className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-40">Approve package</button><button disabled={busy} onClick={() => void decide('package', 'rejected')} className="rounded-lg bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-300 disabled:opacity-40">Reject package</button></div></> : <p className="mt-4 text-xs text-white/35">The package is not submitted for final independent review. All required controls must first carry current approvals.</p>}
          </section>
        </div>}
      </div>
    </main>
  </>;
}
