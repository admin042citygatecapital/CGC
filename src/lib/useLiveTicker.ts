/**
 * useLiveTicker — homepage ticker bar
 *
 * Wraps useMarketWebSocket with a stable, formatted output array
 * suitable for the scrolling ticker strip on the homepage.
 * Falls back to REST polling if WebSocket is unavailable.
 */
import { useMemo } from 'react';
import { useMarketWebSocket } from './useMarketWebSocket';

export interface TickerItem {
  symbol: string;
  price:  string;
  change: string;
  up:     boolean;
}

const TICKER_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT',
  'XRPUSDT', 'ADAUSDT', 'DOGEUSDT',
];

const EMPTY_TICKERS: TickerItem[] = TICKER_SYMBOLS.map(symbol => ({
  symbol: symbol.replace(/USDT$/, '/USD'),
  price: '—',
  change: '—',
  up: true,
}));

function cleanSymbol(raw: string): string {
  const symbol = raw.trim().toUpperCase();
  if (symbol.endsWith('USDT')) return `${symbol.slice(0, -4)}/USD`;
  if (symbol.endsWith('USD')) return `${symbol.slice(0, -3)}/USD`;
  return symbol;
}

export function useLiveTicker(): TickerItem[] {
  const { tickers } = useMarketWebSocket(TICKER_SYMBOLS, 10_000);

  return useMemo(() => {
    if (tickers.size === 0) return EMPTY_TICKERS;

    return TICKER_SYMBOLS.map(sym => {
      const t = tickers.get(sym);
      if (!t) {
        return { symbol: cleanSymbol(sym), price: '—', change: '—', up: true };
      }
      return {
        symbol: cleanSymbol(sym),
        price:  t.priceStr,
        change: t.changeStr,
        up:     t.up,
      };
    });
  }, [tickers]);
}
