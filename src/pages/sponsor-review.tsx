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
  submittedAt: string | null;
}

interface ReviewQueue {
  reviewer: { id: string };
  queue: {
    evidence: ReviewEvidence[];
    package: { id: string; version: string; status: string; label: string; submittedAt: string | null; reviewable: boolean };
    summary: { submittedEvidence: number; approvedControls: number; totalControls: number; outstandingControls: number };
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

  async function decide(target: 'evidence' | 'package', decision: 'approved' | 'rejected', evidenceId?: string) {
    const note = target === 'evidence' ? notes[evidenceId ?? ''] ?? '' : packageNote;
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
        body: JSON.stringify({ target, decision, evidenceId, note: note.trim() }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'The review decision could not be recorded.');
      setNotice(`${target === 'package' ? 'Package' : 'Evidence'} ${decision}. The immutable review history has been updated.`);
      if (evidenceId) setNotes(current => ({ ...current, [evidenceId]: '' }));
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
              ['Approved controls', `${queue.queue.summary.approvedControls}/${queue.queue.summary.totalControls}`],
              ['Outstanding gates', queue.queue.summary.outstandingControls],
              ['Package', queue.queue.package.status],
            ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><p className="text-[11px] uppercase tracking-wide text-white/30">{label}</p><p className="mt-1 break-words text-lg font-bold">{value}</p></div>)}
          </section>

          <div className="flex justify-end"><button disabled={busy} onClick={() => void load(credential)} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Refresh queue</button></div>

          <section>
            <div className="mb-3 flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-amber-300" /><h2 className="text-lg font-semibold">Submitted evidence</h2></div>
            {queue.queue.evidence.length === 0 ? <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 text-center text-sm text-white/35">No evidence is currently awaiting independent review.</div> : <div className="space-y-4">{queue.queue.evidence.map(item => <article key={item.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row"><div><p className="font-semibold">{item.controlTitle}</p><p className="mt-1 font-mono text-[11px] text-white/30">{item.controlKey} · {item.category.replaceAll('_', ' ')} · Phase {item.phase ?? '—'}</p></div><span className="h-fit rounded-full border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 text-[10px] uppercase text-sky-200">submitted</span></div>
              <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                <div><dt className="text-white/30">Controlled reference</dt><dd className="mt-1 break-all text-white/65">{item.reference}</dd></div>
                <div><dt className="text-white/30">SHA-256</dt><dd className="mt-1 break-all font-mono text-white/65">{item.sha256 ?? 'Missing'}</dd></div>
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
