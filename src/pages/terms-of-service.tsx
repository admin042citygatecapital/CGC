import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { FileText, Shield, AlertTriangle, CreditCard, Globe, Lock, ChevronRight, Scale, Ban, Mail } from 'lucide-react';

const LAST_UPDATED = 'May 23, 2026';
const EFFECTIVE_DATE = 'May 23, 2026';
const CANONICAL = 'https://citygate.capital/terms-of-service';

const sections = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    icon: FileText,
    content: [
      {
        subtitle: '1.1 Agreement',
        body: `By accessing or using any City Gate Capital service — including our website, mobile application, API, or any product offered under the City Gate Capital brand — you agree to be bound by these Terms of Service ("Terms"), our Privacy Policy, Cookie Policy, and any additional terms applicable to specific services. If you do not agree, you must not use our services.`,
      },
      {
        subtitle: '1.2 Eligibility',
        body: `You must be at least 18 years of age (or the age of majority in your jurisdiction, if higher) to use our services. By agreeing to these Terms, you represent and warrant that you meet this requirement and that you are not prohibited from using financial services under applicable law.`,
      },
      {
        subtitle: '1.3 Business Accounts',
        body: `If you are accepting these Terms on behalf of a company or other legal entity, you represent that you have the authority to bind that entity. In that case, "you" refers to that entity.`,
      },
    ],
  },
  {
    id: 'services',
    title: '2. Our Services',
    icon: CreditCard,
    content: [
      {
        subtitle: '2.1 Service Description',
        body: `City Gate Capital provides digital banking services including multi-currency accounts, domestic and international payment processing, debit and virtual card issuance, cryptocurrency custody and exchange, savings products, and related financial services. The specific services available to you depend on your account type, jurisdiction, and KYC verification status.`,
      },
      {
        subtitle: '2.2 Service Availability',
        body: `We aim to maintain 99.9% uptime but do not guarantee uninterrupted access. We may suspend services temporarily for maintenance, security updates, or regulatory compliance. We will provide advance notice where reasonably practicable.`,
      },
      {
        subtitle: '2.3 Service Changes',
        body: `We reserve the right to modify, suspend, or discontinue any service at any time with reasonable notice. We will notify you of material changes at least 30 days in advance where required by applicable law.`,
      },
    ],
  },
  {
    id: 'account',
    title: '3. Account Registration & KYC',
    icon: Shield,
    content: [
      {
        subtitle: '3.1 Account Opening',
        body: `To use our services, you must complete our account registration process, which includes providing accurate personal information and completing identity verification (KYC). You agree to provide truthful, current, and complete information and to update it promptly if it changes.`,
      },
      {
        subtitle: '3.2 Identity Verification',
        body: `We are required by law to verify your identity before providing financial services. This includes collecting government-issued identification, proof of address, and in some cases, source of funds documentation. We use automated and manual verification processes. Failure to complete verification will result in restricted or suspended account access.`,
      },
      {
        subtitle: '3.3 Account Security',
        body: `You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. You must notify us immediately at security@citygate.capital if you suspect unauthorised access. We will never ask for your password by email, phone, or chat.`,
      },
      {
        subtitle: '3.4 One Account Per Person',
        body: `Each individual may hold only one personal account. Operating multiple accounts is prohibited and may result in immediate account suspension and reporting to relevant authorities.`,
      },
    ],
  },
  {
    id: 'payments',
    title: '4. Payments & Transactions',
    icon: CreditCard,
    content: [
      {
        subtitle: '4.1 Transaction Authorisation',
        body: `By initiating a payment or transaction, you authorise City Gate Capital to execute it on your behalf. Once a payment instruction is submitted and confirmed, it may not be reversible. You are responsible for verifying all transaction details before confirming.`,
      },
      {
        subtitle: '4.2 Fees',
        body: `Our fee schedule is published in the app and at citygate.capital/fees. Fees are deducted from your account balance at the time of the transaction. We reserve the right to change fees with 30 days' notice. Continued use after the notice period constitutes acceptance of the new fees.`,
      },
      {
        subtitle: '4.3 Transaction Limits',
        body: `Transaction limits apply based on your account tier and verification status. Standard accounts: $10,000/day. Premium accounts: $50,000/day. Elite accounts: custom limits. Limits may be temporarily reduced for security reasons.`,
      },
      {
        subtitle: '4.4 Declined Transactions',
        body: `We may decline transactions that appear suspicious, violate our policies, exceed your limits, or are required to be blocked under applicable law. We will notify you of declined transactions where legally permitted.`,
      },
    ],
  },
  {
    id: 'prohibited',
    title: '5. Prohibited Uses',
    icon: Ban,
    content: [
      {
        subtitle: '5.1 Prohibited Activities',
        body: `You must not use our services for: money laundering, terrorist financing, or any activity that violates applicable AML/CFT laws; purchasing, selling, or facilitating illegal goods or services; fraud, identity theft, or impersonation; market manipulation or insider trading; circumventing sanctions or export controls; operating unlicensed financial services; or any activity that violates applicable law.`,
      },
      {
        subtitle: '5.2 Restricted Jurisdictions',
        body: `Our services are not available to residents of jurisdictions subject to comprehensive sanctions (including but not limited to North Korea, Iran, Cuba, Syria, and the Crimea region). You represent that you are not located in, or acting on behalf of a person located in, a restricted jurisdiction.`,
      },
      {
        subtitle: '5.3 Consequences',
        body: `Violation of these prohibitions will result in immediate account suspension, forfeiture of any pending transactions, reporting to relevant law enforcement and regulatory authorities, and potential civil or criminal liability.`,
      },
    ],
  },
  {
    id: 'crypto',
    title: '6. Cryptocurrency Services',
    icon: Globe,
    content: [
      {
        subtitle: '6.1 Risk Disclosure',
        body: `Cryptocurrency assets are highly volatile and speculative. Their value can decrease to zero. Cryptocurrency is not legal tender, is not backed by any government, and is not covered by deposit protection schemes. Past performance is not indicative of future results. You should only invest what you can afford to lose.`,
      },
      {
        subtitle: '6.2 Custody',
        body: `We hold cryptocurrency on your behalf in segregated cold storage wallets. You retain beneficial ownership of your crypto assets. In the event of our insolvency, your crypto assets are held separately from our corporate assets and are not available to our creditors.`,
      },
      {
        subtitle: '6.3 Regulatory Status',
        body: `Cryptocurrency services are regulated differently across jurisdictions. In some jurisdictions, our crypto services may be provided by a regulated entity; in others, they may not be subject to the same regulatory protections as traditional financial services. Please review the regulatory disclosures applicable to your jurisdiction.`,
      },
    ],
  },
  {
    id: 'intellectual-property',
    title: '7. Intellectual Property',
    icon: Lock,
    content: [
      {
        subtitle: '7.1 Our IP',
        body: `All content, software, trademarks, logos, and intellectual property on our platform are owned by or licensed to City Gate Capital. You may not copy, reproduce, distribute, or create derivative works without our express written consent.`,
      },
      {
        subtitle: '7.2 Licence to You',
        body: `We grant you a limited, non-exclusive, non-transferable, revocable licence to access and use our services for your personal or internal business purposes, subject to these Terms.`,
      },
    ],
  },
  {
    id: 'liability',
    title: '8. Limitation of Liability',
    icon: Scale,
    content: [
      {
        subtitle: '8.1 Disclaimer',
        body: `To the maximum extent permitted by applicable law, City Gate Capital provides its services "as is" and "as available" without warranties of any kind, express or implied, including warranties of merchantability, fitness for a particular purpose, or non-infringement.`,
      },
      {
        subtitle: '8.2 Limitation',
        body: `To the maximum extent permitted by law, City Gate Capital's total liability to you for any claim arising out of or relating to these Terms or our services shall not exceed the greater of (a) the fees you paid to us in the 12 months preceding the claim, or (b) £100 / $100 / €100.`,
      },
      {
        subtitle: '8.3 Exclusions',
        body: `Nothing in these Terms limits our liability for death or personal injury caused by our negligence, fraud or fraudulent misrepresentation, or any other liability that cannot be excluded or limited by applicable law.`,
      },
    ],
  },
  {
    id: 'termination',
    title: '9. Termination',
    icon: AlertTriangle,
    content: [
      {
        subtitle: '9.1 Termination by You',
        body: `You may close your account at any time by contacting support@citygate.capital. Account closure is subject to the settlement of any pending transactions and the return of your balance, net of applicable fees.`,
      },
      {
        subtitle: '9.2 Termination by Us',
        body: `We may suspend or terminate your account immediately if you breach these Terms, engage in prohibited activities, fail to complete KYC, or if we are required to do so by law or regulatory order. We will provide notice where legally permitted.`,
      },
      {
        subtitle: '9.3 Effect of Termination',
        body: `Upon termination, your right to use our services ceases immediately. Provisions that by their nature should survive termination (including liability limitations, dispute resolution, and data retention obligations) will continue to apply.`,
      },
    ],
  },
  {
    id: 'governing-law',
    title: '10. Governing Law & Disputes',
    icon: Scale,
    content: [
      {
        subtitle: '10.1 Governing Law',
        body: `These Terms are governed by the laws of England and Wales, without regard to conflict of law principles. If you are a consumer in the EEA, you also benefit from the mandatory consumer protection laws of your country of residence.`,
      },
      {
        subtitle: '10.2 Dispute Resolution',
        body: `We encourage you to contact us first to resolve any dispute informally. If we cannot resolve a dispute within 30 days, either party may refer it to the courts of England and Wales, or to an alternative dispute resolution scheme where required by applicable law.`,
      },
      {
        subtitle: '10.3 Contact',
        body: `For any questions about these Terms, contact legal@citygate.capital. Our registered address is City Gate Capital Ltd, International Financial Centre, London, United Kingdom.`,
      },
    ],
  },
];

const tocItems = sections.map(s => ({ id: s.id, title: s.title }));

export default function TermsOfServicePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Terms of Service — City Gate Capital',
    url: CANONICAL,
    description: 'The legal agreement governing your use of City Gate Capital digital banking services.',
    dateModified: LAST_UPDATED,
    publisher: {
      '@type': 'Organization',
      name: 'City Gate Capital',
      url: 'https://citygate.capital',
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://citygate.capital' },
        { '@type': 'ListItem', position: 2, name: 'Terms of Service', item: CANONICAL },
      ],
    },
  };

  return (
    <>
      <Helmet>
        <title>Terms of Service — City Gate Capital</title>
        <meta name="description" content="Read the Terms of Service governing your use of City Gate Capital's digital banking, payments, and cryptocurrency services." />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content="Terms of Service — City Gate Capital" />
        <meta property="og:description" content="The legal agreement governing your use of City Gate Capital digital banking services." />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://citygate.capital/api/og?title=Terms+of+Service&description=Legal+agreement+governing+City+Gate+Capital+services" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content="Terms of Service — City Gate Capital" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:title" content="Terms of Service — City Gate Capital" />
        <meta name="twitter:description" content="The legal agreement governing your use of City Gate Capital digital banking services." />
        <meta name="twitter:image" content="https://citygate.capital/api/og?title=Terms+of+Service&description=Legal+agreement+governing+City+Gate+Capital+services" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="container mx-auto px-4 md:px-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-foreground/35 mb-8">
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight size={12} />
            <span className="text-foreground/55">Terms of Service</span>
          </nav>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium mb-6">
              <Scale size={12} />
              Legal Document
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
              Terms of Service
            </h1>
            <p className="text-foreground/55 text-lg leading-relaxed mb-6">
              Please read these Terms carefully before using our services. They form a legally binding agreement between you and City Gate Capital.
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-foreground/40">
              <span>Effective: <span className="text-foreground/60">{EFFECTIVE_DATE}</span></span>
              <span>·</span>
              <span>Last updated: <span className="text-foreground/60">{LAST_UPDATED}</span></span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Body */}
      <section className="pb-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 max-w-6xl">

            {/* Sticky TOC */}
            <aside className="hidden lg:block lg:col-span-1">
              <div className="sticky top-28 space-y-1">
                <p className="text-[10px] font-bold text-foreground/25 uppercase tracking-[0.18em] mb-4">Contents</p>
                {tocItems.map(item => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block text-xs text-foreground/40 hover:text-primary py-1.5 pl-3 border-l border-primary/10 hover:border-primary/40 transition-colors leading-snug"
                  >
                    {item.title}
                  </a>
                ))}
                <div className="pt-6 border-t border-primary/10 mt-6">
                  <p className="text-[10px] text-foreground/25 mb-3">Related</p>
                  <Link to="/privacy-policy" className="block text-xs text-foreground/40 hover:text-primary py-1 transition-colors">Privacy Policy</Link>
                  <Link to="/cookie-policy" className="block text-xs text-foreground/40 hover:text-primary py-1 transition-colors">Cookie Policy</Link>
                  <Link to="/compliance" className="block text-xs text-foreground/40 hover:text-primary py-1 transition-colors">Compliance</Link>
                </div>
              </div>
            </aside>

            {/* Content */}
            <main className="lg:col-span-3 space-y-12">
              {sections.map((section, i) => {
                const Icon = section.icon;
                return (
                  <motion.article
                    key={section.id}
                    id={section.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.03 }}
                    className="scroll-mt-28"
                  >
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Icon size={14} className="text-primary" />
                      </div>
                      <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>
                        {section.title}
                      </h2>
                    </div>
                    <div className="space-y-5 pl-11">
                      {section.content.map(block => (
                        <div key={block.subtitle}>
                          <h3 className="text-sm font-semibold text-foreground/80 mb-2">{block.subtitle}</h3>
                          <p className="text-sm text-foreground/55 leading-relaxed">{block.body}</p>
                        </div>
                      ))}
                    </div>
                    {i < sections.length - 1 && (
                      <div className="mt-10 h-px bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
                    )}
                  </motion.article>
                );
              })}

              {/* Contact card */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                    <Mail size={16} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Legal Enquiries</h3>
                    <p className="text-sm text-foreground/55 mb-3">For questions about these Terms or our legal obligations, contact our legal team.</p>
                    <a href="mailto:legal@citygate.capital" className="text-sm text-primary hover:underline font-medium">legal@citygate.capital</a>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </section>
    </>
  );
}
