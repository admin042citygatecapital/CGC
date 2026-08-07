// Re-export shim — real implementation in src/sections/TradingModule.tsx
import { Helmet } from '@dr.pogodin/react-helmet';
export { TradingSection } from '@/sections/TradingModule';
export function TradingModuleSEO() {
  return (
    <Helmet>
      <title>City Gate Capital — Crypto Trading</title>
      <meta name="description" content="Trade Bitcoin, Ethereum, Solana and 50+ crypto assets with real-time prices and low fees." />
      <link rel="canonical" href="https://citygate.capital/" />
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  );
}
export default function TradingModulePage() {
  return <main><h1>City Gate Capital — Crypto Trading</h1><TradingModuleSEO /></main>;
}
