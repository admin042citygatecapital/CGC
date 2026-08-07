/**
 * POST /api/users/trading/orders — place a new trading order.
 * Market orders are immediately filled at the simulated live price.
 * Limit/stop orders are stored as "open" for future matching.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import {
  createOrder, appendTrade, createPosition, updatePosition,
  getPositions, getLivePrice,
  type AssetClass, type OrderSide, type OrderType,
} from '../../../../lib/tradingStore.js';
import { requirePaperTrading } from '../../../../lib/platformMode.js';

export default async (req: Request, res: Response) => {
  try {
    if (!requirePaperTrading(res)) return;
    const auth  = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const user = await findUserBySessionToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired session' });
    if (user.status !== 'active' || user.kycStatus !== 'approved') {
      return res.status(403).json({ error: 'An active, KYC-approved account is required to trade.' });
    }

    const {
      symbol, assetClass, side, type: orderType, quantity,
      price, stopPrice, currency = 'USD', leverage = 1,
      stopLoss, takeProfit, note,
    } = req.body as {
      symbol: string; assetClass: AssetClass; side: OrderSide;
      type: OrderType; quantity: number; price?: number;
      stopPrice?: number; currency?: string; leverage?: number;
      stopLoss?: number; takeProfit?: number; note?: string;
    };

    if (!symbol || !assetClass || !side || !orderType || !quantity || quantity <= 0)
      return res.status(400).json({ error: 'symbol, assetClass, side, type, and quantity are required' });
    if (!['buy', 'sell'].includes(side))
      return res.status(400).json({ error: 'side must be buy or sell' });
    if (!['market', 'limit', 'stop', 'stop_limit'].includes(orderType))
      return res.status(400).json({ error: 'Invalid order type' });

    const livePrice = getLivePrice(symbol);
    const fillPrice = orderType === 'market' ? livePrice : (price ?? livePrice);
    const lev       = Math.min(Math.max(leverage, 1), 100);

    const order = await createOrder({
      userId: user.id, symbol, assetClass, side, type: orderType,
      quantity, price, stopPrice, currency, leverage: lev,
      stopLoss, takeProfit, note,
      filledQty: orderType === 'market' ? quantity : 0,
      status:   orderType === 'market' ? 'filled' : 'open',
      filledAt: orderType === 'market' ? new Date().toISOString() : undefined,
      expiresAt: undefined,
    });

    if (orderType === 'market') {
      const positions = await getPositions(user.id);
      const existing  = positions.find(p => p.symbol === symbol && p.side === side && p.status === 'open');
      let positionId = existing?.id ?? '';
      const fee        = parseFloat((fillPrice * quantity * 0.001).toFixed(2));
      const mult       = side === 'buy' ? 1 : -1;

      if (existing) {
        const totalQty   = existing.quantity + quantity;
        const avgEntry   = (existing.avgEntryPrice * existing.quantity + fillPrice * quantity) / totalQty;
        const unrealised = (livePrice - avgEntry) * totalQty * mult * lev;
        await updatePosition(existing.id, {
          quantity:      totalQty,
          avgEntryPrice: parseFloat(avgEntry.toFixed(6)),
          currentPrice:  livePrice,
          unrealisedPnl: parseFloat(unrealised.toFixed(2)),
        });
      } else {
        const unrealised = (livePrice - fillPrice) * quantity * mult * lev;
        const newPosition = await createPosition({
          userId: user.id, symbol, assetClass, side, quantity,
          avgEntryPrice: fillPrice, currentPrice: livePrice,
          unrealisedPnl: parseFloat(unrealised.toFixed(2)), realisedPnl: 0,
          status: 'open', openedAt: new Date().toISOString(),
          currency, leverage: lev, stopLoss, takeProfit,
        });
        positionId = newPosition.id;
      }

      await appendTrade({
        userId: user.id, orderId: order.id, positionId,
        symbol, assetClass, side, quantity,
        price: fillPrice, fee, currency,
        executedAt: new Date().toISOString(),
      });
    }

    res.status(201).json({ order });
  } catch (err) {
    console.error('[trading/orders POST]', err);
    res.status(500).json({ error: 'Failed to place order' });
  }
};
