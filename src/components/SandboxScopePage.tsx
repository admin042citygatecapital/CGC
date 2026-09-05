import { Link, useLocation } from 'react-router-dom';

/** Replaces excluded financial screens without deleting historical records. */
export default function SandboxScopePage() {
  const admin = useLocation().pathname.startsWith('/admin');
  return <main className="min-h-screen bg-background px-6 py-16 text-foreground">
    <section className="mx-auto max-w-2xl rounded-2xl border border-primary/25 bg-primary/5 p-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">Sandbox KYC only</p>
      <h1 className="mt-4 text-3xl font-semibold">Financial activity is outside this project's scope</h1>
      <p className="mt-4 leading-relaxed text-foreground/70">This workspace is for testing identity verification. Payments, transfers, trading, card issuing and custody are not offered or awaiting activation. Sandbox verification does not authorize financial activity.</p>
      <p className="mt-4 text-sm text-foreground/60">Historical records are preserved. This scope change does not delete accounts or transactions.</p>
      <Link className="mt-6 inline-block rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground" to={admin ? '/admin/onboarding' : '/onboarding'}>Open KYC workspace</Link>
      {admin && <Link className="ml-5 inline-block text-primary underline" to="/admin">Control Center</Link>}
    </section>
  </main>;
}
