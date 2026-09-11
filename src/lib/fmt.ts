/**
 * fmt.ts — Universal safe formatters
 * Prevents null/undefined crashes on .toLocaleString(), .toFixed(), etc.
 */

/** Format a number with locale commas. Returns "0" for null/undefined/NaN. */
export function fmtNum(value: unknown, fallback = '0'): string {
  const n = Number(value ?? 0);
  if (!isFinite(n)) return fallback;
  return n.toLocaleString();
}

/** Format a currency amount. e.g. fmtCurrency(1234.5, 'USD') → "$1,234.50" */
export function fmtCurrency(value: unknown, currency = 'USD', fallback = '$0.00'): string {
  const n = Number(value ?? 0);
  if (!isFinite(n)) return fallback;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

/** Format a date safely. Returns "—" for null/undefined/invalid. */
export function fmtDate(value: unknown, fallback = '—'): string {
  if (!value) return fallback;
  try {
    const d = new Date(value as string | number);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleString();
  } catch {
    return fallback;
  }
}

/** Format a percentage. e.g. fmtPct(0.1234) → "12.34%" */
export function fmtPct(value: unknown, decimals = 1, fallback = '0%'): string {
  const n = Number(value ?? 0);
  if (!isFinite(n)) return fallback;
  return `${(n * 100).toFixed(decimals)}%`;
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Fixed-decimal locale format. e.g. fmtFixed(1234.5, 2) → "1,234.50" */
export function fmtFixed(value: number, decimals = 2): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Tiered crypto price without a currency symbol: ≥1000 → 2dp, ≥1 → 4dp, else 6dp. */
export function fmtPrice(value: number): string {
  if (value >= 1000) return fmtFixed(value, 2);
  if (value >= 1)    return fmtFixed(value, 4);
  return fmtFixed(value, 6);
}

/**
 * Compacted USD: fmtCompactUsd(1200) → "+$1.2K", fmtCompactUsd(-3_400_000) →
 * "-$3.40M", fmtCompactUsd(999, false) → "$999.00". Pass signed=false to drop
 * the leading '+' on positive amounts (balance summaries use this).
 */
export function fmtCompactUsd(value: number, signed = true): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : signed && value > 0 ? '+' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}
