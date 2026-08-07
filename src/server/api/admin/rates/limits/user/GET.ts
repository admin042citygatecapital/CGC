/**
 * GET /api/admin/rates/limits/user?userId=xxx
 * Returns withdrawal limit info for a specific user.
 *
 * GET /api/admin/rates/limits/user?summary=1
 * Returns aggregated withdrawal usage per tier (for the Withdrawal Limits admin panel).
 */
import type { Request, Response } from 'express';
import { readRatesConfig, getWithdrawalUsage } from '../../../../../lib/ratesStore.js';
import { findUserById, loadAllUsers } from '../../../../../lib/userStore.js';

export default async function handler(req: Request, res: Response) {
  // ── Summary mode: aggregate usage per tier ──────────────────────────────
  if (req.query.summary === '1') {
    const config = readRatesConfig();
    const users  = await loadAllUsers();

    // Build a map: tier → { todayUSD, monthUSD, userCount }
    const tierMap: Record<string, { todayUSD: number; monthUSD: number; userCount: number }> = {};

    for (const user of users) {
      const tier = user.accountTier ?? 'personal';
      if (!tierMap[tier]) tierMap[tier] = { todayUSD: 0, monthUSD: 0, userCount: 0 };
      const usage = getWithdrawalUsage(user.id);
      tierMap[tier].todayUSD  += usage.todayUSD;
      tierMap[tier].monthUSD  += usage.monthUSD;
      tierMap[tier].userCount += 1;
    }

    // Also include tiers that have limit rules but no users yet
    for (const rule of config.limits.tierLimits) {
      if (!tierMap[rule.tier]) tierMap[rule.tier] = { todayUSD: 0, monthUSD: 0, userCount: 0 };
    }

    const tierUsage = Object.entries(tierMap).map(([tier, data]) => ({
      tier,
      todayUSD:  Math.round(data.todayUSD  * 100) / 100,
      monthUSD:  Math.round(data.monthUSD  * 100) / 100,
      userCount: data.userCount,
    }));

    return res.json({ ok: true, tierUsage });
  }

  // ── Per-user mode ────────────────────────────────────────────────────────
  const userId = String(req.query.userId ?? '').trim();
  if (!userId) return res.status(400).json({ ok: false, error: 'userId or summary=1 query param required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  const config = readRatesConfig();

  // Determine effective limit: user override > tier > default
  const override = config.limits.userOverrides[userId];
  const tier     = user.accountTier ?? 'personal';
  const tierRule = config.limits.tierLimits.find(t => t.tier === tier)
                ?? config.limits.tierLimits.find(t => t.tier === 'default')
                ?? { dailyLimitUSD: 10_000, monthlyLimitUSD: 50_000 };

  const effectiveDaily   = override ? override.dailyLimitUSD   : tierRule.dailyLimitUSD;
  const effectiveMonthly = override ? override.monthlyLimitUSD : tierRule.monthlyLimitUSD;

  const { todayUSD, monthUSD } = getWithdrawalUsage(userId);

  return res.json({
    ok: true,
    userId,
    userName:         user.name,
    userEmail:        user.email,
    tier,
    hasOverride:      !!override,
    overrideNote:     override?.note ?? '',
    effectiveDaily,
    effectiveMonthly,
    usedToday:        Math.round(todayUSD * 100) / 100,
    usedMonth:        Math.round(monthUSD * 100) / 100,
    remainingToday:   effectiveDaily   === 0 ? null : Math.max(0, effectiveDaily   - todayUSD),
    remainingMonth:   effectiveMonthly === 0 ? null : Math.max(0, effectiveMonthly - monthUSD),
  });
}
