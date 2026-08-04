/**
 * GET /api/users/trading/orders
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { getOrders } from '../../../../lib/tradingStore.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const orders = (await getOrders(user.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.json({ ok: true, orders });
}
