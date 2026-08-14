/**
 * POST /api/admin/rates/tier-fees
 * Update fee schedule per account tier.
 * Body: { tiers: TierFeeRule[] }
 */
import type { Request, Response } from 'express';
import { readRatesConfig, applyRatesConfigChange, type PendingFeeHistoryEntry } from '../../../../lib/ratesStore.js';
import type { TierFeeRule } from '../../../../lib/ratesStore.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { tiers } = req.body ?? {};
  if (!Array.isArray(tiers)) {
    return res.status(400).json({ ok: false, error: 'tiers array required' });
  }
  const allowedTierFields = new Set(['tier','label','transferFeeMode','transferFlat','transferPct','wireFeeMode','wireFlat','wirePct','cryptoFeeMode','cryptoFlat','cryptoPct','exchangeFeeMode','exchangeFlat','exchangePct','volumeDiscountPct','enabled']);
  const modeFields = ['transferFeeMode','wireFeeMode','cryptoFeeMode','exchangeFeeMode'];
  if (tiers.length < 1 || tiers.length > 3 || tiers.some((tier: unknown) => {
    if (!tier || typeof tier !== 'object') return true;
    const row = tier as Record<string, unknown>;
    return Object.keys(row).some(key => !allowedTierFields.has(key)) ||
      !['personal','savings','business'].includes(String(row.tier)) ||
      modeFields.some(key => row[key] !== undefined && row[key] !== 'flat' && row[key] !== 'percentage') ||
      (row.enabled !== undefined && typeof row.enabled !== 'boolean') ||
      (row.label !== undefined && (typeof row.label !== 'string' || row.label.length < 1 || row.label.length > 50)) ||
      Object.values(row).some(value => typeof value === 'number' && (!Number.isFinite(value) || value < 0 || value > 100_000));
  })) return res.status(400).json({ ok: false, error: 'Invalid tier fee configuration.' });

  const config = readRatesConfig();
  const prev   = config.tierFees.tiers;

  const incoming = tiers as TierFeeRule[];
  const merged   = config.tierFees.tiers.map(existing => {
    const update = incoming.find(t => t.tier === existing.tier);
    return update ? { ...existing, ...update } : existing;
  });

  config.tierFees = { tiers: merged, updatedAt: new Date().toISOString() };
  const history: PendingFeeHistoryEntry[] = [];
  for (const t of incoming) {
    const old = prev.find(x => x.tier === t.tier);
    if (old) {
      history.push({
        adminId:    session.adminId,
        adminEmail: session.email,
        section:    'tier_fees',
        field:      t.tier,
        oldValue:   JSON.stringify(old),
        newValue:   JSON.stringify(t),
        ip:         req.ip ?? 'unknown',
      });
    }
  }

  await applyRatesConfigChange(config, history, session.adminId);

  return res.json({ ok: true, tierFees: config.tierFees });
}
