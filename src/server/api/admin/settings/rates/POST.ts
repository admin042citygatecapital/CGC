/**
 * POST /api/admin/settings/rates
 * Admin updates exchange rates and/or legacy transfer fees.
 * Body: { rates?: Partial<ExchangeRates>, fees?: Partial<TransferFees> }
 * Also logs changes to the fee history log.
 */
import type { Request, Response } from 'express';
import { readRatesConfig, applyRatesConfigChange, type PendingFeeHistoryEntry } from '../../../../lib/ratesStore.js';
import { appendCriticalAudit } from '../../../../lib/auditLog.js';

const RATE_KEYS = new Set(['BTC_USD','ETH_USD','SOL_USD','BNB_USD','USDT_USD','EUR_USD','GBP_USD','JPY_USD','CHF_USD','CAD_USD','AUD_USD','SGD_USD','AED_USD','NGN_USD']);
const FEE_KEYS = new Set(['flatFeeUSD','percentageFee','minFeeUSD','maxFeeUSD','withdrawalFlatFeeUSD','withdrawalPercentageFee']);

function validNumbers(value: unknown, allowed: Set<string>, max: number): value is Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.length > 0 && entries.every(([key, item]) => allowed.has(key) && typeof item === 'number' && Number.isFinite(item) && item >= 0 && item <= max);
}

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { rates, fees } = req.body ?? {};
  if (rates !== undefined && !validNumbers(rates, RATE_KEYS, 10_000_000)) return res.status(400).json({ error: 'Invalid rates payload.' });
  if (fees !== undefined && !validNumbers(fees, FEE_KEYS, 100_000)) return res.status(400).json({ error: 'Invalid fees payload.' });
  if (rates === undefined && fees === undefined) return res.status(400).json({ error: 'Provide rates or fees.' });

  const current = readRatesConfig();

  const updated = {
    ...current,
    rates: rates ? { ...current.rates, ...rates, updatedAt: new Date().toISOString() } : current.rates,
    fees:  fees  ? { ...current.fees,  ...fees,  updatedAt: new Date().toISOString() } : current.fees,
  };

  const history: PendingFeeHistoryEntry[] = [];

  // Log rate changes
  if (rates) {
    for (const [key, val] of Object.entries(rates)) {
      if (key === 'updatedAt') continue;
      const old = (current.rates as unknown as Record<string, unknown>)[key];
      if (old !== val) {
        history.push({
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
        history.push({
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

  await appendCriticalAudit({
    event:   'admin_rates_updated',
    adminId: session.adminId,
    ip:      req.ip ?? 'unknown',
    meta:    { rates: !!rates, fees: !!fees },
  });

  const saved = await applyRatesConfigChange(updated, history, session.adminId);

  return res.json({ ok: true, config: saved });
}
