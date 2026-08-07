import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import {
  getMarketData, getCandles, getLivePrice, get24hChange, get24hVolume,
} from '../../../../lib/tradingStore.js';

export default async (req: Request, res: Response) => {
  try {
    const auth  = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const user = await findUserBySessionToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

    const { symbol, candles, periods, interval } = req.query as {
      assetClass?: string; symbol?: string; candles?: string;
      periods?: string; interval?: string;
    };

    if (symbol) {
      const price      = getLivePrice(symbol);
      const change24h  = get24hChange(symbol);
      const volume24h  = get24hVolume(symbol);
      const candleData = candles === 'true'
        ? getCandles(symbol, parseInt(periods ?? '60', 10), parseInt(interval ?? '60', 10))
        : undefined;
      return res.json({ symbol, price, change24h, volume24h, candles: candleData });
    }

    const data = getMarketData();
    res.json({ markets: data });
  } catch (err) {
    console.error('[trading/market-data]', err);
    res.status(500).json({ error: 'Failed to load market data' });
  }
};
