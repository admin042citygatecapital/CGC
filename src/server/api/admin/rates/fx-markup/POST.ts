/**
 * POST /api/admin/rates/fx-markup
 * Update FX markup percentages per currency pair.
 * Body: { pairs: FxMarkup[] }
 */
import type { Request, Response } from 'express';
import { readRatesConfig, writeRatesConfig, appendFeeHistory } from '../../../../lib/ratesStore.js';
import type { FxMarkup } from '../../../../lib/ratesStore.js';

export default function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { pairs } = req.body ?? {};
  if (!Array.isArray(pairs)) {
    return res.status(400).json({ ok: false, error: 'pairs array required' });
  }

  const config = readRatesConfig();
  const prev   = config.fxMarkups.pairs;

  // Merge: update existing pairs, keep any not in the incoming list
  const incoming = pairs as FxMarkup[];
  const merged   = config.fxMarkups.pairs.map(existing => {
    const update = incoming.find(p => p.pair === existing.pair);
    return update ? { ...existing, ...update } : existing;
  });
  // Add any new pairs not already in the list
  for (const p of incoming) {
    if (!merged.find(m => m.pair === p.pair)) merged.push(p);
  }

  config.fxMarkups = { pairs: merged, updatedAt: new Date().toISOString() };
  writeRatesConfig(config);

  // Log changes
  for (const p of incoming) {
    const old = prev.find(x => x.pair === p.pair);
    if (old && (old.markup !== p.markup || old.enabled !== p.enabled)) {
      appendFeeHistory({
        adminId:    session.adminId,
        adminEmail: session.email,
        section:    'fx_markup',
        field:      p.pair,
        oldValue:   `markup=${old.markup}% enabled=${old.enabled}`,
        newValue:   `markup=${p.markup}% enabled=${p.enabled}`,
        ip:         req.ip ?? 'unknown',
      });
    }
  }

  return res.json({ ok: true, fxMarkups: config.fxMarkups });
}
