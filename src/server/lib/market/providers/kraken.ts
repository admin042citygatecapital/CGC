/**
 * Kraken Provider — Crypto
 * REST: https://api.kraken.com/0/public
 * WebSocket v2: wss://ws.kraken.com/v2
 *
 * No API key required for public endpoints.
 */

import WebSocket from 'ws';
import type {
  MarketDataProvider, ProviderCapabilities, Ticker, Candle,
  CandleInterval, OrderBook, SearchResult, MarketSummary,
} from '../types.js';

const REST_BASE = 'https://api.kraken.com/0/public';
const WS_URL    = 'wss://ws.kraken.com/v2';

// Kraken interval in minutes
const INTERVAL_MAP: Record<CandleInterval, number> = {
  '1m': 1, '5m': 5, '15m': 15, '30m': 30,
  '1h': 60, '4h': 240, '1d': 1440, '1w': 10080, '1M': 21600,
  '3m': 5, '2h': 240, '6h': 240, '12h': 1440,
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Kraken HTTP ${res.status}`);
  const json = await res.json() as { error: string[]; result: T };
  if (json.error?.length) throw new Error(`Kraken: ${json.error.join(', ')}`);
  return json.result;
}

/** Convert BTC/USDT → XBTUSDT (Kraken naming) */
function toKrakenPair(symbol: string): string {
  return symbol.replace('BTC', 'XBT').replace('/', '');
}

export class KrakenProvider implements MarketDataProvider {
  readonly id   = 'kraken';
  readonly name = 'Kraken';
  readonly capabilities: ProviderCapabilities = {
    ticker: true, candles: true, orderBook: true,
    search: true, marketSummary: true, webSocket: true,
  };

  async getTicker(symbols: string[]): Promise<Ticker[]> {
    const pairs = symbols.map(toKrakenPair).join(',');
    const data  = await fetchJSON<Record<string, Record<string, unknown>>>(
      `${REST_BASE}/Ticker?pair=${pairs}`
    );
    return Object.entries(data).map(([pair, t]) => {
      const c = t.c as string[];
      const o = t.o as string;
      const h = t.h as string[];
      const l = t.l as string[];
      const v = t.v as string[];
      const price = parseFloat(c[0]);
      const open  = parseFloat(o);
      return {
        symbol:      pair,
        name:        pair,
        assetClass:  'crypto' as const,
        price,
        change24h:   price - open,
        changePct24h: open > 0 ? ((price - open) / open) * 100 : 0,
        volume24h:   parseFloat(v[1]),
        high24h:     parseFloat(h[1]),
        low24h:      parseFloat(l[1]),
        open24h:     open,
        currency:    'USD',
        timestamp:   Date.now(),
        provider:    'kraken',
      };
    });
  }

  async getCandles(symbol: string, interval: CandleInterval, limit = 200): Promise<Candle[]> {
    const pair = toKrakenPair(symbol);
    const iv   = INTERVAL_MAP[interval] ?? 60;
    const data = await fetchJSON<Record<string, unknown>>(
      `${REST_BASE}/OHLC?pair=${pair}&interval=${iv}`
    );
    const key    = Object.keys(data).find(k => k !== 'last') ?? '';
    const candles = (data[key] as number[][]) ?? [];
    return candles.slice(-limit).map(k => ({
      time:   k[0],
      open:   parseFloat(String(k[1])),
      high:   parseFloat(String(k[2])),
      low:    parseFloat(String(k[3])),
      close:  parseFloat(String(k[4])),
      volume: parseFloat(String(k[6])),
    }));
  }

  async getOrderBook(symbol: string, depth = 20): Promise<OrderBook> {
    const pair = toKrakenPair(symbol);
    const data = await fetchJSON<Record<string, { bids: string[][]; asks: string[][] }>>(
      `${REST_BASE}/Depth?pair=${pair}&count=${depth}`
    );
    const key = Object.keys(data)[0];
    const ob  = data[key];
    return {
      symbol,
      bids: ob.bids.map(([p, q]) => ({ price: parseFloat(p), quantity: parseFloat(q) })),
      asks: ob.asks.map(([p, q]) => ({ price: parseFloat(p), quantity: parseFloat(q) })),
      timestamp: Date.now(),
    };
  }

  async search(query: string): Promise<SearchResult[]> {
    const data = await fetchJSON<Record<string, Record<string, string>>>(
      `${REST_BASE}/AssetPairs`
    );
    const q = query.toUpperCase();
    return Object.entries(data)
      .filter(([k]) => k.includes(q))
      .slice(0, 10)
      .map(([k, v]) => ({
        symbol:     k,
        name:       v.wsname ?? k,
        assetClass: 'crypto' as const,
        exchange:   'Kraken',
      }));
  }

  async getMarketSummary(): Promise<MarketSummary> {
    // Fetch top USD pairs
    const pairs = 'XBTUSD,ETHUSD,SOLUSD,ADAUSD,DOTUSD,LINKUSD,MATICUSD,AVAXUSD,ATOMUSD,LTCUSD';
    const data  = await fetchJSON<Record<string, Record<string, unknown>>>(
      `${REST_BASE}/Ticker?pair=${pairs}`
    );
    const tickers = Object.entries(data).map(([pair, t]) => {
      const c = t.c as string[];
      const o = t.o as string;
      const h = t.h as string[];
      const l = t.l as string[];
      const v = t.v as string[];
      const price = parseFloat(c[0]);
      const open  = parseFloat(o);
      return {
        symbol:      pair,
        name:        pair,
        assetClass:  'crypto' as const,
        price,
        change24h:   price - open,
        changePct24h: open > 0 ? ((price - open) / open) * 100 : 0,
        volume24h:   parseFloat(v[1]),
        high24h:     parseFloat(h[1]),
        low24h:      parseFloat(l[1]),
        open24h:     open,
        currency:    'USD',
        timestamp:   Date.now(),
        provider:    'kraken',
      };
    });

    const sorted = [...tickers].sort((a, b) => b.changePct24h - a.changePct24h);
    const byVol  = [...tickers].sort((a, b) => b.volume24h - a.volume24h);
    return {
      gainers:    sorted.slice(0, 5),
      losers:     sorted.slice(-5).reverse(),
      trending:   byVol.slice(0, 5),
      mostActive: byVol.slice(0, 5),
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

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(WS_URL);

      ws.on('open', () => {
        ws?.send(JSON.stringify({
          method: 'subscribe',
          params: { channel: 'ticker', symbol: symbols.map(toKrakenPair) },
        }));
      });

      ws.on('message', (raw: Buffer) => {
        try {
          const d = JSON.parse(raw.toString());
          if (d.channel !== 'ticker') return;
          for (const t of d.data ?? []) {
            onUpdate({
              symbol:      t.symbol,
              name:        t.symbol,
              assetClass:  'crypto',
              price:       t.last,
              change24h:   t.change,
              changePct24h: t.change_pct,
              volume24h:   t.volume,
              high24h:     t.high,
              low24h:      t.low,
              open24h:     t.open,
              currency:    'USD',
              timestamp:   Date.now(),
              provider:    'kraken',
            });
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
