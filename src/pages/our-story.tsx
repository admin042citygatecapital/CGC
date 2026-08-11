import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, Landmark, Scale, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const principles = [
  ['Truth in status', 'Describe what exists today, what is being tested, and what still depends on authorisation or a regulated partner.'],
  ['Customer needs first', 'Design journeys around comprehension, accessibility, support, and good outcomes—not just speed.'],
  ['Consent with purpose', 'Ask for data only when the purpose is clear, proportionate, and protected.'],
  ['No invisible money movement', 'Every future financial instruction must be traceable, authorised, reconcilable, and explainable.'],
  ['Separation of duties', 'High-risk decisions require defined roles, independent review, and an immutable audit trail.'],
  ['Explain inflation honestly', 'Distinguish the rate of inflation from the price level and national averages from personal experience.'],
  ['Provider authority', 'A regulated sponsor or core provider—not this interface—must remain authoritative for regulated accounts and execution.'],
  ['Graceful failure', 'When identity, payment, or provider systems are uncertain, stop safely and communicate clearly.'],
];

const stories = [
  ['Aisha, the household planner', 'Aisha wants one calm view of recurring costs across currencies. She needs clear exchange-rate context and privacy controls, not a promise that technology can make inflation disappear.'],
  ['Daniel, the small importer', 'Daniel needs to understand the rate, fee, settlement route, and status of an international payment before committing. Certainty matters more than a decorative live-price badge.'],
  ['Meera, the compliance reviewer', 'Meera needs evidence, ownership, timestamps, and maker-checker review. Her work is not a button that bypasses KYC or AML; it is accountable orchestration around approved providers and policy.'],
];

const roadmap = [
  ['01', 'Sponsor sandbox', 'Synthetic customers, six-currency product design, and no real funds.'],
  ['02', 'Controlled consumer pilot', 'UK individuals and limited GBP, EUR, and USD corridors—only after sponsor and legal approval.'],
  ['03', 'Business expansion', 'KYB, beneficial owners, authorised users, and additional approved currencies.'],
  ['04', 'International payouts', 'Corridors activated individually after screening, reconciliation, disclosure, and sponsor approval.'],
];

const sources = [
  ['UK consumer price inflation', 'Office for National Statistics', 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/consumerpriceinflation/latest'],
  ['Bank Rate', 'Bank of England', 'https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp'],
  ['The 2% inflation target', 'Bank of England', 'https://www.bankofengland.co.uk/monetary-policy/inflation'],
  ['Safeguarding requirements', 'Financial Conduct Authority', 'https://www.fca.org.uk/firms/emi-payment-institutions-safeguarding-requirements'],
  ['Consumer Duty', 'Financial Conduct Authority', 'https://www.fca.org.uk/firms/consumer-duty'],
  ['Applying as an EMI', 'Financial Conduct Authority', 'https://www.fca.org.uk/firms/apply-emoney-payment-institution/emi'],
  ['Deposit protection', 'Financial Services Compensation Scheme', 'https://www.fscs.org.uk/what-we-cover/banks-building-societies/'],
  ['Open Banking in the UK', 'Open Banking Limited', 'https://www.openbanking.org.uk/'],
];

const Reveal = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} className={className}>{children}</motion.div>
);

export default function OurStoryPage() {
  const title = 'Our Story: Banking, Policy and Inflation | City Gate Capital';
  const description = 'The City Gate Capital story: why clarity, accountable policy, and honest inflation context shape our partnership-led financial-technology platform.';
  return <>
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href="https://citygate.capital/our-story" />
      <meta property="og:type" content="article" /><meta property="og:title" content={title} /><meta property="og:description" content={description} />
      <meta property="og:url" content="https://citygate.capital/our-story" /><meta property="og:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
      <meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content={title} /><meta name="twitter:description" content={description} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: 'The Gate, the City and the Value of Trust', description, datePublished: '2026-08-11', dateModified: '2026-08-11', mainEntityOfPage: 'https://citygate.capital/our-story', author: { '@type': 'Organization', name: 'City Gate Capital' }, publisher: { '@type': 'Organization', name: 'City Gate Capital', logo: { '@type': 'ImageObject', url: 'https://citygate.capital/assets/brand/city-gate-capital-seal.png' } } }) }} />
    </Helmet>

    <main className="overflow-hidden">
      <section className="relative pt-40 pb-24 border-b border-primary/10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        <div className="container mx-auto px-4 md:px-6 relative max-w-5xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary mb-6">The City Gate Capital story</p>
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight max-w-4xl">The gate, the city and the <span className="text-gold-gradient">value of trust.</span></h1>
            <p className="text-xl md:text-2xl text-foreground/60 leading-relaxed mt-8 max-w-3xl">A story about digital banking, responsible policy, and the way inflation reaches real lives.</p>
          </Reveal>
          <Reveal className="mt-12 rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-6 md:p-8">
            <div className="flex gap-4"><ShieldCheck className="text-primary shrink-0" />
              <div><h2 className="font-semibold text-foreground mb-2">Product and regulatory status</h2><p className="text-sm leading-7 text-foreground/65">City Gate Capital is currently a financial-technology platform pursuing a partnership-led UK launch. It is not presently represented as an authorised bank, does not accept customer deposits or execute live financial transactions, and does not claim FSCS protection. Any future regulated service remains subject to legal approval, contracted authorised providers, and operational readiness.</p></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-24"><div className="container mx-auto px-4 md:px-6 max-w-4xl space-y-16">
        <Reveal><p className="text-primary text-xs uppercase tracking-[0.25em] mb-4">The world outside the gate</p><h2 className="text-3xl md:text-5xl font-bold mb-7">Inflation is not one number.</h2><div className="space-y-5 text-foreground/65 leading-8 text-lg"><p>Official inflation measures help describe what is happening across an economy, but no national average can reproduce one household's experience. Rent, food, transport, energy, imports, savings, and debt each carry different weight from person to person.</p><p>In June 2026, the UK Consumer Prices Index was 2.6%, while CPIH was 2.8%, according to the Office for National Statistics. The Bank of England's inflation target remains 2%. Those figures are important, but a falling inflation rate does not mean prices have returned to where they began; it means the general price level is rising more slowly.</p><p>Policy travels through people. Interest-rate decisions influence borrowing, saving, investment, sterling, and demand, but not at the same speed or in the same way for everyone. Good financial technology should make that context clearer without pretending to predict a customer's future.</p></div></Reveal>

        <Reveal><div className="grid md:grid-cols-[180px_1fr] gap-8"><Landmark className="text-primary w-14 h-14"/><div><p className="text-primary text-xs uppercase tracking-[0.25em] mb-4">Why City Gate</p><h2 className="text-3xl md:text-5xl font-bold mb-7">A boundary between movement and safety.</h2><div className="space-y-5 text-foreground/65 leading-8 text-lg"><p>A city gate is both an opening and a control: it connects trade with community while defining where responsibility begins. Capital is stored effort—the capacity to meet today's needs and shape tomorrow's choices.</p><p>That pairing became our design test. Can a platform make global movement feel simple while keeping identity, permission, record-keeping, and accountability visible? Can it serve one customer across household, business, and currency realities without collapsing important distinctions?</p><p>Our answer begins with clarity before velocity. Protections must have precise names. A safeguarded payment account is not automatically a bank deposit. Provider obligations, eligibility, execution status, and compensation arrangements must be explained exactly as they apply.</p></div></div></div></Reveal>
      </div></section>

      <section className="py-24 bg-[#060606] border-y border-primary/10"><div className="container mx-auto px-4 md:px-6 max-w-6xl"><Reveal><div className="text-center max-w-3xl mx-auto mb-14"><Scale className="mx-auto text-primary mb-5"/><p className="text-primary text-xs uppercase tracking-[0.25em] mb-4">Our policy charter</p><h2 className="text-4xl md:text-5xl font-bold">Eight rules for earning trust.</h2></div></Reveal><div className="grid md:grid-cols-2 gap-4">{principles.map(([name, detail], i) => <Reveal key={name} className="glass-card rounded-2xl p-6 border border-primary/10"><div className="flex gap-4"><span className="text-primary font-semibold">{String(i + 1).padStart(2, '0')}</span><div><h3 className="font-semibold mb-2">{name}</h3><p className="text-sm text-foreground/55 leading-6">{detail}</p></div></div></Reveal>)}</div></div></section>

      <section className="py-24"><div className="container mx-auto px-4 md:px-6 max-w-5xl"><Reveal><p className="text-primary text-xs uppercase tracking-[0.25em] mb-4">Governance before growth</p><h2 className="text-4xl md:text-5xl font-bold mb-8">Controls are part of the product.</h2><div className="grid md:grid-cols-2 gap-8 text-foreground/65 leading-8"><p>Customer and administrator identities must remain separate. Permissions belong on the server, sensitive actions belong in immutable audit logs, and high-risk approvals require maker-checker separation. KYC and AML administration coordinates evidence and decisions; it cannot replace an approved verification or screening provider.</p><p>When live money is eventually permitted, balances must follow a provider-authoritative, double-entry ledger with idempotency, reversals, and daily reconciliation. A polished interface cannot become the source of financial truth.</p></div></Reveal></div></section>

      <section className="py-24 bg-[#060606]"><div className="container mx-auto px-4 md:px-6 max-w-6xl"><Reveal><p className="text-primary text-xs uppercase tracking-[0.25em] mb-4">Three illustrative lives</p><h2 className="text-4xl md:text-5xl font-bold mb-4">What clarity looks like in practice.</h2><p className="text-foreground/50 mb-12">These are illustrative scenarios, not customer testimonials.</p></Reveal><div className="grid md:grid-cols-3 gap-5">{stories.map(([name, text]) => <Reveal key={name} className="glass-card rounded-2xl p-7 border border-primary/10"><h3 className="font-semibold text-lg mb-4">{name}</h3><p className="text-sm text-foreground/55 leading-7">{text}</p></Reveal>)}</div></div></section>

      <section className="py-24"><div className="container mx-auto px-4 md:px-6 max-w-5xl"><Reveal><p className="text-primary text-xs uppercase tracking-[0.25em] mb-4">A phased path</p><h2 className="text-4xl md:text-5xl font-bold mb-12">Open the gate only when it is ready.</h2></Reveal><div className="space-y-4">{roadmap.map(([n, title, text]) => <Reveal key={n} className="rounded-2xl border border-primary/15 p-6 md:p-8 flex gap-6"><span className="text-primary text-xl font-semibold">{n}</span><div><h3 className="font-semibold text-lg mb-2">{title}</h3><p className="text-foreground/55 leading-7">{text}</p></div></Reveal>)}</div></div></section>

      <section className="py-24 border-y border-primary/10 bg-primary/[0.03]"><div className="container mx-auto px-4 md:px-6 max-w-4xl text-center"><Reveal><blockquote className="text-3xl md:text-5xl font-medium leading-tight">“Build the gate carefully. Explain what lies beyond it. Open it only when trust can travel both ways.”</blockquote><p className="text-primary mt-7 text-sm uppercase tracking-[0.2em]">City Gate Capital</p><address className="mt-4 text-sm leading-6 text-foreground/55 not-italic">51 Mosley Street<br />Manchester M2 3HQ<br />United Kingdom</address><Link to="/contact" className="inline-flex items-center gap-2 mt-10 px-7 py-4 rounded-xl bg-primary text-black font-semibold">Talk to our team <ArrowRight size={18}/></Link></Reveal></div></section>

      <section className="py-20"><div className="container mx-auto px-4 md:px-6 max-w-5xl"><Reveal><h2 className="text-2xl font-bold mb-3">Sources and further reading</h2><p className="text-sm text-foreground/50 mb-8">Official sources accessed 11 August 2026. Figures and rules can change; follow the linked authority for the latest position.</p><div className="grid md:grid-cols-2 gap-3">{sources.map(([title, org, url]) => <a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-start gap-3 rounded-xl border border-primary/10 p-4 hover:border-primary/30 transition-colors"><CheckCircle2 size={17} className="text-primary mt-0.5 shrink-0"/><span><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-foreground/45 mt-1">{org}</span></span></a>)}</div></Reveal></div></section>
    </main>
  </>;
}
