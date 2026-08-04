/**
 * useMarketWebSocket — live price hook
 *
 * Strategy:
 *  1. Try WebSocket first (wss://<host>/ws/market)
 *  2. If WS is unavailable or the server doesn't support it, fall back to
 *     REST polling via GET /api/market/ticker on a configurable interval
 *  3. Stale-while-revalidate: always returns the last known value instantly
 *     while a fresh fetch is in flight
 *
 * Usage:
 *   const { tickers, status, source } = useMarketWebSocket(['BTCUSDT','ETHUSDT']);
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { wsSubscribe, wsSubscribeStatus, wsRegisterSymbols, wsUnregisterSymbols, type WsStatus } from './wsManager';
import { apiCache } from './apiCache';

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

export type MarketSource = 'ws' | 'rest' | 'cache';

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

function formatPrice(n: number): string {
  if (n >= 1000)  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (n >= 1)     return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

function formatChange(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

// Parse a raw REST ticker response into TickerData
function parseRestTicker(raw: Record<string, unknown>): TickerData | null {
  const symbol = String(raw.symbol ?? raw.s ?? '');
  const price  = parseFloat(String(raw.price ?? raw.p ?? raw.lastPrice ?? 0));
  if (!symbol || isNaN(price)) return null;
  const change24h = parseFloat(String(raw.change24h ?? raw.priceChangePercent ?? raw.changePercent ?? 0));
  return {
    symbol,
    price,
    priceStr:  formatPrice(price),
    change24h,
    changeStr: formatChange(change24h),
    volume24h: parseFloat(String(raw.volume24h ?? raw.volume ?? 0)),
    high24h:   parseFloat(String(raw.high24h ?? raw.highPrice ?? 0)),
    low24h:    parseFloat(String(raw.low24h  ?? raw.lowPrice  ?? 0)),
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

  // ── REST poll ──────────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    if (wsConnected.current) return; // WS is live — skip REST
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
  }, [symbolsKey]);

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

    // Start REST polling immediately as baseline
    startPolling();

    // Register symbols with the WS manager so the server gets a subscription message
    wsRegisterSymbols(wsUrl.current, symbols);

    // Give WS a chance to connect; if it doesn't within WS_TIMEOUT_MS, stay on REST
    wsTimeoutId.current = setTimeout(() => {
      if (!wsConnected.current) {
        setSource('rest');
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
        // Subscribe to symbols on the server
        // (server reads the subscribe message and starts streaming those symbols)
      } else if (s === 'closed' || s === 'error') {
        wsConnected.current = false;
        setSource('rest');
        startPolling(); // fall back to REST while reconnecting
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
    isLive:  source === 'ws',
    lastUpdate,
  };
}

// ── Convenience: single symbol ────────────────────────────────────────────────
export function useTickerSymbol(symbol: string): TickerData | null {
  const { tickers } = useMarketWebSocket([symbol]);
  return tickers.get(symbol) ?? null;
}
