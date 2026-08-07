export function newIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `cgc-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}
