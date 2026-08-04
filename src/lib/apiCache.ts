/**
 * apiCache — in-memory LRU cache with TTL + stale-while-revalidate
 *
 * Features:
 *  - LRU eviction when capacity is exceeded (default 256 entries)
 *  - Per-entry TTL (milliseconds)
 *  - Stale-while-revalidate: returns stale data while a background
 *    revalidation is in flight, then updates the cache silently
 *  - In-flight coalescing: concurrent requests for the same key share
 *    one Promise — no duplicate network calls when multiple components
 *    mount simultaneously
 *  - BroadcastChannel: cache writes are broadcast to other tabs so
 *    they don't need to re-fetch the same data
 *  - SSR-safe: all browser APIs are guarded with typeof window checks
 */

interface CacheEntry<T> {
  value:     T;
  expiresAt: number;   // absolute ms timestamp
  staleAt:   number;   // absolute ms — after this, trigger background revalidation
  key:       string;   // stored for LRU eviction
  revalidating: boolean;
}

const DEFAULT_TTL   = 30_000;  // 30s hard expiry
const DEFAULT_STALE = 10_000;  // 10s stale-while-revalidate window
const MAX_CAPACITY  = 256;

class ApiCache {
  private store    = new Map<string, CacheEntry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>(); // in-flight coalescing
  private channel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('cgc_api_cache');
        this.channel.onmessage = (ev: MessageEvent) => {
          const { key, value, expiresAt, staleAt } = ev.data as CacheEntry<unknown>;
          // Apply remote write without re-broadcasting (avoid loops)
          this.store.set(key, { key, value, expiresAt, staleAt, revalidating: false });
        };
      } catch {
        // BroadcastChannel not available in this context
      }
    }
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  /**
   * Get a cached value. Returns null if missing or hard-expired.
   * If stale, triggers a background revalidation via the provided fetcher.
   */
  get<T>(key: string, fetcher?: () => Promise<T>): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    const now = Date.now();

    // Hard expired — evict and return null
    if (now > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // Stale — return value but kick off background revalidation
    if (fetcher && now > entry.staleAt && !entry.revalidating) {
      entry.revalidating = true;
      fetcher()
        .then(fresh => {
          this.set(key, fresh, entry.expiresAt - now, entry.staleAt - now);
        })
        .catch(() => {
          // revalidation failed — keep stale data, allow retry next time
          const e = this.store.get(key) as CacheEntry<T> | undefined;
          if (e) e.revalidating = false;
        });
    }

    // LRU: move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);

    return entry.value;
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  /**
   * Store a value with a TTL (ms). Stale window defaults to TTL/3.
   */
  set<T>(key: string, value: T, ttl = DEFAULT_TTL, staleWindow = DEFAULT_STALE): void {
    // Evict oldest entry if at capacity
    if (this.store.size >= MAX_CAPACITY) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }

    const now      = Date.now();
    const entry: CacheEntry<T> = {
      key,
      value,
      expiresAt:    now + ttl,
      staleAt:      now + Math.min(staleWindow, ttl),
      revalidating: false,
    };

    this.store.set(key, entry);
    // Clear any in-flight entry now that we have a value
    this.inflight.delete(key);

    // Broadcast to other tabs
    try {
      this.channel?.postMessage(entry);
    } catch {
      // ignore serialisation errors
    }
  }

  // ── Invalidate ────────────────────────────────────────────────────────────

  /** Remove a single key */
  invalidate(key: string): void {
    this.store.delete(key);
    this.inflight.delete(key);
  }

  /** Remove all keys matching a prefix */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
    for (const key of this.inflight.keys()) {
      if (key.startsWith(prefix)) this.inflight.delete(key);
    }
  }

  /** Clear everything */
  clear(): void {
    this.store.clear();
    this.inflight.clear();
  }

  // ── Fetch-or-set with in-flight coalescing ────────────────────────────────

  /**
   * Return cached value if fresh; otherwise fetch, cache, and return.
   * Stale values are returned immediately while revalidation runs in background.
   *
   * Multiple concurrent callers for the same key share ONE in-flight Promise —
   * no duplicate network requests when several components mount simultaneously.
   */
  async fetchOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl = DEFAULT_TTL,
    staleWindow = DEFAULT_STALE,
  ): Promise<T> {
    const cached = this.get<T>(key, fetcher);
    if (cached !== null) return cached;

    // Coalesce: if a fetch is already in flight for this key, wait for it
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    // Start a new fetch and register it as in-flight
    const promise = fetcher().then(fresh => {
      this.set(key, fresh, ttl, staleWindow);
      return fresh;
    }).catch(err => {
      // Remove in-flight entry on error so next caller retries
      this.inflight.delete(key);
      throw err;
    });

    this.inflight.set(key, promise as Promise<unknown>);
    return promise;
  }

  // ── Stats (dev/debug) ─────────────────────────────────────────────────────

  stats() {
    const now = Date.now();
    let fresh = 0, stale = 0, expired = 0;
    for (const entry of this.store.values()) {
      if (now > entry.expiresAt) expired++;
      else if (now > entry.staleAt) stale++;
      else fresh++;
    }
    return { total: this.store.size, fresh, stale, expired, inflight: this.inflight.size };
  }
}

// Singleton — one cache per browser tab (BroadcastChannel syncs across tabs)
export const apiCache = new ApiCache();

// ── Typed fetch helpers ───────────────────────────────────────────────────────

/**
 * Cached GET fetch. Returns stale data while revalidating.
 * Concurrent calls for the same URL share one in-flight request.
 *
 * @param url       Fetch URL
 * @param ttl       Hard TTL in ms (default 30s)
 * @param stale     Stale-while-revalidate window in ms (default 10s)
 */
export async function cachedFetch<T>(
  url: string,
  ttl  = DEFAULT_TTL,
  stale = DEFAULT_STALE,
): Promise<T> {
  return apiCache.fetchOrSet<T>(
    url,
    async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
      return res.json() as Promise<T>;
    },
    ttl,
    stale,
  );
}

/**
 * Cached GET fetch with auth header.
 * Concurrent calls for the same URL+token share one in-flight request.
 */
export async function cachedAuthFetch<T>(
  url:   string,
  token: string,
  ttl   = DEFAULT_TTL,
  stale = DEFAULT_STALE,
): Promise<T> {
  const key = `auth:${url}`;
  return apiCache.fetchOrSet<T>(
    key,
    async () => {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
      return res.json() as Promise<T>;
    },
    ttl,
    stale,
  );
}
