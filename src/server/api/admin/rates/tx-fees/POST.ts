/**
 * POST /api/admin/rates/tx-fees
 * Update per-transaction-type fee rules.
 * Body: { txFees: Partial<TransactionTypeFees> }
 */
import type { Request, Response } from 'express';
import { readRatesConfig, writeRatesConfig, appendFeeHistory } from '../../../../lib/ratesStore.js';

export default function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { txFees } = req.body ?? {};
  if (!txFees || typeof txFees !== 'object') {
    return res.status(400).json({ ok: false, error: 'txFees object required' });
  }

  const config  = readRatesConfig();
  const prev    = config.txFees;
  const updated = { ...prev, ...txFees, updatedAt: new Date().toISOString() };
  config.txFees = updated;
  writeRatesConfig(config);

  // Log each changed fee type
  const types = ['domestic_transfer', 'international_wire', 'crypto_send', 'currency_exchange'] as const;
  for (const t of types) {
    if (txFees[t]) {
      appendFeeHistory({
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

  return res.json({ ok: true, txFees: updated });
}
