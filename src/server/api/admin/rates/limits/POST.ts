/**
 * POST /api/admin/rates/limits
 * Body: { tierLimits?: WithdrawalLimitRule[],
 *         userOverride?: { userId, dailyLimitUSD, monthlyLimitUSD, note? } }
 * Set tier-wide limits and/or a single per-user override in one call.
 */
import type { Request, Response } from 'express';
import { readRatesConfig, writeRatesConfig, appendFeeHistory, type WithdrawalLimitRule } from '../../../../lib/ratesStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

const TIERS = ['default', 'personal', 'savings', 'business'];

export default async function handler(req: Request, res: Response) {
  const raw = req.body as { tierLimits?: unknown; userOverride?: Record<string, unknown> };
  const config = readRatesConfig();
  const oldValue = JSON.stringify(config.limits);
  const adminId = req.adminSession?.adminId ?? 'admin';
  const adminEmail = req.adminSession?.email;
  const ip = req.ip ?? 'unknown';

  if (Array.isArray(raw.tierLimits)) {
    const safeTiers: WithdrawalLimitRule[] = [];
    for (const t of raw.tierLimits) {
      if (!t || typeof t !== 'object') continue;
      const r = t as Record<string, unknown>;
      const tier = TIERS.includes(String(r.tier)) ? (r.tier as WithdrawalLimitRule['tier']) : null;
      if (!tier || typeof r.dailyLimitUSD !== 'number' || typeof r.monthlyLimitUSD !== 'number') continue;
      safeTiers.push({ tier, dailyLimitUSD: r.dailyLimitUSD, monthlyLimitUSD: r.monthlyLimitUSD });
    }
    if (safeTiers.length > 0) config.limits.tierLimits = safeTiers;
  }

  if (raw.userOverride && typeof raw.userOverride === 'object') {
    const o = raw.userOverride;
    const userId = typeof o.userId === 'string' ? o.userId : '';
    if (userId && typeof o.dailyLimitUSD === 'number' && typeof o.monthlyLimitUSD === 'number') {
      config.limits.userOverrides[userId] = {
        dailyLimitUSD: o.dailyLimitUSD,
        monthlyLimitUSD: o.monthlyLimitUSD,
        note: sanitizeString(o.note, 500) || undefined,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  config.limits.updatedAt = new Date().toISOString();
  writeRatesConfig(config);

  appendFeeHistory({ adminId, adminEmail, section: 'limits', field: 'withdrawal_limits', oldValue, newValue: JSON.stringify(config.limits), ip });
  appendAudit({ event: 'rates_withdrawal_limits_updated', adminId, email: adminEmail, ip, meta: { tierLimits: config.limits.tierLimits } });

  return res.json({ ok: true, limits: config.limits });
}
