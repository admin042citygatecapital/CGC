/**
 * Market Data Provider Initializer
 *
 * Registers all providers that have valid API keys at startup.
 * Providers without keys are silently skipped — the registry
 * will use whichever providers are available.
 *
 * Call initMarketProviders() once at server startup.
 */

import { getSecret } from '#airo/secrets';
import { marketRegistry } from './registry.js';
import { BinanceProvider }      from './providers/binance.js';
import { CoinbaseProvider }     from './providers/coinbase.js';
import { KrakenProvider }       from './providers/kraken.js';
import { AlphaVantageProvider } from './providers/alphavantage.js';
import { FinnhubProvider }      from './providers/finnhub.js';
import { PolygonProvider }      from './providers/polygon.js';
import { TwelveDataProvider }   from './providers/twelvedata.js';

let initialised = false;

export function initMarketProviders() {
  if (initialised) return;
  initialised = true;

  // No-key providers — always register
  marketRegistry.register(new BinanceProvider());
  marketRegistry.register(new CoinbaseProvider());
  marketRegistry.register(new KrakenProvider());

  // Key-gated providers — register only when key is present
  if (String(getSecret('ALPHA_VANTAGE_API_KEY') ?? '')) {
    marketRegistry.register(new AlphaVantageProvider());
  }
  if (String(getSecret('FINNHUB_API_KEY') ?? '')) {
    marketRegistry.register(new FinnhubProvider());
  }
  if (String(getSecret('POLYGON_API_KEY') ?? '')) {
    marketRegistry.register(new PolygonProvider());
  }
  if (String(getSecret('TWELVE_DATA_API_KEY') ?? '')) {
    marketRegistry.register(new TwelveDataProvider());
  }

  console.log(`[market] ${marketRegistry.listProviders().length} provider(s) registered`);
}

// Auto-init at module load so providers are available immediately in dev (Vite SSR)
initMarketProviders();
