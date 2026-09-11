/**
 * apiCache — in-memory LRU cache with TTL + stale-while-revalidate
 *
 * Features:
 *  - LRU eviction when capacity is exceeded (default 256 entries; enforced
 *    on every insertion path, including broadcast-applied writes)
 *  - Per-entry TTL (milliseconds); a successful background revalidation
 *    resets BOTH the hard expiry and the stale window to their full
 *    durations from the refresh time
 *  - Stale-while-revalidate: returns stale data while a background
 *    revalidation is in flight; the revalidation promise is registered as
 *    in-flight so expired-path fetchers share the same refresh instead of
 *    duplicating it
 *  - In-flight coalescing: concurrent requests for the same key share
 *    one Promise — no duplicate network calls when multiple components
 *    mount simultaneously
 *  - Per-key generations: invalidation bumps the generation so a request
 *    that started before the invalidation can never repopulate the cache
 *    with its result
 *  - BroadcastChannel: PUBLIC cache writes only are broadcast to other
 *    tabs; incoming broadcast writes are shape-validated, future-expiry
 *    checked, ordered against the local entry, and capacity-capped
 *  - SSR-safe: all browser APIs are guarded with typeof window checks
 *
 *  NOT for private data: keys and values in this cache are shared across
 *  tabs via BroadcastChannel. Never cache authenticated/account-scoped
 *  responses here.
 */

interface CacheEntry<T> {
  value:     T;
  expiresAt: number;   // absolute ms timestamp
  staleAt:   number;   // absolute ms — after this, trigger background revalidation
  key:       string;   // stored for LRU eviction
  ttl:       number;   // hard TTL (ms) — reused to reset durations on revalidation
  staleWindow: number; // stale-while-revalidate window (ms)
  revalidating: boolean;
}

const DEFAULT_TTL   = 30_000;  // 30s hard expiry
const MAX_CAPACITY  = 256;

/** Key prefix reserved for data that must never be broadcast cross-tab. */
const PRIVATE_KEY_PREFIX = 'private:';

function isFiniteMs(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

class ApiCache {
  private store       = new Map<string, CacheEntry<unknown>>();
  private inflight    = new Map<string, Promise<unknown>>(); // in-flight coalescing
  private generations = new Map<string, number>();           // invalidation epochs
  private channel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('cgc_api_cache');
        this.channel.onmessage = (ev: MessageEvent) => {
          const data = ev.data as Partial<CacheEntry<unknown>> | null;
          if (!data || !this.isValidBroadcast(data)) return;
          const { key, value, expiresAt, staleAt } = data;
          // Ordered apply: a remote write never overrides a strictly newer
          // local entry, and never rebroadcasts (avoid loops).
          const current = this.store.get(key);
          if (current && current.expiresAt >= expiresAt) return;
          const windowMs = Math.max(expiresAt - staleAt, 0);
          this.insert(key, {
            key, value, expiresAt, staleAt,
            ttl: windowMs, staleWindow: windowMs,
            revalidating: false,
          });
        };
      } catch {
        // BroadcastChannel not available in this context
      }
    }
  }

  /** Shape/freshness gate for incoming broadcast writes. Same-origin
   *  mechanism — this guards against malformed or spoofed messages from
   *  code running under this origin, not cross-origin attackers. */
  private isValidBroadcast(data: Partial<CacheEntry<unknown>>): data is CacheEntry<unknown> {
    return (
      typeof data.key === 'string' &&
      data.key.length > 0 &&
      !data.key.startsWith(PRIVATE_KEY_PREFIX) &&
      data.value !== undefined &&
      isFiniteMs(data.expiresAt) &&
      isFiniteMs(data.staleAt) &&
      data.staleAt <= data.expiresAt &&
      data.expiresAt > Date.now()
    );
  }

  /** Single insertion path for every write (local and broadcast) that
   *  enforces capacity. Callers must handle recency ordering themselves. */
  private insert(key: string, entry: CacheEntry<unknown>): void {
    const isNewKey = !this.store.has(key);
    // Evict the least-recently-used entry only when inserting a new key at
    // capacity — replacing an existing key must not evict an unrelated value.
    if (isNewKey && this.store.size >= MAX_CAPACITY) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.delete(key);
    this.store.set(key, entry);
  }

  private bumpGeneration(key: string): void {
    this.generations.set(key, (this.generations.get(key) ?? 0) + 1);
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  /**
   * Get a cached value. Returns null if missing or hard-expired.
   * If stale and a fetcher is provided, starts ONE background revalidation
   * (coalesced via `inflight`) that resets the entry's full TTL durations
   * on success.
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

    // Stale — return value but kick off (or join) a background revalidation
    if (fetcher && now > entry.staleAt && !entry.revalidating && !this.inflight.has(key)) {
      const gen = this.generations.get(key) ?? 0;
      entry.revalidating = true;
      const promise = fetcher()
        .then(fresh => {
          // A generation bump (invalidate/…) between fetch start and
          // completion must win: drop the write entirely.
          if ((this.generations.get(key) ?? 0) !== gen) return fresh;
          this.set(key, fresh, entry.ttl, entry.staleWindow);
          return fresh;
        })
        .catch(() => {
          // revalidation failed — keep stale data, allow retry next time
          this.inflight.delete(key);
          const e = this.store.get(key) as CacheEntry<T> | undefined;
          if (e) e.revalidating = false;
        });
      this.inflight.set(key, promise);
    }

    // LRU: move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);

    return entry.value;
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  /**
   * Store a value with a TTL (ms). Omitting the stale window defaults it to
   * TTL/3 (clamped to the TTL).
   */
  set<T>(key: string, value: T, ttl = DEFAULT_TTL, staleWindow?: number): void {
    const now        = Date.now();
    const safeTtl    = Math.max(ttl, 0);
    const stale      = Math.min(staleWindow ?? Math.round(safeTtl / 3), safeTtl);
    const entry: CacheEntry<T> = {
      key,
      value,
      expiresAt:    now + safeTtl,
      staleAt:      now + stale,
      ttl:          safeTtl,
      staleWindow:  stale,
      revalidating: false,
    };

    this.insert(key, entry);
    // Clear any in-flight entry now that we have a value
    this.inflight.delete(key);

    // Broadcast to other tabs — public data only
    if (key.startsWith(PRIVATE_KEY_PREFIX)) return;
    try {
      this.channel?.postMessage(entry);
    } catch {
      // ignore serialisation errors
    }
  }

  // ── Invalidate ────────────────────────────────────────────────────────────

  /** Remove a single key. Bumps the key's generation so any in-flight
   *  request that started before this call cannot repopulate the cache. */
  invalidate(key: string): void {
    this.bumpGeneration(key);
    this.store.delete(key);
    this.inflight.delete(key);
  }

  /** Remove all keys matching a prefix (same generation rule). */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.bumpGeneration(key);
    }
    for (const key of this.inflight.keys()) {
      if (key.startsWith(prefix)) this.bumpGeneration(key);
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
    for (const key of this.inflight.keys()) {
      if (key.startsWith(prefix)) this.inflight.delete(key);
    }
  }

  /** Clear everything (same generation protection per key). */
  clear(): void {
    for (const key of this.store.keys()) this.bumpGeneration(key);
    for (const key of this.inflight.keys()) this.bumpGeneration(key);
    this.store.clear();
    this.inflight.clear();
  }

  // ── Fetch-or-set with in-flight coalescing ────────────────────────────────

  /**
   * Return cached value if fresh; otherwise fetch, cache, and return.
   * Stale values are returned immediately while revalidation runs in background
   * (the background promise is shared, so an expired-path caller joins the
   * same refresh rather than starting a second one).
   *
   * Multiple concurrent callers for the same key share ONE in-flight Promise —
   * no duplicate network requests when several components mount simultaneously.
   */
  async fetchOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl = DEFAULT_TTL,
    staleWindow?: number,
  ): Promise<T> {
    const cached = this.get<T>(key, fetcher);
    if (cached !== null) return cached;

    // Coalesce: if a fetch (or background revalidation) is already in flight
    // for this key, wait for it
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    // Start a new fetch and register it as in-flight
    const gen = this.generations.get(key) ?? 0;
    const promise = fetcher().then(fresh => {
      if ((this.generations.get(key) ?? 0) !== gen) return fresh;
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
 * Cached GET fetch for PUBLIC, unauthenticated endpoints only.
 * Returns stale data while revalidating.
 * Concurrent calls for the same URL share one in-flight request.
 *
 * This cache is shared across tabs via BroadcastChannel — do not use it for
 * authenticated or account-scoped endpoints.
 *
 * @param url       Fetch URL
 * @param ttl       Hard TTL in ms (default 30s)
 * @param stale     Stale-while-revalidate window in ms (default TTL/3)
 */
export async function cachedFetch<T>(
  url: string,
  ttl  = DEFAULT_TTL,
  stale?: number,
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