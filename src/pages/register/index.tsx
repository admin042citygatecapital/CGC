/**
 * /register — account-type selection. Each card opens its own complete
 * application journey; no generic shared form.
 */
import { Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { ACCOUNT_TYPE_META, ACCOUNT_TYPES, ACCOUNT_TYPE_SLUGS } from '../../shared/applicationFlow';

export default function RegisterHomePage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Helmet><title>Open an Account — City Gate Capital</title></Helmet>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <header className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-[#E6C76A]">City Gate Capital</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Choose your account type</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[#a9a9b2]">
            One customer identity, many accounts. Every account type has its own
            application journey — approval of the application is separate from the
            activation of any regulated financial service.
          </p>
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ACCOUNT_TYPES.map(type => {
            const meta = ACCOUNT_TYPE_META[type];
            return (
              <Link
                key={type}
                to={`/register/${ACCOUNT_TYPE_SLUGS[type]}`}
                className="group rounded-2xl border border-[#2a2a2e] bg-[#0d0d11] p-6 transition hover:border-[#E6C76A]/60 hover:shadow-[0_0_30px_rgba(230,199,106,0.08)]"
              >
                <p className="text-xs uppercase tracking-widest text-[#E6C76A]/80">{meta.tagline}</p>
                <h2 className="mt-2 text-xl font-semibold">{meta.label}</h2>
                <p className="mt-2 text-sm text-[#a9a9b2]">{meta.description}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#E6C76A]">
                  Apply
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>

        <p className="mx-auto mt-10 flex max-w-xl items-start gap-2 text-xs text-[#6b6b74]">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E6C76A]/70" />
          Regulated banking, payments, exchange execution and custody are not currently
          activated. Applications register your interest and start the onboarding workflow.
        </p>
      </div>
    </div>
  );
}