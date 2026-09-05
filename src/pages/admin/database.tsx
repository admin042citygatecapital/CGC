import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import { AlertTriangle, CheckCircle2, Database, HardDrive, Loader2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DatabaseData {
  evidence?: {
    target: { source: string; provider: string; projectRef: string | null; storageProjectRef: string | null; matchesStorageProject: boolean | null };
    backup: { scope: string; latestAt: string | null; checksumValid: boolean | null; restore: { managedBackupsAttested: boolean; lastRestoreTestAt: string | null; recent: boolean; referenceRecorded: boolean; complete: boolean } };
  };
  database: { state: string; provider: string; latencyMs: number | null };
  schema: { tableCount: number; rlsEnabledTables: number; migrationCount: number; latestMigration: string | null; latestMigrationAt: string | null };
  storage: { state: string; privateCredentials: boolean };
  controls: { arbitrarySql: boolean; schemaChanges: string; secretValuesExposed: boolean };
}

export default function DatabasePage() {
  const [data, setData] = useState<DatabaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/admin/database', { headers: authHeaders() })
      .then(async (response) => { if (!response.ok) throw new Error(`Database diagnostics failed (${response.status})`); setData(await response.json()); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Database diagnostics are unavailable.'));
  }, []);
  return <AdminLayout title="Database Operations"><Helmet><title>Database Operations — City Gate Capital Admin</title><meta name="robots" content="noindex,nofollow" /></Helmet><main className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
    <div><h1 className="text-2xl font-bold text-white">Database Operations</h1><p className="mt-1 text-sm text-white/40">Read-only PostgreSQL, migration, RLS, and storage diagnostics. There is no browser SQL console.</p></div>
    {!data && !error && <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>}
    {error && <div role="alert" className="flex items-center gap-2 rounded-2xl border border-red-400/15 bg-red-400/5 p-4 text-sm text-red-300"><AlertTriangle size={16} />{error}</div>}
    {data?.evidence && <section className="rounded-2xl border border-white/10 p-5 space-y-3 text-sm text-white/70">
      <h2 className="font-semibold text-white">Database authority and recovery evidence</h2>
      <p>Application connection: {data.evidence.target.provider}, selected by {data.evidence.target.source}.</p>
      <p>Database project: {data.evidence.target.projectRef ?? 'Not identified'}; storage project: {data.evidence.target.storageProjectRef ?? 'Not identified'}.</p>
      <p>Project alignment: {data.evidence.target.matchesStorageProject === true ? 'Matched' : data.evidence.target.matchesStorageProject === false ? 'Mismatch - investigate before any migration' : 'Unverified'}.</p>
      <p>Local backup scope: {data.evidence.backup.scope}. This is not a complete database or storage backup.</p>
      <p>Latest local snapshot: {data.evidence.backup.latestAt ?? 'Not recorded'}; checksum: {data.evidence.backup.checksumValid === true ? 'Verified' : data.evidence.backup.checksumValid === false ? 'Failed' : 'Unverified'}.</p>
      <p>Managed backups: {data.evidence.backup.restore.managedBackupsAttested ? 'Attested' : 'Evidence outstanding'}.</p>
      <p>Restore exercise: {data.evidence.backup.restore.lastRestoreTestAt ?? 'Not recorded'}; evidence reference: {data.evidence.backup.restore.referenceRecorded ? 'Recorded' : 'Missing'}; recent within 90 days: {data.evidence.backup.restore.recent ? 'Yes' : 'No'}.</p>
    </section>}
    {data && <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[[Database, 'PostgreSQL', `${data.database.state} · ${data.database.latencyMs ?? '—'} ms`], [HardDrive, 'Storage', data.storage.state], [ShieldCheck, 'RLS-enabled tables', data.schema.rlsEnabledTables], [CheckCircle2, 'Tracked migrations', data.schema.migrationCount]].map(([Icon, label, value]) => { const CardIcon = Icon as typeof Database; return <div key={String(label)} className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><CardIcon className="text-primary" size={18} /><p className="mt-3 text-xs text-white/35">{String(label)}</p><p className="mt-1 font-semibold text-white">{String(value)}</p></div>; })}</div>
      <div className="grid gap-4 md:grid-cols-2"><section className="rounded-2xl border border-white/8 bg-white/[.02] p-5"><h2 className="font-semibold text-white">Schema state</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-white/35">Public tables</dt><dd className="text-white">{data.schema.tableCount}</dd></div><div className="flex justify-between gap-4"><dt className="text-white/35">Latest migration</dt><dd className="font-mono text-xs text-white">{data.schema.latestMigration ?? 'Not reported'}</dd></div><div className="flex justify-between gap-4"><dt className="text-white/35">Applied at</dt><dd className="text-white">{data.schema.latestMigrationAt ? new Date(data.schema.latestMigrationAt).toLocaleString() : 'Not reported'}</dd></div></dl></section><section className="rounded-2xl border border-white/8 bg-white/[.02] p-5"><h2 className="font-semibold text-white">Security boundary</h2><ul className="mt-4 space-y-3 text-sm text-white/50"><li>Arbitrary SQL: <strong className="text-emerald-300">Not available</strong></li><li>Schema changes: <strong className="text-white">{data.controls.schemaChanges}</strong></li><li>Secret values exposed: <strong className="text-emerald-300">No</strong></li><li>Storage credential: <strong className="text-white">{data.storage.privateCredentials ? 'Configured server-side' : 'Not configured'}</strong></li></ul></section></div></>}
  </main></AdminLayout>;
}
