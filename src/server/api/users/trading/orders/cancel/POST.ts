import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../../lib/userStore.js';
import { cancelOrder } from '../../../../../lib/tradingStore.js';

export default async (req: Request, res: Response) => {
  try {
    const auth  = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const user = await findUserBySessionToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

    const { orderId } = req.body as { orderId: string };
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    const order = cancelOrder(orderId, user.id);
    if (!order) return res.status(404).json({ error: 'Order not found or cannot be cancelled' });
    res.json({ order });
  } catch (err) {
    console.error('[trading/orders/cancel]', err);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
};
