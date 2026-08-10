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

// ── Banking module ────────────────────────────────────────────────────────────
import {
  HeroSection,
  StatsBar,
  FeaturesGrid,
  DashboardPreview,
  TransfersSection,
  SecuritySection,
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

export default function HomePage() {
  const tickers = useLiveTicker();
  const { status: wsStatus, isLive, source } = useMarketWebSocket(
    ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT'],
    8_000,
  );

  return (
    <>
      <Helmet>
        <title>City Gate Capital — Digital Finance Product Preview</title>
        <meta name="description" content="Explore the City Gate Capital product preview for multi-currency accounts, wallets, transfers, cards, analytics, and secure administration." />
        <link rel="canonical" href="https://citygate.capital/" />
        <meta property="og:title" content="City Gate Capital — Digital Finance Product Preview" />
        <meta property="og:description" content="A product preview for multi-currency accounts, wallets, transfers, cards, analytics, and secure administration." />
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
        <meta name="twitter:title" content="City Gate Capital — Digital Finance Product Preview" />
        <meta name="twitter:description" content="Preview proposed multi-currency, wallet, transfer, card, analytics, and administration experiences without live financial transactions." />
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
              description: 'Product preview of proposed financial-technology interfaces and administration workflows.',
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
              name: 'City Gate Capital — Digital Finance Product Preview',
              isPartOf: { '@id': 'https://citygate.capital/#website' },
              about: { '@id': 'https://citygate.capital/#organization' },
              dateModified: '2026-07-11',
            },
            {
              '@type': 'WebApplication',
              '@id': 'https://citygate.capital/#product-preview',
              name: 'City Gate Capital',
              url: 'https://citygate.capital',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              description: 'A non-transactional product preview. It does not accept deposits, provide custody, issue cards, or execute live financial transactions.',
            },
          ],
        })}</script>
      </Helmet>

      {/* sr-only h1 — visible h1 is rendered inside HeroSection */}
      <h1 className="sr-only">City Gate Capital — Digital Finance Product Preview</h1>

      {/* ── Live Ticker Strip ────────────────────────────────── */}
      <div className="relative z-10 bg-[#060606] border-b border-primary/10 overflow-hidden mt-[72px]">
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
        <div className="flex py-2.5 pl-0 sm:pl-28" style={{ overflow: 'hidden' }}>
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
      </div>

      {/* ── BANKING MODULE ───────────────────────────────────── */}
      <HeroSection />
      <StatsBar />
      <FeaturesGrid />
      <DashboardPreview />
      <TransfersSection />

      {/* ── TRADING MODULE ───────────────────────────────────── */}
      <TradingSection livePrices={tickers} />

      {/* ── LIVE MARKETS ─────────────────────────────────────── */}
      <LiveMarketsSection />

      {/* ── WALLETS MODULE ───────────────────────────────────── */}
      <WalletsSection />

      {/* ── INVESTMENTS MODULE ──────────────────────────────── */}
      <InvestmentsSection />

      {/* ── BANKING MODULE (continued) ──────────────────────── */}
      <SecuritySection />
      <MobileAppSection />

      {/* ── Pricing ─────────────────────────────────────────── */}
      <section className="py-28 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
              Proposed Plan Concepts
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
              Explore possible <span className="text-gold-gradient">product tiers</span>
            </h2>
          </div>
          <PricingSection />
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────── */}
      <section className="py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
              Illustrative Use Cases
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
              Proposed <span className="text-gold-gradient">user scenarios</span>
            </h2>
          </div>
          <TestimonialsSection />
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section className="py-28 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
              FAQ
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
              Got <span className="text-gold-gradient">questions?</span>
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
