import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import { AlertTriangle, CheckCircle2, Loader2, Shield, UserCog, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Administrator {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  activeSessions: number;
  lastLoginAt: string | null;
}

interface ResponseData {
  administrators: Administrator[];
  summary: { total: number; active: number; superAdmins: number; activeSessions: number };
}

export default function AdministratorsPage() {
  const [data, setData] = useState<ResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/admin/administrators', { headers: authHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Administrator directory failed (${response.status})`);
        setData(await response.json());
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Administrator directory is unavailable.'));
  }, []);

  return (
    <AdminLayout title="Administrators">
      <Helmet><title>Administrators — City Gate Capital Admin</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <main className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
        <div><h1 className="text-2xl font-bold text-white">Administrators</h1><p className="mt-1 text-sm text-white/40">PostgreSQL-backed administrator identities, roles, and active-session counts. Password hashes and session tokens are never returned.</p></div>
        {!data && !error && <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>}
        {error && <div role="alert" className="flex items-center gap-2 rounded-2xl border border-red-400/15 bg-red-400/5 p-4 text-sm text-red-300"><AlertTriangle size={16} />{error}</div>}
        {data && <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[[Users, 'Total', data.summary.total], [CheckCircle2, 'Active', data.summary.active], [Shield, 'Active SUPER_ADMIN', data.summary.superAdmins], [UserCog, 'Active sessions', data.summary.activeSessions]].map(([Icon, label, value]) => {
              const CardIcon = Icon as typeof Users;
              return <div key={String(label)} className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><CardIcon className="mb-3 text-primary" size={18} /><p className="text-xs text-white/35">{String(label)}</p><p className="mt-1 text-2xl font-bold text-white">{String(value)}</p></div>;
            })}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/8">
            <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-white/[.035] text-xs uppercase tracking-wide text-white/35"><tr><th className="p-4">Administrator</th><th className="p-4">Role</th><th className="p-4">State</th><th className="p-4">Password policy</th><th className="p-4">Sessions</th><th className="p-4">Last login</th></tr></thead>
              <tbody>{data.administrators.map((administrator) => <tr key={administrator.id} className="border-t border-white/7 text-white/65"><td className="p-4"><p className="font-semibold text-white">{administrator.name}</p><p className="text-xs text-white/35">{administrator.email} · {administrator.id}</p></td><td className="p-4 font-mono text-xs text-primary">{administrator.role}</td><td className="p-4">{administrator.isActive ? 'Active' : 'Suspended'}</td><td className="p-4">{administrator.mustChangePassword ? 'Change required' : 'Current'}</td><td className="p-4">{administrator.activeSessions}</td><td className="p-4">{administrator.lastLoginAt ? new Date(administrator.lastLoginAt).toLocaleString() : 'Never'}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="text-xs text-white/30">Role changes and session revocation remain in Security Center, where step-up authentication, confirmation, and immutable audit controls apply.</p>
        </>}
      </main>
    </AdminLayout>
  );
}
