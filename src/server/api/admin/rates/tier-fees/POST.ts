/**
 * POST /api/admin/rates/tier-fees
 * Body: { tiers: TierFeeRule[] }
 */
import type { Request, Response } from 'express';
import { readRatesConfig, writeRatesConfig, appendFeeHistory, type TierFeeRule, type AccountTier } from '../../../../lib/ratesStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

const ACCOUNT_TIERS: readonly AccountTier[] = ['personal', 'savings', 'business'];

function isTierFeeRule(v: unknown): v is TierFeeRule {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  const feeMode = (m: unknown) => m === 'flat' || m === 'percentage';
  const num = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  return typeof r.tier === 'string' && (ACCOUNT_TIERS as readonly string[]).includes(r.tier)
    && typeof r.label === 'string'
    && feeMode(r.transferFeeMode) && num(r.transferFlat) && num(r.transferPct)
    && feeMode(r.wireFeeMode) && num(r.wireFlat) && num(r.wirePct)
    && feeMode(r.cryptoFeeMode) && num(r.cryptoFlat) && num(r.cryptoPct)
    && feeMode(r.exchangeFeeMode) && num(r.exchangeFlat) && num(r.exchangePct)
    && num(r.volumeDiscountPct) && (r.volumeDiscountPct as number) <= 100
    && typeof r.enabled === 'boolean';
}

export default async function handler(req: Request, res: Response) {
  const { tiers } = req.body as { tiers?: unknown };
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return res.status(400).json({ ok: false, error: 'tiers must be a non-empty array' });
  }
  if (!tiers.every(isTierFeeRule)) {
    return res.status(400).json({ ok: false, error: 'Every tier must be a valid TierFeeRule (non-negative fee amounts/percentages, valid tier name, boolean enabled)' });
  }

  const config = readRatesConfig();
  const oldValue = JSON.stringify(config.tierFees.tiers);
  config.tierFees = { tiers, updatedAt: new Date().toISOString() };
  writeRatesConfig(config);

  const adminId = req.adminSession?.adminId ?? 'admin';
  const adminEmail = req.adminSession?.email;
  const ip = req.ip ?? 'unknown';
  appendFeeHistory({ adminId, adminEmail, section: 'tier_fees', field: 'tiers', oldValue, newValue: JSON.stringify(config.tierFees.tiers), ip });
  appendAudit({ event: 'rates_tier_fees_updated', adminId, email: adminEmail, ip, meta: { tiers: config.tierFees.tiers.map(t => t.tier) } });

  return res.json({ ok: true, tierFees: config.tierFees });
}
