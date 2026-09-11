// Currency display helpers. Kept out of CurrencyMark.tsx so that file exports
// only components (react-refresh) and the tables stay importable from .ts code.

export const FIAT_FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', CHF: '🇨🇭', CAD: '🇨🇦',
  AUD: '🇦🇺', JPY: '🇯🇵', SGD: '🇸🇬', AED: 'د.إ', NGN: '₦',
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', CHF: 'Fr', CAD: 'C$', AUD: 'A$', JPY: '¥', SGD: 'S$', AED: 'د.إ', NGN: '₦',
  BTC: '₿', ETH: 'Ξ', USDT: '₮', BNB: 'BNB', SOL: 'SOL',
};

export const currencyFlag = (currency: string): string => FIAT_FLAGS[currency.toUpperCase()] ?? '';

export const currencyOptionLabel = (currency: string): string => {
  const code = currency.toUpperCase();
  return `${FIAT_FLAGS[code] ?? CURRENCY_SYMBOLS[code] ?? ''} ${code}`.trim();
};