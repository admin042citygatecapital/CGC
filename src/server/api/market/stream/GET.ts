/**
 * GET /api/market/stream?symbols=BTCUSDT,ETHUSDT&assetClass=crypto
 *
 * Server-Sent Events (SSE) endpoint for live market data.
 *
 * Works on Vercel Serverless Functions (unlike WebSocket which requires a
 * persistent TCP connection).  The client receives a stream of `ticker` events
 * at ~3-second intervals for as long as the connection is open.
 *
 * Protocol:
 *   event: ticker
 *   data: { type:"ticker", data: Ticker[], ts: number }
 *
 *   event: ping
 *   data: { type:"ping", ts: number }   (every 25s — keeps connection alive through proxies)
 *
 * Client usage:
 *   const es = new EventSource('/api/market/stream?symbols=BTCUSDT,ETHUSDT');
 *   es.addEventListener('ticker', e => { const { data } = JSON.parse(e.data); ... });
 *
 * Vercel note:
 *   Vercel Serverless Functions support streaming responses via the Web Streams API.
 *   This implementation uses Node.js res.write() which works in both Airo (Express)
 *   and Vercel (the adapter passes the raw Node IncomingMessage/ServerResponse).
 *   maxDuration in vercel.json should be set to 60s (free) or 300s (pro).
 */

import type { Request, Response } from 'express';
import { marketRegistry } from '../../../lib/market/registry.js';
import type { AssetClass } from '../../../lib/market/types.js';

const TICK_INTERVAL_MS  = 3_000;  // push ticker every 3s
const PING_INTERVAL_MS  = 25_000; // keepalive ping every 25s
const MAX_DURATION_MS   = 55_000; // close after 55s so Vercel 60s limit isn't hit

export default async function handler(req: Request, res: Response) {
  // ── Parse query params ────────────────────────────────────────────────────
  const rawSymbols = String(req.query.symbols ?? 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT');
  const symbols    = rawSymbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 30);
  const assetClass = (req.query.assetClass as AssetClass | undefined) ?? 'crypto';

  // ── SSE headers ───────────────────────────────────────────────────────────
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // ── Helpers ───────────────────────────────────────────────────────────────
  function send(event: string, data: unknown) {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      // client disconnected — cleanup will handle it
    }
  }

  let closed = false;

  function cleanup() {
    if (closed) return;
    closed = true;
    clearInterval(tickTimer);
    clearInterval(pingTimer);
    clearTimeout(maxTimer);
  }

  // ── Initial tick (send immediately so UI isn't blank) ─────────────────────
  try {
    const tickers = await marketRegistry.getTicker(symbols, assetClass);
    send('ticker', { type: 'ticker', data: tickers, ts: Date.now() });
  } catch {
    // provider not ready yet — client will get data on next tick
  }

  // ── Tick loop ─────────────────────────────────────────────────────────────
  const tickTimer = setInterval(async () => {
    if (closed) return;
    try {
      const tickers = await marketRegistry.getTicker(symbols, assetClass);
      send('ticker', { type: 'ticker', data: tickers, ts: Date.now() });
    } catch {
      // provider error — skip this tick, keep connection open
    }
  }, TICK_INTERVAL_MS);

  // ── Keepalive ping ────────────────────────────────────────────────────────
  const pingTimer = setInterval(() => {
    if (closed) return;
    send('ping', { type: 'ping', ts: Date.now() });
  }, PING_INTERVAL_MS);

  // ── Max duration guard (Vercel 60s function limit) ────────────────────────
  const maxTimer = setTimeout(() => {
    if (!closed) {
      // Send a reconnect hint before closing so the client reconnects immediately
      send('reconnect', { type: 'reconnect', reason: 'max_duration' });
      cleanup();
      res.end();
    }
  }, MAX_DURATION_MS);

  // ── Client disconnect ─────────────────────────────────────────────────────
  req.on('close',   cleanup);
  req.on('error',   cleanup);
  res.on('close',   cleanup);
  res.on('finish',  cleanup);
}
