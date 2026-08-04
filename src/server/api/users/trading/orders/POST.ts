/**
 * POST /api/users/trading/orders
 * Body: { symbol, side: 'buy'|'sell', type: 'market'|'limit'|'stop'|'stop_limit',
 *         quantity, price?, stopPrice?, currency?, leverage?, stopLoss?, takeProfit? }
 *
 * Validates against the admin-configured market (tradingAdminStore.ts):
 * must be active, quantity within min/max order size, leverage within the
 * market's cap, and the global freeze switch must be off.
 *
 * There's no matching engine or live price feed anywhere in this codebase
 * (see trading/market-data/GET's comment), so a 'market' order — which
 * would normally fill instantly at the current price — is created as
 * 'pending' rather than fabricating a fill price; 'limit'/'stop' orders
 * are created 'open', which is their correct resting state regardless.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { createOrder, type OrderSide, type OrderType, type AssetClass } from '../../../../lib/tradingStore.js';
import { getMarkets, isTradingFrozen } from '../../../../lib/tradingAdminStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, isOneOf } from '../../../../lib/inputValidator.js';

const SIDES = ['buy', 'sell'] as const satisfies readonly OrderSide[];
const TYPES = ['market', 'limit', 'stop', 'stop_limit'] as const satisfies readonly OrderType[];

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  if (isTradingFrozen()) {
    return res.status(423).json({ ok: false, error: 'Trading is temporarily frozen platform-wide. Please try again later.' });
  }

  const raw = req.body as Record<string, unknown>;
  const symbol = sanitizeString(raw.symbol, 20);
  const side = isOneOf(raw.side, SIDES);
  const type = isOneOf(raw.type, TYPES);
  const quantity = typeof raw.quantity === 'number' ? raw.quantity : NaN;

  if (!symbol || !side || !type || !Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ ok: false, error: 'symbol, side, type, and a positive quantity are required' });
  }
  if ((type === 'limit' || type === 'stop_limit') && typeof raw.price !== 'number') {
    return res.status(400).json({ ok: false, error: 'price is required for limit orders' });
  }
  if ((type === 'stop' || type === 'stop_limit') && typeof raw.stopPrice !== 'number') {
    return res.status(400).json({ ok: false, error: 'stopPrice is required for stop orders' });
  }

  const market = getMarkets().find(m => m.symbol.toUpperCase() === symbol.toUpperCase());
  if (!market) return res.status(400).json({ ok: false, error: 'Unknown market' });
  if (market.status !== 'active') {
    return res.status(423).json({ ok: false, error: `${market.symbol} is currently ${market.status}${market.suspendReason ? `: ${market.suspendReason}` : ''}` });
  }
  if (quantity < market.minOrderSize || quantity > market.maxOrderSize) {
    return res.status(400).json({ ok: false, error: `Quantity must be between ${market.minOrderSize} and ${market.maxOrderSize} for ${market.symbol}` });
  }

  const leverage = typeof raw.leverage === 'number' && raw.leverage > 0 ? raw.leverage : 1;
  if (leverage > market.maxLeverage) {
    return res.status(400).json({ ok: false, error: `Leverage cannot exceed ${market.maxLeverage}x for ${market.symbol}` });
  }

  const currency = sanitizeString(raw.currency, 10).toUpperCase() || 'USD';

  const order = await createOrder({
    userId: user.id,
    symbol: market.symbol,
    assetClass: market.assetClass as AssetClass,
    side,
    type,
    quantity,
    filledQty: 0,
    price: typeof raw.price === 'number' ? raw.price : undefined,
    stopPrice: typeof raw.stopPrice === 'number' ? raw.stopPrice : undefined,
    status: type === 'market' ? 'pending' : 'open',
    currency,
    leverage,
    stopLoss: typeof raw.stopLoss === 'number' ? raw.stopLoss : undefined,
    takeProfit: typeof raw.takeProfit === 'number' ? raw.takeProfit : undefined,
    note: sanitizeString(raw.note, 500) || undefined,
  });

  appendAudit({ event: 'user_trading_order_placed', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { orderId: order.id, symbol: market.symbol, side, type, quantity } });

  return res.status(201).json({ ok: true, order });
}
