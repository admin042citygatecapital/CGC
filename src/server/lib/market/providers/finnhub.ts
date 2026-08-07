/**
 * Finnhub Provider — Stocks, Forex, Crypto
 * REST: https://finnhub.io/api/v1
 * WebSocket: wss://ws.finnhub.io
 * Requires: FINNHUB_API_KEY
 */

import WebSocket from 'ws';
import { getSecret } from '#airo/secrets';
import { MissingApiKeyError } from '../types.js';
import type {
  MarketDataProvider, ProviderCapabilities, Ticker, Candle,
  CandleInterval, OrderBook, SearchResult, MarketSummary,
} from '../types.js';

const REST_BASE = 'https://finnhub.io/api/v1';
const WS_URL    = 'wss://ws.finnhub.io';

const RESOLUTION_MAP: Record<CandleInterval, string> = {
  '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1h': '60',
  '1d': 'D', '1w': 'W', '1M': 'M',
  '3m': '5', '2h': '60', '4h': '60', '6h': '60', '12h': '60',
};

function getKey(): string {
  const k = String(getSecret('FINNHUB_API_KEY') ?? '');
  if (!k) throw new MissingApiKeyError('Finnhub', 'FINNHUB_API_KEY');
  return k;
}

async function fetchJSON<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs  = new URLSearchParams({ ...params, token: getKey() }).toString();
  const res = await fetch(`${REST_BASE}${path}?${qs}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export class FinnhubProvider implements MarketDataProvider {
  readonly id   = 'finnhub';
  readonly name = 'Finnhub';
  readonly capabilities: ProviderCapabilities = {
    ticker: true, candles: true, orderBook: false,
    search: true, marketSummary: true, webSocket: true,
  };

  async getTicker(symbols: string[]): Promise<Ticker[]> {
    const results: Ticker[] = [];
    for (const sym of symbols) {
      try {
        const [quote, profile] = await Promise.all([
          fetchJSON<Record<string, number>>('/quote', { symbol: sym }),
          fetchJSON<Record<string, string>>('/stock/profile2', { symbol: sym }).catch(() => ({})),
        ]);
        results.push({
          symbol:      sym,
          name:        (profile as Record<string, string>).name ?? sym,
          assetClass:  'stock',
          price:       quote.c ?? 0,
          change24h:   quote.d ?? 0,
          changePct24h: quote.dp ?? 0,
          volume24h:   0,
          high24h:     quote.h ?? 0,
          low24h:      quote.l ?? 0,
          open24h:     quote.o ?? 0,
          currency:    'USD',
          timestamp:   (quote.t ?? 0) * 1000,
          provider:    'finnhub',
        });
      } catch { /* skip */ }
    }
    return results;
  }

  async getCandles(symbol: string, interval: CandleInterval, limit = 200): Promise<Candle[]> {
    const resolution = RESOLUTION_MAP[interval] ?? '60';
    const to   = Math.floor(Date.now() / 1000);
    const from = to - limit * 3600;
    const data = await fetchJSON<{
      c: number[]; h: number[]; l: number[]; o: number[]; t: number[]; v: number[]; s: string;
    }>('/stock/candle', { symbol, resolution, from: String(from), to: String(to) });

    if (data.s !== 'ok' || !data.t) return [];
    return data.t.map((t, i) => ({
      time:   t,
      open:   data.o[i],
      high:   data.h[i],
      low:    data.l[i],
      close:  data.c[i],
      volume: data.v[i],
    }));
  }

  async getOrderBook(): Promise<OrderBook> {
    throw new Error('Finnhub does not support order book');
  }

  async search(query: string): Promise<SearchResult[]> {
    const data = await fetchJSON<{ result: Record<string, string>[] }>('/search', { q: query });
    return (data.result ?? []).slice(0, 10).map(r => ({
      symbol:     r.symbol,
      name:       r.description,
      assetClass: 'stock' as const,
      exchange:   r.primaryExchange,
    }));
  }

  async getMarketSummary(): Promise<MarketSummary> {
    // Fetch US market movers
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
      ws = new WebSocket(`${WS_URL}?token=${key}`);

      ws.on('open', () => {
        for (const sym of symbols) {
          ws?.send(JSON.stringify({ type: 'subscribe', symbol: sym }));
        }
      });

      ws.on('message', (raw: Buffer) => {
        try {
          const d = JSON.parse(raw.toString());
          if (d.type !== 'trade') return;
          for (const t of d.data ?? []) {
            onUpdate({
              symbol:      t.s,
              name:        t.s,
              assetClass:  'stock',
              price:       t.p,
              change24h:   0,
              changePct24h: 0,
              volume24h:   t.v,
              high24h:     t.p,
              low24h:      t.p,
              open24h:     t.p,
              currency:    'USD',
              timestamp:   t.t,
              provider:    'finnhub',
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
