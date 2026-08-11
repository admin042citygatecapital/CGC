import type { Request, Response } from 'express';
import { getProviders } from '../../../../lib/tradingAdminStore.js';
import { getSecret } from '#runtime/secrets';
import { isPreviewMode } from '../../../../lib/platformMode.js';

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
      if (isPreviewMode) return {
        ...p,
        status: 'disabled' as const,
        apiKeySet,
        lastChecked: '',
        latencyMs: null,
        errorRate: 0,
        uptime24h: 0,
        notes: 'Provider planning record only; no live adapter or health monitor is connected.',
      };
      return { ...p, apiKeySet };
    });

    res.json({ providers: enriched, dataClassification: isPreviewMode ? 'provider_planning_records' : 'provider_configuration' });
  } catch (err) {
    console.error('[admin/trading/providers GET]', err);
    res.status(500).json({ error: 'Failed to load providers' });
  }
};
