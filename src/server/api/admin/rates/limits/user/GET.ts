/**
 * GET /api/admin/rates/limits/user
 * Query: userId
 * Returns the effective withdrawal limits for one user (override if set,
 * else their tier's limit) plus current usage (best-effort — see
 * ratesStore.getWithdrawalUsage's own comment on flat-file-only accuracy).
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../../lib/userStore.js';
import { readRatesConfig, getWithdrawalUsage } from '../../../../../lib/ratesStore.js';

export default async function handler(req: Request, res: Response) {
  const { userId } = req.query as { userId?: string };
  if (!userId) return res.status(400).json({ ok: false, error: 'userId is required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  const config = readRatesConfig();
  const override = config.limits.userOverrides[userId];
  const tier = user.accountTier ?? 'personal';
  const tierLimit = config.limits.tierLimits.find(t => t.tier === tier) ?? config.limits.tierLimits.find(t => t.tier === 'default');
  const usage = getWithdrawalUsage(userId);

  return res.json({
    ok: true,
    userId,
    tier,
    override: override ?? null,
    tierLimit: tierLimit ?? null,
    effective: override ?? tierLimit ?? null,
    usage,
  });
}
