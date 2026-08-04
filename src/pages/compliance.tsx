import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Shield, Globe, FileText, Lock, AlertTriangle, CheckCircle, ChevronRight, Mail, Scale, Eye } from 'lucide-react';

const LAST_UPDATED = 'May 23, 2026';
const CANONICAL = 'https://citygate.capital/compliance';

const regulatoryBadges = [
  { label: 'FCA Registered', region: 'United Kingdom', color: '#C9A84C' },
  { label: 'FinCEN Registered', region: 'United States', color: '#627EEA' },
  { label: 'AUSTRAC Registered', region: 'Australia', color: '#10B981' },
  { label: 'MAS Licensed', region: 'Singapore', color: '#9945FF' },
  { label: 'GDPR Compliant', region: 'European Union', color: '#EC4899' },
  { label: 'PCI DSS Level 1', region: 'Global', color: '#F7931A' },
];

const certifications = [
  { title: 'ISO 27001', desc: 'Information Security Management', icon: Lock },
  { title: 'SOC 2 Type II', desc: 'Security, Availability & Confidentiality', icon: Shield },
  { title: 'PCI DSS Level 1', desc: 'Payment Card Industry Data Security', icon: FileText },
  { title: 'GDPR', desc: 'EU General Data Protection Regulation', icon: Eye },
  { title: 'UK GDPR', desc: 'UK Data Protection Act 2018', icon: Eye },
  { title: 'AML/CFT', desc: 'Anti-Money Laundering & Counter-Terrorism Financing', icon: AlertTriangle },
];

const sections = [
  {
    id: 'regulatory-framework',
    title: '1. Regulatory Framework',
    icon: Globe,
    content: [
      {
        subtitle: '1.1 Licensing & Registration',
        body: `City Gate Capital Ltd operates under licences and registrations obtained from financial regulators in the jurisdictions where we provide services. We are registered with the Financial Conduct Authority (FCA) in the United Kingdom, FinCEN in the United States, AUSTRAC in Australia, and the Monetary Authority of Singapore (MAS), among others. Our regulatory status is reviewed and maintained on an ongoing basis.`,
      },
      {
        subtitle: '1.2 Regulatory Oversight',
        body: `We are subject to ongoing supervision by our primary regulator and cooperate fully with all regulatory examinations, enquiries, and requests. Our compliance programme is reviewed annually by independent external auditors and updated to reflect changes in applicable law and regulatory guidance.`,
      },
      {
        subtitle: '1.3 Jurisdictional Coverage',
        body: `We operate in 40+ jurisdictions and maintain a dedicated compliance team responsible for monitoring regulatory developments in each market. Where local licensing requirements apply, we either hold the required licence or partner with locally licensed entities.`,
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
        body: `City Gate Capital maintains a comprehensive AML/CFT programme that meets or exceeds the requirements of the Financial Action Task Force (FATF) Recommendations, the EU's Sixth Anti-Money Laundering Directive (AMLD6), the UK Money Laundering Regulations 2017, and equivalent legislation in all jurisdictions where we operate.`,
      },
      {
        subtitle: '2.2 Know Your Customer (KYC)',
        body: `All customers are subject to identity verification before accessing our services. Our KYC process includes: government-issued ID verification, biometric liveness checks, address verification, PEP (Politically Exposed Person) screening, adverse media screening, and ongoing monitoring of customer profiles and transaction patterns.`,
      },
      {
        subtitle: '2.3 Transaction Monitoring',
        body: `We operate a real-time transaction monitoring system that analyses all transactions against risk-based rules and machine learning models. Suspicious transactions are automatically flagged for review by our Financial Intelligence Unit (FIU). Where required by law, we file Suspicious Activity Reports (SARs) with the relevant financial intelligence authority.`,
      },
      {
        subtitle: '2.4 Sanctions Screening',
        body: `All customers and transactions are screened against international sanctions lists including OFAC (US), HM Treasury (UK), EU Consolidated List, UN Security Council, and other applicable lists. Matches are reviewed by our compliance team and, where confirmed, result in account restriction and regulatory reporting.`,
      },
      {
        subtitle: '2.5 Record Keeping',
        body: `We retain all KYC documentation, transaction records, and compliance reports for a minimum of 5 years from the date of the transaction or account closure, or longer where required by applicable law.`,
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
        body: `City Gate Capital processes personal data in accordance with the EU General Data Protection Regulation (GDPR) and the UK GDPR. We have appointed a Data Protection Officer (DPO) and maintain a comprehensive data protection programme including data mapping, privacy impact assessments, and data subject rights procedures.`,
      },
      {
        subtitle: '3.2 Data Minimisation',
        body: `We collect only the personal data necessary for the purposes described in our Privacy Policy. We do not collect or retain data beyond what is required for regulatory compliance or service delivery.`,
      },
      {
        subtitle: '3.3 Cross-Border Transfers',
        body: `International transfers of personal data are conducted under appropriate safeguards including Standard Contractual Clauses (SCCs), adequacy decisions, or other lawful transfer mechanisms as required by applicable data protection law.`,
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
        body: `Our information security programme is certified to ISO 27001 and SOC 2 Type II. We maintain a comprehensive set of security controls including encryption at rest and in transit, access controls, network segmentation, vulnerability management, and incident response procedures.`,
      },
      {
        subtitle: '4.2 Penetration Testing',
        body: `We conduct annual penetration tests by independent, CREST-certified security firms, as well as continuous automated vulnerability scanning. Critical vulnerabilities are remediated within 24 hours; high vulnerabilities within 7 days.`,
      },
      {
        subtitle: '4.3 Payment Security',
        body: `Our payment infrastructure is certified to PCI DSS Level 1 — the highest level of payment card industry security certification. Cardholder data is never stored on our servers; all card data is tokenised at the point of entry.`,
      },
      {
        subtitle: '4.4 Business Continuity',
        body: `We maintain a Business Continuity Plan (BCP) and Disaster Recovery Plan (DRP) that are tested annually. Our infrastructure is deployed across multiple availability zones with automatic failover to ensure 99.9% uptime.`,
      },
    ],
  },
  {
    id: 'consumer-protection',
    title: '5. Consumer Protection',
    icon: Shield,
    content: [
      {
        subtitle: '5.1 Deposit Protection',
        body: `Fiat currency deposits held in City Gate Capital accounts are safeguarded in accordance with applicable e-money regulations. In the UK, customer funds are held in segregated accounts at authorised credit institutions. In the US, funds are FDIC insured up to $250,000 per depositor through our banking partners.`,
      },
      {
        subtitle: '5.2 Complaints Handling',
        body: `We have a formal complaints handling procedure. Complaints can be submitted to complaints@citygate.capital. We acknowledge all complaints within 5 business days and aim to resolve them within 15 business days. If you are not satisfied with our response, you may refer your complaint to the relevant financial ombudsman or regulatory authority.`,
      },
      {
        subtitle: '5.3 Vulnerable Customers',
        body: `We are committed to treating all customers fairly, including those who may be in vulnerable circumstances. Our customer support team is trained to identify and support vulnerable customers, and we offer additional assistance including extended response times and simplified communication.`,
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
        body: `City Gate Capital complies with the US Foreign Account Tax Compliance Act (FATCA) and the OECD Common Reporting Standard (CRS). We collect tax identification information from customers and report to relevant tax authorities as required by law.`,
      },
      {
        subtitle: '6.2 Crypto Tax Reporting',
        body: `We provide customers with annual transaction summaries to assist with tax reporting obligations. In jurisdictions where we are required to report cryptocurrency transactions to tax authorities, we do so in accordance with applicable law.`,
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
        body: `Our Board of Directors maintains ultimate responsibility for our compliance programme. A dedicated Risk and Compliance Committee of the Board meets quarterly to review compliance performance, regulatory developments, and risk appetite.`,
      },
      {
        subtitle: '7.2 Chief Compliance Officer',
        body: `Our Chief Compliance Officer (CCO) reports directly to the Board and is responsible for the day-to-day management of our compliance programme. The CCO has the authority and resources to implement and enforce compliance policies across the organisation.`,
      },
      {
        subtitle: '7.3 Training',
        body: `All employees complete mandatory AML/CFT, data protection, and information security training upon joining and annually thereafter. Employees in compliance-sensitive roles receive additional specialist training.`,
      },
      {
        subtitle: '7.4 Whistleblowing',
        body: `We maintain a confidential whistleblowing channel that allows employees, contractors, and third parties to report compliance concerns without fear of retaliation. Reports can be submitted to whistleblowing@citygate.capital or through our anonymous reporting portal.`,
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
        body: `For compliance-related enquiries, regulatory correspondence, or to report a concern, contact our Compliance team at compliance@citygate.capital. For data protection matters, contact our DPO at privacy@citygate.capital. For legal matters, contact legal@citygate.capital.`,
      },
      {
        subtitle: '8.2 Regulatory Correspondence',
        body: `Regulatory authorities and law enforcement agencies should direct formal correspondence to: Compliance Department, City Gate Capital Ltd, International Financial Centre, London, United Kingdom. We respond to all regulatory requests within the timeframes required by applicable law.`,
      },
    ],
  },
];

const tocItems = sections.map(s => ({ id: s.id, title: s.title }));

export default function CompliancePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Compliance — City Gate Capital',
    url: CANONICAL,
    description: 'City Gate Capital\'s regulatory compliance framework: AML/CFT, KYC, data protection, information security, and consumer protection.',
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
        <meta name="description" content="City Gate Capital's regulatory compliance framework covering AML/CFT, KYC, GDPR, PCI DSS, and consumer protection across 40+ jurisdictions." />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content="Compliance — City Gate Capital" />
        <meta property="og:description" content="Our regulatory compliance framework: AML/CFT, KYC, data protection, and security certifications across 40+ jurisdictions." />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://citygate.capital/api/og?title=Compliance+%26+Regulation&description=AML%2FCFT%2C+KYC%2C+GDPR+across+40%2B+jurisdictions" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content="Compliance — City Gate Capital" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:title" content="Compliance — City Gate Capital" />
        <meta name="twitter:description" content="Our regulatory compliance framework: AML/CFT, KYC, data protection, and security certifications across 40+ jurisdictions." />
        <meta name="twitter:image" content="https://citygate.capital/api/og?title=Compliance+%26+Regulation&description=AML%2FCFT%2C+KYC%2C+GDPR+across+40%2B+jurisdictions" />
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
              Regulatory Compliance
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
              Compliance
            </h1>
            <p className="text-foreground/55 text-lg leading-relaxed mb-6">
              City Gate Capital is built on a foundation of regulatory compliance, financial integrity, and the highest standards of security. We are licensed, audited, and accountable.
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-foreground/40">
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
                <p className="text-[10px] text-foreground/35">{badge.region}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications strip */}
      <section className="pb-12">
        <div className="container mx-auto px-4 md:px-6">
          <p className="text-[10px] font-bold text-foreground/25 uppercase tracking-[0.18em] mb-5">Security & Compliance Certifications</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 max-w-5xl">
            {certifications.map(cert => {
              const Icon = cert.icon;
              return (
                <div key={cert.title} className="rounded-xl border border-primary/10 bg-primary/3 p-4">
                  <Icon size={14} className="text-primary mb-2" />
                  <p className="text-xs font-bold text-foreground/80 mb-1">{cert.title}</p>
                  <p className="text-[10px] text-foreground/35 leading-snug">{cert.desc}</p>
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
