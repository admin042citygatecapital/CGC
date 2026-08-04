import { Helmet } from '@dr.pogodin/react-helmet';
import { type ReactElement } from 'react';
import { ScrollRestoration } from 'react-router-dom';

import Footer from '@/layouts/parts/Footer';
import Header from '@/layouts/parts/Header';
import Website from '@/layouts/Website';
import { usePageViewTracking } from '@/lib/useAnalytics';
import LogoIntro from '@/components/LogoIntro';

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
        <meta name="google-site-verification" content="-J8IGmkvR6HGA8bs2-NiBUbFvkGsPx4EBOhE36msBPQ" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://citygate.capital/" />
        <meta property="og:image" content="https://citygate.capital/api/og?title=City+Gate+Capital&description=Secure+Digital+Banking+for+the+Modern+World" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:image" content="https://citygate.capital/api/og?title=City+Gate+Capital&description=Secure+Digital+Banking+for+the+Modern+World" />
        <meta name="theme-color" content="#C9A84C" />
        <meta name="robots" content="index, follow" />
        <meta name="author" content="City Gate Capital" />
        <meta name="keywords" content="digital banking, crypto wallet, international transfers, multi-currency account, FDIC insured, fintech" />
      </Helmet>
      <ScrollRestoration />
      <Header />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </Website>
  );
}
