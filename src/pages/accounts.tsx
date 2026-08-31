import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, BriefcaseBusiness, Building2, CheckCircle2,
  CircleDollarSign, Fingerprint, Globe2, Landmark, LockKeyhole,
  ShieldCheck, Sparkles, UserRound, WalletCards,
} from 'lucide-react';
import AccountOpeningModal from '@/components/AccountOpeningModal';

const accountOptions = [
  {
    icon: UserRound,
    title: 'Personal',
    description: 'A connected account experience for everyday financial organisation, account activity and secure access.',
    features: ['Account overview', 'Statements and activity', 'Security controls'],
  },
  {
    icon: CircleDollarSign,
    title: 'Savings',
    description: 'Goal-led tools designed to help you organise savings objectives and follow progress over time.',
    features: ['Savings goals', 'Progress insights', 'Account history'],
  },
  {
    icon: BriefcaseBusiness,
    title: 'Business',
    description: 'Operational visibility for business finances, team access and structured account administration.',
    features: ['Team access', 'Approval workflows', 'Business reporting'],
  },
  {
    icon: Globe2,
    title: 'Multi-Currency',
    description: 'A unified view of supported currencies, with availability determined by eligibility and provider coverage.',
    features: ['Supported currencies', 'FX information', 'Consolidated visibility'],
  },
  {
    icon: Landmark,
    title: 'Wealth',
    description: 'A premium financial overview for eligible customers seeking deeper reporting and relationship support.',
    features: ['Portfolio visibility', 'Advanced reporting', 'Relationship support'],
  },
] as const;

const accessSteps = [
  { icon: UserRound, title: 'Create your profile', description: 'Provide your contact details and create secure sign-in credentials.' },
  { icon: BadgeCheck, title: 'Complete the required review', description: 'Identity, eligibility and service checks are completed before eligible features become available.' },
  { icon: Fingerprint, title: 'Protect your access', description: 'Configure the security controls available for your profile, including multi-factor verification.' },
  { icon: WalletCards, title: 'Manage your financial view', description: 'Use one authenticated workspace for accounts, activity, documents and available services.' },
] as const;

const safeguards = [
  'Separate customer and administrator access',
  'Multi-factor verification and session controls',
  'Account activity and security notifications',
  'Eligibility and feature-availability checks',
] as const;

export default function AccountsPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Helmet>
        <title>Explore Account Options | City Gate Capital</title>
        <meta name="description" content="Explore City Gate Capital personal, savings, business, multi-currency and wealth account experiences. Availability depends on eligibility and approved service arrangements." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://citygate.capital/accounts" />
        <meta property="og:title" content="Choose the Account That Fits Your Ambition | City Gate Capital" />
        <meta property="og:description" content="Explore connected account experiences designed for personal, business and international financial needs." />
        <meta property="og:url" content="https://citygate.capital/accounts" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Explore Account Options | City Gate Capital" />
        <meta name="twitter:description" content="Personal, savings, business, multi-currency and wealth account experiences in one connected platform." />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': 'https://citygate.capital/accounts#webpage',
          name: 'Explore Account Options | City Gate Capital',
          url: 'https://citygate.capital/accounts',
          isPartOf: { '@id': 'https://citygate.capital/#website' },
          about: { '@id': 'https://citygate.capital/#organization' },
          mainEntity: {
            '@type': 'ItemList',
            name: 'City Gate Capital account experiences',
            itemListElement: accountOptions.map((option, index) => ({
              '@type': 'ListItem', position: index + 1, name: `${option.title} account experience`,
            })),
          },
        }) }} />
      </Helmet>

      <main className="overflow-hidden bg-[#050505] text-foreground">
        <section className="relative border-b border-white/[0.06] pb-24 pt-24 md:pb-32 md:pt-32">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(201,168,76,0.16),transparent_35%),radial-gradient(circle_at_18%_82%,rgba(98,126,234,0.1),transparent_30%)]" />
          <div className="container relative mx-auto px-4 md:px-6">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }} className="mx-auto max-w-4xl text-center">
              <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                <Sparkles size={14} /> Account options
              </span>
              <h1 className="text-4xl font-bold leading-[1.08] tracking-tight md:text-6xl lg:text-7xl">
                Choose the Account That Fits <span className="text-gold-gradient">Your Ambition</span>
              </h1>
              <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-foreground/60 md:text-lg">
                Explore a connected financial experience designed around personal goals, business needs and supported international activity.
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <button type="button" onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#F0D080] px-7 py-4 text-sm font-bold text-black transition-transform hover:-translate-y-0.5">
                  Start Your Application <ArrowRight size={17} />
                </button>
                <Link to="/digital-banking" className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-white/[0.025] px-7 py-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/55">
                  Explore Digital Banking
                </Link>
              </div>
              <p className="mx-auto mt-7 max-w-2xl text-xs leading-6 text-foreground/40">
                Submitting an application does not guarantee access to any service. Availability depends on verification, eligibility, jurisdiction and approved provider arrangements.
              </p>
            </motion.div>
          </div>
        </section>

        <section className="py-20 md:py-28" aria-labelledby="account-options-heading">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-12 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Designed around you</p>
              <h2 id="account-options-heading" className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">One platform, distinct financial needs</h2>
              <p className="mt-5 text-sm leading-7 text-foreground/55 md:text-base">
                Each account experience brings together the information, controls and support appropriate to its purpose. Enabled capabilities are shown after sign-in.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              {accountOptions.map((option, index) => {
                const Icon = option.icon;
                return (
                  <motion.article key={option.title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 transition-colors hover:border-primary/25">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Icon size={21} /></div>
                    <h3 className="text-lg font-semibold">{option.title}</h3>
                    <p className="mt-3 min-h-24 text-sm leading-6 text-foreground/50">{option.description}</p>
                    <ul className="mt-5 space-y-2 border-t border-white/[0.06] pt-5">
                      {option.features.map(feature => (
                        <li key={feature} className="flex items-start gap-2 text-xs leading-5 text-foreground/55"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-primary" /> {feature}</li>
                      ))}
                    </ul>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.06] bg-[#080806] py-20 md:py-28" aria-labelledby="access-heading">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Guided access</p>
              <h2 id="access-heading" className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">A clear path from profile to platform</h2>
              <p className="mt-5 text-sm leading-7 text-foreground/55 md:text-base">Account access follows a structured process so security, eligibility and service availability are clear at every stage.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {accessSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <article key={step.title} className="relative rounded-2xl border border-white/[0.07] bg-black/30 p-6">
                    <span className="absolute right-5 top-4 text-xs font-semibold text-primary/45">0{index + 1}</span>
                    <Icon size={23} className="text-primary" />
                    <h3 className="mt-5 text-base font-semibold">{step.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-foreground/50">{step.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-20 md:py-28" aria-labelledby="security-heading">
          <div className="container mx-auto grid items-center gap-12 px-4 md:px-6 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary"><ShieldCheck size={14} /> Security and control</span>
              <h2 id="security-heading" className="mt-6 text-3xl font-bold tracking-tight md:text-5xl">Account access built around protection</h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-foreground/55 md:text-base">Customer access is separated from administration and protected with server-side authorization, session controls and audit-supported workflows.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {safeguards.map(item => (
                  <div key={item} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 text-sm leading-6 text-foreground/60"><LockKeyhole size={16} className="mt-1 shrink-0 text-primary" /> {item}</div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-primary/20 bg-[linear-gradient(145deg,rgba(201,168,76,0.1),rgba(255,255,255,0.02))] p-7 md:p-10">
              <Building2 size={30} className="text-primary" />
              <h3 className="mt-6 text-2xl font-bold">Service availability</h3>
              <p className="mt-4 text-sm leading-7 text-foreground/55">Product pages describe the intended customer experience. Specific capabilities appear in the authenticated dashboard only when the relevant verification, provider and operational requirements are satisfied.</p>
              <ul className="mt-6 space-y-3 text-sm text-foreground/60">
                <li className="flex gap-3"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" /> Supported currencies and assets are shown in your account.</li>
                <li className="flex gap-3"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" /> Restricted or unavailable features remain disabled.</li>
                <li className="flex gap-3"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" /> Legal and service disclosures remain accessible before use.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.06] pb-24 pt-20">
          <div className="container mx-auto px-4 text-center md:px-6">
            <h2 className="text-3xl font-bold md:text-5xl">Ready to explore your options?</h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-foreground/55 md:text-base">Begin with a secure profile and continue through the verification and eligibility steps appropriate to your selected service.</p>
            <button type="button" onClick={() => setModalOpen(true)} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#F0D080] px-8 py-4 text-sm font-bold text-black">
              Start Your Application <ArrowRight size={17} />
            </button>
          </div>
        </section>
      </main>

      <AccountOpeningModal open={modalOpen} onClose={() => setModalOpen(false)} initialPlan="Personal" />
    </>
  );
}
