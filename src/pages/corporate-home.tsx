import { Helmet } from '@dr.pogodin/react-helmet';
import { ArrowRight, Building2, Globe2, LockKeyhole, Scale, ShieldCheck, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';

const capabilities = [
  {
    icon: Workflow,
    title: 'Financial operations software',
    text: 'Account, payment, reconciliation and administrative workflows designed around provider-authoritative records.',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance operations',
    text: 'Maker-checker review, evidence registers, immutable audit history and role-based operational controls.',
  },
  {
    icon: LockKeyhole,
    title: 'Security by design',
    text: 'Secure sessions, protected administration, privacy controls and fail-closed launch boundaries.',
  },
] as const;

const readiness = [
  'Authorised sponsor and programme-provider engagement',
  'Safeguarding, ledger and daily reconciliation design',
  'KYC, KYB, AML and sanctions-provider integration',
  'Controlled, corridor-by-corridor product activation',
] as const;

export default function CorporateHomePage() {
  return (
    <>
      <Helmet>
        <title>City Gate Capital — Financial Technology & Operations</title>
        <meta name="description" content="City Gate Capital develops secure financial-technology and operational infrastructure for modern, globally connected financial experiences." />
        <link rel="canonical" href="https://citygate.capital/" />
        <meta property="og:title" content="City Gate Capital — Financial Technology & Operations" />
        <meta property="og:description" content="Secure financial-technology, compliance operations and provider-ready infrastructure." />
        <meta property="og:url" content="https://citygate.capital/" />
        <meta name="twitter:title" content="City Gate Capital — Financial Technology & Operations" />
        <meta name="twitter:description" content="Secure financial-technology, compliance operations and provider-ready infrastructure." />
      </Helmet>

      <section className="relative min-h-[88vh] overflow-hidden pt-40 pb-24 flex items-center">
        <div className="absolute inset-0">
          <img src="/airo-assets/images/pages/home/hero" alt="" className="h-full w-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/95 to-[#080808]/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-[#080808]/30" />
        </div>
        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <div className="max-w-4xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.08] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <Building2 size={13} /> City Gate Capital
            </div>
            <h1 className="max-w-4xl text-5xl font-bold leading-[1.02] tracking-tight text-white md:text-7xl">
              Financial infrastructure, <span className="text-gold-shimmer">built with discipline.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/55 md:text-xl">
              We develop secure financial-technology, compliance operations and provider-ready infrastructure for modern, globally connected experiences.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/contact" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#F0D080] px-7 py-4 text-sm font-bold text-black transition-opacity hover:opacity-90">
                Discuss a partnership <ArrowRight size={17} />
              </Link>
              <Link to="/demo" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-7 py-4 text-sm font-semibold text-white/70 transition-colors hover:border-primary/30 hover:text-white">
                View platform demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-[#090909] py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Platform capabilities</p>
            <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Technology for controlled financial operations</h2>
            <p className="mt-4 leading-relaxed text-white/45">Designed to integrate with authorised institutions and regulated providers while keeping operational authority and evidence clear.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-7">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.08] text-primary"><Icon size={20} /></div>
                <h3 className="mt-6 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/45">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#070707] py-24">
        <div className="container mx-auto grid gap-12 px-4 md:px-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><Scale size={14} /> Responsible activation</div>
            <h2 className="mt-4 max-w-xl text-3xl font-bold text-white md:text-4xl">Built for partnership-led, phased delivery</h2>
            <p className="mt-5 max-w-xl leading-relaxed text-white/55">
              Product capabilities are activated only with the appropriate legal permissions, contracted providers, safeguarding arrangements and operational approvals.
            </p>
            <Link to="/about" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-[#F0D080]">About City Gate Capital <ArrowRight size={15} /></Link>
          </div>
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-7 md:p-9">
            <div className="mb-6 flex items-center gap-3"><Globe2 className="text-primary" size={22} /><h3 className="font-semibold text-white">Readiness programme</h3></div>
            <ul className="space-y-4">
              {readiness.map(item => <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-white/55"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" />{item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] bg-[#090909] py-20 text-center">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl font-bold text-white md:text-4xl">Start a serious conversation</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/45">For sponsor, programme-provider, technology, compliance and institutional partnership enquiries.</p>
          <Link to="/contact" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#F0D080] px-7 py-4 text-sm font-bold text-black">Contact us <ArrowRight size={16} /></Link>
        </div>
      </section>
    </>
  );
}
