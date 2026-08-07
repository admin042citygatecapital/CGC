/**
 * useMarketData — Real-time market data hook
 *
 * Fetches ticker, candles, order book, market summary, and search
 * from the /api/market/* backend routes.
 *
 * useTicker now uses WebSocket as primary source (via useMarketWebSocket)
 * with automatic REST polling fallback. All REST fetches go through
 * apiCache (LRU + stale-while-revalidate) to avoid redundant network calls.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMarketWebSocket } from '@/lib/useMarketWebSocket';
import { cachedFetch } from '@/lib/apiCache';

// ── Types (mirrored from server) ──────────────────────────────────────────────

export type AssetClass = 'crypto' | 'stock' | 'forex' | 'commodity' | 'etf';

export interface Ticker {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  price: number;
  change24h: number;
  changePct24h: number;
  volume24h: number;
  marketCap?: number;
  high24h: number;
  low24h: number;
  open24h: number;
  currency: string;
  timestamp: number;
  provider: string;
}

export interface Candle {
  time: number;
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

export interface OrderBookLevel { price: number; quantity: number; }
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
  timestamp: number;
}

export interface ProviderStatus {
  id: string;
  name: string;
  available: boolean;
  capabilities: string[];
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  return cachedFetch<T>(path, 30_000, 8_000);
}

// ── useTicker — WebSocket primary, REST fallback ──────────────────────────────

export function useTicker(
  symbols: string[],
  assetClass?: AssetClass,
  pollMs = 8000,  // REST fallback interval (WS is ~3s when connected)
) {
  const { tickers: wsMap, isLive } = useMarketWebSocket(symbols, pollMs);

  // Convert WS map → Ticker[] shape expected by consumers
  const tickers = useMemo<Ticker[]>(() => {
    if (wsMap.size === 0) return [];
    return symbols
      .map(sym => {
        const t = wsMap.get(sym);
        if (!t) return null;
        return {
          symbol:      t.symbol,
          name:        t.symbol.replace('USDT', ''),
          assetClass:  (assetClass ?? 'crypto') as AssetClass,
          price:       t.price,
          change24h:   t.change24h,
          changePct24h: t.change24h,
          volume24h:   t.volume24h,
          high24h:     t.high24h,
          low24h:      t.low24h,
          open24h:     t.price,
          currency:    'USD',
          timestamp:   t.ts,
          provider:    isLive ? 'websocket' : 'rest',
        } satisfies Ticker;
      })
      .filter((t): t is Ticker => t !== null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsMap, symbols.join(','), assetClass, isLive]);

  const loading = wsMap.size === 0;
  const [error] = useState<string | null>(null);

  return { tickers, loading, error, isLive, refetch: () => {} };
}

// ── useCandles — cached, background-synced ────────────────────────────────────

export function useCandles(
  symbol: string,
  interval: CandleInterval = '1h',
  limit = 200,
  assetClass?: AssetClass,
  pollMs = 30_000,
) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch_ = useCallback(async () => {
    if (!symbol) return;
    try {
      const ac  = assetClass ? `&assetClass=${assetClass}` : '';
      const url = `/api/market/candles?symbol=${symbol}&interval=${interval}&limit=${limit}${ac}`;
      const data = await cachedFetch<{ candles: Candle[] }>(url, pollMs, pollMs / 3);
      setCandles(data.candles);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [symbol, interval, limit, assetClass, pollMs]);

  useEffect(() => {
    setLoading(true);
    void fetch_();
    timerRef.current = setInterval(fetch_, pollMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetch_, pollMs]);

  return { candles, loading, error, refetch: fetch_ };
}

// ── useOrderBook — short-TTL cached ──────────────────────────────────────────

export function useOrderBook(
  symbol: string,
  depth = 20,
  assetClass?: AssetClass,
  pollMs = 4_000,
) {
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch_ = useCallback(async () => {
    if (!symbol) return;
    try {
      const ac  = assetClass ? `&assetClass=${assetClass}` : '';
      const url = `/api/market/orderbook?symbol=${symbol}&depth=${depth}${ac}`;
      const data = await cachedFetch<OrderBook>(url, pollMs, pollMs / 2);
      setOrderBook(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [symbol, depth, assetClass, pollMs]);

  useEffect(() => {
    setLoading(true);
    void fetch_();
    timerRef.current = setInterval(fetch_, pollMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetch_, pollMs]);

  return { orderBook, loading, error, refetch: fetch_ };
}

// ── useMarketSummary — background-synced, 30s TTL ────────────────────────────

export function useMarketSummary(assetClass: AssetClass = 'crypto', pollMs = 30_000) {
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const url  = `/api/market/summary?assetClass=${assetClass}`;
      const data = await cachedFetch<MarketSummary>(url, pollMs, pollMs / 3);
      setSummary(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [assetClass, pollMs]);

  useEffect(() => {
    setLoading(true);
    void fetch_();
    timerRef.current = setInterval(fetch_, pollMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetch_, pollMs]);

  return { summary, loading, error, refetch: fetch_ };
}

// ── useMarketSearch ───────────────────────────────────────────────────────────

export function useMarketSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch<{ results: SearchResult[] }>(
          `/api/market/search?q=${encodeURIComponent(query)}`
        );
        setResults(data.results);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 350);
  }, []);

  return { results, loading, error, search };
}

// ── useProviders ──────────────────────────────────────────────────────────────

export function useProviders() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    apiFetch<{ providers: ProviderStatus[] }>('/api/market/providers')
      .then(d => setProviders(d.providers))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { providers, loading };
}
