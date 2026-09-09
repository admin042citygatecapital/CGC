import { useEffect, useState } from 'react';
import { adminFetch, useAdminAuth } from '@/lib/adminAuth';

type Test = { externalUserId: string; applicantId: string | null; status: string | null; reviewedAt: string | null; canRetry: boolean };
type Configuration = { ready: boolean; missing: string[]; webhookPath: string };

async function readSandboxResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`Sandbox request returned a non-JSON response (HTTP ${response.status}). Retry the existing test; do not create another applicant.`);
  }
  try { return await response.json(); }
  catch { throw new Error(`Sandbox response could not be read (HTTP ${response.status}). Retry the existing test.`); }
}

export default function SumsubSandboxTests() {
  const { admin } = useAdminAuth();
  const [tests, setTests] = useState<Test[]>([]);
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);

  async function refresh() {
    const response = await adminFetch('/api/admin/onboarding/sandbox');
    const data = await readSandboxResponse(response);
    if (!response.ok) throw new Error(data.error || 'Unable to load sandbox tests.');
    setConfiguration(data.configuration); setTests(data.tests);
  }
  useEffect(() => { void refresh().catch(e => setError(e.message)); }, []);

  async function run(create: boolean, retryExternalId?: string) {
    setBusy(true); setError('');
    try {
      if (create) {
        setLink(null);
        const existingId = retryExternalId?.match(/^sbx_([a-f0-9]{8})([a-f0-9]{4})([a-f0-9]{4})([a-f0-9]{4})([a-f0-9]{12})$/);
        const attemptId = existingId ? existingId.slice(1).join('-') : requestId;
        if (retryExternalId && !existingId) throw new Error('Invalid sandbox test reference.');
        const response = await adminFetch('/api/admin/onboarding/sandbox', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: attemptId }),
        });
        const data = await readSandboxResponse(response);
        if (!response.ok) throw new Error(data.error || 'Unable to create sandbox applicant.');
        setLink({ url: data.verificationUrl, expiresAt: data.expiresAt });
        setRequestId(crypto.randomUUID());
      }
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Sandbox request failed.'); }
    finally { setBusy(false); }
  }

  return <section aria-label="Sandbox verification tests" className="rounded-xl border border-white/10 p-4 space-y-3">
    <h3 className="font-semibold">Sandbox verification tests</h3>
    <p className="text-sm text-white/60">Create a synthetic applicant and use Sumsub sample documents to test verification. Results stay here and do not approve customer accounts.</p>
    {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
    {configuration && !configuration.ready && <p className="text-sm text-amber-200">Server setup needed: {configuration.missing.join(', ')}</p>}
    <div className="flex gap-3">
      {admin?.role === 'SUPER_ADMIN' && <button type="button" disabled={busy || !configuration?.ready} onClick={() => void run(true)} className="rounded-lg bg-primary px-3 py-2 text-sm text-black disabled:opacity-40">{busy ? 'Working...' : 'Create sandbox test'}</button>}
      <button type="button" disabled={busy} onClick={() => void run(false)} className="rounded-lg border border-white/20 px-3 py-2 text-sm">Refresh test results</button>
    </div>
    {link && <p className="text-sm"><a href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Open sandbox verification</a> (expires {new Date(link.expiresAt).toLocaleTimeString()})</p>}
    <ul className="space-y-2 text-sm">{tests.map(test => <li key={test.externalUserId} className="rounded-lg bg-white/5 p-3 break-all">
      <span className="font-mono">{test.externalUserId}</span>: {test.status ? `Sandbox result: ${test.status}` : test.applicantId ? 'Waiting for signed result' : 'Applicant creation pending; retry the request'}
      {test.reviewedAt && <span> ({new Date(test.reviewedAt).toLocaleString()})</span>}
      {admin?.role === 'SUPER_ADMIN' && test.canRetry === true && !test.status && <button type="button" disabled={busy || !configuration?.ready} onClick={() => void run(true, test.externalUserId)} className="ml-3 underline disabled:opacity-40">Retry this sandbox test</button>}
    </li>)}</ul>
    {!tests.length && configuration && <p className="text-sm text-white/60">No sandbox tests recorded yet.</p>}
  </section>;
}
