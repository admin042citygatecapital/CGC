import { Link } from 'react-router-dom';
import SumsubSandboxTests from './SumsubSandboxTests';
import { useAdminAuth } from '@/lib/adminAuth';

export interface SumsubReadiness {
  approved: boolean; webhookConfigured: boolean; receiverReady: boolean;
  status: string; message: string; evidenceStatus: string;
  evidence: { eventCount: number; latestEventAt: string | null; identityEvents: number; screeningEvents: number } | null;
}

export default function SumsubReadinessPanel({ data, loading, error }: { data: SumsubReadiness | null; loading: boolean; error: boolean }) {
  const { admin } = useAdminAuth();
  const canViewSandbox = admin?.role === 'SUPER_ADMIN' || admin?.permissions.includes('compliance.view') || admin?.permissions.includes('*');
  return <section aria-label="Sumsub readiness" className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 space-y-3">
    <h2 className="font-semibold text-white">Sumsub sandbox KYC readiness</h2>
    <p className="text-xs leading-relaxed text-white/60">Identity verification tests only. Signed sandbox results are stored separately from customer approvals.</p>
    {loading ? <p role="status" className="text-sm text-white/60">Loading provider evidence...</p> : error || !data ?
      <p role="alert" className="text-sm text-amber-200">Provider readiness is unavailable. Refresh to retry.</p> : <>
        <p className="text-sm text-amber-200">{data.status === 'ready' ? 'Sandbox signed result received' : data.status === 'not_configured' ? 'Receiver configuration incomplete' : data.status === 'unknown' ? 'Evidence unavailable' : 'Awaiting sandbox test'}</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 text-white/70">
          <div><dt>Provider allow-list</dt><dd>{data.approved ? 'Configured' : 'Not configured'}</dd></div>
      <div><dt>Sandbox receiver signing secret</dt><dd>{data.webhookConfigured ? 'Configured server-side' : 'Missing or invalid'}</dd></div>
          <div><dt>Recorded signed events</dt><dd>{data.evidenceStatus === 'available' && data.evidence ? data.evidence.eventCount : 'Unavailable'}</dd></div>
          <div><dt>Latest recorded event</dt><dd>{data.evidence?.latestEventAt ? new Date(data.evidence.latestEventAt).toLocaleString() : data.evidenceStatus === 'available' ? 'None recorded' : 'Unavailable'}</dd></div>
        </dl>
        <p className="text-xs leading-relaxed text-white/60">{data.message}</p>
      </>}
    <div className="flex gap-4 text-sm text-primary"><Link to="/admin/onboarding">Onboarding cases</Link><Link to="/admin/readiness">Full readiness report</Link></div>
    {canViewSandbox && <SumsubSandboxTests />}
  </section>;
}
