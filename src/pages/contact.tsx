import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, Send, CheckCircle, MessageCircle, ArrowRight, ExternalLink, MapPin, Navigation } from 'lucide-react';
import type { BusinessLocation } from '@/lib/businessLocation';

interface SocialLink {
  platformId: string; url: string; enabled: boolean;
  showInFooter: boolean; showInContact: boolean;
}

const PLATFORM_META: Record<string, { label: string; color: string; detail: string }> = {
  twitter:   { label: 'X / Twitter', color: '#1DA1F2', detail: '@CityGateCapital' },
  linkedin:  { label: 'LinkedIn',    color: '#0A66C2', detail: 'City Gate Capital' },
  instagram: { label: 'Instagram',   color: '#E1306C', detail: '@citygatecapital' },
  facebook:  { label: 'Facebook',    color: '#1877F2', detail: 'City Gate Capital' },
  telegram:  { label: 'Telegram',    color: '#26A5E4', detail: 't.me/citygatecapital' },
  whatsapp:  { label: 'WhatsApp',    color: '#25D366', detail: 'Chat on WhatsApp' },
  tiktok:    { label: 'TikTok',      color: '#FF0050', detail: '@citygatecapital' },
  youtube:   { label: 'YouTube',     color: '#FF0000', detail: 'City Gate Capital' },
  discord:   { label: 'Discord',     color: '#5865F2', detail: 'Join our server' },
};

const subjects = ['General Inquiry', 'Account Support', 'Partnership', 'Press & Media', 'Careers', 'Compliance', 'API & Developer', 'Enterprise Sales'];

const contactChannels = [
  { icon: MessageCircle, title: 'Website Chat', detail: 'Availability may vary',    color: '#10B981', action: 'Start Chat',  href: '/support'                        },
  { icon: Mail,          title: 'General',    detail: 'info@citygate.capital',      color: '#C9A84C', action: 'Send Email',  href: 'mailto:info@citygate.capital'    },
  { icon: Mail,          title: 'Support',    detail: 'support@citygate.capital',   color: '#9945FF', action: 'Get Help',    href: 'mailto:support@citygate.capital' },
  { icon: Phone,         title: 'Phone',      detail: '+44 7888 382458',            color: '#627EEA', action: 'Call Now',    href: 'tel:+447888382458'               },
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', company: '', subject: 'General Inquiry', message: '' });
  const [socials, setSocials] = useState<SocialLink[]>([]);
  const [businessLocation, setBusinessLocation] = useState<BusinessLocation | null>(null);

  useEffect(() => {
    fetch('/api/settings/social')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d?.links)) setSocials(d.links.filter((l: SocialLink) => l.showInContact)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    const loadLocation = () => {
      fetch('/api/settings/website', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (active) setBusinessLocation(d?.data?.location?.address ? d.data.location as BusinessLocation : null);
        })
        .catch(() => {});
    };
    loadLocation();
    const timer = window.setInterval(loadLocation, 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitError('Network error — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Contact City Gate Capital</title>
        <meta name="description" content="Contact the City Gate Capital product-preview team by website chat, email, contact form, or phone. Response times vary." />
        <link rel="canonical" href="https://citygate.capital/contact" />
        <meta property="og:title" content="Contact City Gate Capital — Get in Touch" />
        <meta property="og:description" content="Contact the City Gate Capital product-preview team by website chat, email, contact form, or phone." />
        <meta property="og:url" content="https://citygate.capital/contact" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content="Contact City Gate Capital — Get in Touch" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:creator" content="@CityGateCapital" />
        <meta name="twitter:title" content="Contact City Gate Capital" />
        <meta name="twitter:description" content="Contact the City Gate Capital product-preview team. Response times vary." />
        <meta name="twitter:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          '@id': 'https://citygate.capital/contact#webpage',
          name: 'Contact City Gate Capital',
          url: 'https://citygate.capital/contact',
          isPartOf: { '@id': 'https://citygate.capital/#website' },
          about: { '@id': 'https://citygate.capital/#organization' },
          mainEntity: {
            '@type': 'Organization',
            '@id': 'https://citygate.capital/#organization',
            name: 'City Gate Capital',
            telephone: '+447888382458',
            email: 'info@citygate.capital',
            url: 'https://citygate.capital',
            contactPoint: [
              { '@type': 'ContactPoint', contactType: 'product preview support', telephone: '+447888382458', email: 'support@citygate.capital', availableLanguage: 'English' },
              { '@type': 'ContactPoint', contactType: 'general inquiry', email: 'info@citygate.capital', availableLanguage: 'English' },
            ],
            ...(businessLocation ? { address: businessLocation.address } : {}),
          },
        }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://citygate.capital/' },
            { '@type': 'ListItem', position: 2, name: 'Contact', item: 'https://citygate.capital/contact' },
          ],
        }) }} />
      </Helmet>

      {/* Hero */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] opacity-5 blur-[120px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, #C9A84C, transparent)' }} />
        <div className="container mx-auto px-4 md:px-6 relative text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-6 tracking-widest uppercase">
              Contact Us
            </span>
            <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight tracking-tight">
              Let's <span className="text-gold-shimmer">Talk</span>
            </h1>
            <p className="text-xl text-foreground/50 mb-10 max-w-lg mx-auto">
              Have a question, partnership inquiry, or need help with the product preview? Send a message and the team will respond when available.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {['Product preview support', 'Email contact', 'Website chat', 'Partnership enquiries'].map(tag => (
                <span key={tag} className="px-3 py-1.5 rounded-full text-xs font-medium text-primary bg-primary/10 border border-primary/20">{tag}</span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick contact channels */}
      <section className="py-12 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-wrap justify-center gap-3">
            {contactChannels.map((c, i) => (
              <motion.a
                key={c.title}
                href={c.href}
                target={c.href.startsWith('http') ? '_blank' : undefined}
                rel={c.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                className="flex items-center gap-3 glass-card rounded-xl px-4 py-3 gradient-border hover:border-primary/25 transition-colors group cursor-pointer no-underline">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                  style={{ background: `${c.color}15` }}>
                  <c.icon size={15} style={{ color: c.color }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{c.title}</p>
                  <p className="text-[10px] text-foreground/55">{c.detail}</p>
                </div>
              </motion.a>
            ))}
            {/* Admin-controlled social links */}
            {socials.map((s, i) => {
              const meta = PLATFORM_META[s.platformId];
              if (!meta) return null;
              return (
                <motion.a
                  key={s.platformId}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ delay: (contactChannels.length + i) * 0.07 }}
                  className="flex items-center gap-3 glass-card rounded-xl px-4 py-3 gradient-border hover:border-primary/25 transition-colors group cursor-pointer no-underline">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                    style={{ background: `${meta.color}15` }}>
                    <ExternalLink size={15} style={{ color: meta.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{meta.label}</p>
                    <p className="text-[10px] text-foreground/55">{meta.detail}</p>
                  </div>
                </motion.a>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact info + form */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* Info */}
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <h2 className="text-2xl font-bold text-foreground mb-8 tracking-tight">Contact Information</h2>
              <div className="space-y-4 mb-12">
                {[
                  { icon: Phone,  title: 'Phone',          detail: '+44 7888 382458',                       href: 'tel:+447888382458' },
                  { icon: Mail,   title: 'General',        detail: 'info@citygate.capital',                 href: 'mailto:info@citygate.capital' },
                  { icon: Mail,   title: 'Support',        detail: 'support@citygate.capital',              href: 'mailto:support@citygate.capital' },
                  ...(businessLocation ? [{ icon: MapPin, title: 'Office', detail: businessLocation.address, href: businessLocation.directionsUrl }] : []),
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4 p-4 glass rounded-2xl border border-primary/10 hover:border-primary/20 transition-colors group">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                      <item.icon size={17} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-foreground/55 uppercase tracking-wide mb-0.5">{item.title}</p>
                      {item.href ? (
                        <a href={item.href} className="text-sm font-medium text-foreground hover:text-primary transition-colors">{item.detail}</a>
                      ) : (
                        <p className="text-sm font-medium text-foreground">{item.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {businessLocation && <div className="overflow-hidden rounded-2xl border border-primary/15 bg-black/20 shadow-2xl shadow-black/20">
                <iframe
                  title="City Gate Capital office on Google Maps"
                  src={businessLocation.mapEmbedUrl}
                  className="h-80 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-primary/10 px-4 py-4">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
                    <p className="text-sm leading-relaxed text-foreground/65">{businessLocation.address}</p>
                  </div>
                  <a
                    href={businessLocation.directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-primary/20 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <Navigation size={13} /> Get directions
                  </a>
                </div>
              </div>}

            </motion.div>

            {/* Form */}
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              {submitted ? (
                <div className="h-full flex items-center justify-center">
                  <div className="glass-card rounded-3xl p-12 gradient-border text-center" style={{ boxShadow: 'var(--gold-glow)' }}>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
                      className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle size={36} className="text-primary" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-foreground mb-3">Message Sent!</h3>
                    <p className="text-foreground/50 text-sm mb-6 max-w-xs mx-auto">Your message was received. Response times vary; check your email for updates.</p>
                    <button onClick={() => setSubmitted(false)} className="text-xs text-primary hover:underline">Send another message</button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="glass-card rounded-3xl p-8 gradient-border space-y-5" style={{ boxShadow: 'var(--gold-glow)' }}>
                  <div>
                    <h2 className="text-xl font-bold text-foreground mb-1 tracking-tight">Send a Message</h2>
                    <p className="text-xs text-foreground/55">Response times vary. Do not send financial, identity-document, or payment information.</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { key: 'firstName', label: 'First Name', placeholder: 'John' },
                      { key: 'lastName',  label: 'Last Name',  placeholder: 'Doe'  },
                    ].map(field => (
                      <div key={field.key}>
                        <label htmlFor={`contact-${field.key}`} className="text-xs text-foreground/55 uppercase tracking-wide mb-2 block">{field.label}</label>
                        <input
                          id={`contact-${field.key}`}
                          required
                          value={form[field.key as keyof typeof form]}
                          onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                          className="w-full bg-white/[0.03] border border-primary/15 rounded-xl px-4 py-3 text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors text-sm"
                          placeholder={field.placeholder}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-email" className="text-xs text-foreground/55 uppercase tracking-wide mb-2 block">Email</label>
                      <input
                        id="contact-email"
                        required
                        type="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        className="w-full bg-white/[0.03] border border-primary/15 rounded-xl px-4 py-3 text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors text-sm"
                        placeholder="john@example.com"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-company" className="text-xs text-foreground/55 uppercase tracking-wide mb-2 block">Company <span className="text-foreground/40">(optional)</span></label>
                      <input
                        id="contact-company"
                        value={form.company}
                        onChange={e => setForm({ ...form, company: e.target.value })}
                        className="w-full bg-white/[0.03] border border-primary/15 rounded-xl px-4 py-3 text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors text-sm"
                        placeholder="Acme Corp"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-subject" className="text-xs text-foreground/55 uppercase tracking-wide mb-2 block">Subject</label>
                    <select
                      id="contact-subject"
                      value={form.subject}
                      onChange={e => setForm({ ...form, subject: e.target.value })}
                      className="w-full bg-white/[0.03] border border-primary/15 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors text-sm"
                    >
                      {subjects.map(s => (
                        <option key={s} className="bg-[#0A0A0A]">{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="text-xs text-foreground/55 uppercase tracking-wide mb-2 block">Message</label>
                    <textarea
                      id="contact-message"
                      required
                      rows={5}
                      value={form.message}
                      onChange={e => setForm({ ...form, message: e.target.value })}
                      className="w-full bg-white/[0.03] border border-primary/15 rounded-xl px-4 py-3 text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors text-sm resize-none"
                      placeholder="How can we help you?"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="group relative w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-bold text-black overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080] transition-opacity group-hover:opacity-90" />
                    {submitting ? (
                      <svg className="relative animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <Send size={16} className="relative" />
                    )}
                    <span className="relative">{submitting ? 'Sending…' : 'Send Message'}</span>
                  </button>
                  {submitError && (
                    <p className="text-sm text-red-400 text-center mt-2">{submitError}</p>
                  )}
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="glass-card rounded-3xl p-10 gradient-border text-center" style={{ boxShadow: 'var(--gold-glow)' }}>
            <h2 className="text-3xl font-bold text-foreground mb-4 tracking-tight">
              Ready to <span className="text-gold-gradient">Get Started?</span>
            </h2>
            <p className="text-foreground/50 mb-8 max-w-md mx-auto">Create a demonstration profile to explore the preview. No bank account or financial service is opened.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/accounts" className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-black overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                <span className="relative">Create Preview Profile</span>
                <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/support" className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-medium text-foreground/70 glass border border-primary/20 hover:border-primary/40 hover:text-foreground transition-colors">
                Visit Support Centre
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
