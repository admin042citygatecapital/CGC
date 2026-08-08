import type { CSSProperties } from 'react';

const FIAT_FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', CHF: '🇨🇭', CAD: '🇨🇦',
  AUD: '🇦🇺', JPY: '🇯🇵', SGD: '🇸🇬', AED: '🇦🇪', NGN: '🇳🇬',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', CHF: 'Fr', CAD: 'C$', AUD: 'A$', JPY: '¥', SGD: 'S$', AED: 'د.إ', NGN: '₦',
  BTC: '₿', ETH: 'Ξ', USDT: '₮', BNB: 'BNB', SOL: 'SOL',
};

export const currencyFlag = (currency: string): string => FIAT_FLAGS[currency.toUpperCase()] ?? '';

export const currencyOptionLabel = (currency: string): string => {
  const code = currency.toUpperCase();
  return `${FIAT_FLAGS[code] ?? CURRENCY_SYMBOLS[code] ?? ''} ${code}`.trim();
};

function CryptoLogo({ currency, size }: { currency: string; size: number }) {
  const shared = { width: size, height: size, display: 'block' } satisfies CSSProperties;

  if (currency === 'ETH') return (
    <svg viewBox="0 0 40 40" role="img" aria-label="Ethereum" style={shared}>
      <circle cx="20" cy="20" r="20" fill="#627EEA" />
      <path d="M20 6.5 12.2 20 20 24.5 27.8 20 20 6.5Z" fill="#fff" fillOpacity=".95" />
      <path d="m20 26-7.8-4.5L20 33.5l7.8-12L20 26Z" fill="#fff" fillOpacity=".72" />
    </svg>
  );

  if (currency === 'USDT') return (
    <svg viewBox="0 0 40 40" role="img" aria-label="Tether" style={shared}>
      <circle cx="20" cy="20" r="20" fill="#26A17B" />
      <path d="M10 9h20v5H23v2.5c5.7.3 10 1.5 10 3s-4.3 2.7-10 3V31h-6v-8.5c-5.7-.3-10-1.5-10-3s4.3-2.7 10-3V14h-7V9Zm10 10c-4.6 0-8.1.5-8.1 1.1s3.5 1.1 8.1 1.1 8.1-.5 8.1-1.1S24.6 19 20 19Z" fill="#fff" />
    </svg>
  );

  if (currency === 'SOL') return (
    <svg viewBox="0 0 40 40" role="img" aria-label="Solana" style={shared}>
      <circle cx="20" cy="20" r="20" fill="#111" />
      <path d="M11 10h19l-4 5H7l4-5Z" fill="#14F195" />
      <path d="M11 17.5h19l-4 5H7l4-5Z" fill="#80ECFF" />
      <path d="M11 25h19l-4 5H7l4-5Z" fill="#9945FF" />
    </svg>
  );

  if (currency === 'BNB') return (
    <svg viewBox="0 0 40 40" role="img" aria-label="BNB" style={shared}>
      <circle cx="20" cy="20" r="20" fill="#F3BA2F" />
      <path d="m20 8 5 5-3 3-2-2-2 2-3-3 5-5Zm-8 8 3 3-3 3-3-3 3-3Zm16 0 3 3-3 3-3-3 3-3Zm-8 1 3 3-3 3-3-3 3-3Zm0 9 2-2 3 3-5 5-5-5 3-3 2 2Z" fill="#111" />
    </svg>
  );

  return (
    <svg viewBox="0 0 40 40" role="img" aria-label="Bitcoin" style={shared}>
      <circle cx="20" cy="20" r="20" fill="#F7931A" />
      <text x="20" y="27" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="23" fontWeight="700" fill="#fff">₿</text>
    </svg>
  );
}

export function CurrencyMark({ currency, size = 32, className = '' }: {
  currency: string;
  size?: number;
  className?: string;
}) {
  const code = currency.toUpperCase();
  const isCrypto = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL'].includes(code);

  if (isCrypto) return (
    <span className={`inline-flex shrink-0 rounded-full overflow-hidden ${className}`}
      style={{ width: size, height: size }} title={code}>
      <CryptoLogo currency={code} size={size} />
    </span>
  );

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      role="img" aria-label={`${code} currency`} title={code}
    >
      {FIAT_FLAGS[code] ?? CURRENCY_SYMBOLS[code] ?? code.slice(0, 2)}
    </span>
  );
}
