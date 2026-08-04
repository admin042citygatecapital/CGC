/**
 * POST /api/admin/users/currency
 * Sets the primary display currency for a specific user.
 * Body: { userId, currency }
 * The customer dashboard reads user.primaryCurrency to decide which
 * currency to display the total balance in. Takes effect on next fetch.
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

const SUPPORTED = ['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'SGD', 'AED', 'BTC', 'ETH', 'SOL', 'USDT', 'BNB'];

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, currency } = req.body as { userId?: string; currency?: string };

  if (!userId) return res.status(400).json({ ok: false, error: 'userId is required' });
  if (!currency) return res.status(400).json({ ok: false, error: 'currency is required' });

  const cur = String(currency).toUpperCase();
  if (!SUPPORTED.includes(cur)) {
    return res.status(400).json({ ok: false, error: `Unsupported currency: ${cur}. Supported: ${SUPPORTED.join(', ')}` });
  }

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  const previous = user.primaryCurrency ?? 'USD';
  const updated = await updateUser(userId, { primaryCurrency: cur });
  if (!updated) return res.status(500).json({ ok: false, error: 'Update failed' });

  appendAudit({
    event: 'admin_set_user_currency',
    adminId: session.adminId,
    userId,
    email: user.email,
    ip: req.ip ?? 'unknown',
    meta: { previousCurrency: previous, newCurrency: cur, userName: user.name },
  });

  return res.json({ ok: true, userId, currency: cur, previousCurrency: previous });
}
