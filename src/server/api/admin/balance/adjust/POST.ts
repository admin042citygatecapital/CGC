/**
 * POST /api/admin/balance/adjust
 * Increase or decrease a user's balance.
 * Body: { userId, type: 'credit'|'debit', amount, note }
 */
import type { Request, Response } from 'express';
import { findUserById, adjustUserBalance } from '../../../../lib/userStore.js';
import { appendBalanceTx } from '../../../../lib/balanceStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sendBalanceAdjustmentEmail } from '../../../../lib/emailService.js';

export default async function handler(req: Request, res: Response) {
  const { userId, type, amount: rawAmount, note = '' } = req.body ?? {};
  const session   = req.adminSession;
  const adminId   = session?.adminId   ?? 'admin';
  const adminName = session?.email     ?? 'Admin';
  const ip        = req.ip ?? req.socket?.remoteAddress ?? 'unknown';

  // Validate
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ ok: false, error: 'userId is required' });
  }
  if (type !== 'credit' && type !== 'debit') {
    return res.status(400).json({ ok: false, error: 'type must be credit or debit' });
  }
  const amount = Number(rawAmount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ ok: false, error: 'amount must be a positive number' });
  }
  if (amount > 10_000_000) {
    return res.status(400).json({ ok: false, error: 'amount exceeds maximum single adjustment limit' });
  }

  // Load user
  const user = await findUserById(userId);
  if (!user) {
    return res.status(404).json({ ok: false, error: 'User not found' });
  }

  const previousBalance = Number(user.balance ?? 0);
  const delta = type === 'credit' ? amount : -amount;

  // Atomic delta-based update — avoids the read-then-write race a plain
  // updateUser(userId, { balance: computed }) would have (see
  // adjustUserBalance's doc comment for the full TOCTOU rationale).
  const result = await adjustUserBalance(userId, delta);
  if (!result.ok) {
    return res.status(400).json({
      ok: false,
      error: `Insufficient balance. Current balance is $${previousBalance.toLocaleString()}`,
    });
  }
  const newBalance = result.newBalance!;

  // Log transaction
  const tx = appendBalanceTx({
    userId,
    userName:        user.name,
    userEmail:       user.email,
    type:            type === 'credit' ? 'manual_credit' : 'manual_debit',
    amount,
    previousBalance,
    newBalance,
    note:            String(note).slice(0, 500),
    adminId,
    adminName,
    ip,
  });

  // Audit log
  appendAudit({
    event:    `balance_${type}`,
    adminId,
    userId,
    ip,
    meta: {
      adminName,
      amount,
      previousBalance,
      newBalance,
      note,
      transactionId: tx.id,
    },
  });

  // Fire-and-forget email notification
  sendBalanceAdjustmentEmail(
    user.email, user.name, type, amount, previousBalance, newBalance, String(note)
  ).catch(() => {});

  return res.json({
    success:         true,
    previousBalance,
    newBalance,
    transactionId:   tx.id,
  });
}
