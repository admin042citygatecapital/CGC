/**
 * formatMoney — null-safe currency / number formatting utilities.
 * Always use these instead of raw .toLocaleString() / .toFixed() on
 * potentially-undefined financial values.
 */

/**
 * Format a monetary amount as a locale string with 2 decimal places.
 * Safely handles null, undefined, NaN, and non-numeric values.
 *
 * @example formatMoney(1234.5)   → "1,234.50"
 * @example formatMoney(undefined) → "0.00"
 */
export function formatMoney(value: unknown, decimals = 2): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a crypto amount (BTC/ETH) with 6 decimal places,
 * or fiat with 2 decimal places based on currency symbol.
 */
export function formatAmount(value: unknown, currency?: string): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const isCrypto = currency === 'BTC' || currency === 'ETH';
  return isCrypto
    ? safe.toFixed(6)
    : safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Compact number formatter for dashboard stats.
 * 1,500,000 → "$1.5M" | 2,300 → "$2.3k" | 450 → "$450"
 */
export function formatCompact(value: unknown, prefix = '$'): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  if (safe >= 1_000_000) return `${prefix}${(safe / 1_000_000).toFixed(1)}M`;
  if (safe >= 1_000)     return `${prefix}${(safe / 1_000).toFixed(1)}k`;
  return `${prefix}${safe.toLocaleString('en-US')}`;
}

/**
 * Safe integer formatter — for counts, totals, record numbers.
 */
export function formatCount(value: unknown): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? Math.round(n) : 0;
  return safe.toLocaleString('en-US');
}
