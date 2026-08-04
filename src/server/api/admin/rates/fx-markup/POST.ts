/**
 * POST /api/admin/rates/fx-markup
 * Body: { pairs: Array<{ pair: string, markup: number, enabled: boolean }> }
 */
import type { Request, Response } from 'express';
import { readRatesConfig, writeRatesConfig, appendFeeHistory, type FxMarkup } from '../../../../lib/ratesStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const { pairs } = req.body as { pairs?: unknown };
  if (!Array.isArray(pairs)) return res.status(400).json({ ok: false, error: 'pairs must be an array' });

  const config = readRatesConfig();
  const safePairs: FxMarkup[] = [];
  for (const p of pairs) {
    if (!p || typeof p !== 'object') continue;
    const r = p as Record<string, unknown>;
    const pair = sanitizeString(r.pair, 20);
    const markup = typeof r.markup === 'number' ? r.markup : NaN;
    if (!pair || !Number.isFinite(markup)) continue;
    safePairs.push({ pair, markup, enabled: r.enabled !== false });
  }

  const oldValue = JSON.stringify(config.fxMarkups.pairs);
  config.fxMarkups = { pairs: safePairs, updatedAt: new Date().toISOString() };
  writeRatesConfig(config);

  const adminId = req.adminSession?.adminId ?? 'admin';
  const adminEmail = req.adminSession?.email;
  const ip = req.ip ?? 'unknown';
  appendFeeHistory({ adminId, adminEmail, section: 'fx_markup', field: 'pairs', oldValue, newValue: JSON.stringify(safePairs), ip });
  appendAudit({ event: 'rates_fx_markup_updated', adminId, email: adminEmail, ip, meta: { pairs: safePairs } });

  return res.json({ ok: true, fxMarkups: config.fxMarkups });
}
