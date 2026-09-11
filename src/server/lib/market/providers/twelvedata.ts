/**
 * Twelve Data Provider — Stocks, Forex, Crypto, ETFs
 * REST: https://api.twelvedata.com
 * WebSocket: wss://ws.twelvedata.com/v1/quotes/price
 * Requires: TWELVE_DATA_API_KEY
 */

import WebSocket from 'ws';
import { getSecret } from '#runtime/secrets';
import { MissingApiKeyError } from '../types.js';
import type {
  MarketDataProvider, ProviderCapabilities, Ticker, Candle,
  CandleInterval, OrderBook, SearchResult, MarketSummary,
} from '../types.js';

const REST_BASE = 'https://api.twelvedata.com';
const WS_URL    = 'wss://ws.twelvedata.com/v1/quotes/price';

/** Twelve Data granularities that are actually offered — unsupported
 *  intervals must be refused, not silently served at a different width. */
const SUPPORTED_INTERVALS: ReadonlySet<CandleInterval> = new Set([
  '1m', '5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w', '1M',
]);
const INTERVAL_MAP: Record<string, string> = {
  '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min',
  '1h': '1h', '2h': '2h', '4h': '4h', '1d': '1day', '1w': '1week',
  '1M': '1month',
};

/** Parse a provider string into a finite number, else null — never a
 *  fabricated 0. */
function num(value: unknown): number | null {
  const n = parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : null;
}

function getKey(): string {
  const k = String(getSecret('TWELVE_DATA_API_KEY') ?? '');
  if (!k) throw new MissingApiKeyError('Twelve Data', 'TWELVE_DATA_API_KEY');
  return k;
}

async function fetchJSON<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs  = new URLSearchParams({ ...params, apikey: getKey() }).toString();
  const res = await fetch(`${REST_BASE}${path}?${qs}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);
  const json = await res.json() as T;
  if ((json as Record<string, unknown>).code === 429) throw new Error('Twelve Data rate limit');
  return json;
}

export class TwelveDataProvider implements MarketDataProvider {
  readonly id   = 'twelve-data';
  readonly name = 'Twelve Data';
  readonly capabilities: ProviderCapabilities = {
    ticker: true, candles: true, orderBook: false,
    search: true, marketSummary: true, webSocket: true,
  };

  async getTicker(symbols: string[]): Promise<Ticker[]> {
    const syms = symbols.join(',');
    const data = await fetchJSON<Record<string, Record<string, string>>>('/price', { symbol: syms });

    // Single symbol returns { price: "..." }, multiple returns { SYM: { price: "..." } }
    const results: Ticker[] = [];
    if (symbols.length === 1) {
      const price = num((data as unknown as { price: string }).price);
      if (price === null) return results;
      results.push({
        symbol:      symbols[0],
        name:        symbols[0],
        assetClass:  'stock',
        price,
        // The /price endpoint exposes nothing but the last price — the 24h
        // statistics stay null rather than masquerade as zeros/price clones.
        change24h:   null,
        changePct24h: null,
        volume24h:   null,
        high24h:     null,
        low24h:      null,
        open24h:     null,
        currency:    'USD',
        timestamp:   Date.now(),
        provider:    'twelve-data',
      });
    } else {
      for (const [sym, v] of Object.entries(data)) {
        const price = num(v.price);
        if (price === null) continue;
        results.push({
          symbol:      sym,
          name:        sym,
          assetClass:  'stock',
          price,
          change24h:   null,
          changePct24h: null,
          volume24h:   null,
          high24h:     null,
          low24h:      null,
          open24h:     null,
          currency:    'USD',
          timestamp:   Date.now(),
          provider:    'twelve-data',
        });
      }
    }
    return results;
  }

  async getCandles(symbol: string, interval: CandleInterval, limit = 200): Promise<Candle[]> {
    if (!SUPPORTED_INTERVALS.has(interval)) {
      throw new Error(`Twelve Data does not support ${interval} candles`);
    }
    const iv   = INTERVAL_MAP[interval];
    const data = await fetchJSON<{ values: Record<string, string>[] }>(
      '/time_series',
      { symbol, interval: iv, outputsize: String(limit) }
    );
    return (data.values ?? []).map(v => ({
      time:   Math.floor(new Date(v.datetime).getTime() / 1000),
      open:   parseFloat(v.open),
      high:   parseFloat(v.high),
      low:    parseFloat(v.low),
      close:  parseFloat(v.close),
      volume: parseFloat(v.volume ?? '0'),
    })).reverse();
  }

  async getOrderBook(): Promise<OrderBook> {
    throw new Error('Twelve Data does not support order book');
  }

  async search(query: string): Promise<SearchResult[]> {
    const data = await fetchJSON<{ data: Record<string, string>[] }>(
      '/symbol_search',
      { symbol: query, outputsize: '10' }
    );
    return (data.data ?? []).map(r => ({
      symbol:     r.symbol,
      name:       r.instrument_name,
      assetClass: (r.instrument_type === 'Cryptocurrency' ? 'crypto' :
                   r.instrument_type === 'ETF' ? 'etf' :
                   r.instrument_type === 'Forex Pair' ? 'forex' : 'stock') as 'crypto' | 'etf' | 'forex' | 'stock',
      exchange:   r.exchange,
    }));
  }

  async getMarketSummary(): Promise<MarketSummary> {
    // Twelve Data doesn't have a free gainers/losers endpoint
    return { gainers: [], losers: [], trending: [], mostActive: [] };
  }

  subscribeToTicker(
    symbols: string[],
    onUpdate: (ticker: Ticker) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let key: string;
    try { key = getKey(); } catch { return () => {}; }

    let ws: WebSocket | null = null;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(WS_URL);

      ws.on('open', () => {
        ws?.send(JSON.stringify({
          action: 'subscribe',
          params: { apikey: key, symbols },
        }));
      });

      ws.on('message', (raw: Buffer) => {
        try {
          const d = JSON.parse(raw.toString());
          if (d.event !== 'price') return;
          const price    = num(d.price) ?? 0;
          const change   = num(d.day_change);
          const tsMs     = num(d.timestamp);
          onUpdate({
            symbol:      d.symbol,
            name:        d.symbol,
            assetClass:  'stock',
            price,
            change24h:   change,
            changePct24h: change !== null && price ? (change / price) * 100 : null,
            volume24h:   num(d.day_volume),
            high24h:     null,
            low24h:      null,
            open24h:     null,
            currency:    'USD',
            timestamp:   tsMs !== null ? tsMs * 1000 : Date.now(),
            provider:    'twelve-data',
          });
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
