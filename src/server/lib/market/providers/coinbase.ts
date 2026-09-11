/**
 * Coinbase Advanced Trade Provider — Crypto
 * REST: https://api.coinbase.com/api/v3/brokerage
 * WebSocket: wss://advanced-trade-ws.coinbase.com
 *
 * Public endpoints (no auth) for market data.
 */

import WebSocket from 'ws';
import type {
  MarketDataProvider, ProviderCapabilities, Ticker, Candle,
  CandleInterval, OrderBook, SearchResult, MarketSummary,
} from '../types.js';

const REST_BASE = 'https://api.coinbase.com/api/v3/brokerage';
const WS_URL    = 'wss://advanced-trade-ws.coinbase.com';

/** Coinbase granularities that are actually offered — unsupported intervals
 *  must be refused, not silently served at a different width. */
const SUPPORTED_INTERVALS: ReadonlySet<CandleInterval> = new Set([
  '1m', '5m', '15m', '30m', '1h', '2h', '6h', '1d',
]);
const GRANULARITY: Record<string, string> = {
  '1m': 'ONE_MINUTE', '5m': 'FIVE_MINUTE', '15m': 'FIFTEEN_MINUTE',
  '30m': 'THIRTY_MINUTE', '1h': 'ONE_HOUR', '2h': 'TWO_HOUR',
  '6h': 'SIX_HOUR', '1d': 'ONE_DAY',
};
const GRANULARITY_SECONDS: Record<string, number> = {
  ONE_MINUTE: 60, FIVE_MINUTE: 300, FIFTEEN_MINUTE: 900,
  THIRTY_MINUTE: 1800, ONE_HOUR: 3600, TWO_HOUR: 7200,
  SIX_HOUR: 21600, ONE_DAY: 86400,
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Coinbase HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Parse a provider string into a finite number, else null — never a
 *  fabricated 0. */
function num(value: unknown): number | null {
  const n = parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : null;
}

export function toCoinbaseProductId(symbol: string): string {
  // Coinbase Advanced Trade lists USD-quoted products. A USDT request would
  // silently receive USD-quoted data, so refuse it and let the registry fall
  // back to a provider that genuinely quotes USDT.
  const normalized = symbol.replace('/', '').replace('-', '').toUpperCase();
  if (normalized.endsWith('USDT')) {
    throw new Error(`Coinbase does not quote USDT pairs (${symbol} would be served as USD)`);
  }
  if (normalized.endsWith('USD')) return `${normalized.slice(0, -3)}-USD`;
  return normalized;
}

/** Map a provider-native product id back to the platform's canonical symbol. */
export function fromCoinbaseProductId(productId: string): string {
  return productId.replace('/', '').replace('-', '').toUpperCase();
}

export class CoinbaseProvider implements MarketDataProvider {
  readonly id   = 'coinbase';
  readonly name = 'Coinbase';
  readonly capabilities: ProviderCapabilities = {
    ticker: true, candles: true, orderBook: true,
    search: true, marketSummary: true, webSocket: true,
  };

  async getTicker(symbols: string[]): Promise<Ticker[]> {
    const results: Ticker[] = [];
    for (const sym of symbols) {
      try {
        const productId = toCoinbaseProductId(sym);
        const data = await fetchJSON<Record<string, unknown>>(
          `${REST_BASE}/market/products/${productId}/ticker?limit=1`
        );
        const trades = (data.trades as Record<string, string>[])?.[0];
        if (!trades) continue;
        const price = num(trades.price);
        if (price === null) continue;
        results.push({
          symbol:      sym,
          name:        sym,
          assetClass:  'crypto',
          price,
          // This endpoint exposes no 24h statistics — leave them null rather
          // than reporting zeros, best-bid size as volume, or the last price
          // as the day's high/low/open.
          change24h:   null,
          changePct24h: null,
          volume24h:   null,
          high24h:     null,
          low24h:      null,
          open24h:     null,
          currency:    'USD',
          timestamp:   Date.now(),
          provider:    'coinbase',
        });
      } catch { /* skip */ }
    }
    return results;
  }

  async getCandles(symbol: string, interval: CandleInterval, limit = 200): Promise<Candle[]> {
    if (!SUPPORTED_INTERVALS.has(interval)) {
      throw new Error(`Coinbase does not support ${interval} candles`);
    }
    const productId = toCoinbaseProductId(symbol);
    const gran      = GRANULARITY[interval];
    const end       = Math.floor(Date.now() / 1000);
    const start = end - (GRANULARITY_SECONDS[gran] ?? 3600) * limit;
    const data  = await fetchJSON<{ candles: Record<string, string>[] }>(
      `${REST_BASE}/market/products/${productId}/candles?start=${start}&end=${end}&granularity=${gran}`
    );
    return (data.candles ?? []).map(c => ({
      time:   parseInt(c.start, 10),
      open:   parseFloat(c.open),
      high:   parseFloat(c.high),
      low:    parseFloat(c.low),
      close:  parseFloat(c.close),
      volume: parseFloat(c.volume),
    })).reverse();
  }

  async getOrderBook(symbol: string, depth = 20): Promise<OrderBook> {
    const productId = toCoinbaseProductId(symbol);
    const data = await fetchJSON<{ pricebook: { bids: Record<string, string>[]; asks: Record<string, string>[] } }>(
      `${REST_BASE}/market/product_book?product_id=${productId}&limit=${depth}`
    );
    const pb = data.pricebook ?? { bids: [], asks: [] };
    return {
      symbol,
      bids: pb.bids.map(b => ({ price: parseFloat(b.price), quantity: parseFloat(b.size) })),
      asks: pb.asks.map(a => ({ price: parseFloat(a.price), quantity: parseFloat(a.size) })),
      timestamp: Date.now(),
    };
  }

  async search(query: string): Promise<SearchResult[]> {
    const data = await fetchJSON<{ products: Record<string, string>[] }>(
      `${REST_BASE}/market/products?limit=50`
    );
    const q = query.toUpperCase();
    return (data.products ?? [])
      .filter(p => p.product_id?.includes(q) || p.base_name?.toUpperCase().includes(q))
      .slice(0, 10)
      .map(p => ({
        symbol:     p.product_id,
        name:       p.base_name ?? p.product_id,
        assetClass: 'crypto' as const,
        exchange:   'Coinbase',
      }));
  }

  async getMarketSummary(): Promise<MarketSummary> {
    const data = await fetchJSON<{ products: Record<string, string>[] }>(
      `${REST_BASE}/market/products?limit=100`
    );
    const tickers: Ticker[] = (data.products ?? [])
      .filter(p => p.quote_currency_id === 'USD' && p.status === 'online')
      .map(p => ({
        symbol:      p.product_id,
        name:        p.base_name ?? p.product_id,
        assetClass:  'crypto' as const,
        price:       num(p.price) ?? 0,
        // Percentage change and 24h volume are provided; the absolute change
        // and the day's high/low/open are not — they stay null.
        change24h:   null,
        changePct24h: num(p.price_percentage_change_24h),
        volume24h:   num(p.volume_24h),
        high24h:     null,
        low24h:      null,
        open24h:     null,
        currency:    'USD',
        timestamp:   Date.now(),
        provider:    'coinbase',
      }));

    const sorted = [...tickers].sort((a, b) => (b.changePct24h ?? -Infinity) - (a.changePct24h ?? -Infinity));
    const byVol  = [...tickers].sort((a, b) => (b.volume24h ?? -Infinity) - (a.volume24h ?? -Infinity));
    return {
      gainers:    sorted.slice(0, 10),
      losers:     sorted.slice(-10).reverse(),
      trending:   byVol.slice(0, 10),
      mostActive: byVol.slice(0, 10),
    };
  }

  subscribeToTicker(
    symbols: string[],
    onUpdate: (ticker: Ticker) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let ws: WebSocket | null = null;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    // Skip symbols Coinbase cannot serve rather than aborting the stream.
    const productIds: string[] = [];
    for (const s of symbols) {
      try { productIds.push(toCoinbaseProductId(s)); } catch { /* unsupported pair — skip */ }
    }

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(WS_URL);

      ws.on('open', () => {
        ws?.send(JSON.stringify({
          type: 'subscribe',
          product_ids: productIds,
          channel: 'ticker',
        }));
      });

      ws.on('message', (raw: Buffer) => {
        try {
          const d = JSON.parse(raw.toString());
          if (d.channel !== 'ticker') return;
          for (const ev of d.events ?? []) {
            for (const t of ev.tickers ?? []) {
              onUpdate({
                // Emit the platform's canonical symbol, not Coinbase's
                // provider-native product id.
                symbol:      fromCoinbaseProductId(t.product_id),
                name:        fromCoinbaseProductId(t.product_id),
                assetClass:  'crypto',
                price:       num(t.price) ?? 0,
                change24h:   null,
                changePct24h: num(t.price_percent_chg_24h),
                volume24h:   num(t.volume_24h),
                // 52-week figures are a different horizon — never reuse them
                // as 24h high/low.
                high24h:     null,
                low24h:      null,
                open24h:     null,
                currency:    'USD',
                timestamp:   Date.now(),
                provider:    'coinbase',
              });
            }
          }
        } catch { /* ignore */ }
      });

      ws.on('error', (err: Error) => onError?.(err));
      ws.on('close', () => {
        if (!closed) reconnectTimer = setTimeout(connect, 3000);
      });
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }
}
