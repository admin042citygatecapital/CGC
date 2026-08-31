import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import { AlertTriangle, CheckCircle2, GitCommitHorizontal, Loader2, Rocket } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DeploymentsData {
  current: { commit: string | null; branch: string | null; serviceName: string | null; instanceConfigured: boolean };
  provider: { configured: boolean; state: string; lastCheckedAt: string; statusCode?: number };
  deployments: Array<{ id: string | null; status: string; commit: string | null; message: string | null; createdAt: string | null; finishedAt: string | null }>;
  controls: { triggerAvailable: boolean; rollbackAvailable: boolean; arbitraryApiCalls: boolean };
}

export default function DeploymentsPage() {
  const [data, setData] = useState<DeploymentsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/admin/deployments', { headers: authHeaders() })
      .then(async (response) => { if (!response.ok) throw new Error(`Deployment diagnostics failed (${response.status})`); setData(await response.json()); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Deployment diagnostics are unavailable.'));
  }, []);
  return <AdminLayout title="Deployments"><Helmet><title>Deployments — City Gate Capital Admin</title><meta name="robots" content="noindex,nofollow" /></Helmet><main className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
    <div><h1 className="text-2xl font-bold text-white">Deployments</h1><p className="mt-1 text-sm text-white/40">Safe production revision and Render deployment history. Credentials and arbitrary provider operations are excluded.</p></div>
    {!data && !error && <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>}
    {error && <div role="alert" className="flex items-center gap-2 rounded-2xl border border-red-400/15 bg-red-400/5 p-4 text-sm text-red-300"><AlertTriangle size={16} />{error}</div>}
    {data && <><div className="grid gap-3 md:grid-cols-3"><div className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><Rocket className="text-primary" size={18} /><p className="mt-3 text-xs text-white/35">Service</p><p className="font-semibold text-white">{data.current.serviceName ?? 'Not reported'}</p></div><div className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><GitCommitHorizontal className="text-primary" size={18} /><p className="mt-3 text-xs text-white/35">Current revision</p><p className="break-all font-mono text-xs text-white">{data.current.commit ?? 'Not reported'}</p><p className="mt-1 text-xs text-white/35">{data.current.branch ?? 'Branch not reported'}</p></div><div className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><CheckCircle2 className={data.provider.state === 'healthy' ? 'text-emerald-400' : 'text-amber-400'} size={18} /><p className="mt-3 text-xs text-white/35">Render adapter</p><p className="font-semibold text-white">{data.provider.state === 'healthy' ? 'Healthy' : data.provider.configured ? 'Error' : 'Not configured'}</p></div></div>
      <div className="overflow-x-auto rounded-2xl border border-white/8"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-white/[.035] text-xs uppercase tracking-wide text-white/35"><tr><th className="p-4">Status</th><th className="p-4">Commit</th><th className="p-4">Message</th><th className="p-4">Created</th><th className="p-4">Finished</th></tr></thead><tbody>{data.deployments.length ? data.deployments.map((deployment) => <tr key={deployment.id ?? `${deployment.commit}:${deployment.createdAt}`} className="border-t border-white/7 text-white/60"><td className="p-4 font-semibold text-white">{deployment.status}</td><td className="p-4 font-mono text-xs">{deployment.commit?.slice(0, 12) ?? '—'}</td><td className="max-w-sm truncate p-4">{deployment.message ?? '—'}</td><td className="p-4">{deployment.createdAt ? new Date(deployment.createdAt).toLocaleString() : '—'}</td><td className="p-4">{deployment.finishedAt ? new Date(deployment.finishedAt).toLocaleString() : '—'}</td></tr>) : <tr><td colSpan={5} className="p-8 text-center text-white/30">No provider deployment history is available.</td></tr>}</tbody></table></div>
      <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4 text-xs leading-5 text-amber-100/65">Production deploy and rollback controls remain disabled in this release. They require recent step-up authentication, an explicitly selected revision, confirmation, reason, provider-side success, and an immutable audit record.</div></>}
  </main></AdminLayout>;
}
