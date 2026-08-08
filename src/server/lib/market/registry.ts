/**
 * Market Data Provider Registry
 *
 * Central registry that:
 *  - Holds all registered providers
 *  - Selects the best available provider for a given capability + asset class
 *  - Provides a unified API so callers never reference a specific provider
 *
 * Priority order (highest → lowest):
 *   Crypto:  Binance → Kraken → Coinbase → Finnhub → Twelve Data → Alpha Vantage
 *   Stocks:  Polygon → Finnhub → Twelve Data → Alpha Vantage
 *   Forex:   Twelve Data → Alpha Vantage → Finnhub
 *   Default: first provider that supports the capability
 */

import type {
  MarketDataProvider, Ticker, Candle, CandleInterval,
  OrderBook, SearchResult, MarketSummary, AssetClass,
} from './types.js';

const CRYPTO_PRIORITY  = ['binance', 'kraken', 'coinbase', 'finnhub', 'twelve-data', 'alpha-vantage'];
const STOCK_PRIORITY   = ['polygon', 'finnhub', 'twelve-data', 'alpha-vantage'];
const FOREX_PRIORITY   = ['twelve-data', 'alpha-vantage', 'finnhub'];

export class MarketDataRegistry {
  private providers = new Map<string, MarketDataProvider>();
  private unavailableUntil = new Map<string, number>();

  register(provider: MarketDataProvider) {
    this.providers.set(provider.id, provider);
    console.log(`[market] Registered provider: ${provider.name}`);
  }

  getProvider(id: string): MarketDataProvider | undefined {
    return this.providers.get(id);
  }

  listProviders(): MarketDataProvider[] {
    return [...this.providers.values()];
  }

  /** Pick the best provider for a capability + asset class */
  private pick(
    capability: keyof MarketDataProvider['capabilities'],
    assetClass?: AssetClass,
  ): MarketDataProvider {
    const priority =
      assetClass === 'crypto' ? CRYPTO_PRIORITY :
      assetClass === 'stock'  ? STOCK_PRIORITY  :
      assetClass === 'forex'  ? FOREX_PRIORITY  :
      [...CRYPTO_PRIORITY, ...STOCK_PRIORITY, ...FOREX_PRIORITY];

    // Try in priority order first
    for (const id of priority) {
      const p = this.providers.get(id);
      if (p && p.capabilities[capability]) return p;
    }

    // Fall back to any registered provider that supports the capability
    for (const p of this.providers.values()) {
      if (p.capabilities[capability]) return p;
    }

    throw new Error(
      `No market data provider available for capability "${capability}"` +
      (assetClass ? ` and asset class "${assetClass}"` : '') +
      '. Add an API key in Settings → Secrets.'
    );
  }

  /** Try providers in priority order, falling back on error */
  private async tryWithFallback<T>(
    capability: keyof MarketDataProvider['capabilities'],
    assetClass: AssetClass | undefined,
    fn: (p: MarketDataProvider) => Promise<T>,
  ): Promise<T> {
    const priority =
      assetClass === 'crypto' ? CRYPTO_PRIORITY :
      assetClass === 'stock'  ? STOCK_PRIORITY  :
      assetClass === 'forex'  ? FOREX_PRIORITY  :
      [...CRYPTO_PRIORITY, ...STOCK_PRIORITY, ...FOREX_PRIORITY];

    const candidates: MarketDataProvider[] = [];
    for (const id of priority) {
      const p = this.providers.get(id);
      if (p && p.capabilities[capability]) candidates.push(p);
    }
    // Also include any registered provider not in the priority list
    for (const p of this.providers.values()) {
      if (p.capabilities[capability] && !candidates.includes(p)) candidates.push(p);
    }

    if (!candidates.length) {
      throw new Error(
        `No market data provider available for capability "${capability}"` +
        (assetClass ? ` and asset class "${assetClass}"` : '') +
        '. Add an API key in Settings → Secrets.'
      );
    }

    let lastError: Error = new Error('No providers');
    for (const p of candidates) {
      if ((this.unavailableUntil.get(p.id) ?? 0) > Date.now()) continue;
      try {
        const result = await fn(p);
        this.unavailableUntil.delete(p.id);
        return result;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        const geographicBlock = /HTTP 451|restricted location/i.test(lastError.message);
        this.unavailableUntil.set(p.id, Date.now() + (geographicBlock ? 60 * 60_000 : 30_000));
        console.warn(`[market] Provider ${p.id} failed for ${capability}: ${lastError.message}`);
      }
    }
    throw lastError;
  }

  // ── Unified API ────────────────────────────────────────────────────────────

  async getTicker(symbols: string[], assetClass?: AssetClass): Promise<Ticker[]> {
    return this.tryWithFallback('ticker', assetClass, async p => {
      const tickers = await p.getTicker(symbols);
      if (!tickers.length) throw new Error(`${p.name} returned no ticker data`);
      return tickers;
    });
  }

  async getCandles(
    symbol: string, interval: CandleInterval, limit?: number, assetClass?: AssetClass,
  ): Promise<Candle[]> {
    return this.tryWithFallback('candles', assetClass, p => p.getCandles(symbol, interval, limit));
  }

  async getOrderBook(symbol: string, depth?: number, assetClass?: AssetClass): Promise<OrderBook> {
    return this.tryWithFallback('orderBook', assetClass, p => p.getOrderBook(symbol, depth));
  }

  async search(query: string): Promise<SearchResult[]> {
    // Aggregate results from all providers that support search
    const results: SearchResult[] = [];
    const seen = new Set<string>();
    for (const p of this.providers.values()) {
      if (!p.capabilities.search) continue;
      try {
        const r = await p.search(query);
        for (const item of r) {
          if (!seen.has(item.symbol)) {
            seen.add(item.symbol);
            results.push(item);
          }
        }
      } catch { /* skip failing providers */ }
    }
    return results.slice(0, 30);
  }

  async getMarketSummary(assetClass?: AssetClass): Promise<MarketSummary> {
    return this.tryWithFallback('marketSummary', assetClass, p => p.getMarketSummary());
  }

  subscribeToTicker(
    symbols: string[],
    onUpdate: (ticker: Ticker) => void,
    onError?: (err: Error) => void,
    assetClass?: AssetClass,
  ): () => void {
    try {
      const p = this.pick('webSocket', assetClass);
      return p.subscribeToTicker(symbols, onUpdate, onError);
    } catch {
      return () => {};
    }
  }

  /** Status snapshot for admin UI */
  getStatus(): Array<{ id: string; name: string; available: boolean; capabilities: string[] }> {
    return [...this.providers.values()].map(p => ({
      id: p.id,
      name: p.name,
      available: (this.unavailableUntil.get(p.id) ?? 0) <= Date.now(),
      capabilities: Object.entries(p.capabilities)
        .filter(([, v]) => v)
        .map(([k]) => k),
    }));
  }
}

// Singleton
export const marketRegistry = new MarketDataRegistry();
