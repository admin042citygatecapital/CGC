/**
 * POST /api/admin/rates/tx-fees
 * Update per-transaction-type fee rules.
 * Body: { txFees: Partial<TransactionTypeFees> }
 */
import type { Request, Response } from 'express';
import { readRatesConfig, applyRatesConfigChange, type PendingFeeHistoryEntry, type FeeRule } from '../../../../lib/ratesStore.js';

function validRule(value: unknown): value is Partial<FeeRule> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const allowed = new Set(['mode','flat','percentage','minFee','maxFee','enabled']);
  if (Object.keys(item).some(key => !allowed.has(key))) return false;
  if (item.mode !== undefined && item.mode !== 'flat' && item.mode !== 'percentage') return false;
  if (item.enabled !== undefined && typeof item.enabled !== 'boolean') return false;
  return ['flat','percentage','minFee','maxFee'].every(key => item[key] === undefined || (typeof item[key] === 'number' && Number.isFinite(item[key]) && item[key] >= 0 && item[key] <= 100_000));
}

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { txFees } = req.body ?? {};
  if (!txFees || typeof txFees !== 'object') {
    return res.status(400).json({ ok: false, error: 'txFees object required' });
  }
  const types = ['domestic_transfer', 'international_wire', 'crypto_send', 'currency_exchange'] as const;
  if (Object.keys(txFees).some(key => !types.includes(key as typeof types[number])) || Object.values(txFees).some(value => !validRule(value))) {
    return res.status(400).json({ ok: false, error: 'Invalid transaction fee configuration.' });
  }

  const config  = readRatesConfig();
  const prev    = config.txFees;
  const updated = { ...prev, updatedAt: new Date().toISOString() };
  for (const type of types) if (txFees[type]) updated[type] = { ...prev[type], ...txFees[type] };
  config.txFees = updated;

  // Log each changed fee type
  const history: PendingFeeHistoryEntry[] = [];
  for (const t of types) {
    if (txFees[t]) {
      history.push({
        adminId:    session.adminId,
        adminEmail: session.email,
        section:    'transfer_fees',
        field:      t,
        oldValue:   JSON.stringify(prev[t] ?? {}),
        newValue:   JSON.stringify(updated[t]),
        ip:         req.ip ?? 'unknown',
      });
    }
  }

  await applyRatesConfigChange(config, history, session.adminId);

  return res.json({ ok: true, txFees: updated });
}
