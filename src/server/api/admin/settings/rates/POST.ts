/**
 * POST /api/admin/settings/rates
 * Admin updates exchange rates and/or legacy transfer fees.
 * Body: { rates?: Partial<ExchangeRates>, fees?: Partial<TransferFees> }
 * Also logs changes to the fee history log.
 */
import type { Request, Response } from 'express';
import { readRatesConfig, writeRatesConfig, appendFeeHistory } from '../../../../lib/ratesStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { rates, fees } = req.body ?? {};

  const current = readRatesConfig();

  const updated = {
    ...current,
    rates: rates ? { ...current.rates, ...rates, updatedAt: new Date().toISOString() } : current.rates,
    fees:  fees  ? { ...current.fees,  ...fees,  updatedAt: new Date().toISOString() } : current.fees,
  };

  writeRatesConfig(updated);

  // Log rate changes
  if (rates) {
    for (const [key, val] of Object.entries(rates)) {
      if (key === 'updatedAt') continue;
      const old = (current.rates as unknown as Record<string, unknown>)[key];
      if (old !== val) {
        appendFeeHistory({
          adminId:    session.adminId,
          adminEmail: session.email,
          section:    'rates',
          field:      key,
          oldValue:   String(old ?? ''),
          newValue:   String(val),
          ip:         req.ip ?? 'unknown',
        });
      }
    }
  }

  // Log fee changes
  if (fees) {
    for (const [key, val] of Object.entries(fees)) {
      if (key === 'updatedAt') continue;
      const old = (current.fees as unknown as Record<string, unknown>)[key];
      if (old !== val) {
        appendFeeHistory({
          adminId:    session.adminId,
          adminEmail: session.email,
          section:    'transfer_fees',
          field:      key,
          oldValue:   String(old ?? ''),
          newValue:   String(val),
          ip:         req.ip ?? 'unknown',
        });
      }
    }
  }

  appendAudit({
    event:   'admin_rates_updated',
    adminId: session.adminId,
    ip:      req.ip ?? 'unknown',
    meta:    { rates: !!rates, fees: !!fees },
  });

  return res.json({ ok: true, config: updated });
}
