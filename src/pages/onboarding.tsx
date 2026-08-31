import { Helmet } from '@dr.pogodin/react-helmet';
import { CheckCircle2, FileCheck2, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useCustomerAuth } from '@/lib/customerAuth';

type DocumentKind = 'identity_front' | 'identity_back' | 'proof_of_address' | 'additional';
type KycBundle = {
  case: { id:string; status:string; version:number; customerInstructions?:string|null; requestedEvidenceKinds:DocumentKind[] };
  profile: Record<string, unknown>|null;
  documents: Array<{ id:string; kind:DocumentKind; originalName:string; version:number; byteSize:number; createdAt:string }>;
  provider: { configured:boolean; identityAccepted:boolean; screeningClear:boolean };
};

const labels: Record<string,string> = {
  draft:'Incomplete', submitted:'Submitted', under_review:'Under Review', needs_info:'More Information Required',
  approved:'Identity Review Approved — Final Activation Pending', rejected:'Rejected',
};
const blank = { legalName:'', dateOfBirth:'', nationality:'', residenceCountry:'', addressLine1:'', addressLine2:'', city:'', region:'', postalCode:'', documentType:'passport', issuingCountry:'', documentNumber:'', documentIssuedAt:'', documentExpiresAt:'', informationCertified:false, privacyAcknowledged:false };

export default function OnboardingPage() {
  const { logout } = useCustomerAuth();
  const [bundle,setBundle] = useState<KycBundle|null>(null);
  const [form,setForm] = useState<Record<string, string|boolean>>(blank);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const editable = bundle ? ['draft','needs_info'].includes(bundle.case.status) : false;
  async function load() {
    const response = await fetch('/api/users/onboarding');
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Identity onboarding is unavailable.');
    setBundle(body);
    if (body.profile) setForm(current => ({ ...current, ...body.profile, documentNumber:'' }));
  }
  useEffect(() => { void load().catch(error => setMessage(error.message)); }, []);
  const requiredKinds = useMemo<DocumentKind[]>(() => form.documentType === 'passport' ? ['identity_front','proof_of_address'] : ['identity_front','identity_back','proof_of_address'], [form.documentType]);
  function field(name:string,label:string,type='text',required=true) {
    return <label className="text-sm font-medium">{label}<input name={name} type={type} required={required} disabled={!editable} value={String(form[name] ?? '')} onChange={event=>setForm({...form,[name]:event.target.value})} className="mt-2 block w-full rounded-xl border border-white/10 bg-white/5 p-3 disabled:opacity-60" /></label>;
  }
  async function saveProfile(event:FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/users/onboarding/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      const body = await response.json(); if (!response.ok) throw new Error(body.error); setMessage('Identity profile saved securely.'); await load();
    } catch(error) { setMessage(error instanceof Error ? error.message : 'Profile could not be saved.'); } finally { setBusy(false); }
  }
  async function upload(kind:DocumentKind,file:File|null) {
    if (!file) return; setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/users/onboarding/documents',{method:'POST',headers:{'Content-Type':file.type,'X-KYC-Document-Kind':kind,'X-KYC-File-Name':file.name},body:file});
      const body = await response.json(); if (!response.ok) throw new Error(body.error); setMessage(`${kind.replaceAll('_',' ')} uploaded securely.`); await load();
    } catch(error) { setMessage(error instanceof Error ? error.message : 'Document upload failed.'); } finally { setBusy(false); }
  }
  async function submit() {
    if (!bundle) return; setBusy(true); setMessage('');
    try {
      const key = crypto.randomUUID().replaceAll('-','');
      const response = await fetch('/api/users/onboarding/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({caseVersion:bundle.case.version,idempotencyKey:key})});
      const body = await response.json(); if (!response.ok) throw new Error(body.error); setMessage('Your evidence was submitted once and is now locked for review.'); await load();
    } catch(error) { setMessage(error instanceof Error ? error.message : 'Submission failed.'); } finally { setBusy(false); }
  }
  if (!bundle) return <main className="min-h-screen bg-background p-8 text-foreground"><Loader2 className="animate-spin"/><p className="mt-4">{message}</p></main>;
  const uploaded = new Set(bundle.documents.map(item=>item.kind));
  return <main className="min-h-screen bg-background p-4 text-foreground sm:p-8"><Helmet><title>Secure Identity Onboarding | City Gate Capital</title></Helmet>
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Restricted onboarding session</p><h1 className="mt-2 text-3xl font-bold">Identity and compliance review</h1><p className="mt-2 text-sm text-foreground/55">Financial pages remain locked until provider screening and final SUPER_ADMIN activation are complete.</p></div><button onClick={logout} className="flex gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm"><LogOut size={16}/>Sign out</button></header>
      <section className="rounded-2xl border border-primary/25 bg-primary/[.05] p-5"><div className="flex items-center gap-3"><ShieldCheck className="text-primary"/><div><p className="font-semibold">{labels[bundle.case.status] || bundle.case.status}</p><p className="text-xs text-foreground/55">Case {bundle.case.id} · version {bundle.case.version}</p></div></div>{bundle.case.customerInstructions && <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/[.06] p-4 text-sm"><strong>Reviewer instructions:</strong> {bundle.case.customerInstructions}</div>}</section>
      {editable && <form onSubmit={saveProfile} className="space-y-5 rounded-2xl border border-white/10 p-5"><h2 className="text-xl font-semibold">1. Legal identity and residence</h2><div className="grid gap-4 md:grid-cols-2">{field('legalName','Legal name')}{field('dateOfBirth','Date of birth','date')}{field('nationality','Nationality')}{field('residenceCountry','Country of residence')}{field('addressLine1','Address')}{field('addressLine2','Address line 2','text',false)}{field('city','City')}{field('region','State / region','text',false)}{field('postalCode','Postal code')}
        <label className="text-sm font-medium">Identity document type<select name="documentType" value={String(form.documentType)} onChange={event=>setForm({...form,documentType:event.target.value})} className="mt-2 block w-full rounded-xl border border-white/10 bg-background p-3"><option value="passport">Passport</option><option value="national_id">National ID</option><option value="drivers_license">Driver licence</option><option value="residence_permit">Residence permit</option></select></label>
        {field('issuingCountry','Issuing country')}{field('documentNumber', form.documentNumber ? 'Document number' : 'Document number (enter again to save)')}{field('documentIssuedAt','Issue date','date',false)}{field('documentExpiresAt','Expiry date','date')}</div>
        <label className="flex gap-3 text-sm"><input type="checkbox" checked={Boolean(form.informationCertified)} onChange={e=>setForm({...form,informationCertified:e.target.checked})}/>I certify this information is accurate.</label><label className="flex gap-3 text-sm"><input type="checkbox" checked={Boolean(form.privacyAcknowledged)} onChange={e=>setForm({...form,privacyAcknowledged:e.target.checked})}/>I understand the evidence will be processed for identity and compliance review.</label><button disabled={busy} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Save identity profile</button></form>}
      <section className="space-y-4 rounded-2xl border border-white/10 p-5"><h2 className="text-xl font-semibold">2. Supporting evidence</h2><p className="text-sm text-foreground/55">JPEG, PNG or PDF only, maximum 5 MB. Use synthetic evidence for test accounts—never a real identity document.</p>{[...new Set([...requiredKinds,...bundle.case.requestedEvidenceKinds])].map(kind=><div key={kind} className="flex flex-col justify-between gap-3 rounded-xl bg-white/[.03] p-4 sm:flex-row sm:items-center"><div><p className="font-medium">{kind.replaceAll('_',' ')}</p><p className="text-xs text-foreground/50">{uploaded.has(kind)?'Uploaded and versioned':'Required'}</p></div>{editable && <input aria-label={`Upload ${kind}`} type="file" accept="image/jpeg,image/png,application/pdf" onChange={e=>void upload(kind,e.target.files?.[0]??null)}/>}</div>)}</section>
      {editable && <section className="rounded-2xl border border-white/10 p-5"><h2 className="text-xl font-semibold">3. Review and submit</h2><p className="my-3 text-sm text-foreground/55">Submission is explicit, atomic and idempotent. Evidence is locked while under review.</p><button disabled={busy || requiredKinds.some(kind=>!uploaded.has(kind))} onClick={()=>void submit()} className="w-full rounded-xl bg-emerald-500/20 py-3 font-semibold text-emerald-300 disabled:opacity-40">Submit identity package once</button></section>}
      <Link to="/onboarding/support" className="inline-flex rounded-xl border border-white/10 px-4 py-3 text-sm">Identity verification support</Link>
      {message && <p role="status" className="flex gap-2 rounded-xl border border-white/10 p-4 text-sm"><CheckCircle2 size={17}/>{message}</p>}
      {!bundle.provider.configured && <p className="rounded-xl border border-amber-400/20 p-4 text-sm text-amber-200"><FileCheck2 className="mr-2 inline" size={17}/>Provider verification is not configured. Evidence collection may proceed, but approval and activation remain blocked.</p>}
    </div></main>;
}
