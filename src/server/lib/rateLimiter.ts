/**
 * In-memory rate limiter — no external deps required.
 * Fixed window per key with standard RateLimit response headers.
 */
import type { Request, Response, NextFunction } from 'express';

interface Window {
  count: number;
  resetAt: number; // unix ms
}

const store = new Map<string, Window>();

// Prune stale entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.resetAt < now) store.delete(k);
  }
}, 5 * 60_000).unref();

export interface RateLimitOptions {
  windowMs: number; // e.g. 60_000 = 1 min
  max: number;      // max requests per window
}

export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetAt: number; // unix ms
  retryAfterSec: number;
}

/** Returns rate-limit state for the given key without side-effects on the count. */
export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  let win = store.get(key);
  if (!win || win.resetAt < now) {
    win = { count: 0, resetAt: now + opts.windowMs };
    store.set(key, win);
  }
  win.count += 1;
  const limited = win.count > opts.max;
  const remaining = Math.max(0, opts.max - win.count);
  const retryAfterSec = limited ? Math.ceil((win.resetAt - now) / 1000) : 0;
  return { limited, remaining, resetAt: win.resetAt, retryAfterSec };
}

/**
 * @deprecated Use checkRateLimit. Kept for backward compatibility.
 */
export function isRateLimited(key: string, opts: RateLimitOptions): boolean {
  return checkRateLimit(key, opts).limited;
}

/**
 * Express middleware factory.
 * Attaches standard RateLimit headers on every response and returns 429 when limited.
 */
export function rateLimitMiddleware(
  keyFn: (req: Request) => string,
  opts: RateLimitOptions,
  message = 'Too many requests. Please try again later.',
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = checkRateLimit(keyFn(req), opts);

    // Standard rate-limit headers (draft-ietf-httpapi-ratelimit-headers)
    res.setHeader('X-RateLimit-Limit', opts.max);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000)); // unix seconds

    if (result.limited) {
      res.setHeader('Retry-After', result.retryAfterSec);
      return res.status(429).json({
        error: message,
        retryAfter: result.retryAfterSec,
      });
    }

    next();
  };
}
