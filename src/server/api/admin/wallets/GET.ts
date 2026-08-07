/**
 * GET /api/admin/wallets
 * Returns all crypto deposit wallet addresses.
 */
import type { Request, Response } from 'express';
import { loadWallets } from '../../../lib/walletStore.js';

export default function handler(_req: Request, res: Response) {
  return res.json({ wallets: loadWallets() });
}
