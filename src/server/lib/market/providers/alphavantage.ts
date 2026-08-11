/**
 * Alpha Vantage Provider — Stocks, Forex, Crypto
 * REST: https://www.alphavantage.co/query
 * Requires: ALPHA_VANTAGE_API_KEY
 */

import { getSecret } from '#runtime/secrets';
import { MissingApiKeyError, CapabilityNotSupportedError } from '../types.js';
import type {
  MarketDataProvider, ProviderCapabilities, Ticker, Candle,
  CandleInterval, OrderBook, SearchResult, MarketSummary,
} from '../types.js';

const BASE = 'https://www.alphavantage.co/query';

const INTERVAL_MAP: Record<CandleInterval, string> = {
  '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min', '1h': '60min',
  '1d': 'daily', '1w': 'weekly', '1M': 'monthly',
  '3m': '5min', '2h': '60min', '4h': '60min', '6h': '60min', '12h': '60min',
};

function getKey(): string {
  const k = String(getSecret('ALPHA_VANTAGE_API_KEY') ?? '');
  if (!k) throw new MissingApiKeyError('Alpha Vantage', 'ALPHA_VANTAGE_API_KEY');
  return k;
}

async function fetchJSON<T>(params: Record<string, string>): Promise<T> {
  const qs  = new URLSearchParams({ ...params, apikey: getKey() }).toString();
  const res = await fetch(`${BASE}?${qs}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);
  const json = await res.json() as T;
  if ((json as Record<string, unknown>)['Note']) throw new Error('Alpha Vantage rate limit reached');
  return json;
}

export class AlphaVantageProvider implements MarketDataProvider {
  readonly id   = 'alpha-vantage';
  readonly name = 'Alpha Vantage';
  readonly capabilities: ProviderCapabilities = {
    ticker: true, candles: true, orderBook: false,
    search: true, marketSummary: true, webSocket: false,
  };

  async getTicker(symbols: string[]): Promise<Ticker[]> {
    const results: Ticker[] = [];
    for (const sym of symbols) {
      try {
        const data = await fetchJSON<Record<string, Record<string, string>>>({
          function: 'GLOBAL_QUOTE',
          symbol: sym,
        });
        const q = data['Global Quote'];
        if (!q) continue;
        const price  = parseFloat(q['05. price'] ?? '0');
        const prev   = parseFloat(q['08. previous close'] ?? '0');
        const change = parseFloat(q['09. change'] ?? '0');
        results.push({
          symbol:      sym,
          name:        sym,
          assetClass:  'stock',
          price,
          change24h:   change,
          changePct24h: parseFloat(q['10. change percent']?.replace('%', '') ?? '0'),
          volume24h:   parseFloat(q['06. volume'] ?? '0'),
          high24h:     parseFloat(q['03. high'] ?? price.toString()),
          low24h:      parseFloat(q['04. low'] ?? price.toString()),
          open24h:     parseFloat(q['02. open'] ?? prev.toString()),
          currency:    'USD',
          timestamp:   Date.now(),
          provider:    'alpha-vantage',
        });
      } catch { /* skip */ }
    }
    return results;
  }

  async getCandles(symbol: string, interval: CandleInterval, limit = 100): Promise<Candle[]> {
    const iv = INTERVAL_MAP[interval] ?? '60min';
    const isIntraday = ['1min', '5min', '15min', '30min', '60min'].includes(iv);

    const data = await fetchJSON<Record<string, unknown>>(
      isIntraday
        ? { function: 'TIME_SERIES_INTRADAY', symbol, interval: iv, outputsize: 'compact' }
        : { function: iv === 'daily' ? 'TIME_SERIES_DAILY' : iv === 'weekly' ? 'TIME_SERIES_WEEKLY' : 'TIME_SERIES_MONTHLY', symbol }
    );

    const key = Object.keys(data).find(k => k.startsWith('Time Series')) ?? '';
    const series = data[key] as Record<string, Record<string, string>> ?? {};

    return Object.entries(series)
      .slice(0, limit)
      .map(([date, v]) => ({
        time:   Math.floor(new Date(date).getTime() / 1000),
        open:   parseFloat(v['1. open']),
        high:   parseFloat(v['2. high']),
        low:    parseFloat(v['3. low']),
        close:  parseFloat(v['4. close']),
        volume: parseFloat(v['5. volume'] ?? '0'),
      }))
      .reverse();
  }

  async getOrderBook(): Promise<OrderBook> {
    throw new CapabilityNotSupportedError('Alpha Vantage', 'orderBook');
  }

  async search(query: string): Promise<SearchResult[]> {
    const data = await fetchJSON<{ bestMatches: Record<string, string>[] }>({
      function: 'SYMBOL_SEARCH',
      keywords: query,
    });
    return (data.bestMatches ?? []).slice(0, 10).map(m => ({
      symbol:     m['1. symbol'],
      name:       m['2. name'],
      assetClass: (m['3. type']?.toLowerCase() === 'equity' ? 'stock' : 'crypto') as 'stock' | 'crypto',
      exchange:   m['4. region'],
    }));
  }

  async getMarketSummary(): Promise<MarketSummary> {
    // Alpha Vantage doesn't have a gainers/losers endpoint on free tier
    // Return empty — registry will fall back to another provider
    return { gainers: [], losers: [], trending: [], mostActive: [] };
  }

  subscribeToTicker(): () => void {
    return () => {};
  }
}
