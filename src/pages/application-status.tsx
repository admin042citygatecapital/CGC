/**
 * /application/status — the applicant's own application tracker.
 * Server-enforced ownership; never exposes other applicants' data.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { CheckCircle2, Circle, Loader2, Wrench } from 'lucide-react';
import { ACCOUNT_TYPE_META, APPLICATION_FLOWS, ACCOUNT_TYPE_SLUGS, type AccountType } from '../shared/applicationFlow';

interface ApplicationSummary {
  id: string; reference: string | null; accountType: string; selectedPlan: string | null;
  status: string; currentStep: string; completionPct: number;
  steps: Record<string, Record<string, unknown>>;
  decision: string | null; decisionReason: string | null; informationRequest: string | null;
  updatedAt: string;
}

interface KycStatus {
  kyc: { id: string; status: string; riskLevel: string; provider: { name: string; status: string } | null; reviewReason: string | null } | null;
  documents: Array<{ id: string; documentType: string; issuingCountry?: string | null; originalName: string | null; createdAt: string }>;
}

const KYC_DOCUMENT_TYPES = ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'RESIDENCE_PERMIT'] as const;
const OPEN_KYC_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'IN_PROGRESS', 'DRAFT'];
const KYC_NEXT_ACTION: Record<string, string> = {
  SUBMITTED: 'Your documents are queued for review. Add any missing identity documents below.',
  UNDER_REVIEW: 'A reviewer is checking your case. No action is needed unless we contact you.',
  NEEDS_INFORMATION: 'We asked for more information — upload the requested documents below and watch your email.',
  APPROVED: 'Identity verification is complete. Service activation is handled by our operations team.',
  REJECTED: 'This application was not approved. See the reason above.',
  EXPIRED: 'This review expired — contact support to restart verification.',
};


const STATUS_COPY: Record<string, string> = {
  APPLICATION_STARTED: 'Application started — complete the steps below.',
  EMAIL_VERIFICATION_REQUIRED: 'Verify your email address to continue.',
  EMAIL_VERIFIED: 'Email verified — continue your application.',
  INFORMATION_INCOMPLETE: 'Some information is missing — review your steps.',
  REVIEW_REQUIRED: 'Submitted — our team is reviewing your application.',
  NEEDS_INFORMATION: 'We need more information from you (see below).',
  APPROVED: 'Approved — pending operational activation.',
  REJECTED: 'Not approved — see the reason below.',
  ACTIVATION_PENDING: 'Approved and queued for service activation.',
};

export default function ApplicationStatusPage() {
  const [apps, setApps] = useState<ApplicationSummary[] | null>(null);
  const [kycByApp, setKycByApp] = useState<Record<string, KycStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [upload, setUpload] = useState<{ appId: string; documentType: string; issuingCountry: string; file: File | null }>({ appId: '', documentType: 'PASSPORT', issuingCountry: '', file: null });
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const loadKyc = useCallback(async (id: string) => {
    const r = await fetch(`/api/kyc/status?applicationId=${encodeURIComponent(id)}`, { credentials: 'include' });
    if (r.ok) {
      const j = await r.json() as KycStatus;
      setKycByApp(m => ({ ...m, [id]: j }));
    }
  }, []);

  const uploadDocument = useCallback(async (appId: string) => {
    if (!upload.file) return;
    setUploadBusy(true);
    setUploadMessage(null);
    try {
      const body = new FormData();
      body.set('applicationId', appId);
      body.set('documentType', upload.documentType);
      if (upload.issuingCountry.trim()) body.set('issuingCountry', upload.issuingCountry.trim());
      body.set('document', upload.file);
      const r = await fetch('/api/kyc/documents', { method: 'POST', credentials: 'include', body });
      const j = await r.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (r.ok && j.ok) {
        setUploadMessage({ ok: true, text: 'Document uploaded securely for review.' });
        setUpload(u => ({ ...u, appId: appId, file: null }));
        void loadKyc(appId);
      } else {
        setUploadMessage({ ok: false, text: j.error ?? 'Upload failed.' });
      }
    } catch {
      setUploadMessage({ ok: false, text: 'Network error — upload failed.' });
    } finally {
      setUploadBusy(false);
    }
  }, [upload, loadKyc]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/applications', { credentials: 'include' });
        if (r.status === 401) { setError('Sign in to view your applications.'); return; }
        if (!r.ok) { setError('Could not load your applications.'); return; }
        const j = await r.json() as { applications: ApplicationSummary[] };
        setApps(j.applications);
        j.applications.filter(a => ['REVIEW_REQUIRED', 'APPROVED', 'NEEDS_INFORMATION', 'ACTIVATION_PENDING'].includes(a.status)).forEach(a => void loadKyc(a.id));
      } catch {
        setError('Network error — try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadKyc]);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Helmet><title>Application Status — City Gate Capital</title></Helmet>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold">Your applications</h1>
        <p className="mt-1 text-sm text-[#a9a9b2]">Only you can see this page. Approval of an application is separate from the activation of regulated financial services.</p>

        {loading && <div className="mt-10 flex items-center gap-2 text-[#a9a9b2]"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>}
        {error && (
          <div className="mt-8 rounded-xl border border-[#2a2a2e] bg-[#0d0d11] p-6 text-sm text-[#a9a9b2]">
            {error} <Link to="/login" className="ml-1 text-[#E6C76A] underline">Sign in</Link>
          </div>
        )}
        {apps && apps.length === 0 && (
          <div className="mt-8 rounded-xl border border-[#2a2a2e] bg-[#0d0d11] p-6 text-sm text-[#a9a9b2]">
            No applications yet. <Link to="/register" className="ml-1 text-[#E6C76A] underline">Choose an account type</Link> to begin.
          </div>
        )}

        <div className="mt-6 space-y-5">
          {apps?.map(app => {
            const meta = ACCOUNT_TYPE_META[app.accountType as AccountType];
            const flow = APPLICATION_FLOWS[app.accountType as AccountType] ?? [];
            const kyc = kycByApp[app.id]?.kyc ?? null;
            const docs = kycByApp[app.id]?.documents ?? [];
            return (
              <section key={app.id} className="rounded-2xl border border-[#2a2a2e] bg-[#0d0d11] p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{meta?.label ?? app.accountType} {app.selectedPlan ? `· ${app.selectedPlan}` : ''}</h2>
                    {app.reference && <p className="text-xs text-[#6b6b74]">Reference {app.reference}</p>}
                  </div>
                  <span className="rounded-full bg-[#E6C76A]/15 px-3 py-1 text-xs font-medium text-[#E6C76A]">
                    {app.status.replaceAll('_', ' ')}
                  </span>
                </div>

                <p className="mt-3 text-sm text-[#c8c8cf]">{STATUS_COPY[app.status] ?? app.status}</p>

                {app.informationRequest && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                    <Wrench className="mt-0.5 h-4 w-4 shrink-0" /> {app.informationRequest}
                  </p>
                )}
                {app.decisionReason && app.status === 'REJECTED' && (
                  <p className="mt-3 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-200">Reason: {app.decisionReason}</p>
                )}

                <div className="mt-4 h-1.5 rounded-full bg-[#1c1c22]">
                  <div className="h-full rounded-full bg-[#E6C76A]" style={{ width: `${app.completionPct}%` }} />
                </div>

                <div className="mt-4 grid gap-1.5 text-sm sm:grid-cols-2">
                  {flow.map(s => (
                      <div key={s.id} className="flex items-center gap-2 text-[#a9a9b2]">
                        {app.steps[s.id] ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4 text-[#3a3a42]" />}
                        {s.title}
                      </div>
                  ))}
                </div>

                {kyc && (
                  <div className="mt-4 rounded-xl bg-[#101014] p-4 text-sm">
                    <p className="font-medium">KYC review: <span className="text-[#E6C76A]">{kyc.status.replaceAll('_', ' ')}</span></p>
                    {kyc.provider && <p className="mt-1 text-xs text-[#a9a9b2]">Provider: {kyc.provider.name} — {kyc.provider.status ?? 'pending'}</p>}
                    {docs.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-[#a9a9b2]">
                        {docs.map(d => (
                          <li key={d.id}>• {d.documentType.replaceAll('_', ' ')}{d.issuingCountry ? ` (${d.issuingCountry})` : ''} — {d.originalName ?? 'document'}</li>
                        ))}
                      </ul>
                    )}
                    {KYC_NEXT_ACTION[kyc.status] && (
                      <p className="mt-2 text-xs text-[#c8c8cf]">Next: {KYC_NEXT_ACTION[kyc.status]}</p>
                    )}

                    {OPEN_KYC_STATUSES.includes(kyc.status) && (
                      <div className="mt-3 rounded-lg border border-[#2a2a2e] bg-[#0a0a0e] p-3">
                        <p className="text-xs font-medium text-[#c8c8cf]">Upload an identity document (JPEG, PNG or PDF, up to 5 MB)</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          <select
                            aria-label="Document type"
                            value={upload.appId === app.id ? upload.documentType : 'PASSPORT'}
                            onChange={e => setUpload(u => ({ ...u, appId: app.id, documentType: e.target.value }))}
                            className="rounded-lg border border-[#2a2a2e] bg-[#101014] px-2 py-1.5 text-xs text-white"
                          >
                            {KYC_DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}
                          </select>
                          <input
                            aria-label="Issuing country"
                            value={upload.appId === app.id ? upload.issuingCountry : ''}
                            onChange={e => setUpload(u => ({ ...u, appId: app.id, issuingCountry: e.target.value }))}
                            placeholder="Issuing country"
                            className="rounded-lg border border-[#2a2a2e] bg-[#101014] px-2 py-1.5 text-xs text-white placeholder-[#6b6b74]"
                          />
                          <input
                            aria-label="Document file"
                            type="file"
                            accept="image/jpeg,image/png,application/pdf"
                            onChange={e => setUpload(u => ({ ...u, appId: app.id, file: e.target.files?.[0] ?? null }))}
                            className="rounded-lg border border-[#2a2a2e] bg-[#101014] px-2 py-1.5 text-xs text-white file:mr-2 file:rounded file:border-0 file:bg-[#E6C76A] file:px-2 file:py-1 file:text-black"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={uploadBusy || !(upload.appId === app.id && upload.file)}
                          onClick={() => void uploadDocument(app.id)}
                          className="mt-2 rounded-lg bg-[#E6C76A] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40"
                        >
                          {uploadBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Upload document'}
                        </button>
                        {uploadMessage && (
                          <p role="status" className={`mt-2 text-xs ${uploadMessage.ok ? 'text-emerald-400' : 'text-red-400'}`}>{uploadMessage.text}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!['REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'ACTIVATION_PENDING'].includes(app.status) && (
                  <Link
                    to={`/register/${ACCOUNT_TYPE_SLUGS[app.accountType as AccountType] ?? 'personal'}`}
                    className="mt-4 inline-block rounded-xl bg-[#E6C76A] px-4 py-2 text-sm font-semibold text-black"
                  >
                    Continue application
                  </Link>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}