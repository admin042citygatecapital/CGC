import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { getOrders } from '../../../../lib/tradingStore.js';

export default async (req: Request, res: Response) => {
  try {
    const auth  = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const user = await findUserBySessionToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

    const status = req.query.status as string | undefined;
    let orders = await getOrders(user.id);
    if (status) orders = orders.filter(o => o.status === status);
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ orders });
  } catch (err) {
    console.error('[trading/orders GET]', err);
    res.status(500).json({ error: 'Failed to load orders' });
  }
};
