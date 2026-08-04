/**
 * POST /api/users/trading/orders/cancel
 * Body: { orderId: string }
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../../lib/userStore.js';
import { cancelOrder } from '../../../../../lib/tradingStore.js';
import { appendAudit } from '../../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { orderId } = req.body as { orderId?: string };
  if (!orderId) return res.status(400).json({ ok: false, error: 'orderId is required' });

  const order = await cancelOrder(orderId, user.id);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found, not yours, or not cancellable' });

  appendAudit({ event: 'user_trading_order_cancelled', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { orderId } });

  return res.json({ ok: true, order });
}
