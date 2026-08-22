import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, ChevronDown, Loader2, Mail, MapPin } from 'lucide-react';
import { SocialPlatformIcon } from '@/components/SocialPlatformIcon';
import type { BusinessLocation } from '@/lib/businessLocation';

const footerLinks = {
  Legal: [
    { label: 'Privacy Policy',   href: '/privacy-policy'   },
    { label: 'Terms of Service', href: '/terms-of-service' },
    { label: 'Cookie Policy',    href: '/cookie-policy'    },
    { label: 'Compliance',       href: '/compliance'       },
  ],
};

interface SocialLink {
  platformId: string;
  url: string;
  enabled: boolean;
  showInFooter: boolean;
}

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'X / Twitter', linkedin: 'LinkedIn', instagram: 'Instagram',
  facebook: 'Facebook', telegram: 'Telegram', whatsapp: 'WhatsApp',
  tiktok: 'TikTok', youtube: 'YouTube', discord: 'Discord',
};

export default function Footer() {
  const [email, setEmail]       = useState('');
  const [name, setName]         = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [newsletterOpen, setNewsletterOpen] = useState(false);
  const [socials, setSocials]   = useState<SocialLink[]>([]);
  const [businessLocation, setBusinessLocation] = useState<BusinessLocation | null>(null);

  // Load admin-controlled social links from public endpoint
  useEffect(() => {
    fetch('/api/settings/social')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d?.links)) setSocials(d.links); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/settings/website', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setBusinessLocation(d?.data?.location?.address ? d.data.location as BusinessLocation : null);
      })
      .catch(() => {});
  }, []);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: name || undefined, source: 'footer' }),
      });
      if (!res.ok) throw new Error('Subscription failed');
      setSubscribed(true);
    } catch {
      setError('Something went wrong — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <footer className="relative border-t border-primary/10 bg-[#060606]">
      {/* Gold line top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      {/* Compact newsletter control */}
      <div className="border-b border-primary/8 py-6">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mx-auto max-w-3xl">
            <button
              type="button"
              onClick={() => setNewsletterOpen(open => !open)}
              aria-expanded={newsletterOpen}
              aria-controls="footer-newsletter-form"
              className="flex w-full items-center justify-between rounded-2xl border border-primary/20 bg-primary/[0.035] px-5 py-4 text-left transition-colors hover:border-primary/40 md:px-6"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Mail size={19} /></span>
                <span><span className="block text-sm font-semibold text-foreground">Market insights</span><span className="mt-1 block text-xs text-foreground/55">Receive selected updates on markets, currencies and financial technology.</span></span>
              </span>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform ${newsletterOpen ? 'rotate-180' : ''}`}><ChevronDown size={17} /></span>
            </button>

            {newsletterOpen && (
              <div id="footer-newsletter-form" className="mt-3 rounded-2xl border border-primary/10 bg-white/[0.02] p-4 md:p-5">
                {subscribed ? (
                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-primary"><CheckCircle size={16} /><span>You're subscribed — check your inbox.</span></div>
                ) : (
                  <form onSubmit={handleSubscribe} className="space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input id="footer-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="First name (optional)" aria-label="First name (optional)" className="w-full rounded-xl border border-primary/15 bg-white/[0.03] px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:w-44" />
                      <input id="footer-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" aria-label="Email address" className="min-w-0 flex-1 rounded-xl border border-primary/15 bg-white/[0.03] px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" />
                      <button type="submit" disabled={loading} className="group relative shrink-0 overflow-hidden rounded-xl px-5 py-2.5 text-sm font-bold text-black disabled:opacity-60"><span className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" /><span className="relative flex items-center justify-center gap-1.5">{loading ? <Loader2 size={13} className="animate-spin" /> : <><span>Subscribe</span><ArrowRight size={13} /></>}</span></button>
                    </div>
                    {error && <p className="text-xs text-red-400">{error}</p>}
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-16">
        <div className="max-w-sm">
          {/* Links */}
          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <h4 className="text-[10px] font-bold text-foreground/50 uppercase tracking-[0.18em] mb-5">
                {section}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-sm text-foreground/65 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-14 flex flex-col items-center justify-between gap-5 border-t border-primary/8 pt-6 lg:flex-row">
          <div className="flex flex-col items-center gap-3 lg:items-start">
            <p className="text-xs text-foreground/50">© {new Date().getFullYear()} City Gate Capital Ltd. All rights reserved.</p>
            {businessLocation && <a href={businessLocation.directionsUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-xs leading-relaxed text-foreground/45 transition-colors hover:text-primary"><MapPin size={13} className="mt-0.5 shrink-0 text-primary" /><span>{businessLocation.address}</span></a>}
          </div>
          {socials.some(s => s.enabled && s.showInFooter && s.url) && (
            <div className="flex flex-wrap justify-center gap-2">
              {socials.filter(s => s.enabled && s.showInFooter && s.url).map(s => (
                <a key={s.platformId} href={s.url} aria-label={PLATFORM_LABELS[s.platformId] ?? s.platformId} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/10 text-foreground/40 transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><SocialPlatformIcon platform={s.platformId} className="h-4 w-4" /></a>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
