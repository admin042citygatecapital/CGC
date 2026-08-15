import { describe, expect, it, vi } from 'vitest';
import { MarketDataRegistry } from '../../server/lib/market/registry.js';
import { CoinbaseProvider, toCoinbaseProductId } from '../../server/lib/market/providers/coinbase.js';
import { KrakenProvider } from '../../server/lib/market/providers/kraken.js';
import type { MarketDataProvider, ProviderCapabilities, Ticker } from '../../server/lib/market/types.js';

const tickerCapabilities: ProviderCapabilities = {
  ticker: true,
  candles: false,
  orderBook: false,
  search: false,
  marketSummary: false,
  webSocket: false,
};

function fakeProvider(id: string, tickers: Ticker[]): MarketDataProvider {
  return {
    id,
    name: id,
    capabilities: tickerCapabilities,
    getTicker: vi.fn().mockResolvedValue(tickers),
    getCandles: vi.fn().mockRejectedValue(new Error('unsupported')),
    getOrderBook: vi.fn().mockRejectedValue(new Error('unsupported')),
    search: vi.fn().mockResolvedValue([]),
    getMarketSummary: vi.fn().mockRejectedValue(new Error('unsupported')),
    subscribeToTicker: vi.fn().mockReturnValue(() => {}),
  };
}

describe('market provider fallbacks', () => {
  it('converts common symbols to valid Coinbase product IDs', () => {
    expect(toCoinbaseProductId('BTCUSDT')).toBe('BTC-USD');
    expect(toCoinbaseProductId('ETHUSD')).toBe('ETH-USD');
    expect(toCoinbaseProductId('SOL/USD')).toBe('SOL-USD');
  });

  it('falls back when a provider returns an empty ticker response', async () => {
    const registry = new MarketDataRegistry();
    const expected: Ticker = {
      symbol: 'BTCUSDT',
      name: 'BTCUSDT',
      assetClass: 'crypto',
      price: 1,
      change24h: 0,
      changePct24h: 0,
      volume24h: 0,
      high24h: 1,
      low24h: 1,
      open24h: 1,
      currency: 'USD',
      timestamp: 1,
      provider: 'kraken',
    };

    registry.register(fakeProvider('binance', []));
    registry.register(fakeProvider('kraken', [expected]));

    await expect(registry.getTicker(['BTCUSDT'], 'crypto')).resolves.toEqual([expected]);
    expect(registry.getStatus().find(provider => provider.id === 'binance')?.available).toBe(false);
  });

  it('requests Coinbase with the corrected product ID', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      trades: [{ price: '64000' }],
      best_bid_size: '2',
    }), { status: 200 }));

    const tickers = await new CoinbaseProvider().getTicker(['BTCUSDT']);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/BTC-USD/ticker'),
      expect.any(Object),
    );
    expect(tickers).toHaveLength(1);
    fetchMock.mockRestore();
  });

  it('normalizes Kraken XBT responses to the platform BTC symbol', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: [],
      result: {
        XBTUSDT: {
          c: ['63158.81'], o: '62882.00', h: ['63300', '63400'],
          l: ['62500', '62400'], v: ['100', '200'],
        },
      },
    }), { status: 200 }));

    const [ticker] = await new KrakenProvider().getTicker(['BTCUSDT']);

    expect(ticker.symbol).toBe('BTCUSDT');
    expect(ticker.name).toBe('BTCUSDT');
    fetchMock.mockRestore();
  });
});
