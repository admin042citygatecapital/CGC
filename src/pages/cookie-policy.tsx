import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Cookie, Shield, BarChart2, Settings, ChevronRight, Mail, ToggleLeft, Globe } from 'lucide-react';

const LAST_UPDATED = 'August 10, 2026';
const EFFECTIVE_DATE = 'August 10, 2026';
const CANONICAL = 'https://citygate.capital/cookie-policy';

interface CookieRow {
  name: string;
  purpose: string;
  duration: string;
  type: 'Essential' | 'Analytics' | 'Functional' | 'Security';
}

const cookieTable: CookieRow[] = [
  { name: 'cgc_admin_sid',                purpose: 'Secure administrator session cookie',                       duration: '8 hours by default', type: 'Essential'  },
  { name: 'csrf_token',                   purpose: 'Protects authenticated administrative changes from CSRF',   duration: '2 hours',            type: 'Security'   },
  { name: 'cgc_trusted_device',           purpose: 'Optional administrator trusted-device token',               duration: '30 days by default', type: 'Security'   },
  { name: 'cgc_customer_sid',             purpose: 'Secure HttpOnly preview customer session cookie',           duration: '8 hours by default', type: 'Essential'  },
  { name: 'cgc_analytics_consent_v1',     purpose: 'Records the visitor analytics choice in browser storage',   duration: '1 year',              type: 'Essential'  },
  { name: 'cgc_sid',                      purpose: 'Random analytics identifier scoped to one browser tab',      duration: 'Browser tab',         type: 'Analytics'  },
  { name: 'cgc_ab_*',                     purpose: 'Consented first-party experiment assignment',               duration: 'Until consent ends',  type: 'Analytics'  },
];

const typeColors: Record<CookieRow['type'], string> = {
  Essential:  'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  Analytics:  'text-blue-400 bg-blue-400/10 border-blue-400/20',
  Functional: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  Security:   'text-primary bg-primary/10 border-primary/20',
};

const sections = [
  {
    id: 'what-are-cookies',
    title: '1. What Are Cookies?',
    icon: Cookie,
    content: [
      {
        subtitle: '1.1 Definition',
        body: `Cookies are small text files placed on your device when you visit a website. They allow the website to recognise your device on subsequent visits and store information about your preferences or actions. Similar technologies include web beacons, pixel tags, local storage, and session storage — this policy covers all of them.`,
      },
      {
        subtitle: '1.2 First-Party vs Third-Party',
        body: `First-party storage is set by City Gate Capital directly. The optional website analytics described in this policy is first-party and does not load Google Analytics, advertising pixels, or the legacy AIRO Signals tracker.`,
      },
    ],
  },
  {
    id: 'cookies-we-use',
    title: '2. Cookies We Use',
    icon: Settings,
    content: [
      {
        subtitle: '2.1 Essential Cookies',
        body: `These cookies are strictly necessary for our services to function. They enable core features such as authentication, security, and session management. You cannot opt out of essential cookies — without them, the services you have requested cannot be provided.`,
      },
      {
        subtitle: '2.2 Security Cookies',
        body: `Security cookies help us detect and prevent fraud, protect against cross-site request forgery (CSRF), and identify suspicious device behaviour. They are essential to the security of your account and our platform.`,
      },
      {
        subtitle: '2.3 Functional Cookies',
        body: `Functional cookies remember your preferences — such as your preferred language, currency display, or notification settings — so you don't have to re-enter them on every visit. These can be disabled, but doing so may affect your experience.`,
      },
      {
        subtitle: '2.4 Analytics Cookies',
        body: `With consent, our first-party analytics records a relative page path without query strings, the referring site's origin, a random browser-tab session identifier, a broad device category, and allowlisted feature labels. Event records exclude form contents, credentials, full referring URLs, and IP addresses. Analytics storage is removed when consent expires or is withdrawn.`,
      },
    ],
  },
  {
    id: 'cookie-table',
    title: '3. Cookie Reference Table',
    icon: BarChart2,
    content: [
      {
        subtitle: '3.1 Specific Cookies',
        body: `The table below lists the principal cookies and browser-storage keys currently used on citygate.capital. This list is updated when the implementation changes.`,
      },
    ],
    hasTable: true,
  },
  {
    id: 'consent',
    title: '4. Your Consent & Choices',
    icon: ToggleLeft,
    content: [
      {
        subtitle: '4.1 Cookie Banner',
        body: `When you first visit our site, we display a consent banner unless your browser sends a recognised privacy opt-out signal. You can accept or decline optional analytics. Your choice is saved in cgc_analytics_consent_v1 for up to 1 year.`,
      },
      {
        subtitle: '4.2 Changing Your Preferences',
        body: `You can change your analytics choice at any time by clicking "Cookie settings" in the footer. Withdrawal removes the analytics session identifier and stored experiment assignments and stops future analytics events.`,
      },
      {
        subtitle: '4.3 Browser Controls',
        body: `Most browsers allow you to control cookies through their settings. You can block all cookies, delete existing cookies, or set your browser to notify you when cookies are set. Note that blocking essential cookies will prevent you from logging in or using core features. Instructions for major browsers: Chrome (Settings → Privacy → Cookies), Firefox (Settings → Privacy → Cookies), Safari (Preferences → Privacy), Edge (Settings → Privacy → Cookies).`,
      },
      {
        subtitle: '4.4 Opt-Out Tools',
        body: `We honour Global Privacy Control and the browser Do Not Track value "1" as analytics opt-outs. These signals override a stored analytics acceptance.`,
      },
    ],
  },
  {
    id: 'third-parties',
    title: '5. Third-Party Services',
    icon: Globe,
    content: [
      {
        subtitle: '5.1 Analytics',
        body: `Website usage events are handled by City Gate Capital's first-party endpoint and stored in private application storage. Administrative reports require an authenticated administrator session.`,
      },
      {
        subtitle: '5.2 Security',
        body: `Security cookies protect authenticated administration, including CSRF protection and an optional trusted-device token. These controls are not used for advertising.`,
      },
      {
        subtitle: '5.3 No Advertising Cookies',
        body: `We do not use advertising or tracking cookies for targeted advertising. We do not share cookie data with advertising networks or data brokers.`,
      },
    ],
  },
  {
    id: 'updates',
    title: '6. Updates to This Policy',
    icon: Shield,
    content: [
      {
        subtitle: '6.1 Policy Changes',
        body: `We may update this Cookie Policy when we add new cookies, change providers, or when required by law. We will update the "Last Updated" date at the top of this page and, for material changes, notify you via email or in-app notification.`,
      },
      {
        subtitle: '6.2 Contact',
        body: `For questions about our use of cookies, contact privacy@citygate.capital. Our Data Protection Officer will respond within 5 business days.`,
      },
    ],
  },
];

const tocItems = sections.map(s => ({ id: s.id, title: s.title }));

export default function CookiePolicyPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Cookie Policy — City Gate Capital',
    url: CANONICAL,
    description: 'How City Gate Capital uses cookies and similar technologies on its website and platform.',
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
        { '@type': 'ListItem', position: 2, name: 'Cookie Policy', item: CANONICAL },
      ],
    },
  };

  return (
    <>
      <Helmet>
        <title>Cookie Policy — City Gate Capital</title>
        <meta name="description" content="Learn how City Gate Capital uses cookies and similar technologies, what data they collect, and how to manage your preferences." />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content="Cookie Policy — City Gate Capital" />
        <meta property="og:description" content="How City Gate Capital uses cookies and similar technologies on its website and platform." />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content="Cookie Policy — City Gate Capital" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:title" content="Cookie Policy — City Gate Capital" />
        <meta name="twitter:description" content="How City Gate Capital uses cookies and similar technologies on its website and platform." />
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
            <span className="text-foreground/55">Cookie Policy</span>
          </nav>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium mb-6">
              <Cookie size={12} />
              Legal Document
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
              Cookie Policy
            </h1>
            <p className="text-foreground/55 text-lg leading-relaxed mb-6">
              We use cookies to keep your account secure, remember your preferences, and understand how our platform is used. Here's exactly what we use and why.
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
                  <Link to="/privacy-policy" className="block text-xs text-foreground/40 hover:text-primary py-1 transition-colors">Privacy Policy</Link>
                  <Link to="/terms-of-service" className="block text-xs text-foreground/40 hover:text-primary py-1 transition-colors">Terms of Service</Link>
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
                      {'hasTable' in section && section.hasTable && (
                        <div className="overflow-x-auto rounded-xl border border-primary/15 mt-4">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-primary/15 bg-primary/5">
                                <th className="text-left px-4 py-3 text-foreground/50 font-semibold">Cookie Name</th>
                                <th className="text-left px-4 py-3 text-foreground/50 font-semibold">Purpose</th>
                                <th className="text-left px-4 py-3 text-foreground/50 font-semibold">Duration</th>
                                <th className="text-left px-4 py-3 text-foreground/50 font-semibold">Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cookieTable.map((row, ri) => (
                                <tr key={row.name} className={ri % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'}>
                                  <td className="px-4 py-3 font-mono text-foreground/70">{row.name}</td>
                                  <td className="px-4 py-3 text-foreground/50">{row.purpose}</td>
                                  <td className="px-4 py-3 text-foreground/50">{row.duration}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold ${typeColors[row.type]}`}>
                                      {row.type}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
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
                    <h3 className="font-semibold text-foreground mb-1">Cookie Questions?</h3>
                    <p className="text-sm text-foreground/55 mb-3">Contact our Data Protection Officer for any questions about our cookie practices.</p>
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
