// Re-export shim — real implementation in src/sections/BankingModule.tsx
import { Helmet } from '@dr.pogodin/react-helmet';
export { HeroSection, StatsBar, FeaturesGrid, DashboardPreview, TransfersSection, SecuritySection, MobileAppSection, PricingSection, TestimonialsSection, FaqSection, CtaSection } from '@/sections/BankingModule';
export function BankingModuleSEO() {
  return (
    <Helmet>
      <title>City Gate Capital — Secure Digital Banking</title>
      <meta name="description" content="Premium digital banking, crypto wallets, and international transfers for global citizens." />
      <link rel="canonical" href="https://citygate.capital/" />
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  );
}
export default function BankingModulePage() {
  return <main><h1>City Gate Capital — Secure Digital Banking</h1><BankingModuleSEO /></main>;
}
