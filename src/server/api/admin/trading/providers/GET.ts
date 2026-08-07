import type { Request, Response } from 'express';
import { getProviders } from '../../../../lib/tradingAdminStore.js';
import { getSecret } from '#airo/secrets';

export default async (_req: Request, res: Response) => {
  try {
    const providers = getProviders();

    // Reflect actual API key state from secrets
    const keyMap: Record<string, string> = {
      'Alpha Vantage': 'ALPHA_VANTAGE_KEY',
      'Finnhub':       'FINNHUB_KEY',
      'Polygon.io':    'POLYGON_KEY',
      'Twelve Data':   'TWELVE_DATA_KEY',
    };

    const enriched = providers.map(p => {
      const secretKey = keyMap[p.name];
      const apiKeySet = secretKey ? Boolean(String(getSecret(secretKey) ?? '').trim()) : p.apiKeySet;
      return { ...p, apiKeySet };
    });

    res.json({ providers: enriched });
  } catch (err) {
    console.error('[admin/trading/providers GET]', err);
    res.status(500).json({ error: 'Failed to load providers' });
  }
};
