/**
 * useMarketSSE — Server-Sent Events hook for live market data
 *
 * Connects to GET /api/market/stream via EventSource (SSE).
 * Works on Vercel Serverless Functions, unlike WebSocket which requires a
 * persistent TCP connection.
 *
 * Strategy:
 *  1. Open EventSource to /api/market/stream?symbols=...
 *  2. On 'ticker' event → update tickers map
 *  3. On error / close → reconnect with exponential backoff
 *  4. On 'reconnect' event (server-side max-duration hit) → reconnect immediately
 *  5. If EventSource is not supported (very old browser) → signal unavailable
 *
 * The hook is intentionally thin — it only manages the SSE connection and
 * exposes the same TickerData shape as useMarketWebSocket so callers are
 * interchangeable.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TickerData } from './useMarketWebSocket';

export type SseStatus = 'connecting' | 'open' | 'closed' | 'error' | 'unsupported';

export interface UseMarketSseResult {
  tickers:    Map<string, TickerData>;
  status:     SseStatus;
  isLive:     boolean;
  lastUpdate: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPrice(value: unknown): string {
  const n = finiteNumber(value);
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (n >= 1)    return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

function formatChange(value: unknown): string {
  const pct = finiteNumber(value);
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

function parseTicker(raw: Record<string, unknown>): TickerData | null {
  const symbol = String(raw.symbol ?? raw.s ?? '');
  const price  = finiteNumber(raw.price ?? raw.lastPrice ?? raw.p, Number.NaN);
  if (!symbol || !Number.isFinite(price)) return null;
  const change24h = finiteNumber(
    raw.changePct24h ?? raw.change24h ?? raw.priceChangePercent ?? raw.changePercent
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

// ── Hook ──────────────────────────────────────────────────────────────────────

const INITIAL_BACKOFF = 1_000;
const MAX_BACKOFF     = 30_000;

export function useMarketSSE(
  symbols: string[],
): UseMarketSseResult {
  const [tickers,    setTickers]    = useState<Map<string, TickerData>>(new Map());
  const [status,     setStatus]     = useState<SseStatus>('connecting');
  const [lastUpdate, setLastUpdate] = useState(0);

  const esRef       = useRef<EventSource | null>(null);
  const backoffRef  = useRef(INITIAL_BACKOFF);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedRef   = useRef(false);
  const symbolsKey  = symbols.join(',');

  const buildUrl = useCallback(() => {
    const syms = symbols.map(s => s.toUpperCase()).join(',');
    return `/api/market/stream?symbols=${encodeURIComponent(syms)}&assetClass=crypto`;
  }, [symbolsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = useCallback(() => {
    if (closedRef.current) return;
    if (typeof EventSource === 'undefined') {
      setStatus('unsupported');
      return;
    }

    // Close any existing connection
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    setStatus('connecting');
    const es = new EventSource(buildUrl());
    esRef.current = es;

    es.onopen = () => {
      setStatus('open');
      backoffRef.current = INITIAL_BACKOFF; // reset backoff on success
    };

    es.addEventListener('ticker', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data as string) as { data?: unknown[] };
        const items = Array.isArray(payload.data) ? payload.data : [];
        const parsed = (items as Record<string, unknown>[])
          .map(parseTicker)
          .filter((t): t is TickerData => t !== null);
        if (parsed.length > 0) {
          setTickers(prev => {
            const next = new Map(prev);
            parsed.forEach(t => next.set(t.symbol, t));
            return next;
          });
          setLastUpdate(Date.now());
        }
      } catch {
        // malformed JSON — ignore
      }
    });

    // Server signals it's about to close (max-duration hit) — reconnect immediately
    es.addEventListener('reconnect', () => {
      es.close();
      esRef.current = null;
      backoffRef.current = INITIAL_BACKOFF;
      if (!closedRef.current) connect();
    });

    es.onerror = () => {
      setStatus('error');
      es.close();
      esRef.current = null;
      if (!closedRef.current) {
        // Exponential backoff reconnect
        timerRef.current = setTimeout(() => {
          backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
          connect();
        }, backoffRef.current);
      }
    };
  }, [buildUrl]);

  useEffect(() => {
    closedRef.current = false;
    connect();

    return () => {
      closedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      setStatus('closed');
    };
  }, [symbolsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    tickers,
    status,
    isLive:     status === 'open',
    lastUpdate,
  };
}
