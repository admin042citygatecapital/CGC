/**
 * /admin/applications — application review console with KYC case queue.
 * All actions go through /api/admin/* (RBAC + audit via central middleware).
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

const TYPES = ['PERSONAL', 'SAVINGS', 'BUSINESS', 'MULTI_CURRENCY', 'WEALTH'] as const;
const STATUSES = ['APPLICATION_STARTED', 'EMAIL_VERIFICATION_REQUIRED', 'EMAIL_VERIFIED', 'REVIEW_REQUIRED', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'ACTIVATION_PENDING'] as const;

export default function AdminApplications() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<{ row: Row; value: string; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    try {
      const r = await fetch(`/api/admin/applications?${params}`, { headers: authHeaders() });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json() as { applications: Row[] };
      setRows(j.applications);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [type, status, search]);

  useEffect(() => { void load(); }, [load]);

  const submitDecision = useCallback(async () => {
    if (!decision) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/applications/${decision.row.id}/decision`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: decision.value, reason: decision.reason }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      setToast(j.ok
        ? { ok: true, text: `Application ${decision.row.reference ?? decision.row.id}: ${decision.value}` }
        : { ok: false, text: j.error ?? 'Decision failed.' });
      window.setTimeout(() => setToast(null), 4000);
      if (j.ok) { setDecision(null); void load(); }
    } finally {
      setBusy(false);
    }
  }, [decision, load]);

  const inputCls = 'rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm';

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

        <div className="flex flex-wrap items-center gap-2">
          <select value={type} onChange={e => setType(e.target.value)} className={inputCls} aria-label="Filter by account type">
            <option value="">All types</option>
            {TYPES.map(t => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls} aria-label="Filter by status">
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
          </select>
          <div className="relative flex-1 min-w-52">
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
                  <th className="px-4 py-3">Decision</th>
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
                      <button
                        type="button"
                        onClick={() => setDecision({ row, value: 'APPROVED', reason: '' })}
                        className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs hover:bg-[var(--accent)]"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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