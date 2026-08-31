/**
 * GET /api/admin/wallets
 * Returns protected wallet-address configuration. This does not imply that
 * customer deposits, withdrawals, custody, or provider execution are enabled.
 */
import type { Request, Response } from 'express';
import { loadWallets } from '../../../lib/walletStore.js';

export default async function handler(_req: Request, res: Response) {
  return res.json({ wallets: await loadWallets(), executionEnabled: false });
}
