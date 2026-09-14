/**
 * /admin/kyc — dedicated KYC case review panel for the per-account-type
 * application system. Queue supports filtering by account type, status and
 * customer search; the case drawer shows the KYC profile, documents (opened
 * through short-lived signed URLs), the event trail and every review action.
 * All actions go through /api/admin/kyc-cases/* (RBAC + audit centrally).
 */
import AdminLayout from '@/layouts/AdminLayout';
import { adminFetch } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface CaseRow {
  id: string; applicationId: string; userId: string | null; accountType: string;
  status: string; riskLevel: string; reviewerId: string | null;
  provider: { name: string; status: string | null } | null;
  submittedAt: string | null; reviewedAt: string | null; reviewReason: string | null;
  customerEmail: string | null; customerName: string | null; applicationReference: string | null;
}

interface CaseDetail {
  ok: boolean;
  kycCase: CaseRow;
  application: {
    id: string; reference: string | null; email: string; firstName: string; lastName: string;
    accountType: string; selectedPlan: string | null; status: string; completionPct: number;
    informationRequest: string | null; decisionReason: string | null;
  } | null;
  documents: Array<{ id: string; documentType: string; issuingCountry: string | null; originalName: string | null; createdAt: string }>;
  events: Array<{ event: string; actor: string; actorRole: string | null; at: string }>;
}

const TYPES = ['PERSONAL', 'SAVINGS', 'BUSINESS', 'MULTI_CURRENCY', 'WEALTH'] as const;
const STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'EXPIRED'] as const;
const DECISIONS = ['APPROVED', 'REJECTED', 'NEEDS_INFORMATION', 'EXPIRED', 'UNDER_REVIEW'] as const;

const inputCls = 'rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[#E6C76A]';

export default function AdminKyc() {
  const [rows, setRows] = useState<CaseRow[] | null>(null);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const flash = useCallback((ok: boolean, text: string) => {
    setToast({ ok, text });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (type) params.set('accountType', type);
    if (status) params.set('status', status);
    if (search.trim()) params.set('q', search.trim());
    try {
      const r = await adminFetch(`/api/admin/kyc-cases?${params}`);
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json() as { cases: CaseRow[] };
      setRows(j.cases);
    } catch {
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, [type, status, search]);

  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 350);
    return () => window.clearTimeout(t);
  }, [load]);

  const openCase = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDecision(''); setReason(''); setNote(''); setReviewer('');
    try {
      const r = await adminFetch(`/api/admin/kyc-cases/${id}`);
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json() as CaseDetail;
      setDetail(j);
    } catch {
      flash(false, 'Could not load the KYC case.');
    } finally {
      setDetailLoading(false);
    }
  }, [flash]);

  const post = useCallback(async (url: string, body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true);
    try {
      const r = await adminFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({ ok: false, error: 'Network error.' })) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) { flash(false, j.error ?? 'Action failed.'); return false; }
      return true;
    } catch {
      flash(false, 'Network error — action not recorded.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [flash]);

  const openDocument = useCallback(async (caseId: string, documentId: string) => {
    try {
      const r = await adminFetch(`/api/admin/kyc-cases/${caseId}/documents/${documentId}`);
      const j = await r.json().catch(() => ({ ok: false })) as { ok?: boolean; url?: string; error?: string };
      if (r.ok && j.ok && j.url) {
        window.open(j.url, '_blank', 'noopener,noreferrer');
      } else {
        flash(false, j.error ?? 'Document access failed.');
      }
    } catch {
      flash(false, 'Document access failed.');
    }
  }, [flash]);

  const recordDecision = useCallback(async () => {
    if (!detail || decision.trim().length === 0 || reason.trim().length < 4) return;
    const ok = await post(`/api/admin/kyc-cases/${detail.kycCase.id}/decision`, { decision, reason: reason.trim() });
    if (ok) {
      flash(true, `Decision ${decision} recorded.`);
      setDetail(null);
      void load();
    }
  }, [detail, decision, reason, post, flash, load]);

  const addNote = useCallback(async () => {
    if (!detail || note.trim().length < 2) return;
    const ok = await post(`/api/admin/kyc-cases/${detail.kycCase.id}/notes`, { note: note.trim() });
    if (ok) { flash(true, 'Note added.'); setNote(''); void openCase(detail.kycCase.id); }
  }, [detail, note, post, flash, openCase]);

  const assign = useCallback(async () => {
    if (!detail || reviewer.trim().length < 2) return;
    const ok = await post(`/api/admin/kyc-cases/${detail.kycCase.id}/assign`, { reviewerId: reviewer.trim() });
    if (ok) { flash(true, 'Reviewer assigned.'); void openCase(detail.kycCase.id); }
  }, [detail, reviewer, post, flash, openCase]);

  return (
    <AdminLayout>
      <div className="p-6">
        <Helmet><title>KYC Review — City Gate Capital</title></Helmet>
        <h1 className="text-xl font-semibold">KYC review</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Per-account-type KYC cases. Approval of identity verification is separate from regulated-service activation.
        </p>

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
              toast.ok
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/40 bg-red-500/10 text-red-300'
            }`}
          >
            {toast.text}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer, email or reference"
            aria-label="Search KYC cases"
            className={`${inputCls} w-72`}
          />
          <select value={type} onChange={e => setType(e.target.value)} aria-label="Filter by account type" className={inputCls}>
            <option value="">All account types</option>
            {TYPES.map(t => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status" className={inputCls}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
          </select>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-[#E6C76A]" />}
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)]">
          {rows === null ? (
            <p className="p-6 text-sm text-[var(--muted-foreground)]">Could not load KYC cases — check your connection or permissions.</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-[var(--muted-foreground)]">No KYC cases match the current filters.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--muted)] text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reviewer</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Review</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(c => (
                  <tr key={c.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3 text-xs">{c.applicationReference ?? c.applicationId.slice(0, 12)}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium">{c.customerName || '—'}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{c.customerEmail ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">{c.accountType.replaceAll('_', ' ')}</td>
                    <td className="px-4 py-3 text-xs">{c.status.replaceAll('_', ' ')}</td>
                    <td className="px-4 py-3 text-xs">{c.reviewerId ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">{c.submittedAt ? new Date(c.submittedAt).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void openCase(c.id)}
                        className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs hover:bg-[var(--accent)]"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {detailLoading && <Loader2 className="mt-4 h-5 w-5 animate-spin text-[#E6C76A]" />}

        {detail && (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/70 p-4" role="dialog" aria-modal="true">
            <div className="my-8 w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">KYC case — {detail.application?.reference ?? detail.kycCase.applicationId.slice(0, 12)}</h2>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {detail.application ? `${detail.application.firstName} ${detail.application.lastName} · ${detail.application.email}` : 'Application summary unavailable'} · {detail.kycCase.accountType.replaceAll('_', ' ')}
                  </p>
                </div>
                <button type="button" onClick={() => setDetail(null)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm">Close</button>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-xs text-[var(--muted-foreground)]">Status</dt><dd>{detail.kycCase.status.replaceAll('_', ' ')}</dd></div>
                <div><dt className="text-xs text-[var(--muted-foreground)]">Risk</dt><dd>{detail.kycCase.riskLevel}</dd></div>
                <div><dt className="text-xs text-[var(--muted-foreground)]">Reviewer</dt><dd>{detail.kycCase.reviewerId ?? '—'}</dd></div>
                <div><dt className="text-xs text-[var(--muted-foreground)]">Provider</dt><dd>{detail.kycCase.provider ? `${detail.kycCase.provider.name} — ${detail.kycCase.provider.status ?? 'pending'}` : 'not used'}</dd></div>
                <div><dt className="text-xs text-[var(--muted-foreground)]">Application status</dt><dd>{detail.application?.status.replaceAll('_', ' ') ?? '—'}</dd></div>
                <div><dt className="text-xs text-[var(--muted-foreground)]">Completion</dt><dd>{detail.application ? `${detail.application.completionPct}%` : '—'}</dd></div>
              </dl>
              {detail.kycCase.reviewReason && (
                <p className="mt-3 rounded-lg bg-[var(--muted)] px-3 py-2 text-sm">Last review reason: {detail.kycCase.reviewReason}</p>
              )}
              {detail.application?.informationRequest && (
                <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Information request: {detail.application.informationRequest}</p>
              )}

              <h3 className="mt-5 text-sm font-semibold">Documents</h3>
              {detail.documents.length === 0 ? (
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">No documents uploaded to this case.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {detail.documents.map(d => (
                    <li key={d.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                      <span>{d.documentType.replaceAll('_', ' ')}{d.issuingCountry ? ` · ${d.issuingCountry}` : ''}</span>
                      <button
                        type="button"
                        onClick={() => void openDocument(detail.kycCase.id, d.id)}
                        className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-[var(--accent)]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Open (60s link)
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-5 text-sm font-semibold">Event trail</h3>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-[var(--muted-foreground)]">
                {detail.events.map((e, i) => (
                  <li key={`${e.event}-${i}`}>{new Date(e.at).toLocaleString()} — {e.event.replaceAll('_', ' ')} · {e.actor}{e.actorRole ? ` (${e.actorRole})` : ''}</li>
                ))}
              </ul>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">
                    Decision
                    <select value={decision} onChange={e => setDecision(e.target.value)} className={`${inputCls} mt-1 w-full`}>
                      <option value="">Choose…</option>
                      {DECISIONS.map(d => <option key={d} value={d}>{d.replaceAll('_', ' ')}</option>)}
                    </select>
                  </label>
                  <label className="mt-2 block text-sm font-medium">
                    Reason (required, audited)
                    <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} className={`${inputCls} mt-1 w-full`} />
                  </label>
                  <button
                    type="button"
                    disabled={busy || !decision || reason.trim().length < 4}
                    onClick={() => void recordDecision()}
                    className="mt-2 rounded-lg bg-[#E6C76A] px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record decision'}
                  </button>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">UNDER_REVIEW on a decided case reopens the review.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium">
                      Assign reviewer
                      <input value={reviewer} onChange={e => setReviewer(e.target.value)} placeholder="Administrator id or email" className={`${inputCls} mt-1 w-full`} />
                    </label>
                    <button type="button" disabled={busy || reviewer.trim().length < 2} onClick={() => void assign()} className="mt-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40">
                      Assign
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      Internal note
                      <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Visible to staff only" className={`${inputCls} mt-1 w-full`} />
                    </label>
                    <button type="button" disabled={busy || note.trim().length < 2} onClick={() => void addNote()} className="mt-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40">
                      Add note
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
