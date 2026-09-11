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

// Kraken interval in minutes. Only intervals Kraken actually offers are
// listed — unsupported intervals must be refused, not served at a
// substituted width (21600 is a 15-day bucket, not a monthly one).
const SUPPORTED_INTERVALS: ReadonlySet<CandleInterval> = new Set([
  '1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w',
]);
const INTERVAL_MAP: Record<string, number> = {
  '1m': 1, '5m': 5, '15m': 15, '30m': 30,
  '1h': 60, '4h': 240, '1d': 1440, '1w': 10080,
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Kraken HTTP ${res.status}`);
  const json = await res.json() as { error: string[]; result: T };
  if (json.error?.length) throw new Error(`Kraken: ${json.error.join(', ')}`);
  return json.result;
}

/** Parse a provider string into a finite number, else null — never a
 *  fabricated 0. */
function num(value: unknown): number | null {
  const n = parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : null;
}

/** Convert BTC/USDT → XBTUSDT (Kraken naming) */
function toKrakenPair(symbol: string): string {
  return symbol.replace('BTC', 'XBT').replace('/', '');
}

/** Translate Kraken's XBT code back to the platform's canonical BTC code. */
function fromKrakenPair(symbol: string): string {
  return symbol
    .toUpperCase()
    .replace(/^XBT/, 'BTC')
    .replace(/^XDG/, 'DOGE');
}

/** Report the pair's actual quote currency — a USDT-quoted pair must not be
 *  labelled as USD data. */
function quoteCurrency(canonicalSymbol: string): string {
  return canonicalSymbol.endsWith('USDT') ? 'USDT' : 'USD';
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
      const canonical = fromKrakenPair(pair);
      return {
        symbol:      canonical,
        name:        canonical,
        assetClass:  'crypto' as const,
        price,
        change24h:   price - open,
        changePct24h: open > 0 ? ((price - open) / open) * 100 : 0,
        volume24h:   parseFloat(v[1]),
        high24h:     parseFloat(h[1]),
        low24h:      parseFloat(l[1]),
        open24h:     open,
        currency:    quoteCurrency(canonical),
        timestamp:   Date.now(),
        provider:    'kraken',
      };
    });
  }

  async getCandles(symbol: string, interval: CandleInterval, limit = 200): Promise<Candle[]> {
    if (!SUPPORTED_INTERVALS.has(interval)) {
      throw new Error(`Kraken does not support ${interval} candles`);
    }
    const pair = toKrakenPair(symbol);
    const iv   = INTERVAL_MAP[interval];
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
      const canonical = fromKrakenPair(pair);
      return {
        symbol:      canonical,
        name:        canonical,
        assetClass:  'crypto' as const,
        price,
        change24h:   price - open,
        changePct24h: open > 0 ? ((price - open) / open) * 100 : 0,
        volume24h:   parseFloat(v[1]),
        high24h:     parseFloat(h[1]),
        low24h:      parseFloat(l[1]),
        open24h:     open,
        currency:    quoteCurrency(canonical),
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
            const canonical = fromKrakenPair(t.symbol);
            onUpdate({
              symbol:      canonical,
              name:        canonical,
              assetClass:  'crypto',
              price:       num(t.last) ?? 0,
              change24h:   num(t.change),
              changePct24h: num(t.change_pct),
              volume24h:   num(t.volume),
              high24h:     num(t.high),
              low24h:      num(t.low),
              open24h:     num(t.open),
              currency:    quoteCurrency(canonical),
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
