/** Tab-local refresh jobs. Private keys and results never leave this tab. */
import { useEffect, useRef } from 'react';
type Fetcher<T> = () => Promise<T>;
type Listener<T> = (data: T) => void;
interface Job {
  fetcher: Fetcher<unknown>;
  listeners: Set<Listener<unknown>>;
  interval: number;
  timer: ReturnType<typeof setInterval> | null;
  running: boolean;
}
export class BackgroundSyncManager {
  private jobs = new Map<string, Job>();
  private observing = false;
  private visible = () => typeof document !== 'undefined' && !document.hidden;
  private visibilityChanged = () => {
    this.jobs.forEach((job, key) => {
      this.stop(job);
      if (this.visible()) {
        void this.run(key, job);
        this.start(key, job);
      }
    });
  };
  private stop(job: Job) {
    if (job.timer !== null) clearInterval(job.timer);
    job.timer = null;
  }
  private start(key: string, job: Job) {
    if (!this.visible() || job.timer !== null || !job.listeners.size) return;
    job.timer = setInterval(() => void this.run(key, job), job.interval);
  }
  private async run(key: string, job: Job) {
    if (!this.visible() || job.running || !job.listeners.size || this.jobs.get(key) !== job) return;
    job.running = true;
    try {
      const data = await job.fetcher();
      if (this.jobs.get(key) !== job || !this.visible() || data == null) return;
      for (const listener of job.listeners) {
        try { listener(data); } catch { /* Isolate subscriber failures. */ }
      }
    } catch { /* Failed refreshes never replace successful data. */ }
    finally { job.running = false; }
  }
  register<T>(key: string, fetcher: Fetcher<T>, interval: number) {
    if (typeof window === 'undefined') return;
    if (!Number.isFinite(interval) || interval < 1) throw new RangeError('Invalid refresh interval');
    if (!this.observing) {
      document.addEventListener('visibilitychange', this.visibilityChanged);
      this.observing = true;
    }
    const previous = this.jobs.get(key);
    if (previous) this.stop(previous);
    const job: Job = { fetcher, interval, listeners: previous?.listeners ?? new Set(), timer: null, running: false };
    this.jobs.set(key, job);
    this.start(key, job);
  }
  on<T>(key: string, listener: Listener<T>) {
    const job = this.jobs.get(key);
    if (!job) return;
    job.listeners.add(listener as Listener<unknown>);
    void this.run(key, job);
    this.start(key, job);
  }
  off<T>(key: string, listener: Listener<T>) {
    const job = this.jobs.get(key);
    if (!job) return;
    job.listeners.delete(listener as Listener<unknown>);
    if (!job.listeners.size) this.unregister(key);
  }
  unregister(key: string) {
    const job = this.jobs.get(key);
    if (job) {
      this.stop(job);
      job.listeners.clear();
      this.jobs.delete(key);
    }
    if (this.observing && !this.jobs.size) {
      document.removeEventListener('visibilitychange', this.visibilityChanged);
      this.observing = false;
    }
  }
  async refresh(key: string) {
    const job = this.jobs.get(key);
    if (job) await this.run(key, job);
  }
}
export const backgroundSync = new BackgroundSyncManager();
export function useBackgroundSync<T>(key: string, fetcher: Fetcher<T>, interval: number, onData: Listener<T>) {
  const onDataRef = useRef(onData);
  const fetcherRef = useRef(fetcher);
  onDataRef.current = onData;
  fetcherRef.current = fetcher;
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const listener: Listener<T> = data => onDataRef.current(data);
    backgroundSync.register(key, () => fetcherRef.current(), interval);
    backgroundSync.on(key, listener);
    return () => backgroundSync.off(key, listener);
  }, [key, interval]);
}
