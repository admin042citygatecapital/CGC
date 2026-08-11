/**
 * Polygon.io Provider — Stocks, Options, Forex, Crypto
 * REST: https://api.polygon.io
 * WebSocket: wss://socket.polygon.io
 * Requires: POLYGON_API_KEY
 */

import WebSocket from 'ws';
import { getSecret } from '#runtime/secrets';
import { MissingApiKeyError } from '../types.js';
import type {
  MarketDataProvider, ProviderCapabilities, Ticker, Candle,
  CandleInterval, OrderBook, SearchResult, MarketSummary,
} from '../types.js';

const REST_BASE = 'https://api.polygon.io';
const WS_STOCKS = 'wss://socket.polygon.io/stocks';

const TIMESPAN_MAP: Record<CandleInterval, { multiplier: number; timespan: string }> = {
  '1m':  { multiplier: 1,  timespan: 'minute' },
  '3m':  { multiplier: 3,  timespan: 'minute' },
  '5m':  { multiplier: 5,  timespan: 'minute' },
  '15m': { multiplier: 15, timespan: 'minute' },
  '30m': { multiplier: 30, timespan: 'minute' },
  '1h':  { multiplier: 1,  timespan: 'hour' },
  '2h':  { multiplier: 2,  timespan: 'hour' },
  '4h':  { multiplier: 4,  timespan: 'hour' },
  '6h':  { multiplier: 6,  timespan: 'hour' },
  '12h': { multiplier: 12, timespan: 'hour' },
  '1d':  { multiplier: 1,  timespan: 'day' },
  '1w':  { multiplier: 1,  timespan: 'week' },
  '1M':  { multiplier: 1,  timespan: 'month' },
};

function getKey(): string {
  const k = String(getSecret('POLYGON_API_KEY') ?? '');
  if (!k) throw new MissingApiKeyError('Polygon.io', 'POLYGON_API_KEY');
  return k;
}

async function fetchJSON<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs  = new URLSearchParams({ ...params, apiKey: getKey() }).toString();
  const res = await fetch(`${REST_BASE}${path}?${qs}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Polygon HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export class PolygonProvider implements MarketDataProvider {
  readonly id   = 'polygon';
  readonly name = 'Polygon.io';
  readonly capabilities: ProviderCapabilities = {
    ticker: true, candles: true, orderBook: false,
    search: true, marketSummary: true, webSocket: true,
  };

  async getTicker(symbols: string[]): Promise<Ticker[]> {
    const results: Ticker[] = [];
    for (const sym of symbols) {
      try {
        const data = await fetchJSON<{
          ticker: { day: Record<string, number>; prevDay: Record<string, number>; lastTrade: Record<string, number>; todaysChangePerc: number; todaysChange: number };
        }>(`/v2/snapshot/locale/us/markets/stocks/tickers/${sym}`);
        const t = data.ticker;
        const price = t.lastTrade?.p ?? t.day?.c ?? 0;
        results.push({
          symbol:      sym,
          name:        sym,
          assetClass:  'stock',
          price,
          change24h:   t.todaysChange ?? 0,
          changePct24h: t.todaysChangePerc ?? 0,
          volume24h:   t.day?.v ?? 0,
          high24h:     t.day?.h ?? price,
          low24h:      t.day?.l ?? price,
          open24h:     t.day?.o ?? price,
          currency:    'USD',
          timestamp:   Date.now(),
          provider:    'polygon',
        });
      } catch { /* skip */ }
    }
    return results;
  }

  async getCandles(symbol: string, interval: CandleInterval, limit = 200): Promise<Candle[]> {
    const { multiplier, timespan } = TIMESPAN_MAP[interval] ?? { multiplier: 1, timespan: 'hour' };
    const to   = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - limit * 86400000).toISOString().split('T')[0];
    const data = await fetchJSON<{ results: Record<string, number>[] }>(
      `/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}`,
      { limit: String(limit), sort: 'asc' }
    );
    return (data.results ?? []).map(r => ({
      time:   Math.floor(r.t / 1000),
      open:   r.o,
      high:   r.h,
      low:    r.l,
      close:  r.c,
      volume: r.v,
    }));
  }

  async getOrderBook(): Promise<OrderBook> {
    throw new Error('Polygon.io does not support order book on free tier');
  }

  async search(query: string): Promise<SearchResult[]> {
    const data = await fetchJSON<{ results: Record<string, string>[] }>(
      '/v3/reference/tickers',
      { search: query, active: 'true', limit: '10' }
    );
    return (data.results ?? []).map(r => ({
      symbol:     r.ticker,
      name:       r.name,
      assetClass: (r.market === 'crypto' ? 'crypto' : r.market === 'fx' ? 'forex' : 'stock') as 'crypto' | 'forex' | 'stock',
      exchange:   r.primary_exchange,
    }));
  }

  async getMarketSummary(): Promise<MarketSummary> {
    try {
      const data = await fetchJSON<{
        tickers: Array<{ ticker: string; todaysChangePerc: number; todaysChange: number; day: Record<string, number>; lastTrade: Record<string, number> }>;
      }>('/v2/snapshot/locale/us/markets/stocks/gainers');

      const toTicker = (t: typeof data.tickers[0]): Ticker => ({
        symbol:      t.ticker,
        name:        t.ticker,
        assetClass:  'stock',
        price:       t.lastTrade?.p ?? t.day?.c ?? 0,
        change24h:   t.todaysChange,
        changePct24h: t.todaysChangePerc,
        volume24h:   t.day?.v ?? 0,
        high24h:     t.day?.h ?? 0,
        low24h:      t.day?.l ?? 0,
        open24h:     t.day?.o ?? 0,
        currency:    'USD',
        timestamp:   Date.now(),
        provider:    'polygon',
      });

      const losersData = await fetchJSON<typeof data>('/v2/snapshot/locale/us/markets/stocks/losers');

      return {
        gainers:    data.tickers.slice(0, 10).map(toTicker),
        losers:     losersData.tickers.slice(0, 10).map(toTicker),
        trending:   data.tickers.slice(0, 10).map(toTicker),
        mostActive: data.tickers.slice(0, 10).map(toTicker),
      };
    } catch {
      return { gainers: [], losers: [], trending: [], mostActive: [] };
    }
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
      ws = new WebSocket(WS_STOCKS);

      ws.on('message', (raw: Buffer) => {
        try {
          const msgs = JSON.parse(raw.toString()) as Array<Record<string, unknown>>;
          for (const msg of msgs) {
            if (msg.ev === 'connected') {
              ws?.send(JSON.stringify({ action: 'auth', params: key }));
            } else if (msg.ev === 'auth_success') {
              const subs = symbols.map(s => `T.${s}`).join(',');
              ws?.send(JSON.stringify({ action: 'subscribe', params: subs }));
            } else if (msg.ev === 'T') {
              onUpdate({
                symbol:      String(msg.sym),
                name:        String(msg.sym),
                assetClass:  'stock',
                price:       Number(msg.p),
                change24h:   0,
                changePct24h: 0,
                volume24h:   Number(msg.s),
                high24h:     Number(msg.p),
                low24h:      Number(msg.p),
                open24h:     Number(msg.p),
                currency:    'USD',
                timestamp:   Number(msg.t),
                provider:    'polygon',
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
