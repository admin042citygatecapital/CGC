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

const INTERVAL_MAP: Record<CandleInterval, string> = {
  '1m': 'ONE_MINUTE', '5m': 'FIVE_MINUTE', '15m': 'FIFTEEN_MINUTE',
  '30m': 'THIRTY_MINUTE', '1h': 'ONE_HOUR', '2h': 'TWO_HOUR',
  '6h': 'SIX_HOUR', '1d': 'ONE_DAY',
  '3m': 'FIVE_MINUTE', '4h': 'SIX_HOUR', '12h': 'ONE_DAY',
  '1w': 'ONE_DAY', '1M': 'ONE_DAY',
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Coinbase HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function toCoinbaseProductId(symbol: string): string {
  // Coinbase uses BTC-USD format
  const normalized = symbol.replace('/', '').replace('-', '').toUpperCase();
  if (normalized.endsWith('USDT')) return `${normalized.slice(0, -4)}-USD`;
  if (normalized.endsWith('USD')) return `${normalized.slice(0, -3)}-USD`;
  return symbol;
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
        const price = parseFloat(trades.price ?? '0');
        results.push({
          symbol:      sym,
          name:        sym,
          assetClass:  'crypto',
          price,
          change24h:   0,
          changePct24h: 0,
          volume24h:   parseFloat(String(data.best_bid_size ?? 0)),
          high24h:     price,
          low24h:      price,
          open24h:     price,
          currency:    'USD',
          timestamp:   Date.now(),
          provider:    'coinbase',
        });
      } catch { /* skip */ }
    }
    return results;
  }

  async getCandles(symbol: string, interval: CandleInterval, limit = 200): Promise<Candle[]> {
    const productId = toCoinbaseProductId(symbol);
    const gran      = INTERVAL_MAP[interval] ?? 'ONE_HOUR';
    const end       = Math.floor(Date.now() / 1000);
    const granSecs: Record<string, number> = {
      ONE_MINUTE: 60, FIVE_MINUTE: 300, FIFTEEN_MINUTE: 900,
      THIRTY_MINUTE: 1800, ONE_HOUR: 3600, TWO_HOUR: 7200,
      SIX_HOUR: 21600, ONE_DAY: 86400,
    };
    const start = end - (granSecs[gran] ?? 3600) * limit;
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
        price:       parseFloat(p.price ?? '0'),
        change24h:   parseFloat(p.price_percentage_change_24h ?? '0'),
        changePct24h: parseFloat(p.price_percentage_change_24h ?? '0'),
        volume24h:   parseFloat(p.volume_24h ?? '0'),
        high24h:     parseFloat(p.price ?? '0'),
        low24h:      parseFloat(p.price ?? '0'),
        open24h:     parseFloat(p.price ?? '0'),
        currency:    'USD',
        timestamp:   Date.now(),
        provider:    'coinbase',
      }));

    const sorted = [...tickers].sort((a, b) => b.changePct24h - a.changePct24h);
    const byVol  = [...tickers].sort((a, b) => b.volume24h - a.volume24h);
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

    const productIds = symbols.map(toCoinbaseProductId);

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
                symbol:      t.product_id,
                name:        t.product_id,
                assetClass:  'crypto',
                price:       parseFloat(t.price),
                change24h:   parseFloat(t.price_percent_chg_24h ?? '0'),
                changePct24h: parseFloat(t.price_percent_chg_24h ?? '0'),
                volume24h:   parseFloat(t.volume_24h ?? '0'),
                high24h:     parseFloat(t.high_52_week ?? t.price),
                low24h:      parseFloat(t.low_52_week ?? t.price),
                open24h:     parseFloat(t.price),
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
