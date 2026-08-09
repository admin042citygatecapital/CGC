import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Eye, Database, Globe, Mail, ChevronRight, FileText } from 'lucide-react';

const LAST_UPDATED = 'August 8, 2026';
const EFFECTIVE_DATE = 'August 8, 2026';
const CANONICAL = 'https://citygate.capital/privacy-policy';

const sections = [
  {
    id: 'information-we-collect',
    title: '1. Information We Collect',
    icon: Database,
    content: [
      {
        subtitle: '1.1 Information You Provide',
        body: `When you create a preview profile or contact us, we may collect information you provide such as your name, email address, telephone number, country, support messages, communication preferences, and demonstration profile information. This environment does not perform live identity verification. Do not upload real identity documents, payment-card information, bank credentials, or funds.`,
      },
      {
        subtitle: '1.2 Information Collected Automatically',
        body: `We may automatically collect IP address, browser and device information, referring URLs, pages visited, session activity, security events, and demonstration transaction metadata. The preview does not collect or process live transaction records or production biometric-verification results.`,
      },
      {
        subtitle: '1.3 Information from Third Parties',
        body: `We may receive limited technical or delivery information from service providers that support hosting, email, customer support, analytics, and security. Live identity-verification, banking, payment, custody, credit-reference, and sanctions-screening providers are not connected in this preview.`,
      },
    ],
  },
  {
    id: 'how-we-use-information',
    title: '2. How We Use Your Information',
    icon: Eye,
    content: [
      {
        subtitle: '2.1 Service Delivery',
        body: `We use information to create and maintain preview profiles, authenticate users, provide demonstration features, respond to support requests, send requested communications, protect the website, and improve the product. We do not use preview information to accept deposits, move money, issue payment instruments, provide custody, or execute trades.`,
      },
      {
        subtitle: '2.2 Legal and Regulatory Obligations',
        body: `The preview is not performing regulated KYC, AML screening, transaction monitoring, or regulatory reporting. Before any regulated service is introduced, this policy and the related notices, retention schedules, consent flows, and provider disclosures will be reviewed and updated for the approved jurisdictions and operating entity.`,
      },
      {
        subtitle: '2.3 Security and Fraud Prevention',
        body: `We use session, device, access, and security-event information to prevent abuse, investigate suspicious access, and protect preview profiles. Demonstration transaction data may be used to test product controls, but no live financial-crime monitoring service is represented as active.`,
      },
      {
        subtitle: '2.4 Product Improvement',
        body: `We use aggregated and anonymised data to improve our products, develop new features, conduct research, and generate internal analytics. This data cannot be used to identify you individually.`,
      },
    ],
  },
  {
    id: 'legal-basis',
    title: '3. Legal Basis for Processing',
    icon: FileText,
    content: [
      {
        subtitle: '3.1 Contractual Necessity',
        body: `Where applicable, we process information needed to provide the preview features or communications you request and to administer our relationship with you.`,
      },
      {
        subtitle: '3.2 Legal Obligation',
        body: `We process information when necessary to comply with laws that apply to the website operator, such as responding to valid legal process and maintaining required business records. This preview does not claim regulated financial operations in any jurisdiction.`,
      },
      {
        subtitle: '3.3 Legitimate Interests',
        body: `We may rely on legitimate interests for website security, fraud and abuse prevention, support, service improvement, and limited operational analytics, subject to applicable privacy law and your rights.`,
      },
      {
        subtitle: '3.4 Consent',
        body: `Where we rely on consent (e.g. marketing communications), you may withdraw it at any time by contacting privacy@citygate.capital or using the unsubscribe link in any marketing email. Withdrawal does not affect the lawfulness of processing before withdrawal.`,
      },
    ],
  },
  {
    id: 'data-sharing',
    title: '4. How We Share Your Information',
    icon: Globe,
    content: [
      {
        subtitle: '4.1 Service Providers',
        body: `We may share data with service providers used for hosting, databases, email delivery, customer support, security, and other website operations. We do not share preview-profile data with live banking, payment, card, trading, or custody providers because those services are not active. Provider contracts and privacy terms must be reviewed before any such integration is enabled.`,
      },
      {
        subtitle: '4.2 Regulatory and Law Enforcement',
        body: `We disclose information to financial regulators, tax authorities, law enforcement agencies, and courts when required by law, court order, or regulatory mandate. We will notify you of such disclosures where legally permitted to do so.`,
      },
      {
        subtitle: '4.3 Corporate Transactions',
        body: `In the event of a merger, acquisition, restructuring, or sale of assets, your data may be transferred to the acquiring entity, subject to the same privacy protections described in this policy.`,
      },
      {
        subtitle: '4.4 No Sale of Personal Data',
        body: `We do not sell, rent, or trade your personal data to third parties for their own marketing purposes. Period.`,
      },
    ],
  },
  {
    id: 'international-transfers',
    title: '5. International Data Transfers',
    icon: Globe,
    content: [
      {
        subtitle: '5.1 Transfer Mechanisms',
        body: `Website service providers may process information outside your country. Where applicable law requires a transfer mechanism, we will use an available lawful mechanism and provide additional information on request. Launch into a new jurisdiction requires a separate review of data locations and international-transfer safeguards.`,
      },
      {
        subtitle: '5.2 Safeguards',
        body: `We use access controls, transport encryption, contractual protections, and other measures appropriate to the preview. Specific transfer mechanisms and subprocessors must be confirmed in the final jurisdiction-specific privacy review.`,
      },
    ],
  },
  {
    id: 'data-retention',
    title: '6. Data Retention',
    icon: Database,
    content: [
      {
        subtitle: '6.1 Retention Periods',
        body: `We retain preview-profile, support, communication, security, and operational records only for as long as reasonably necessary for the purposes described here, to resolve disputes, protect the service, and comply with applicable law. A jurisdiction-specific retention schedule will be adopted before regulated services begin.`,
      },
      {
        subtitle: '6.2 Deletion',
        body: `When information is no longer required, we delete or anonymise it where reasonably practicable. You may request deletion of eligible information by contacting privacy@citygate.capital.`,
      },
    ],
  },
  {
    id: 'your-rights',
    title: '7. Your Privacy Rights',
    icon: Shield,
    content: [
      {
        subtitle: '7.1 Rights Available to You',
        body: `Depending on your jurisdiction, you may have the right to: access a copy of your personal data; correct inaccurate data; request deletion of data not subject to legal retention; restrict or object to certain processing; receive your data in a portable format; withdraw consent; and lodge a complaint with your local data protection authority.`,
      },
      {
        subtitle: '7.2 Exercising Your Rights',
        body: `To exercise any of these rights, contact privacy@citygate.capital with your full name, account email, and a description of your request. We will respond within 30 days (or within the timeframe required by applicable law). We may need to verify your identity before processing your request.`,
      },
      {
        subtitle: '7.3 Supervisory Authorities',
        body: `If you are located in the EEA, you have the right to lodge a complaint with your national data protection authority. UK residents may contact the Information Commissioner's Office (ICO) at ico.org.uk. We would, however, appreciate the opportunity to address your concerns before you contact a regulator.`,
      },
    ],
  },
  {
    id: 'security',
    title: '8. Security',
    icon: Lock,
    content: [
      {
        subtitle: '8.1 Technical Safeguards',
        body: `We use technical and organisational safeguards including HTTPS, access controls, secure authentication, restricted administrative routes, logging, and encryption controls where implemented. No system is completely secure, and independent penetration testing and launch-specific security assurance remain required before regulated services begin.`,
      },
      {
        subtitle: '8.2 Incident Response',
        body: `In the event of a data breach that is likely to result in a risk to your rights and freedoms, we will notify the relevant supervisory authority within 72 hours and affected individuals without undue delay, as required by applicable law.`,
      },
    ],
  },
  {
    id: 'cookies',
    title: '9. Cookies',
    icon: Shield,
    content: [
      {
        subtitle: '9.1 Cookie Use',
        body: `We use cookies and similar tracking technologies for authentication, security, performance monitoring, and analytics. For full details, please see our Cookie Policy at citygate.capital/cookie-policy.`,
      },
    ],
  },
  {
    id: 'contact',
    title: '10. Contact & Data Controller',
    icon: Mail,
    content: [
      {
        subtitle: '10.1 Data Controller',
        body: `City Gate Capital is responsible for personal data processed through this product-preview website. The final legal-entity name, registered address, regulatory status, and jurisdiction-specific representative details must be confirmed and published before regulated services begin.`,
      },
      {
        subtitle: '10.2 Privacy Contact',
        body: `For privacy enquiries, requests, or complaints, contact privacy@citygate.capital. We will acknowledge and respond within the timeframe required by applicable law.`,
      },
      {
        subtitle: '10.3 Changes to This Policy',
        body: `We may update this Privacy Policy from time to time. We will notify you of material changes by email or in-app notification at least 30 days before they take effect. Continued use of our services after the effective date constitutes acceptance of the updated policy.`,
      },
    ],
  },
];

const tocItems = sections.map(s => ({ id: s.id, title: s.title }));

export default function PrivacyPolicyPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Privacy Policy — City Gate Capital',
    url: CANONICAL,
    description: 'How City Gate Capital collects, uses, and protects your personal data.',
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
        { '@type': 'ListItem', position: 2, name: 'Privacy Policy', item: CANONICAL },
      ],
    },
  };

  return (
    <>
      <Helmet>
        <title>Privacy Policy — City Gate Capital</title>
        <meta name="description" content="Understand how City Gate Capital collects, uses, shares, and protects your personal data. GDPR, UK GDPR, and global privacy compliance." />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content="Privacy Policy — City Gate Capital" />
        <meta property="og:description" content="How City Gate Capital handles your personal data — transparent, compliant, and secure." />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content="Privacy Policy — City Gate Capital" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:title" content="Privacy Policy — City Gate Capital" />
        <meta name="twitter:description" content="How City Gate Capital handles your personal data — transparent, compliant, and secure." />
        <meta name="twitter:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Helmet>

      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="container mx-auto px-4 md:px-6">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-foreground/55 mb-8">
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight size={12} />
            <span className="text-foreground/55">Privacy Policy</span>
          </nav>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium mb-6">
              <Shield size={12} />
              Legal Document
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
              Privacy Policy
            </h1>
            <p className="text-foreground/55 text-lg leading-relaxed mb-6">
              We are committed to protecting your personal data. This policy explains what we collect, why we collect it, and how we keep it safe.
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-foreground/55">
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
                  <Link to="/terms-of-service" className="block text-xs text-foreground/40 hover:text-primary py-1 transition-colors">Terms of Service</Link>
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
                    <h3 className="font-semibold text-foreground mb-1">Privacy Questions?</h3>
                    <p className="text-sm text-foreground/55 mb-3">Our Data Protection Officer is available to answer any questions about how we handle your data.</p>
                    <a href="mailto:privacy@citygate.capital" className="text-sm text-primary hover:underline font-medium">privacy@citygate.capital</a>
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
