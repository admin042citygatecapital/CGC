/**
 * backgroundSync — periodic data refresh with tab-visibility awareness
 *
 * Features:
 *  - Pauses polling when the tab is hidden (Page Visibility API)
 *  - Resumes and fires an immediate refresh when the tab becomes visible again
 *  - BroadcastChannel: only ONE tab polls at a time; others receive updates
 *    via the channel (leader-election pattern)
 *  - Configurable interval per sync job
 *  - Graceful cleanup on unmount
 *
 * Usage (module-level singleton):
 *   backgroundSync.register('wallet', fetchWalletData, 30_000);
 *   backgroundSync.on('wallet', (data) => setWallet(data));
 *   // later:
 *   backgroundSync.unregister('wallet');
 *
 * Usage (React hook):
 *   useBackgroundSync('wallet', fetchWalletData, 30_000, (data) => setWallet(data));
 */

import { useEffect,useRef } from 'react';

type SyncFetcher<T> = () => Promise<T>;
type SyncListener<T> = (data: T) => void;

interface SyncJob {
  fetcher:   SyncFetcher<unknown>;
  interval:  number;
  listeners: Set<SyncListener<unknown>>;
  timer:     ReturnType<typeof setInterval> | null;
  lastFetch: number;
  isLeader:  boolean;
}

const LEADER_HEARTBEAT_INTERVAL = 5_000;
const LEADER_TIMEOUT            = 12_000; // if leader goes silent for 12s, elect new one

class BackgroundSyncManager {
  private jobs    = new Map<string, SyncJob>();
  private channel: BroadcastChannel | null = null;
  private leaderHeartbeat: ReturnType<typeof setInterval> | null = null;
  private leaderLastSeen  = 0;
  private isLeader        = false;
  private visibilityBound = false;

  constructor() {
    if (typeof window === 'undefined') return;
    this.initChannel();
    this.initVisibility();
    this.electLeader();
  }

  // ── BroadcastChannel ──────────────────────────────────────────────────────

  private initChannel() {
    if (!('BroadcastChannel' in window)) return;
    try {
      this.channel = new BroadcastChannel('cgc_bg_sync');
      this.channel.onmessage = (ev: MessageEvent) => {
        const { type, key, data, ts } = ev.data as {
          type: string; key?: string; data?: unknown; ts?: number;
        };

        if (type === 'leader_heartbeat') {
          this.leaderLastSeen = Date.now();
          if (this.isLeader) {
            // Another tab is also claiming leadership — yield to the one with
            // the earlier timestamp (first-come wins)
            if (ts && ts < this.leaderLastSeen) {
              this.isLeader = false;
              this.stopAllTimers();
              if (this.leaderHeartbeat) {
                clearInterval(this.leaderHeartbeat);
                this.leaderHeartbeat = null;
              }
            }
          }
          return;
        }

        if (type === 'sync_result' && key) {
          // Another tab fetched data — apply it locally without re-fetching
          const job = this.jobs.get(key);
          if (job) {
            job.lastFetch = Date.now();
            job.listeners.forEach(fn => fn(data));
          }
        }
      };
    } catch {
      // ignore
    }
  }

  // ── Leader election ───────────────────────────────────────────────────────

  private electLeader() {
    if (typeof window === 'undefined') return;

    // Simple heuristic: if no heartbeat received in LEADER_TIMEOUT, become leader
    setTimeout(() => {
      if (Date.now() - this.leaderLastSeen > LEADER_TIMEOUT) {
        this.becomeLeader();
      }
    }, LEADER_TIMEOUT);
  }

  private becomeLeader() {
    if (this.isLeader) return;
    this.isLeader = true;
    this.startAllTimers();

    // Broadcast heartbeat so other tabs know we're the leader
    this.leaderHeartbeat = setInterval(() => {
      try {
        this.channel?.postMessage({ type: 'leader_heartbeat', ts: Date.now() });
      } catch {
        // ignore
      }
    }, LEADER_HEARTBEAT_INTERVAL);
  }

  // ── Page Visibility ───────────────────────────────────────────────────────

  private initVisibility() {
    if (this.visibilityBound) return;
    this.visibilityBound = true;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseAllTimers();
      } else {
        // Tab became visible — refresh immediately then restart timers
        this.resumeAllTimers();
      }
    });
  }

  // ── Timer management ─────────────────────────────────────────────────────

  private startTimer(key: string, job: SyncJob) {
    if (!this.isLeader) return;
    if (job.timer) return;
    job.timer = setInterval(() => void this.runJob(key, job), job.interval);
  }

  private stopTimer(job: SyncJob) {
    if (job.timer) {
      clearInterval(job.timer);
      job.timer = null;
    }
  }

  private startAllTimers() {
    this.jobs.forEach((job, key) => this.startTimer(key, job));
  }

  private stopAllTimers() {
    this.jobs.forEach(job => this.stopTimer(job));
  }

  private pauseAllTimers() {
    this.stopAllTimers();
  }

  private resumeAllTimers() {
    if (!this.isLeader) return;
    // Immediate refresh for jobs that are stale
    this.jobs.forEach((job, key) => {
      const stale = Date.now() - job.lastFetch > job.interval;
      if (stale) void this.runJob(key, job);
      this.startTimer(key, job);
    });
  }

  // ── Job execution ─────────────────────────────────────────────────────────

  private async runJob(key: string, job: SyncJob) {
    try {
      const data = await job.fetcher();
      job.lastFetch = Date.now();
      job.listeners.forEach(fn => fn(data));

      // Broadcast result to other tabs
      try {
        this.channel?.postMessage({ type: 'sync_result', key, data });
      } catch {
        // ignore serialisation errors (e.g. non-cloneable data)
      }
    } catch {
      // silently ignore — keep stale data
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Register a sync job. Safe to call multiple times with the same key —
   * subsequent calls update the interval and fetcher.
   */
  register<T>(key: string, fetcher: SyncFetcher<T>, interval: number) {
    if (typeof window === 'undefined') return;

    const existing = this.jobs.get(key);
    if (existing) {
      existing.fetcher  = fetcher as SyncFetcher<unknown>;
      existing.interval = interval;
      return;
    }

    const job: SyncJob = {
      fetcher:   fetcher as SyncFetcher<unknown>,
      interval,
      listeners: new Set(),
      timer:     null,
      lastFetch: 0,
      isLeader:  false,
    };
    this.jobs.set(key, job);

    if (this.isLeader) {
      void this.runJob(key, job); // immediate first fetch
      this.startTimer(key, job);
    }
  }

  /** Add a listener for a sync job's results */
  on<T>(key: string, listener: SyncListener<T>) {
    const job = this.jobs.get(key);
    if (job) job.listeners.add(listener as SyncListener<unknown>);
  }

  /** Remove a listener */
  off<T>(key: string, listener: SyncListener<T>) {
    const job = this.jobs.get(key);
    if (job) job.listeners.delete(listener as SyncListener<unknown>);
  }

  /** Unregister a sync job entirely */
  unregister(key: string) {
    const job = this.jobs.get(key);
    if (job) {
      this.stopTimer(job);
      this.jobs.delete(key);
    }
  }

  /** Force an immediate refresh of a job */
  async refresh(key: string) {
    const job = this.jobs.get(key);
    if (job) await this.runJob(key, job);
  }
}

// Singleton
export const backgroundSync = new BackgroundSyncManager();

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * useBackgroundSync — register a sync job and receive updates in a component.
 *
 * @param key       Unique job identifier
 * @param fetcher   Async function that returns fresh data
 * @param interval  Polling interval in ms
 * @param onData    Callback invoked with fresh data (use setState here)
 */
export function useBackgroundSync<T>(
  key:      string,
  fetcher:  SyncFetcher<T>,
  interval: number,
  onData:   SyncListener<T>,
) {
  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const listener: SyncListener<T> = (data) => onDataRef.current(data);

    backgroundSync.register(key, fetcher, interval);
    backgroundSync.on(key, listener);

    return () => {
      backgroundSync.off(key, listener);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, interval]);
}
