/**
 * POST /api/admin/rates/tier-fees
 * Update fee schedule per account tier.
 * Body: { tiers: TierFeeRule[] }
 */
import type { Request, Response } from 'express';
import { readRatesConfig, writeRatesConfig, appendFeeHistory } from '../../../../lib/ratesStore.js';
import type { TierFeeRule } from '../../../../lib/ratesStore.js';

export default function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { tiers } = req.body ?? {};
  if (!Array.isArray(tiers)) {
    return res.status(400).json({ ok: false, error: 'tiers array required' });
  }

  const config = readRatesConfig();
  const prev   = config.tierFees.tiers;

  const incoming = tiers as TierFeeRule[];
  const merged   = config.tierFees.tiers.map(existing => {
    const update = incoming.find(t => t.tier === existing.tier);
    return update ? { ...existing, ...update } : existing;
  });

  config.tierFees = { tiers: merged, updatedAt: new Date().toISOString() };
  writeRatesConfig(config);

  for (const t of incoming) {
    const old = prev.find(x => x.tier === t.tier);
    if (old) {
      appendFeeHistory({
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

  return res.json({ ok: true, tierFees: config.tierFees });
}
