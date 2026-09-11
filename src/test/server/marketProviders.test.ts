import { describe, expect, it, vi } from 'vitest';
import { MarketDataRegistry } from '../../server/lib/market/registry.js';
import { CoinbaseProvider, toCoinbaseProductId } from '../../server/lib/market/providers/coinbase.js';
import { KrakenProvider } from '../../server/lib/market/providers/kraken.js';
import { parseRestTicker } from '../../lib/useMarketWebSocket.js';
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
  it('converts supported symbols to Coinbase product IDs and refuses USDT pairs', () => {
    // Coinbase Advanced Trade quotes USD only — a USDT request would silently
    // receive USD-quoted data, so the adapter refuses it and the registry
    // falls back to a provider that genuinely quotes USDT.
    expect(toCoinbaseProductId('BTCUSD')).toBe('BTC-USD');
    expect(toCoinbaseProductId('ETHUSD')).toBe('ETH-USD');
    expect(toCoinbaseProductId('SOL/USD')).toBe('SOL-USD');
    expect(() => toCoinbaseProductId('BTCUSDT')).toThrow(/USDT/);
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

  it('requests Coinbase with the corrected product ID and no fabricated statistics', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      trades: [{ price: '64000' }],
      best_bid_size: '2',
    }), { status: 200 }));

    const tickers = await new CoinbaseProvider().getTicker(['BTCUSD']);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/BTC-USD/ticker'),
      expect.any(Object),
    );
    expect(tickers).toHaveLength(1);
    expect(tickers[0].price).toBe(64000);
    // The ticker endpoint exposes no 24h statistics: best-bid size must not
    // pose as volume and the last price must not pose as high/low/open.
    expect(tickers[0].volume24h).toBeNull();
    expect(tickers[0].high24h).toBeNull();
    expect(tickers[0].changePct24h).toBeNull();
    fetchMock.mockRestore();
  });

  it('refuses candle intervals the providers do not actually offer', async () => {
    await expect(new CoinbaseProvider().getCandles('BTCUSD', '3m')).rejects.toThrow(/3m/);
    await expect(new CoinbaseProvider().getCandles('BTCUSD', '1M')).rejects.toThrow(/1M/);
    await expect(new KrakenProvider().getCandles('BTCUSDT', '2h')).rejects.toThrow(/2h/);
    await expect(new KrakenProvider().getCandles('BTCUSDT', '1M')).rejects.toThrow(/1M/);
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

  it('normalizes Kraken XDG responses to the platform DOGE symbol', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: [],
      result: {
        XDGUSDT: {
          c: ['0.12'], o: '0.10', h: ['0.13', '0.14'],
          l: ['0.09', '0.08'], v: ['100', '200'],
        },
      },
    }), { status: 200 }));

    const [ticker] = await new KrakenProvider().getTicker(['DOGEUSDT']);

    expect(ticker.symbol).toBe('DOGEUSDT');
    expect(ticker.name).toBe('DOGEUSDT');
    fetchMock.mockRestore();
  });

  it('uses the percentage move for the customer-facing REST ticker', () => {
    const ticker = parseRestTicker({
      symbol: 'BTCUSDT',
      price: 79_000,
      change24h: 427.3,
      changePct24h: 0.54,
    });

    expect(ticker?.change24h).toBe(0.54);
    expect(ticker?.changeStr).toBe('+0.54%');
  });
});
