/**
 * /admin/applications — application review console with per-type tabs, a full
 * detail drawer (steps, business ownership, events, notes) and RBAC-checked
 * decisions. All actions go through /api/admin/* (audit via central middleware).
 */
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Loader2, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface Row {
  id: string; reference: string | null; email: string; firstName: string; lastName: string;
  accountType: string; selectedPlan: string | null; status: string; currentStep: string;
  completionPct: number; decision: string | null; decisionReason: string | null;
  updatedAt: string;
}

interface DetailApplication extends Row {
  steps: Record<string, Record<string, unknown>>;
  emailVerified: boolean;
  informationRequest: string | null;
}

interface Detail {
  application: DetailApplication;
  events: Array<{ event: string; at: string; actor: string; actorRole: string | null; detail: Record<string, unknown> | null }>;
  businessOwnership: {
    profile: Record<string, string | null> | null;
    representative: { fullName: string; detail: string | null } | null;
    members: Array<{ memberKind: string; teamRole: string | null; fullName: string; detail: string | null }>;
    owners: Array<{ fullName: string; ownershipPct: number }>;
  } | null;
}

const TYPES = ['PERSONAL', 'SAVINGS', 'BUSINESS', 'MULTI_CURRENCY', 'WEALTH'] as const;
const STATUSES = ['APPLICATION_STARTED', 'EMAIL_VERIFICATION_REQUIRED', 'EMAIL_VERIFIED', 'REVIEW_REQUIRED', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'ACTIVATION_PENDING'] as const;
const TABS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  ...TYPES.map(t => ({ value: t, label: t.replaceAll('_', ' ') })),
];

const STEP_TITLES: Record<string, string> = {
  contact: 'Login identity', personal: 'Personal information', business: 'Business details',
  ownership: 'Ownership & control', savings: 'Savings preferences', multiCurrency: 'Multi-currency preferences',
  wealth: 'Wealth preferences', preferences: 'Account preferences', verification: 'Verification',
  security: 'Security setup', review: 'Review',
};

const inputCls = 'rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm';

export default function AdminApplications() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [note, setNote] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [decision, setDecision] = useState<{ row: Row; value: string; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const flash = useCallback((ok: boolean, text: string) => {
    setToast({ ok, text });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tab) params.set('type', tab);
    if (status) params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    try {
      const r = await fetch(`/api/admin/applications?${params}`, { headers: authHeaders() });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json() as { applications: Row[] };
      setRows(j.applications);
      setLoadError(null);
    } catch {
      setRows(null);
      setLoadError('Could not load applications — check your connection or permissions.');
    } finally {
      setLoading(false);
    }
  }, [tab, status, search]);

  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 350);
    return () => window.clearTimeout(t);
  }, [load]);

  const openDetail = useCallback(async (applicationId: string) => {
    setDetailLoading(true);
    try {
      const r = await fetch(`/api/admin/applications/${applicationId}`, { headers: authHeaders() });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json() as Detail;
      setDetail(j);
    } catch {
      flash(false, 'Could not load the application detail.');
    } finally {
      setDetailLoading(false);
    }
  }, [flash]);

  const addNote = useCallback(async () => {
    if (!detail?.application) return;
    const text = note.trim();
    if (text.length < 2) return;
    setNoteBusy(true);
    try {
      const r = await fetch(`/api/admin/applications/${detail.application.id}/notes`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: text }),
      });
      const j = await r.json().catch(() => ({ ok: false, error: 'Network error.' })) as { ok?: boolean; error?: string };
      if (j.ok) {
        setNote('');
        flash(true, 'Note added.');
        await openDetail(detail.application.id);
      } else {
        flash(false, j.error ?? 'Note failed.');
      }
    } finally {
      setNoteBusy(false);
    }
  }, [detail, note, flash, openDetail]);

  const submitDecision = useCallback(async () => {
    if (!decision) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/applications/${decision.row.id}/decision`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: decision.value, reason: decision.reason }),
      }).catch(() => null);
      const j = r ? await r.json().catch(() => ({ ok: false, error: 'Network error.' })) as { ok?: boolean; error?: string } : { ok: false, error: 'Network error.' };
      flash(Boolean(j.ok), j.ok
        ? `Application ${decision.row.reference ?? decision.row.id}: ${decision.value}`
        : j.error ?? 'Decision failed.');
      if (j.ok) { setDecision(null); void load(); }
    } finally {
      setBusy(false);
    }
  }, [decision, load, flash]);

  return (
    <AdminLayout>
      <Helmet><title>Applications — City Gate Capital Admin</title></Helmet>
      <div className="mx-auto max-w-6xl space-y-5">
        <header>
          <h1 className="text-2xl font-semibold">Account applications</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Review, request information, approve or reject. Every decision is RBAC-checked and audited.
          </p>
        </header>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Account type">
          {TABS.map(t => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium ${tab === t.value ? 'border-[#E6C76A] bg-[#E6C76A]/10 text-[#E6C76A]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls} aria-label="Filter by status">
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
          </select>
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email or reference…"
              className={`${inputCls} w-full pl-8`}
              aria-label="Search applicants"
            />
          </div>
        </div>

        {loadError && <p role="alert" className="rounded-xl bg-red-950/60 px-4 py-3 text-sm text-red-200">{loadError}</p>}
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-[var(--muted-foreground)]"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
        ) : (rows?.length ?? 0) === 0 ? (
          <p className="rounded-xl border border-[var(--border)] p-6 text-sm text-[var(--muted-foreground)]">No applications match these filters.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[var(--muted)] text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3">Reference</th><th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Type</th><th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Progress</th><th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows!.map(row => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-mono text-xs">{row.reference ?? row.id.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{[row.firstName, row.lastName].filter(Boolean).join(' ') || '—'}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{row.email}</p>
                    </td>
                    <td className="px-4 py-3">{row.accountType.replaceAll('_', ' ')}</td>
                    <td className="px-4 py-3">{row.selectedPlan ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-[var(--muted)]">
                          <div className="h-full rounded-full bg-[#E6C76A]" style={{ width: `${row.completionPct}%` }} />
                        </div>
                        <span className="text-xs">{row.completionPct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">{row.status.replaceAll('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void openDetail(row.id)}
                          className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs hover:bg-[var(--accent)]"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecision({ row, value: 'APPROVED', reason: '' })}
                          className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs hover:bg-[var(--accent)]"
                        >
                          Review
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {detailLoading && <div className="flex items-center gap-2 py-4 text-sm text-[var(--muted-foreground)]"><Loader2 className="h-4 w-4 animate-spin" /> Loading application…</div>}

        {detail && detail.application && (
          <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/70 p-4" role="dialog" aria-modal="true">
            <div className="mx-auto my-6 w-full max-w-3xl space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    {detail.application.accountType.replaceAll('_', ' ')} application — {detail.application.reference ?? detail.application.id.slice(0, 10)}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {[detail.application.firstName, detail.application.lastName].filter(Boolean).join(' ') || detail.application.email} · {detail.application.email} · {detail.application.selectedPlan ?? 'no plan'} · {detail.application.completionPct}% complete
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Status: {detail.application.status.replaceAll('_', ' ')}{detail.application.emailVerified ? ' · email verified' : ' · email NOT verified'}
                  </p>
                </div>
                <button type="button" onClick={() => setDetail(null)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--accent)]">Close</button>
              </div>

              {detail.application.informationRequest && (
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Information request: {detail.application.informationRequest}</p>
              )}

              <section>
                <h3 className="text-sm font-semibold">Submitted information</h3>
                {Object.entries(detail.application.steps).map(([stepId, data]) => (
                  <div key={stepId} className="mt-2 rounded-lg border border-[var(--border)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{STEP_TITLES[stepId] ?? stepId}</p>
                    <dl className="mt-1 space-y-0.5 text-xs">
                      {Object.entries(data).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <dt className="text-[var(--muted-foreground)]">{key}:</dt>
                          <dd className="break-all">{typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value ?? '—')}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </section>

              {detail.businessOwnership && detail.businessOwnership.profile && (
                <section>
                  <h3 className="text-sm font-semibold">Business ownership &amp; control</h3>
                  {detail.businessOwnership.representative && (
                    <p className="mt-1 text-xs">Authorized representative: <strong>{detail.businessOwnership.representative.fullName}</strong>{detail.businessOwnership.representative.detail ? ` — ${detail.businessOwnership.representative.detail}` : ''}</p>
                  )}
                  {detail.businessOwnership.members.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {detail.businessOwnership.members.map((m, i) => (
                        <li key={i}>{m.memberKind === 'director' ? 'Director' : `Team (${m.teamRole ?? 'unassigned'})`}: {m.fullName}{m.detail ? ` — ${m.detail}` : ''}</li>
                      ))}
                    </ul>
                  )}
                  {detail.businessOwnership.owners.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {detail.businessOwnership.owners.map((o, i) => (
                        <li key={i}>Beneficial owner: {o.fullName} — {o.ownershipPct}%</li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              <section>
                <h3 className="text-sm font-semibold">Audit trail</h3>
                <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs text-[var(--muted-foreground)]">
                  {detail.events.map((e, i) => (
                    <li key={i}>{new Date(e.at).toLocaleString()} — {e.event.replaceAll('_', ' ')} · {e.actor}{e.actorRole ? ` (${e.actorRole})` : ''}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-sm font-semibold">Internal notes</h3>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {detail.events.filter(e => e.event === 'NOTE_ADDED').map((e, i) => (
                    <li key={i}>{new Date(e.at).toLocaleString()} — {String((e.detail as { note?: unknown })?.note ?? '')} · {e.actor}</li>
                  ))}
                  {detail.events.filter(e => e.event === 'NOTE_ADDED').length === 0 && <li className="text-[var(--muted-foreground)]">No notes yet.</li>}
                </ul>
                <div className="mt-2 flex gap-2">
                  <input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Add an internal note (audited, never emailed)"
                    aria-label="Internal note"
                    className={`${inputCls} flex-1`}
                  />
                  <button
                    type="button"
                    disabled={noteBusy || note.trim().length < 2}
                    onClick={() => void addNote()}
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--accent)] disabled:opacity-40"
                  >
                    {noteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add note'}
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}
        {decision && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
              <h2 className="text-lg font-semibold">Decision — {decision.row.reference ?? decision.row.id.slice(0, 10)}</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {[decision.row.firstName, decision.row.lastName].filter(Boolean).join(' ') || decision.row.email} · {decision.row.accountType.replaceAll('_', ' ')}
              </p>
              <label className="mt-4 block text-sm font-medium">
                Decision
                <select
                  value={decision.value}
                  onChange={e => setDecision({ ...decision, value: e.target.value })}
                  className={`${inputCls} mt-1 w-full`}
                >
                  {['APPROVED', 'REJECTED', 'NEEDS_INFORMATION', 'REVIEW_REQUIRED', 'ACTIVATION_PENDING'].map(d => <option key={d} value={d}>{d.replaceAll('_', ' ')}</option>)}
                </select>
              </label>
              <label className="mt-3 block text-sm font-medium">
                Reason (required, audited)
                <textarea
                  rows={3}
                  value={decision.reason}
                  onChange={e => setDecision({ ...decision, reason: e.target.value })}
                  className={`${inputCls} mt-1 w-full`}
                />
              </label>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setDecision(null)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">Cancel</button>
                <button
                  type="button"
                  disabled={busy || decision.reason.trim().length < 4}
                  onClick={() => void submitDecision()}
                  className="rounded-lg bg-[#E6C76A] px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record decision'}
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div role="status" className={`fixed bottom-6 right-6 rounded-xl px-4 py-3 text-sm shadow-lg ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.text}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
