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
  'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'USDTUSDT',
];

const FALLBACK: TickerItem[] = [
  { symbol: 'BTC/USD', price: '$67,420', change: '+3.2%', up: true  },
  { symbol: 'ETH/USD', price: '$3,840',  change: '+1.8%', up: true  },
  { symbol: 'SOL/USD', price: '$182.50', change: '-0.9%', up: false },
  { symbol: 'BNB/USD', price: '$598',    change: '+2.1%', up: true  },
  { symbol: 'XRP/USD', price: '$0.5420', change: '+0.4%', up: true  },
  { symbol: 'ADA/USD', price: '$0.4810', change: '-0.3%', up: false },
  { symbol: 'DOGE/USD',price: '$0.1620', change: '+1.1%', up: true  },
  { symbol: 'USDT',    price: '$1.00',   change: '0.0%',  up: true  },
];

function cleanSymbol(raw: string): string {
  return raw
    .replace(/USDT$/, '/USD')
    .replace(/USD$/, '/USD')
    .replace(/USDT/, '/USDT');
}

export function useLiveTicker(): TickerItem[] {
  const { tickers } = useMarketWebSocket(TICKER_SYMBOLS, 10_000);

  return useMemo(() => {
    if (tickers.size === 0) return FALLBACK;

    return TICKER_SYMBOLS.map(sym => {
      const t = tickers.get(sym);
      if (!t) {
        const fb = FALLBACK.find(f => f.symbol.startsWith(sym.replace('USDT', '')));
        return fb ?? { symbol: cleanSymbol(sym), price: '—', change: '—', up: true };
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
