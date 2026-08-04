/**
 * POST /api/admin/settings/rates
 * Body: Partial<ExchangeRates & TransferFees> — updates only the fields
 * provided.
 */
import type { Request, Response } from 'express';
import { readRatesConfig, writeRatesConfig, appendFeeHistory } from '../../../../lib/ratesStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { validNumber } from '../../../../lib/inputValidator.js';

const RATE_FIELDS = ['BTC_USD', 'ETH_USD', 'SOL_USD', 'BNB_USD', 'USDT_USD', 'EUR_USD', 'GBP_USD', 'JPY_USD', 'CHF_USD'] as const;
const FEE_FIELDS = ['flatFeeUSD', 'percentageFee', 'minFeeUSD', 'maxFeeUSD', 'withdrawalFlatFeeUSD', 'withdrawalPercentageFee'] as const;
const PERCENTAGE_FIELDS = new Set(['percentageFee', 'withdrawalPercentageFee']);

export default async function handler(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;
  const config = readRatesConfig();
  const oldValue = JSON.stringify({ rates: config.rates, fees: config.fees });

  let changed = 0;
  for (const key of RATE_FIELDS) {
    if (raw[key] === undefined) continue;
    // An exchange rate must be a positive, finite number — zero/negative
    // would make every conversion involving this currency nonsensical.
    const value = validNumber(raw[key], { min: 0.00000001 });
    if (value === null) return res.status(400).json({ ok: false, error: `${key} must be a positive number` });
    config.rates[key] = value;
    changed++;
  }
  for (const key of FEE_FIELDS) {
    if (raw[key] === undefined) continue;
    const value = validNumber(raw[key], { min: 0, max: PERCENTAGE_FIELDS.has(key) ? 100 : undefined });
    if (value === null) {
      return res.status(400).json({ ok: false, error: PERCENTAGE_FIELDS.has(key) ? `${key} must be a number between 0 and 100` : `${key} must be a non-negative number` });
    }
    config.fees[key] = value;
    changed++;
  }
  if (changed === 0) {
    return res.status(400).json({ ok: false, error: 'No valid rate/fee fields provided' });
  }

  config.rates.updatedAt = new Date().toISOString();
  config.fees.updatedAt = new Date().toISOString();
  writeRatesConfig(config);

  const adminId = req.adminSession?.adminId ?? 'admin';
  const adminEmail = req.adminSession?.email;
  const ip = req.ip ?? 'unknown';
  appendFeeHistory({ adminId, adminEmail, section: 'rates', field: 'rates_settings', oldValue, newValue: JSON.stringify({ rates: config.rates, fees: config.fees }), ip });
  appendAudit({ event: 'rates_settings_updated', adminId, email: adminEmail, ip, meta: { rates: config.rates, fees: config.fees } });

  return res.json({ ok: true, rates: config.rates, fees: config.fees });
}
