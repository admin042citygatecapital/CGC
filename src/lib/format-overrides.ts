/**
 * Per-business formatting overrides (date/number/currency display).
 * Nothing in this app currently supplies non-default overrides — this is
 * the empty-bundle default that `virtual:format-overrides` (see
 * vite-env.d.ts) falls back to when no overrides are configured.
 */
export interface FormatOverrideBundle {
  dateFormat?: string;
  numberFormat?: string;
  currencyFormat?: string;
}

export const EMPTY_FORMAT_OVERRIDE_BUNDLE: FormatOverrideBundle = {};
