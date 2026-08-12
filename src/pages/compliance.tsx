import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Shield, Globe, FileText, Lock, AlertTriangle, CheckCircle, ChevronRight, Mail, Scale, Eye } from 'lucide-react';

const LAST_UPDATED = 'August 12, 2026';
const CANONICAL = 'https://citygate.capital/compliance';

const regulatoryBadges = [
  { label: 'Legal Review', region: 'Required before launch', color: '#C9A84C' },
  { label: 'KYC Provider', region: 'Contract required', color: '#627EEA' },
  { label: 'AML Screening', region: 'Contract required', color: '#10B981' },
  { label: 'Payment Rails', region: 'Approval required', color: '#9945FF' },
  { label: 'Custody Provider', region: 'Approval required', color: '#EC4899' },
  { label: 'External Audit', region: 'Evidence required', color: '#F7931A' },
];

const certifications = [
  { title: 'Encryption', desc: 'Secure transport and protected credentials', icon: Lock },
  { title: 'Access Control', desc: 'Role-based administration', icon: Shield },
  { title: 'Audit Trail', desc: 'Administrative mutation logging', icon: FileText },
  { title: 'Privacy Review', desc: 'Required before processing live data', icon: Eye },
  { title: 'Data Minimisation', desc: 'Collect only what the current service requires', icon: Eye },
  { title: 'Launch Guard', desc: 'Live money movement disabled by default', icon: AlertTriangle },
];

const verifiedSections = [
  {
    id: 'regulatory-framework',
    title: '1. Regulatory Framework',
    icon: Globe,
    content: [
      {
        subtitle: '1.1 Licensing & Registration',
        body: `No financial-services licence or registration has been verified for publication. The legal entity, operating model, target jurisdiction, and required permissions must be confirmed by qualified counsel before launch.`,
      },
      {
        subtitle: '1.2 Regulatory Oversight',
        body: `No primary financial regulator or independent compliance-audit programme is currently identified for City Gate Capital financial services. Any oversight or audit claim requires documentary evidence and legal approval.`,
      },
      {
        subtitle: '1.3 Jurisdictional Coverage',
        body: `Financial services are not currently activated in any jurisdiction. Geographic availability remains disabled until each proposed market has documented legal analysis, permissions, provider coverage and consumer disclosures.`,
      },
    ],
  },
  {
    id: 'aml-cft',
    title: '2. Anti-Money Laundering & Counter-Terrorism Financing',
    icon: AlertTriangle,
    content: [
      {
        subtitle: '2.1 AML Programme',
        body: `A production AML/CFT programme has not yet been approved. Before financial-service activation, qualified specialists must establish risk assessments, policies, ownership, escalation, reporting, quality assurance and jurisdiction-specific controls.`,
      },
      {
        subtitle: '2.2 Know Your Customer (KYC)',
        body: `Production identity verification is disabled. City Gate Capital must contract and review a KYC provider, establish lawful data handling, configure verification and exception workflows, and test the integration before collecting identity documents.`,
      },
      {
        subtitle: '2.3 Transaction Monitoring',
        body: `No live transactions are processed and no production transaction-monitoring programme is active. Monitoring rules, case management, reporting responsibilities, model governance where applicable, and regulator filing procedures must be approved before launch.`,
      },
      {
        subtitle: '2.4 Sanctions Screening',
        body: `Production sanctions, PEP, and adverse-media screening are not connected. Applicable lists, screening frequency, match handling, escalation, geographic restrictions, and reporting duties must be established with a contracted provider.`,
      },
      {
        subtitle: '2.5 Record Keeping',
        body: `The current platform does not collect production KYC documentation or execute financial transactions. A legally reviewed retention schedule and deletion process must be approved before regulated data is collected.`,
      },
    ],
  },
  {
    id: 'data-protection',
    title: '3. Data Protection & Privacy',
    icon: Eye,
    content: [
      {
        subtitle: '3.1 GDPR Compliance',
        body: `The website processes limited platform-profile and operational data as described in the Privacy Policy. The applicable controller entity, privacy jurisdiction, representative or DPO requirements, data map, assessments and rights procedures require final legal confirmation.`,
      },
      {
        subtitle: '3.2 Data Minimisation',
        body: `The platform is designed to minimise collection and does not request production identity documents, card details, bank credentials or funds. Collection and retention must be reviewed whenever a new provider or financial feature is proposed.`,
      },
      {
        subtitle: '3.3 Cross-Border Transfers',
        body: `Hosting and service providers may process data across borders. Applicable transfer mechanisms, provider locations, contractual safeguards, and notices must be verified and documented before live-service data is processed.`,
      },
    ],
  },
  {
    id: 'information-security',
    title: '4. Information Security',
    icon: Lock,
    content: [
      {
        subtitle: '4.1 Security Standards',
        body: `No ISO 27001 or SOC 2 certification is claimed. Implemented application controls include protected sessions, access controls, CSRF protection, rate limits, security headers, audit events, and encrypted storage for selected sensitive fields.`,
      },
      {
        subtitle: '4.2 Penetration Testing',
        body: `No independent annual penetration-test or fixed remediation-time claim is published. Before live launch, testing scope, assessor independence, remediation targets, retesting, and evidence retention must be formally approved.`,
      },
      {
        subtitle: '4.3 Payment Security',
        body: `No live payment infrastructure or PCI DSS certification is claimed. Card issuance and payment-data collection remain disabled until a contracted provider and validated PCI scope are in place.`,
      },
      {
        subtitle: '4.4 Business Continuity',
        body: `The platform uses managed hosting and health monitoring. Documented recovery objectives, backups, failover, incident ownership, continuity exercises and any service-level commitment must be approved and tested before financial-service activation.`,
      },
    ],
  },
  {
    id: 'consumer-protection',
    title: '5. Consumer Protection',
    icon: Shield,
    content: [
      {
        subtitle: '5.1 Current Funds and Deposit Protection',
        body: `The current platform does not accept deposits or customer funds. Sample balances are not money, safeguarded deposits or insured funds. Any activated financial service must identify the licensed provider, account structure, applicable protection, exclusions and jurisdiction-specific disclosures before accepting funds.`,
      },
      {
        subtitle: '5.2 Complaints Handling',
        body: `Platform-related concerns may be submitted to complaints@citygate.capital. No regulated complaints timetable or ombudsman relationship is currently claimed. A jurisdiction-specific complaints policy, response timetable, escalation route, recordkeeping process and external-redress disclosure must be approved before financial-service activation.`,
      },
      {
        subtitle: '5.3 Vulnerable Customers',
        body: `The live operating model must include an approved vulnerable-customer policy, accessible support, staff training, escalation procedures, monitoring, and appropriate adjustments before consumer financial services are offered.`,
      },
    ],
  },
  {
    id: 'tax-compliance',
    title: '6. Tax Compliance & Reporting',
    icon: FileText,
    content: [
      {
        subtitle: '6.1 FATCA & CRS',
        body: `The current platform does not collect tax identification information or make FATCA or CRS reports. Applicable classification, due-diligence, reporting and recordkeeping duties must be determined for the final entity and account model.`,
      },
      {
        subtitle: '6.2 Crypto Tax Reporting',
        body: `No live crypto transactions or tax reports are produced. Any future statements or reporting must reflect executed provider records and the legal obligations of the confirmed entity and jurisdiction.`,
      },
    ],
  },
  {
    id: 'governance',
    title: '7. Governance & Accountability',
    icon: Scale,
    content: [
      {
        subtitle: '7.1 Board Oversight',
        body: `Governance ownership for a live compliance programme has not been documented for publication. Board or equivalent oversight, committee responsibilities, reporting cadence, and risk appetite must be formally established.`,
      },
      {
        subtitle: '7.2 Chief Compliance Officer',
        body: `No Chief Compliance Officer appointment is claimed. The live model must identify qualified accountable officers with documented authority, independence, resources, and escalation access.`,
      },
      {
        subtitle: '7.3 Training',
        body: `Role-based compliance, privacy, security, fraud, and operational training must be designed, delivered, assessed, and recorded before staff perform regulated or sensitive duties.`,
      },
      {
        subtitle: '7.4 Whistleblowing',
        body: `A protected whistleblowing and escalation process, including ownership, confidentiality, non-retaliation, investigation, and recordkeeping requirements, must be approved before live operation.`,
      },
    ],
  },
  {
    id: 'contact',
    title: '8. Compliance Contact',
    icon: Mail,
    content: [
      {
        subtitle: '8.1 Compliance Team',
        body: `Platform-related compliance, privacy or legal enquiries may be sent to compliance@citygate.capital, privacy@citygate.capital or legal@citygate.capital. These mailboxes do not by themselves establish appointed statutory officers or a regulated compliance function.`,
      },
      {
        subtitle: '8.2 Regulatory Correspondence',
        body: `A verified legal-entity name, registered address, authorised regulatory contact, and formal service procedure must be published before regulated operations. Until then, enquiries may be sent to legal@citygate.capital.`,
      },
    ],
  },
];

const previewSections = [
  {
    id: 'current-status',
    title: '1. Current Status',
    icon: Globe,
    content: [
      { subtitle: '1.1 Current Platform Availability', body: 'The published platform provides account-access and product-interface services. Regulated banking, deposits and financial-transaction execution are not currently activated.' },
      { subtitle: '1.2 No Regulatory Claim', body: 'No licence, registration, certification, deposit-protection scheme or partner relationship should be inferred. Any such claim requires legal verification and published evidence.' },
    ],
  },
  {
    id: 'launch-requirements',
    title: '2. Requirements Before Live Launch',
    icon: AlertTriangle,
    content: [
      { subtitle: '2.1 Legal and Regulatory Approval', body: 'Qualified counsel must determine the permitted business model, entity structure, target jurisdictions, required licences, disclosures, complaints process, and consumer-protection obligations.' },
      { subtitle: '2.2 Contracted Providers', body: 'Live operation requires approved KYC and AML screening, transaction monitoring, payment or banking rails, custody where applicable, signed webhook validation, reconciliations, and documented incident procedures.' },
      { subtitle: '2.3 Operational Evidence', body: 'Provider contracts, security reviews, data-processing agreements, policies, staff ownership, testing evidence, and launch approval must be recorded before financial operations can be enabled.' },
    ],
  },
  {
    id: 'implemented-controls',
    title: '3. Controls Implemented in the Platform',
    icon: Lock,
    content: [
      { subtitle: '3.1 Identity and Administration', body: 'The application includes separate customer and administrator sessions, role-based administration, CSRF protection, secure-cookie support, rate limits, and administrative audit events.' },
      { subtitle: '3.2 Safe Service Mode', body: 'Money-moving endpoints remain unavailable unless explicit readiness settings and verified provider attestations are present.' },
      { subtitle: '3.3 Sample Data', body: 'Balances, transactions, market activity, cards, yields and trading results shown in this environment are illustrative and do not represent customer funds or executed orders.' },
    ],
  },
  {
    id: 'contact',
    title: '4. Compliance Contact',
    icon: Mail,
    content: [
      { subtitle: '4.1 Enquiries', body: 'Questions about launch readiness or regulatory review may be sent to compliance@citygate.capital. This address does not constitute a regulator, ombudsman, or licensed financial-service support channel.' },
    ],
  },
];

// Retained only as a drafting reference; it must not be published until every
// statement has documentary evidence and counsel approval.
void verifiedSections;
const sections = previewSections;

const tocItems = sections.map(s => ({ id: s.id, title: s.title }));

export default function CompliancePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Compliance — City Gate Capital',
    url: CANONICAL,
    description: 'City Gate Capital service availability, implemented safeguards and requirements that remain before regulated financial-service activation.',
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
        { '@type': 'ListItem', position: 2, name: 'Compliance', item: CANONICAL },
      ],
    },
  };

  return (
    <>
      <Helmet>
        <title>Compliance — City Gate Capital</title>
        <meta name="description" content="City Gate Capital service availability, implemented safeguards and requirements for regulated financial-service activation." />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content="Compliance — City Gate Capital" />
        <meta property="og:description" content="Platform safeguards and requirements that must be completed before regulated financial services are activated." />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content="Compliance — City Gate Capital" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:title" content="Compliance — City Gate Capital" />
        <meta name="twitter:description" content="Platform safeguards and requirements for regulated financial-service activation." />
        <meta name="twitter:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Helmet>

      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="container mx-auto px-4 md:px-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-foreground/55 mb-8">
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight size={12} />
            <span className="text-foreground/55">Compliance</span>
          </nav>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium mb-6">
              <Shield size={12} />
              Launch Readiness
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
              Compliance
            </h1>
            <p className="text-foreground/55 text-lg leading-relaxed mb-6">
              This published platform documents implemented software safeguards and the legal, regulatory, provider and operational work still required before regulated financial services can be activated.
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-foreground/55">
              <span>Last updated: <span className="text-foreground/60">{LAST_UPDATED}</span></span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Regulatory badges */}
      <section className="pb-12">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 max-w-5xl">
            {regulatoryBadges.map(badge => (
              <motion.div
                key={badge.label}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3 }}
                className="rounded-xl border border-primary/15 bg-white/[0.02] p-4 text-center"
              >
                <CheckCircle size={18} className="mx-auto mb-2" style={{ color: badge.color }} />
                <p className="text-xs font-semibold text-foreground/80 leading-tight mb-1">{badge.label}</p>
                <p className="text-[10px] text-foreground/55">{badge.region}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications strip */}
      <section className="pb-12">
        <div className="container mx-auto px-4 md:px-6">
          <p className="text-[10px] font-bold text-foreground/50 uppercase tracking-[0.18em] mb-5">Platform Safeguards & Activation Requirements</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 max-w-5xl">
            {certifications.map(cert => {
              const Icon = cert.icon;
              return (
                <div key={cert.title} className="rounded-xl border border-primary/10 bg-primary/3 p-4">
                  <Icon size={14} className="text-primary mb-2" />
                  <p className="text-xs font-bold text-foreground/80 mb-1">{cert.title}</p>
                  <p className="text-[10px] text-foreground/55 leading-snug">{cert.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="pb-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 max-w-6xl">

            {/* Sticky TOC */}
            <aside className="hidden lg:block lg:col-span-1">
              <div className="sticky top-28 space-y-1">
                <p className="text-[10px] font-bold text-foreground/50 uppercase tracking-[0.18em] mb-4">Contents</p>
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
                  <p className="text-[10px] text-foreground/50 mb-3">Related</p>
                  <Link to="/privacy-policy" className="block text-xs text-foreground/40 hover:text-primary py-1 transition-colors">Privacy Policy</Link>
                  <Link to="/terms-of-service" className="block text-xs text-foreground/40 hover:text-primary py-1 transition-colors">Terms of Service</Link>
                  <Link to="/cookie-policy" className="block text-xs text-foreground/40 hover:text-primary py-1 transition-colors">Cookie Policy</Link>
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
                    <h3 className="font-semibold text-foreground mb-1">Compliance Enquiries</h3>
                    <p className="text-sm text-foreground/55 mb-3">For regulatory correspondence, compliance questions, or to report a concern, contact our Compliance team directly.</p>
                    <a href="mailto:compliance@citygate.capital" className="text-sm text-primary hover:underline font-medium">compliance@citygate.capital</a>
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
