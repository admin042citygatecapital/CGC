/**
 * GET /api/users/wallet-overview
 * Combines the customer's fiat balance/currency, available crypto deposit
 * addresses (admin-configured, walletStore.ts), and a short recent-activity
 * slice (transactionStore.ts) into one dashboard-friendly response.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { loadWallets } from '../../../lib/walletStore.js';
import { getTransactionsForUser } from '../../../lib/transactionStore.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const [wallets, recent] = await Promise.all([
    loadWallets(),
    getTransactionsForUser(user.id, { limit: 5, offset: 0 }),
  ]);

  return res.json({
    ok: true,
    balance: user.balance ?? 0,
    currency: user.primaryCurrency ?? 'USD',
    depositAddresses: wallets.filter(w => w.enabled),
    recentTransactions: recent.transactions,
    recentTransactionsTotal: recent.total,
  });
}
