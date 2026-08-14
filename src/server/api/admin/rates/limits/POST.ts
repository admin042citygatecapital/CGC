/**
 * POST /api/admin/rates/limits
 * Update withdrawal limits — tier defaults and/or per-user overrides.
 * Body: { tierLimits?: WithdrawalLimitRule[], userOverride?: { userId, dailyLimitUSD, monthlyLimitUSD, note? } }
 */
import type { Request, Response } from 'express';
import { readRatesConfig, applyRatesConfigChange, type PendingFeeHistoryEntry } from '../../../../lib/ratesStore.js';
import type { WithdrawalLimitRule } from '../../../../lib/ratesStore.js';
import { findUserById } from '../../../../lib/userStore.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { tierLimits, userOverride } = req.body ?? {};
  if (!Array.isArray(tierLimits) && (!userOverride || typeof userOverride !== 'object')) return res.status(400).json({ error: 'Provide tierLimits or userOverride.' });

  const config = readRatesConfig();
  const history: PendingFeeHistoryEntry[] = [];

  if (Array.isArray(tierLimits)) {
    if (tierLimits.length < 1 || tierLimits.length > 4 || tierLimits.some((item: unknown) => {
      if (!item || typeof item !== 'object') return true;
      const rule = item as Record<string, unknown>;
      return Object.keys(rule).some(key => !['tier','dailyLimitUSD','monthlyLimitUSD'].includes(key)) || !['default','personal','savings','business'].includes(String(rule.tier)) || ['dailyLimitUSD','monthlyLimitUSD'].some(key => typeof rule[key] !== 'number' || !Number.isFinite(rule[key]) || rule[key] < 0 || rule[key] > 100_000_000);
    })) return res.status(400).json({ error: 'Invalid withdrawal tier limits.' });
    const prev = config.limits.tierLimits;
    const incoming = tierLimits as WithdrawalLimitRule[];
    const merged = config.limits.tierLimits.map(existing => {
      const update = incoming.find(t => t.tier === existing.tier);
      return update ? { ...existing, ...update } : existing;
    });
    config.limits.tierLimits = merged;

    for (const t of incoming) {
      const old = prev.find(x => x.tier === t.tier);
      if (old && (old.dailyLimitUSD !== t.dailyLimitUSD || old.monthlyLimitUSD !== t.monthlyLimitUSD)) {
        history.push({
          adminId:    session.adminId,
          adminEmail: session.email,
          section:    'limits',
          field:      `tier:${t.tier}`,
          oldValue:   `daily=$${old.dailyLimitUSD} monthly=$${old.monthlyLimitUSD}`,
          newValue:   `daily=$${t.dailyLimitUSD} monthly=$${t.monthlyLimitUSD}`,
          ip:         req.ip ?? 'unknown',
        });
      }
    }
  }

  if (userOverride && typeof userOverride === 'object') {
    const { userId, dailyLimitUSD, monthlyLimitUSD, note } = userOverride as {
      userId: string; dailyLimitUSD: number; monthlyLimitUSD: number; note?: string;
    };
    if (Object.keys(userOverride).some(key => !['userId','dailyLimitUSD','monthlyLimitUSD','note'].includes(key))) return res.status(400).json({ error: 'Invalid user override fields.' });
    if (!userId) return res.status(400).json({ ok: false, error: 'userId required for userOverride' });
    if (![dailyLimitUSD, monthlyLimitUSD].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100_000_000)) return res.status(400).json({ error: 'Invalid user withdrawal limits.' });
    if (note !== undefined && (typeof note !== 'string' || note.length > 500)) return res.status(400).json({ error: 'Limit note is too long.' });

    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

    const prev = config.limits.userOverrides[userId];
    config.limits.userOverrides[userId] = {
      dailyLimitUSD:   Number(dailyLimitUSD)   || 0,
      monthlyLimitUSD: Number(monthlyLimitUSD) || 0,
      note:            note ?? '',
      updatedAt:       new Date().toISOString(),
    };

    history.push({
      adminId:    session.adminId,
      adminEmail: session.email,
      section:    'limits',
      field:      `user:${userId} (${user.name})`,
      oldValue:   prev ? `daily=$${prev.dailyLimitUSD} monthly=$${prev.monthlyLimitUSD}` : 'none',
      newValue:   `daily=$${dailyLimitUSD} monthly=$${monthlyLimitUSD}${note ? ` note=${note}` : ''}`,
      ip:         req.ip ?? 'unknown',
    });
  }

  config.limits.updatedAt = new Date().toISOString();
  await applyRatesConfigChange(config, history, session.adminId);

  return res.json({ ok: true, limits: config.limits });
}
