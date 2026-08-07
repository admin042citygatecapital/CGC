// Re-export shim — real implementation in src/sections/InvestmentsModule.tsx
import { Helmet } from '@dr.pogodin/react-helmet';
export { InvestmentsSection } from '@/sections/InvestmentsModule';
export function InvestmentsModuleSEO() {
  return (
    <Helmet>
      <title>City Gate Capital — Investments & Accounts</title>
      <meta name="description" content="Checking, savings, investment accounts and crypto wallets — all in one premium platform." />
      <link rel="canonical" href="https://citygate.capital/" />
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  );
}
export default function InvestmentsModulePage() {
  return <main><h1>City Gate Capital — Investments</h1><InvestmentsModuleSEO /></main>;
}
