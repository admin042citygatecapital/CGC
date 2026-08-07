import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Globe, ArrowRight, CheckCircle, Loader2, ExternalLink } from 'lucide-react';
import CgcLogo from '@/components/CgcLogo';

const footerLinks = {
  Product: [
    { label: 'Digital Banking', href: '/digital-banking' },
    { label: 'Crypto Wallet',   href: '/accounts'        },
    { label: 'Accounts',        href: '/accounts'        },
    { label: 'Transfers',       href: '/accounts'        },
  ],
  Company: [
    { label: 'About Us',  href: '/about'   },
    { label: 'Contact',   href: '/contact' },
    { label: 'Support',   href: '/support' },
    { label: 'Careers',   href: '/contact' },
  ],
  Legal: [
    { label: 'Privacy Policy',   href: '/privacy-policy'   },
    { label: 'Terms of Service', href: '/terms-of-service' },
    { label: 'Cookie Policy',    href: '/cookie-policy'    },
    { label: 'Compliance',       href: '/compliance'       },
  ],
};

const trustItems = [
  'FDIC Insured up to $250,000',
  'Regulated in 40+ jurisdictions',
  '256-bit AES encryption',
  '99.9% uptime SLA',
];

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
  const [socials, setSocials]   = useState<SocialLink[]>([]);

  // Load admin-controlled social links from public endpoint
  useEffect(() => {
    fetch('/api/settings/social')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d?.links)) setSocials(d.links); })
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

      {/* Newsletter strip */}
      <div className="border-b border-primary/8">
        <div className="container mx-auto px-4 md:px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Stay ahead of the market</p>
              <p className="text-xs text-foreground/55">Weekly insights on crypto, FX rates, and fintech news. No spam.</p>
            </div>
            {subscribed ? (
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle size={16} />
                <span>You're subscribed — check your inbox!</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex flex-col gap-2 w-full md:w-auto">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="footer-name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="First name (optional)"
                    aria-label="First name (optional)"
                    className="w-full sm:w-32 bg-white/[0.03] border border-primary/15 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-primary/35 focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
                  />
                  <input
                    id="footer-email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    aria-label="Email address"
                    className="w-full sm:flex-1 md:w-52 bg-white/[0.03] border border-primary/15 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-primary/35 focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="relative group px-4 py-2.5 rounded-xl text-sm font-bold text-black overflow-hidden shrink-0 disabled:opacity-60"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                    <span className="relative flex items-center justify-center gap-1.5">
                      {loading ? <Loader2 size={13} className="animate-spin" /> : <><span>Subscribe</span><ArrowRight size={13} /></>}
                    </span>
                  </button>
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">

          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-5">
              <CgcLogo size={40} withWordmark glow />
            </Link>
            <p className="text-sm text-foreground/55 leading-relaxed max-w-xs mb-6">
              Premium digital banking for the modern world. Secure, fast, and built for global citizens who demand more.
            </p>

            {/* Trust items */}
            <ul className="space-y-2 mb-6">
              {trustItems.map(item => (
                <li key={item} className="flex items-center gap-2 text-xs text-foreground/55">
                  <Shield size={10} className="text-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            {/* Socials — admin-controlled */}
            {(() => {
              const footerSocials = socials.filter(s => s.enabled && s.showInFooter && s.url);
              if (footerSocials.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-2.5">
                  {footerSocials.map(s => (
                    <a
                      key={s.platformId}
                      href={s.url}
                      aria-label={PLATFORM_LABELS[s.platformId] ?? s.platformId}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-lg glass flex items-center justify-center text-foreground/35 hover:text-primary hover:border-primary/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <ExternalLink size={13} />
                    </a>
                  ))}
                </div>
              );
            })()}
          </div>

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
                      className="text-sm text-foreground/45 hover:text-primary transition-colors"
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
        <div className="mt-14 pt-6 border-t border-primary/8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-foreground/50">
            © {new Date().getFullYear()} City Gate Capital Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-xs text-foreground/50">
            <div className="flex items-center gap-1.5">
              <Globe size={11} />
              <span>Available in 180+ countries</span>
            </div>
            <span className="hidden md:inline">·</span>
            <span className="hidden md:inline">Regulated · Insured · Secure</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
