// Re-export shim — real implementation in src/sections/WalletsModule.tsx
import { Helmet } from '@dr.pogodin/react-helmet';
export { WalletsSection } from '@/sections/WalletsModule';
export function WalletsModuleSEO() {
  return (
    <Helmet>
      <title>City Gate Capital — Multi-Currency Wallets</title>
      <meta name="description" content="Hold, send and exchange USD, EUR, GBP, BTC, ETH and 50+ currencies in one multi-currency wallet." />
      <link rel="canonical" href="https://citygate.capital/" />
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  );
}
export default function WalletsModulePage() {
  return <main><h1>City Gate Capital — Wallets</h1><WalletsModuleSEO /></main>;
}
