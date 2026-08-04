/**
 * POST /api/users/deposit
 * Body: { symbol: string, amount: number, txHash?: string }
 * Records a claimed crypto deposit against one of the admin-configured
 * deposit addresses (walletStore.ts). There's no blockchain-monitoring
 * integration anywhere in this codebase to auto-verify an on-chain
 * payment, so this creates a `pending` transaction for admin review
 * rather than crediting the balance immediately — the customer's balance
 * is only updated once an admin approves it via the already-existing
 * POST /api/admin/transactions/approve (which performs the actual credit).
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { loadWallets } from '../../../lib/walletStore.js';
import { createTransaction } from '../../../lib/transactionStore.js';
import { appendAudit } from '../../../lib/auditLog.js';
import { sanitizeString } from '../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const raw = req.body as { symbol?: string; amount?: number; txHash?: unknown };
  const amount = typeof raw.amount === 'number' ? raw.amount : NaN;
  if (!raw.symbol || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ ok: false, error: 'symbol and a positive amount are required' });
  }

  const wallets = await loadWallets();
  const wallet = wallets.find(w => w.symbol.toUpperCase() === String(raw.symbol).toUpperCase() && w.enabled);
  if (!wallet) return res.status(400).json({ ok: false, error: 'Unsupported or disabled deposit asset' });
  if (amount < wallet.minDeposit) {
    return res.status(400).json({ ok: false, error: `Minimum deposit for ${wallet.symbol} is ${wallet.minDeposit}` });
  }

  const txHash = sanitizeString(raw.txHash, 200);

  const transaction = await createTransaction({
    type: 'deposit',
    status: 'pending',
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    amount,
    currency: wallet.symbol as never,
    description: `Deposit — ${wallet.symbol} (${wallet.network})`,
    walletAddress: wallet.address,
    network: wallet.network,
    txHash: txHash || undefined,
    ip: req.ip,
  });

  appendAudit({ event: 'user_deposit_submitted', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { txId: transaction.id, symbol: wallet.symbol, amount } });

  return res.status(201).json({ ok: true, transaction, message: 'Deposit submitted — awaiting confirmation.' });
}
