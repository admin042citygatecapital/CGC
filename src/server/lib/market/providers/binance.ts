/**
 * Binance Provider — Crypto
 * REST: https://api.binance.com/api/v3
 * WebSocket: wss://stream.binance.com:9443/ws
 *
 * No API key required for public market data endpoints.
 */

import WebSocket from 'ws';
import type {
  MarketDataProvider, ProviderCapabilities, Ticker, Candle,
  CandleInterval, OrderBook, SearchResult, MarketSummary,
} from '../types.js';

const REST_BASE = 'https://api.binance.com/api/v3';
const WS_BASE   = 'wss://stream.binance.com:9443/ws';

const INTERVAL_MAP: Record<CandleInterval, string> = {
  '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '12h': '12h',
  '1d': '1d', '1w': '1w', '1M': '1M',
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

function parseTicker(t: Record<string, string>): Ticker {
  const price  = parseFloat(t.lastPrice);
  const open   = parseFloat(t.openPrice);
  const change = price - open;
  return {
    symbol:      t.symbol,
    name:        t.symbol,
    assetClass:  'crypto',
    price,
    change24h:   change,
    changePct24h: parseFloat(t.priceChangePercent),
    volume24h:   parseFloat(t.quoteVolume),
    high24h:     parseFloat(t.highPrice),
    low24h:      parseFloat(t.lowPrice),
    open24h:     open,
    currency:    'USDT',
    timestamp:   parseInt(t.closeTime, 10),
    provider:    'binance',
  };
}

export class BinanceProvider implements MarketDataProvider {
  readonly id   = 'binance';
  readonly name = 'Binance';
  readonly capabilities: ProviderCapabilities = {
    ticker: true, candles: true, orderBook: true,
    search: true, marketSummary: true, webSocket: true,
  };

  async getTicker(symbols: string[]): Promise<Ticker[]> {
    if (symbols.length === 1) {
      const data = await fetchJSON<Record<string, string>>(
        `${REST_BASE}/ticker/24hr?symbol=${symbols[0].toUpperCase()}`
      );
      return [parseTicker(data)];
    }
    const syms = symbols.map(s => `"${s.toUpperCase()}"`).join(',');
    const data = await fetchJSON<Record<string, string>[]>(
      `${REST_BASE}/ticker/24hr?symbols=[${syms}]`
    );
    return data.map(parseTicker);
  }

  async getCandles(symbol: string, interval: CandleInterval, limit = 200): Promise<Candle[]> {
    const iv   = INTERVAL_MAP[interval] ?? '1h';
    const data = await fetchJSON<number[][]>(
      `${REST_BASE}/klines?symbol=${symbol.toUpperCase()}&interval=${iv}&limit=${limit}`
    );
    return data.map(k => ({
      time:   Math.floor(k[0] / 1000),
      open:   parseFloat(String(k[1])),
      high:   parseFloat(String(k[2])),
      low:    parseFloat(String(k[3])),
      close:  parseFloat(String(k[4])),
      volume: parseFloat(String(k[5])),
    }));
  }

  async getOrderBook(symbol: string, depth = 20): Promise<OrderBook> {
    const data = await fetchJSON<{ bids: string[][]; asks: string[][]; lastUpdateId: number }>(
      `${REST_BASE}/depth?symbol=${symbol.toUpperCase()}&limit=${depth}`
    );
    return {
      symbol,
      bids: data.bids.map(([p, q]) => ({ price: parseFloat(p), quantity: parseFloat(q) })),
      asks: data.asks.map(([p, q]) => ({ price: parseFloat(p), quantity: parseFloat(q) })),
      timestamp: Date.now(),
    };
  }

  async search(query: string): Promise<SearchResult[]> {
    const data = await fetchJSON<Record<string, string>[]>(`${REST_BASE}/ticker/24hr`);
    const q = query.toUpperCase();
    return data
      .filter(t => t.symbol.includes(q))
      .slice(0, 10)
      .map(t => ({ symbol: t.symbol, name: t.symbol, assetClass: 'crypto' as const, exchange: 'Binance' }));
  }

  async getMarketSummary(): Promise<MarketSummary> {
    const data = await fetchJSON<Record<string, string>[]>(`${REST_BASE}/ticker/24hr`);
    const tickers = data
      .filter(t => t.symbol.endsWith('USDT'))
      .map(parseTicker);

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
    const streams = symbols.map(s => `${s.toLowerCase()}@ticker`).join('/');
    const url     = `${WS_BASE}/${streams}`;
    let ws: WebSocket | null = null;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(url);

      ws.on('message', (raw: Buffer) => {
        try {
          const d = JSON.parse(raw.toString());
          // Combined stream wraps in { stream, data }
          const t = d.data ?? d;
          if (!t.s) return;
          onUpdate({
            symbol:      t.s,
            name:        t.s,
            assetClass:  'crypto',
            price:       parseFloat(t.c),
            change24h:   parseFloat(t.p),
            changePct24h: parseFloat(t.P),
            volume24h:   parseFloat(t.q),
            high24h:     parseFloat(t.h),
            low24h:      parseFloat(t.l),
            open24h:     parseFloat(t.o),
            currency:    'USDT',
            timestamp:   t.E,
            provider:    'binance',
          });
        } catch { /* ignore parse errors */ }
      });

      ws.on('error', (err: Error) => {
        onError?.(err);
      });

      ws.on('close', () => {
        if (!closed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
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
