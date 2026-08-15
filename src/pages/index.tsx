import { Helmet } from '@dr.pogodin/react-helmet';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { WsStatusBadge } from '@/components/WsStatusBadge';
import { HomepageContentProvider, useHomepageContent } from '@/lib/homepageContentContext';
import { useLiveTicker } from '@/lib/useLiveTicker';
import { useMarketWebSocket } from '@/lib/useMarketWebSocket';
import {
  BankingFitsLifeBanner,
  FaqSection,
  GlobalBankingSection,
  HeroSection,
} from '@/sections/BankingModule';

function HomePageContent() {
  const home = useHomepageContent();
  const visibility = home._visibility ?? { showStats: true, showTestimonials: true, showPartners: true, showNewsSection: true };
  const announcement = home._announcement;
  const tickers = useLiveTicker();
  const { status: wsStatus, isLive, source } = useMarketWebSocket(
    ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT'],
    8_000,
  );

  const pageTitle = `${home.hero.headline1} ${home.hero.headlineAccent} ${home.hero.headline2} | City Gate Capital`;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={home.hero.subheadline} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://citygate.capital/" />
        <meta property="og:title" content="City Gate Capital — Connected Digital Banking" />
        <meta property="og:description" content={home.hero.subheadline} />
        <meta property="og:url" content="https://citygate.capital/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://citygate.capital/assets/media/city-gate-banking-customer-hero-v2.png" />
        <meta property="og:image:alt" content="City Gate Capital connected banking experience" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="City Gate Capital — Connected Digital Banking" />
        <meta name="twitter:description" content={home.hero.subheadline} />
        <meta name="twitter:image" content="https://citygate.capital/assets/media/city-gate-banking-customer-hero-v2.png" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'Organization', '@id': 'https://citygate.capital/#organization', name: 'City Gate Capital', url: 'https://citygate.capital', logo: 'https://citygate.capital/assets/brand/city-gate-capital-seal.png' },
            { '@type': 'WebSite', '@id': 'https://citygate.capital/#website', name: 'City Gate Capital', url: 'https://citygate.capital', publisher: { '@id': 'https://citygate.capital/#organization' } },
            { '@type': 'WebApplication', name: 'City Gate Capital', url: 'https://citygate.capital/', applicationCategory: 'FinanceApplication', operatingSystem: 'Web', description: home.hero.subheadline },
          ],
        })}</script>
      </Helmet>

      <h1 className="sr-only">City Gate Capital connected digital banking</h1>

      {announcement?.enabled && announcement.text.trim() && (
        <div className="relative z-10 mt-[72px] border-b border-primary/15 px-4 py-3 text-center text-sm font-medium text-foreground" data-announcement-type={announcement.type} style={{ background: 'linear-gradient(90deg, rgba(201,168,76,0.08), rgba(201,168,76,0.16), rgba(201,168,76,0.08))' }}>
          {announcement.text}
        </div>
      )}

      {visibility.showNewsSection && (
        <div className={`relative z-10 overflow-hidden border-b border-primary/10 bg-[#060606] ${announcement?.enabled && announcement.text.trim() ? '' : 'mt-[72px]'}`}>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#060606] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#060606] to-transparent" />
          <div className="absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 items-center gap-2 sm:flex"><WsStatusBadge status={wsStatus} isLive={isLive} source={source} /></div>
          <div className="flex overflow-hidden py-2.5 sm:pl-40 lg:pl-44">
            <div className="flex gap-10 whitespace-nowrap" style={{ animation: 'ticker 50s linear infinite', willChange: 'transform' }}>
              {[...tickers, ...tickers].map((ticker, index) => (
                <span key={index} className="inline-flex shrink-0 items-center gap-2 text-xs">
                  <span className="font-medium tracking-wide text-foreground/65">{ticker.symbol}</span>
                  <span className="font-semibold tabular-nums text-foreground">{ticker.price}</span>
                  <span className={`flex items-center gap-0.5 font-semibold ${ticker.up ? 'text-emerald-400' : 'text-red-400'}`}>{ticker.up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}{ticker.change}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <HeroSection />
      <GlobalBankingSection />
      <BankingFitsLifeBanner />

      <section className="border-y border-primary/10 bg-[#060606] py-10 md:py-12">
        <div className="container mx-auto px-4 md:px-6">
          <FaqSection />
        </div>
      </section>
    </>
  );
}

export default function HomePage() {
  return <HomepageContentProvider><HomePageContent /></HomepageContentProvider>;
}
