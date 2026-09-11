/**
 * marketFormat — pure parsing/formatting helpers shared by the market-data
 * transport hooks (useMarketWebSocket, useMarketSSE) so the ticker model is
 * normalised identically regardless of which source delivered the data.
 */

/** Coerce to a finite number, falling back when null/undefined/NaN. */
export function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatPrice(value: unknown): string {
  const n = finiteNumber(value);
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (n >= 1)    return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

export function formatChange(value: unknown): string {
  const pct = finiteNumber(value);
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

/** Keep provider-specific asset codes out of the customer-facing data model. */
export function normalizeTickerSymbol(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/^XBT/, 'BTC')
    .replace(/^XDG/, 'DOGE');
}