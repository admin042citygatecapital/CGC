/**
 * Homepage — City Gate Capital
 *
 * Architecture: modular sections imported from src/pages/home/
 *   Banking    → BankingModule.tsx
 *   Trading    → TradingModule.tsx
 *   Investments → InvestmentsModule.tsx
 *   Wallets    → WalletsModule.tsx
 *
 * Shared primitives (GlassCard, AnimatedBar, etc.) → src/lib/homeShared.tsx
 *
 * No duplicated code — each module owns its section logic.
 */
import { Helmet } from '@dr.pogodin/react-helmet';
import { useLiveTicker } from '@/lib/useLiveTicker';
import { useMarketWebSocket } from '@/lib/useMarketWebSocket';
import { WsStatusBadge } from '@/components/WsStatusBadge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { HomepageContentProvider, useHomepageContent } from '@/lib/homepageContentContext';

// ── Banking module ────────────────────────────────────────────────────────────
import {
  HeroSection,
  StatsBar,
  FeaturesGrid,
  DashboardPreview,
  MobileAppSection,
  PricingSection,
  TestimonialsSection,
  FaqSection,
  CtaSection,
} from '@/sections/BankingModule';

// ── Trading module ────────────────────────────────────────────────────────────
import { TradingSection } from '@/sections/TradingModule';

// ── Live markets section ──────────────────────────────────────────────────────
import { LiveMarketsSection } from '@/sections/LiveMarketsSection';

// ── Investments module ────────────────────────────────────────────────────────
import { InvestmentsSection } from '@/sections/InvestmentsModule';

// ── Wallets module ────────────────────────────────────────────────────────────
import { WalletsSection } from '@/sections/WalletsModule';

// ── Live ticker (shared between hero and ticker bar) ─────────────────────────
// Moved to a shared hook so the ticker data is fetched once

function HomePageContent() {
  const home = useHomepageContent();
  const visibility = home._visibility ?? {
    showStats: true,
    showTestimonials: true,
    showPartners: true,
    showNewsSection: true,
  };
  const announcement = home._announcement;
  const tickers = useLiveTicker();
  const { status: wsStatus, isLive, source } = useMarketWebSocket(
    ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT'],
    8_000,
  );

  return (
    <>
      <Helmet>
        <title>{`${home.hero.headline1} ${home.hero.headlineAccent} ${home.hero.headline2} | City Gate Capital`}</title>
        <meta name="description" content={home.hero.subheadline} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://citygate.capital/" />
        <meta property="og:title" content="City Gate Capital — Secure Financial Technology" />
        <meta property="og:description" content={home.hero.subheadline} />
        <meta property="og:url" content="https://citygate.capital/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="City Gate Capital — Secure Digital Banking for the Modern World" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:creator" content="@CityGateCapital" />
        <meta name="twitter:title" content="City Gate Capital — Secure Financial Technology" />
        <meta name="twitter:description" content={home.hero.subheadline} />
        <meta name="twitter:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              '@id': 'https://citygate.capital/#organization',
              name: 'City Gate Capital',
              url: 'https://citygate.capital',
              logo: {
                '@type': 'ImageObject',
                url: 'https://citygate.capital/assets/brand/city-gate-capital-seal.png',
                width: 200, height: 200,
              },
              description: 'Financial-technology interfaces, account security and administration workflows.',
              knowsAbout: ['Financial technology product design','Account security','Administrative workflows'],
              sameAs: ['https://twitter.com/CityGateCapital','https://linkedin.com/company/citygate-capital','https://instagram.com/citygatecapital'],
              contactPoint: [
                {
                  '@type': 'ContactPoint',
                  telephone: '+447888382458',
                  contactType: 'customer service',
                  email: 'support@citygate.capital',
                  availableLanguage: 'English',
                  hoursAvailable: {
                    '@type': 'OpeningHoursSpecification',
                    dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
                  },
                },
                { '@type': 'ContactPoint', contactType: 'general inquiry', email: 'info@citygate.capital', availableLanguage: 'English' },
              ],
            },
            {
              '@type': 'WebSite',
              '@id': 'https://citygate.capital/#website',
              name: 'City Gate Capital',
              url: 'https://citygate.capital',
              publisher: { '@id': 'https://citygate.capital/#organization' },
              potentialAction: {
                '@type': 'SearchAction',
                target: { '@type': 'EntryPoint', urlTemplate: 'https://citygate.capital/support?q={search_term_string}' },
                'query-input': 'required name=search_term_string',
              },
            },
            {
              '@type': 'WebPage',
              '@id': 'https://citygate.capital/#webpage',
              url: 'https://citygate.capital/',
              name: 'City Gate Capital — Secure Financial Technology',
              isPartOf: { '@id': 'https://citygate.capital/#website' },
              about: { '@id': 'https://citygate.capital/#organization' },
              dateModified: '2026-07-11',
            },
            {
              '@type': 'WebApplication',
              '@id': 'https://citygate.capital/#platform',
              name: 'City Gate Capital',
              url: 'https://citygate.capital/',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              description: 'Financial-technology software with provider-gated account, transfer, card, wallet, and market experiences.',
            },
          ],
        })}</script>
      </Helmet>

      {/* sr-only h1 — visible h1 is rendered inside HeroSection */}
      <h1 className="sr-only">City Gate Capital Secure Financial Technology</h1>

      {announcement?.enabled && announcement.text.trim() && (
        <div
          className="relative z-10 mt-[72px] border-b border-primary/15 px-4 py-3 text-center text-sm font-medium text-foreground"
          data-announcement-type={announcement.type}
          style={{ background: 'linear-gradient(90deg, rgba(201,168,76,0.08), rgba(201,168,76,0.16), rgba(201,168,76,0.08))' }}
        >
          {announcement.text}
        </div>
      )}

      {/* ── Live Ticker Strip ────────────────────────────────── */}
      {visibility.showNewsSection && <div className={`relative z-10 bg-[#060606] border-b border-primary/10 overflow-hidden ${announcement?.enabled && announcement.text.trim() ? '' : 'mt-[72px]'}`}>
        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to right, #060606, transparent)' }} />
        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to left, #060606, transparent)' }} />

        {/* Status badge — pinned left */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 hidden sm:flex items-center gap-2">
          <WsStatusBadge status={wsStatus} isLive={isLive} source={source} />
        </div>

        {/* Scrolling strip */}
        <div className="flex py-2.5 pl-0 sm:pl-40 lg:pl-44" style={{ overflow: 'hidden' }}>
          <div
            className="flex gap-10 whitespace-nowrap"
            style={{ animation: 'ticker 50s linear infinite', willChange: 'transform' }}
          >
            {[...tickers, ...tickers].map((t, i) => (
              <span key={i} className="inline-flex items-center gap-2 text-xs shrink-0">
                <span className="text-foreground/65 font-medium tracking-wide">{t.symbol}</span>
                <span className="text-foreground font-semibold tabular-nums">{t.price}</span>
                <span className={`font-semibold flex items-center gap-0.5 ${t.up ? 'text-emerald-400' : 'text-red-400'}`}>
                  {t.up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                  {t.change}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>}

      {/* ── BANKING MODULE ───────────────────────────────────── */}
      <HeroSection />
      {visibility.showStats && <StatsBar />}
      <FeaturesGrid />
      <DashboardPreview />

      {/* ── TRADING MODULE ───────────────────────────────────── */}
      <TradingSection livePrices={tickers} />

      {/* ── LIVE MARKETS ─────────────────────────────────────── */}
      {visibility.showPartners && <LiveMarketsSection />}

      {/* ── WALLETS MODULE ───────────────────────────────────── */}
      <WalletsSection />

      {/* ── INVESTMENTS MODULE ──────────────────────────────── */}
      <InvestmentsSection />

      {/* ── BANKING MODULE (continued) ──────────────────────── */}
      <MobileAppSection />

      {/* ── Pricing ─────────────────────────────────────────── */}
      <section className="py-28 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
              {home.pricing.eyebrow}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
              {home.pricing.headline1} <span className="text-gold-gradient">{home.pricing.headlineAccent}</span> {home.pricing.headline2}
            </h2>
          </div>
          <PricingSection />
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────── */}
      {visibility.showTestimonials && <section className="py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
              {home.testimonials.eyebrow}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
              {home.testimonials.headline1} <span className="text-gold-gradient">{home.testimonials.headlineAccent}</span> {home.testimonials.headline2}
            </h2>
          </div>
          <TestimonialsSection />
        </div>
      </section>}

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section className="py-28 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
              {home.faq.eyebrow}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
              {home.faq.headline1} <span className="text-gold-gradient">{home.faq.headlineAccent}</span>
            </h2>
          </div>
          <FaqSection />
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <CtaSection />
    </>
  );
}

export default function HomePage() {
  return <HomepageContentProvider><HomePageContent /></HomepageContentProvider>;
}
