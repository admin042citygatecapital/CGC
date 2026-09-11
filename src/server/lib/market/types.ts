/**
 * Market Data Provider — Shared Types
 * All providers implement these interfaces.
 */

export type AssetClass = 'crypto' | 'stock' | 'forex' | 'commodity' | 'etf';

export interface Ticker {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  price: number;
  // 24h statistics are `null` when the provider does not supply them.
  // Consumers must treat null as "not available" (render an em dash) —
  // providers must NEVER substitute an unrelated quantity or time horizon
  // (e.g. best-bid size as volume, or a 52-week high as a 24h high).
  change24h: number | null;       // absolute
  changePct24h: number | null;    // percentage
  volume24h: number | null;
  marketCap?: number;
  high24h: number | null;
  low24h: number | null;
  open24h: number | null;
  currency: string;
  timestamp: number;       // unix ms
  provider: string;
}

export interface Candle {
  time: number;   // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type CandleInterval =
  | '1m' | '3m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h' | '6h' | '12h'
  | '1d' | '1w' | '1M';

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  exchange?: string;
}

export interface MarketSummary {
  gainers: Ticker[];
  losers: Ticker[];
  trending: Ticker[];
  mostActive: Ticker[];
}

/** Capabilities a provider may or may not support */
export interface ProviderCapabilities {
  ticker: boolean;
  candles: boolean;
  orderBook: boolean;
  search: boolean;
  marketSummary: boolean;
  webSocket: boolean;
}

/** Core interface every provider must implement */
export interface MarketDataProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  /** Fetch one or more tickers */
  getTicker(symbols: string[]): Promise<Ticker[]>;

  /** Fetch OHLCV candles */
  getCandles(symbol: string, interval: CandleInterval, limit?: number): Promise<Candle[]>;

  /** Fetch order book depth */
  getOrderBook(symbol: string, depth?: number): Promise<OrderBook>;

  /** Symbol search */
  search(query: string): Promise<SearchResult[]>;

  /** Gainers / losers / trending */
  getMarketSummary(): Promise<MarketSummary>;

  /** Open a WebSocket stream for real-time price updates.
   *  Returns a cleanup function. */
  subscribeToTicker(
    symbols: string[],
    onUpdate: (ticker: Ticker) => void,
    onError?: (err: Error) => void,
  ): () => void;
}

/** Thrown when a provider doesn't support a capability */
export class CapabilityNotSupportedError extends Error {
  constructor(provider: string, capability: string) {
    super(`Provider "${provider}" does not support "${capability}"`);
    this.name = 'CapabilityNotSupportedError';
  }
}

/** Thrown when a required API key is missing */
export class MissingApiKeyError extends Error {
  constructor(provider: string, keyName: string) {
    super(`Provider "${provider}" requires secret "${keyName}" — add it in Settings → Secrets`);
    this.name = 'MissingApiKeyError';
  }
}
