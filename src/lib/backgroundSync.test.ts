// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackgroundSyncManager } from './backgroundSync';
describe('private background refresh', () => {
  let manager: BackgroundSyncManager;
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    manager = new BackgroundSyncManager();
  });
  afterEach(() => {
    manager.unregister('session');
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it('never broadcasts private keys or results', async () => {
    const channel = vi.fn();
    vi.stubGlobal('BroadcastChannel', channel);
    const receive = vi.fn();
    manager.register('session', async () => ({ private: true }), 1000);
    manager.on('session', receive);
    await vi.advanceTimersByTimeAsync(0);
    expect(receive).toHaveBeenCalledWith({ private: true });
    expect(channel).not.toHaveBeenCalled();
  });
  it('releases the job when the last subscriber leaves', async () => {
    const fetcher = vi.fn(async () => 1);
    const a = vi.fn();
    const b = vi.fn();
    manager.register('session', fetcher, 1000);
    manager.on('session', a);
    manager.on('session', b);
    await vi.advanceTimersByTimeAsync(0);
    manager.off('session', a);
    await vi.advanceTimersByTimeAsync(1000);
    expect(b).toHaveBeenCalledTimes(2);
    manager.off('session', b);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('prevents overlapping polls and drops late results', async () => {
    let resolve!: (value: number) => void;
    const fetcher = vi.fn(() => new Promise<number>(done => { resolve = done; }));
    const receive = vi.fn();
    manager.register('session', fetcher, 1000);
    manager.on('session', receive);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    manager.unregister('session');
    resolve(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(receive).not.toHaveBeenCalled();
  });
  it('pauses hidden jobs and refreshes on visibility', async () => {
    const fetcher = vi.fn(async () => 1);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    manager.register('session', fetcher, 1000);
    manager.on('session', vi.fn());
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetcher).not.toHaveBeenCalled();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not deliver unavailable data', async () => {
    const receive = vi.fn();
    manager.register('session', async () => null, 1000);
    manager.on('session', receive);
    await vi.advanceTimersByTimeAsync(0);
    expect(receive).not.toHaveBeenCalled();
  });
});
