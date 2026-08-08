import { Helmet } from '@dr.pogodin/react-helmet';
import { type ReactElement } from 'react';
import { ScrollRestoration } from 'react-router-dom';

import Footer from '@/layouts/parts/Footer';
import Header from '@/layouts/parts/Header';
import Website from '@/layouts/Website';
import { usePageViewTracking } from '@/lib/useAnalytics';
import LogoIntro from '@/components/LogoIntro';
import WebsiteAnnouncement from '@/components/WebsiteAnnouncement';

/**
 * Root layout component that wraps all pages with consistent header and footer.
 *
 * To customize the header or footer, directly edit the Header.tsx and Footer.tsx
 * files in the layouts/parts directory.
 *
 * Site-wide <title> and <meta> live in the <Helmet> below. Individual pages can
 * override them by rendering their own <Helmet> — last-mounted wins.
 */
interface RootLayoutProps {
  children: ReactElement;
}

export default function RootLayout({ children }: RootLayoutProps) {
  usePageViewTracking();
  const isPreview = import.meta.env.VITE_PLATFORM_MODE !== 'live';
  return (
    <Website>
      {/* Skip-to-content link for keyboard/screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold focus:text-black focus:outline-none focus:ring-2 focus:ring-primary"
        style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}
      >
        Skip to main content
      </a>
      <LogoIntro />
      <Helmet>
        <title>City Gate Capital — Secure Digital Banking for the Modern World</title>
        <meta name="description" content="City Gate Capital offers premium digital banking, multi-currency wallets, crypto exchange, and international transfers. Open your account in minutes." />
        {/* google-site-verification is injected server-side from the GOOGLE_SITE_VERIFICATION secret */}
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://citygate.capital/" />
        <meta property="og:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <meta name="theme-color" content="#C9A84C" />
        <meta name="robots" content={isPreview ? 'noindex, nofollow' : 'index, follow'} />
        <meta name="author" content="City Gate Capital" />
        <meta name="keywords" content="digital banking, crypto wallet, international transfers, multi-currency account, fintech" />
        {/* Preconnect to own origin for API calls — cuts TTFB on first fetch */}
        <link rel="preconnect" href="https://citygate.capital" />
        {/* DNS-prefetch for external market data providers */}
        <link rel="dns-prefetch" href="https://api.coinbase.com" />
        <link rel="dns-prefetch" href="https://api.kraken.com" />
        <link rel="dns-prefetch" href="https://www.alphavantage.co" />
        <link rel="dns-prefetch" href="https://finnhub.io" />
        {/* Global Organization schema — present on every page */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          '@id': 'https://citygate.capital/#organization',
          name: 'City Gate Capital',
          url: 'https://citygate.capital',
          logo: {
            '@type': 'ImageObject',
            url: 'https://citygate.capital/assets/brand/city-gate-capital-seal.png',
            width: 200,
            height: 200,
          },
          description: 'Premium digital banking for global citizens. Multi-currency wallets, crypto exchange, international transfers, and smart cards.',
          contactPoint: [
            {
              '@type': 'ContactPoint',
              contactType: 'customer service',
              email: 'support@citygate.capital',
              availableLanguage: 'English',
              hoursAvailable: {
                '@type': 'OpeningHoursSpecification',
                dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
              },
            },
            {
              '@type': 'ContactPoint',
              contactType: 'general inquiry',
              email: 'info@citygate.capital',
              availableLanguage: 'English',
            },
          ],
          sameAs: [
            'https://twitter.com/CityGateCapital',
            'https://linkedin.com/company/citygate-capital',
            'https://instagram.com/citygatecapital',
          ],
          knowsAbout: [
            'Digital Banking', 'Cryptocurrency', 'International Money Transfers',
            'Multi-Currency Accounts', 'Fintech', 'Payment Processing',
          ],
        }) }} />
        {/* Global WebSite schema with Sitelinks Searchbox */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
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
        }) }} />
      </Helmet>
      <ScrollRestoration />
      <Header />
      <WebsiteAnnouncement />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </Website>
  );
}
