/**
 * POST /api/admin/rates/tx-fees
 * Body: Partial<{ domestic_transfer, international_wire, crypto_send,
 *                  currency_exchange }> — each a FeeRule
 *       { mode, flat, percentage, minFee, maxFee, enabled }
 */
import type { Request, Response } from 'express';
import { readRatesConfig, writeRatesConfig, appendFeeHistory, type FeeRule } from '../../../../lib/ratesStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

const KEYS = ['domestic_transfer', 'international_wire', 'crypto_send', 'currency_exchange'] as const;

function isFeeRule(v: unknown): v is FeeRule {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  const nonNeg = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  if (!(r.mode === 'flat' || r.mode === 'percentage')) return false;
  if (!nonNeg(r.flat) || !nonNeg(r.minFee) || !nonNeg(r.maxFee)) return false;
  if (typeof r.percentage !== 'number' || !Number.isFinite(r.percentage) || r.percentage < 0 || r.percentage > 100) return false;
  if (typeof r.enabled !== 'boolean') return false;
  if ((r.maxFee as number) > 0 && (r.maxFee as number) < (r.minFee as number)) return false;
  return true;
}

export default async function handler(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;
  const config = readRatesConfig();
  const oldValue = JSON.stringify(config.txFees);

  let changed = 0;
  for (const key of KEYS) {
    if (isFeeRule(raw[key])) {
      config.txFees[key] = raw[key] as FeeRule;
      changed += 1;
    }
  }
  if (changed === 0) {
    return res.status(400).json({ ok: false, error: `Provide at least one valid FeeRule for: ${KEYS.join(', ')}` });
  }
  config.txFees.updatedAt = new Date().toISOString();
  writeRatesConfig(config);

  const adminId = req.adminSession?.adminId ?? 'admin';
  const adminEmail = req.adminSession?.email;
  const ip = req.ip ?? 'unknown';
  const changedFields = KEYS.filter(k => raw[k] !== undefined);
  appendFeeHistory({ adminId, adminEmail, section: 'tx_fees', field: changedFields.join(','), oldValue, newValue: JSON.stringify(config.txFees), ip });
  appendAudit({ event: 'rates_tx_fees_updated', adminId, email: adminEmail, ip, meta: { fields: changedFields } });

  return res.json({ ok: true, txFees: config.txFees });
}
