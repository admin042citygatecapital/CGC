/**
 * POST /api/admin/trading/fees
 * Body: { action: 'delete', id } to remove a tier, otherwise
 * { id?, name, assetClass, makerFeeRate, takerFeeRate, minVolume30d,
 *   maxVolume30d, isDefault } to create (no id) or update (id given) a tier.
 */
import type { Request, Response } from 'express';
import { getFees, upsertFee, deleteFee, appendTradingLog, type FeeTier } from '../../../../lib/tradingAdminStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, isOneOf, validNumber } from '../../../../lib/inputValidator.js';
import { randomUUID } from 'node:crypto';

const ASSET_CLASSES = ['crypto', 'forex', 'stock', 'commodity', 'etf', 'all'] as const;

export default async function handler(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;
  const adminId = req.adminSession?.adminId ?? 'admin';
  const adminEmail = req.adminSession?.email ?? '';
  const ip = req.ip ?? 'unknown';

  if (raw.action === 'delete') {
    const id = typeof raw.id === 'string' ? raw.id : '';
    if (!id) return res.status(400).json({ ok: false, error: 'id is required to delete a fee tier' });
    const ok = deleteFee(id);
    if (!ok) return res.status(404).json({ ok: false, error: 'Fee tier not found' });

    appendTradingLog({ action: 'fee_tier_deleted', category: 'fee', targetId: id, details: `Deleted fee tier ${id}`, adminId, adminEmail, ip });
    appendAudit({ event: 'trading_fee_tier_deleted', adminId, email: adminEmail, ip, meta: { id } });
    return res.json({ ok: true });
  }

  const name = sanitizeString(raw.name, 100);
  const assetClass = isOneOf(raw.assetClass, ASSET_CLASSES);
  if (!name || !assetClass) {
    return res.status(400).json({ ok: false, error: 'name and a valid assetClass are required' });
  }
  const makerFeeRate = raw.makerFeeRate === undefined ? 0 : validNumber(raw.makerFeeRate, { min: 0, max: 100 });
  const takerFeeRate = raw.takerFeeRate === undefined ? 0 : validNumber(raw.takerFeeRate, { min: 0, max: 100 });
  if (makerFeeRate === null || takerFeeRate === null) {
    return res.status(400).json({ ok: false, error: 'makerFeeRate and takerFeeRate must be numbers between 0 and 100' });
  }
  const minVolume30d = raw.minVolume30d === undefined ? 0 : validNumber(raw.minVolume30d, { min: 0 });
  if (minVolume30d === null) {
    return res.status(400).json({ ok: false, error: 'minVolume30d must be a non-negative number' });
  }
  let maxVolume30d: number | null = null;
  if (raw.maxVolume30d !== undefined && raw.maxVolume30d !== null) {
    maxVolume30d = validNumber(raw.maxVolume30d, { min: minVolume30d });
    if (maxVolume30d === null) {
      return res.status(400).json({ ok: false, error: 'maxVolume30d must be a number >= minVolume30d' });
    }
  }
  const isDefault = raw.isDefault === true;

  const now = new Date().toISOString();
  const id = typeof raw.id === 'string' && raw.id ? raw.id : randomUUID();
  const existing = getFees().find(f => f.id === id);

  const tier: FeeTier = {
    id, name, assetClass, makerFeeRate, takerFeeRate, minVolume30d, maxVolume30d, isDefault,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  upsertFee(tier);

  appendTradingLog({
    action: existing ? 'fee_tier_updated' : 'fee_tier_created',
    category: 'fee', targetId: id, targetLabel: name,
    details: `${existing ? 'Updated' : 'Created'} fee tier "${name}"`,
    adminId, adminEmail, ip,
  });
  appendAudit({ event: existing ? 'trading_fee_tier_updated' : 'trading_fee_tier_created', adminId, email: adminEmail, ip, meta: { id, name, makerFeeRate, takerFeeRate } });

  return res.status(existing ? 200 : 201).json({ ok: true, tier });
}
