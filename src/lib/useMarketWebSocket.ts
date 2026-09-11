/**
 * useMarketWebSocket — live price hook
 *
 * Three-tier strategy (best available wins):
 *  1. WebSocket  — wss://<host>/ws/market  (Airo preview / self-hosted Node)
 *  2. SSE        — /api/market/stream      (Vercel Serverless + any HTTP/2 host)
 *  3. REST poll  — /api/market/ticker      (universal fallback, 8s interval)
 *
 * WS and SSE are tried in parallel.  Whichever connects first wins.
 * If neither connects within WS_TIMEOUT_MS, REST polling takes over.
 * REST polling is always running as a baseline until a live source connects.
 *
 * Usage:
 *   const { tickers, status, source } = useMarketWebSocket(['BTCUSDT','ETHUSDT']);
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { wsSubscribe, wsSubscribeStatus, wsRegisterSymbols, wsUnregisterSymbols, type WsStatus } from './wsManager';
import { useMarketSSE } from './useMarketSSE';
import { apiCache } from './apiCache';
import { finiteNumber, formatPrice, formatChange, normalizeTickerSymbol } from './marketFormat';

export interface TickerData {
  symbol:    string;
  price:     number;
  priceStr:  string;
  change24h: number;
  changeStr: string;
  volume24h: number;
  high24h:   number;
  low24h:    number;
  up:        boolean;
  ts:        number;
}

export type MarketSource = 'ws' | 'sse' | 'rest' | 'cache';

export interface UseMarketWebSocketResult {
  tickers:  Map<string, TickerData>;
  status:   WsStatus;
  source:   MarketSource;
  isLive:   boolean;
  lastUpdate: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildWsUrl(): string {
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/market`;
}

// Parse a raw REST ticker response into TickerData
export function parseRestTicker(raw: Record<string, unknown>): TickerData | null {
  const symbol = normalizeTickerSymbol(raw.symbol ?? raw.s);
  const price  = finiteNumber(raw.price ?? raw.p ?? raw.lastPrice, Number.NaN);
  if (!symbol || !Number.isFinite(price)) return null;
  // Provider responses include both an absolute 24-hour move (`change24h`)
  // and its percentage (`changePct24h`). The ticker strip displays a percent,
  // so prefer the percentage field and use legacy aliases only as fallbacks.
  const change24h = finiteNumber(
    raw.changePct24h ?? raw.priceChangePercent ?? raw.changePercent ?? raw.change24h
  );
  return {
    symbol,
    price,
    priceStr:  formatPrice(price),
    change24h,
    changeStr: formatChange(change24h),
    volume24h: finiteNumber(raw.volume24h ?? raw.volume),
    high24h:   finiteNumber(raw.high24h ?? raw.highPrice),
    low24h:    finiteNumber(raw.low24h  ?? raw.lowPrice),
    up:        change24h >= 0,
    ts:        Date.now(),
  };
}

// Parse a WebSocket ticker message
function parseWsTicker(msg: Record<string, unknown>): TickerData | null {
  // Support both { type:'ticker', symbol, price, ... } and { type:'ticker', data:[...] }
  if (Array.isArray(msg.data)) {
    // batch update — return first valid item (caller loops)
    return null;
  }
  return parseRestTicker(msg);
}

// ── REST polling ──────────────────────────────────────────────────────────────

async function fetchTickers(symbols: string[]): Promise<TickerData[]> {
  const cacheKey = `market:ticker:${symbols.join(',')}`;
  const cached = apiCache.get<TickerData[]>(cacheKey);
  if (cached) return cached;

  const url = `/api/market/ticker?symbols=${symbols.join(',')}&assetClass=crypto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ticker fetch failed: ${res.status}`);
  const json = await res.json() as { tickers?: unknown[] };

  const items = (json.tickers ?? []) as Record<string, unknown>[];
  const parsed = items.map(parseRestTicker).filter((t): t is TickerData => t !== null);

  apiCache.set(cacheKey, parsed, 5_000); // 5s TTL — stale-while-revalidate
  return parsed;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const DEFAULT_POLL_INTERVAL = 8_000; // 8s REST fallback
const WS_TIMEOUT_MS         = 5_000; // give WS 5s to connect before falling back

export function useMarketWebSocket(
  symbols: string[],
  pollInterval = DEFAULT_POLL_INTERVAL,
): UseMarketWebSocketResult {
  const [tickers,    setTickers]    = useState<Map<string, TickerData>>(new Map());
  const [wsStatus,   setWsStatus]   = useState<WsStatus>('connecting');
  const [source,     setSource]     = useState<MarketSource>('cache');
  const [lastUpdate, setLastUpdate] = useState(0);

  const wsUrl       = useRef(buildWsUrl());
  const pollTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsConnected = useRef(false);
  const wsTimeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const symbolsKey  = symbols.join(',');

  // ── SSE tier (middle tier — works on Vercel) ───────────────────────────────
  const { tickers: sseTickers, isLive: sseIsLive } = useMarketSSE(symbols);

  // When SSE delivers data and WS is not connected, use SSE tickers
  useEffect(() => {
    if (wsConnected.current) return; // WS wins — ignore SSE
    if (sseTickers.size === 0) return;
    setTickers(prev => {
      const next = new Map(prev);
      sseTickers.forEach((t, k) => next.set(k, t));
      return next;
    });
    if (sseIsLive) {
      setSource('sse');
      setLastUpdate(Date.now());
    }
   
  }, [sseTickers, sseIsLive]);

  // ── REST poll ──────────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    if (wsConnected.current) return; // WS is live — skip REST
    if (sseIsLive) return;           // SSE is live — skip REST
    try {
      const data = await fetchTickers(symbols);
      setTickers(prev => {
        const next = new Map(prev);
        data.forEach(t => next.set(t.symbol, t));
        return next;
      });
      setSource('rest');
      setLastUpdate(Date.now());
    } catch {
      // silently keep stale data
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, sseIsLive]);

  const startPolling = useCallback(() => {
    if (pollTimer.current) return;
    void poll(); // immediate first fetch
    pollTimer.current = setInterval(poll, pollInterval);
  }, [poll, pollInterval]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  // ── WebSocket subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Seed from cache immediately so UI isn't blank
    const cacheKey = `market:ticker:${symbolsKey}`;
    const cached = apiCache.get<TickerData[]>(cacheKey);
    if (cached) {
      setTickers(prev => {
        const next = new Map(prev);
        cached.forEach(t => next.set(t.symbol, t));
        return next;
      });
    }

    // Start REST polling immediately as baseline (SSE will suppress it once live)
    startPolling();

    // Register symbols with the WS manager so the server gets a subscription message
    wsRegisterSymbols(wsUrl.current, symbols);

    // Give WS a chance to connect; if it doesn't within WS_TIMEOUT_MS, stay on SSE/REST
    wsTimeoutId.current = setTimeout(() => {
      if (!wsConnected.current) {
        // WS didn't connect — SSE or REST will handle it
        setSource(sseIsLive ? 'sse' : 'rest');
      }
    }, WS_TIMEOUT_MS);

    // Subscribe to WS status
    const unsubStatus = wsSubscribeStatus(wsUrl.current, (s) => {
      setWsStatus(s);
      if (s === 'open') {
        wsConnected.current = true;
        stopPolling();
        setSource('ws');
        if (wsTimeoutId.current) {
          clearTimeout(wsTimeoutId.current);
          wsTimeoutId.current = null;
        }
      } else if (s === 'closed' || s === 'error') {
        wsConnected.current = false;
        // Fall back to SSE (if live) or REST
        setSource(sseIsLive ? 'sse' : 'rest');
        if (!sseIsLive) startPolling();
      }
    });

    // Subscribe to ticker messages
    const unsubTicker = wsSubscribe(wsUrl.current, 'ticker', (msg) => {
      const raw = msg as Record<string, unknown>;

      // Batch update: { type:'ticker', data: TickerData[] }
      if (Array.isArray(raw.data)) {
        const batch = (raw.data as Record<string, unknown>[])
          .map(parseRestTicker)
          .filter((t): t is TickerData => t !== null);
        if (batch.length > 0) {
          setTickers(prev => {
            const next = new Map(prev);
            batch.forEach(t => next.set(t.symbol, t));
            return next;
          });
          setLastUpdate(Date.now());
        }
        return;
      }

      // Single update
      const t = parseWsTicker(raw);
      if (t) {
        setTickers(prev => new Map(prev).set(t.symbol, t));
        setLastUpdate(Date.now());
      }
    });

    return () => {
      unsubStatus();
      unsubTicker();
      stopPolling();
      if (wsTimeoutId.current) clearTimeout(wsTimeoutId.current);
      // Unregister symbols so server stops streaming them if no other tab needs them
      wsUnregisterSymbols(wsUrl.current, symbols);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  return {
    tickers,
    status:  wsStatus,
    source,
    isLive:  source === 'ws' || source === 'sse',
    lastUpdate,
  };
}

// ── Convenience: single symbol ────────────────────────────────────────────────
export function useTickerSymbol(symbol: string): TickerData | null {
  const { tickers } = useMarketWebSocket([symbol]);
  return tickers.get(symbol) ?? null;
}
