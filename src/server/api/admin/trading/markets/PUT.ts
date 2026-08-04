/**
 * PUT /api/admin/trading/markets
 * Body: { id?, symbol, name, assetClass, status?, spreadBps, minOrderSize,
 *         maxOrderSize, maxLeverage, tradingHours }
 * Create a new market (no id), or update an existing one (id given).
 * Use POST /api/admin/trading/markets/suspend to change status.
 */
import type { Request, Response } from 'express';
import { getMarket, upsertMarket, appendTradingLog, type MarketConfig, type AssetClass } from '../../../../lib/tradingAdminStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, isOneOf, validNumber } from '../../../../lib/inputValidator.js';
import { randomUUID } from 'node:crypto';

const ASSET_CLASSES = ['crypto', 'forex', 'stock', 'commodity', 'etf'] as const satisfies readonly AssetClass[];

export default async function handler(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;

  const symbol = sanitizeString(raw.symbol, 20);
  const name = sanitizeString(raw.name, 100);
  const assetClass = isOneOf(raw.assetClass, ASSET_CLASSES);
  if (!symbol || !name || !assetClass) {
    return res.status(400).json({ ok: false, error: 'symbol, name, and a valid assetClass are required' });
  }

  const id = typeof raw.id === 'string' && raw.id ? raw.id : randomUUID();
  const existing = getMarket(id);
  const now = new Date().toISOString();

  // spreadBps in basis points (10000 = 100%); maxLeverage capped at a sane
  // 500x — reject malformed/out-of-range input rather than silently
  // falling back to a default the admin didn't ask for.
  const spreadBps = raw.spreadBps === undefined ? (existing?.spreadBps ?? 5) : validNumber(raw.spreadBps, { min: 0, max: 10000 });
  const minOrderSize = raw.minOrderSize === undefined ? (existing?.minOrderSize ?? 0) : validNumber(raw.minOrderSize, { min: 0 });
  const maxOrderSize = raw.maxOrderSize === undefined ? (existing?.maxOrderSize ?? 0) : validNumber(raw.maxOrderSize, { min: 0 });
  const maxLeverage = raw.maxLeverage === undefined ? (existing?.maxLeverage ?? 1) : validNumber(raw.maxLeverage, { min: 1, max: 500 });

  if (spreadBps === null || minOrderSize === null || maxOrderSize === null || maxLeverage === null) {
    return res.status(400).json({ ok: false, error: 'spreadBps (0-10000), minOrderSize (>=0), maxOrderSize (>=0), and maxLeverage (1-500) must be valid numbers' });
  }
  if (maxOrderSize > 0 && maxOrderSize < minOrderSize) {
    return res.status(400).json({ ok: false, error: 'maxOrderSize must be >= minOrderSize' });
  }

  const market: MarketConfig = {
    id,
    symbol,
    name,
    assetClass,
    status: existing?.status ?? 'active',
    spreadBps,
    minOrderSize,
    maxOrderSize,
    maxLeverage,
    tradingHours: sanitizeString(raw.tradingHours, 100) || existing?.tradingHours || '24/7',
    suspendedAt: existing?.suspendedAt,
    suspendedBy: existing?.suspendedBy,
    suspendReason: existing?.suspendReason,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  upsertMarket(market);

  const adminId = req.adminSession?.adminId ?? 'admin';
  const adminEmail = req.adminSession?.email ?? '';
  const ip = req.ip ?? 'unknown';
  appendTradingLog({
    action: existing ? 'market_updated' : 'market_created',
    category: 'market', targetId: id, targetLabel: symbol,
    details: `${existing ? 'Updated' : 'Created'} market ${symbol}`,
    adminId, adminEmail, ip,
  });
  appendAudit({ event: existing ? 'trading_market_updated' : 'trading_market_created', adminId, email: adminEmail, ip, meta: { id, symbol, spreadBps, minOrderSize, maxOrderSize, maxLeverage } });

  return res.status(existing ? 200 : 201).json({ ok: true, market });
}
