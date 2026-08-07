/**
 * tradingStore.ts — PostgreSQL-backed trading store.
 * Drop-in replacement for the flat-file JSONL implementation.
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { eq, desc, and, sql as drizzleSql } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { tradingPositions, tradingOrders, tradingTrades, tradingWatchlist } from '../db/schema.js';
import type {
  TradingPosition as DbPosition,
  TradingOrder as DbOrder,
  TradingTrade as DbTrade,
  TradingWatchlistItem as DbWatchlist,
} from '../db/schema.js';

// ── Types (backward compat) ───────────────────────────────────────────────────

export type AssetClass     = 'crypto' | 'forex' | 'stock' | 'commodity' | 'etf';
export type OrderSide      = 'buy' | 'sell';
export type OrderType      = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderStatus    = 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected' | 'expired';
export type PositionStatus = 'open' | 'closed';

export interface TradingPosition {
  id:            string;
  userId:        string;
  symbol:        string;
  assetClass:    AssetClass;
  side:          OrderSide;
  quantity:      number;
  avgEntryPrice: number;
  currentPrice:  number;
  unrealisedPnl: number;
  realisedPnl:   number;
  status:        PositionStatus;
  openedAt:      string;
  closedAt?:     string;
  currency:      string;
  leverage:      number;
  stopLoss?:     number;
  takeProfit?:   number;
}

export interface TradingOrder {
  id:          string;
  userId:      string;
  symbol:      string;
  assetClass:  AssetClass;
  side:        OrderSide;
  type:        OrderType;
  quantity:    number;
  filledQty:   number;
  price?:      number;
  stopPrice?:  number;
  status:      OrderStatus;
  currency:    string;
  leverage:    number;
  stopLoss?:   number;
  takeProfit?: number;
  createdAt:   string;
  updatedAt:   string;
  filledAt?:   string;
  expiresAt?:  string;
  note?:       string;
}

export interface WatchlistEntry {
  id:          string;
  userId:      string;
  symbol:      string;
  assetClass:  AssetClass;
  addedAt:     string;
  alertPrice?: number;
  note?:       string;
}

export interface TradeRecord {
  id:         string;
  userId:     string;
  orderId:    string;
  positionId: string;
  symbol:     string;
  assetClass: AssetClass;
  side:       OrderSide;
  quantity:   number;
  price:      number;
  fee:        number;
  currency:   string;
  executedAt: string;
  pnl?:       number;
}

// ── DB row mappers ────────────────────────────────────────────────────────────

function toPosition(r: DbPosition): TradingPosition {
  return {
    id:            r.id,
    userId:        r.userId,
    symbol:        r.symbol,
    assetClass:    r.assetClass as AssetClass,
    side:          r.side as OrderSide,
    quantity:      r.quantity,
    avgEntryPrice: r.avgEntryPrice,
    currentPrice:  r.currentPrice,
    unrealisedPnl: r.unrealisedPnl,
    realisedPnl:   r.realisedPnl,
    status:        r.status as PositionStatus,
    openedAt:      r.openedAt.toISOString(),
    closedAt:      r.closedAt?.toISOString() ?? undefined,
    currency:      r.currency,
    leverage:      r.leverage,
    stopLoss:      r.stopLoss ?? undefined,
    takeProfit:    r.takeProfit ?? undefined,
  };
}

function toOrder(r: DbOrder): TradingOrder {
  return {
    id:          r.id,
    userId:      r.userId,
    symbol:      r.symbol,
    assetClass:  r.assetClass as AssetClass,
    side:        r.side as OrderSide,
    type:        r.type as OrderType,
    quantity:    r.quantity,
    filledQty:   r.filledQty,
    price:       r.price ?? undefined,
    stopPrice:   r.stopPrice ?? undefined,
    status:      r.status as OrderStatus,
    currency:    r.currency,
    leverage:    1,
    createdAt:   r.createdAt.toISOString(),
    updatedAt:   r.updatedAt.toISOString(),
    expiresAt:   r.expiresAt?.toISOString() ?? undefined,
  };
}

function toTrade(r: DbTrade): TradeRecord {
  return {
    id:         r.id,
    userId:     r.userId,
    orderId:    r.orderId,
    positionId: r.positionId ?? '',
    symbol:     r.symbol,
    assetClass: r.assetClass as AssetClass,
    side:       r.side as OrderSide,
    quantity:   r.quantity,
    price:      r.price,
    fee:        r.fee,
    currency:   r.currency,
    executedAt: r.executedAt.toISOString(),
    pnl:        r.pnl ?? undefined,
  };
}

function toWatchlist(r: DbWatchlist): WatchlistEntry {
  return {
    id:         r.id,
    userId:     r.userId,
    symbol:     r.symbol,
    assetClass: r.assetClass as AssetClass,
    addedAt:    r.addedAt.toISOString(),
  };
}

// ── Flat-file fallback ────────────────────────────────────────────────────────

let _ff: typeof import('./tradingStore.flatfile.js') | null = null;
async function ff() {
  if (!_ff) _ff = await import('./tradingStore.flatfile.js');
  return _ff;
}

// ── Positions ─────────────────────────────────────────────────────────────────

export async function getPositions(userId: string): Promise<TradingPosition[]> {
  if (!isDatabaseConfigured()) return (await ff()).getPositions(userId);
  const db   = getDb();
  const rows = await db.select().from(tradingPositions)
    .where(eq(tradingPositions.userId, userId))
    .orderBy(desc(tradingPositions.openedAt));
  return rows.map(toPosition);
}

export async function getOpenPositions(userId: string): Promise<TradingPosition[]> {
  if (!isDatabaseConfigured()) return (await ff()).getOpenPositions(userId);
  const db   = getDb();
  const rows = await db.select().from(tradingPositions)
    .where(and(eq(tradingPositions.userId, userId), eq(tradingPositions.status, 'open')))
    .orderBy(desc(tradingPositions.openedAt));
  return rows.map(toPosition);
}

export async function createPosition(data: Omit<TradingPosition, 'id'>): Promise<TradingPosition> {
  if (!isDatabaseConfigured()) return (await ff()).createPosition(data);
  const db   = getDb();
  const rows = await db.insert(tradingPositions).values({
    id:            randomUUID(),
    userId:        data.userId,
    symbol:        data.symbol,
    assetClass:    data.assetClass as DbPosition['assetClass'],
    side:          data.side as DbPosition['side'],
    quantity:      data.quantity,
    avgEntryPrice: data.avgEntryPrice,
    currentPrice:  data.currentPrice,
    unrealisedPnl: data.unrealisedPnl,
    realisedPnl:   data.realisedPnl,
    status:        (data.status ?? 'open') as DbPosition['status'],
    currency:      data.currency,
    leverage:      data.leverage,
    stopLoss:      data.stopLoss ?? null,
    takeProfit:    data.takeProfit ?? null,
    openedAt:      new Date(data.openedAt),
    closedAt:      data.closedAt ? new Date(data.closedAt) : null,
  }).returning();
  return toPosition(rows[0]);
}

export async function updatePosition(id: string, patch: Partial<TradingPosition>): Promise<TradingPosition | null> {
  if (!isDatabaseConfigured()) return (await ff()).updatePosition(id, patch);
  const db   = getDb();
  const rows = await db.update(tradingPositions).set({
    ...(patch.currentPrice  !== undefined && { currentPrice:  patch.currentPrice }),
    ...(patch.unrealisedPnl !== undefined && { unrealisedPnl: patch.unrealisedPnl }),
    ...(patch.realisedPnl   !== undefined && { realisedPnl:   patch.realisedPnl }),
    ...(patch.status        !== undefined && { status:        patch.status as DbPosition['status'] }),
    ...(patch.closedAt      !== undefined && { closedAt:      patch.closedAt ? new Date(patch.closedAt) : null }),
    ...(patch.stopLoss      !== undefined && { stopLoss:      patch.stopLoss ?? null }),
    ...(patch.takeProfit    !== undefined && { takeProfit:    patch.takeProfit ?? null }),
  }).where(eq(tradingPositions.id, id)).returning();
  return rows[0] ? toPosition(rows[0]) : null;
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function getOrders(userId: string): Promise<TradingOrder[]> {
  if (!isDatabaseConfigured()) return (await ff()).getOrders(userId);
  const db   = getDb();
  const rows = await db.select().from(tradingOrders)
    .where(eq(tradingOrders.userId, userId))
    .orderBy(desc(tradingOrders.createdAt));
  return rows.map(toOrder);
}

export async function createOrder(data: Omit<TradingOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<TradingOrder> {
  if (!isDatabaseConfigured()) return (await ff()).createOrder(data);
  const db   = getDb();
  const now  = new Date();
  const rows = await db.insert(tradingOrders).values({
    id:          randomUUID(),
    userId:      data.userId,
    symbol:      data.symbol,
    assetClass:  data.assetClass as DbOrder['assetClass'],
    side:        data.side as DbOrder['side'],
    type:        data.type as DbOrder['type'],
    status:      (data.status ?? 'pending') as DbOrder['status'],
    quantity:    data.quantity,
    price:       data.price ?? null,
    stopPrice:   data.stopPrice ?? null,
    filledQty:   data.filledQty ?? 0,
    fee:         0,
    currency:    data.currency,
    createdAt:   now,
    updatedAt:   now,
    expiresAt:   data.expiresAt ? new Date(data.expiresAt) : null,
  }).returning();
  return toOrder(rows[0]);
}

export async function updateOrder(id: string, patch: Partial<TradingOrder>): Promise<TradingOrder | null> {
  if (!isDatabaseConfigured()) return (await ff()).updateOrder(id, patch);
  const db   = getDb();
  const rows = await db.update(tradingOrders).set({
    ...(patch.status    !== undefined && { status:    patch.status as DbOrder['status'] }),
    ...(patch.filledQty !== undefined && { filledQty: patch.filledQty }),
    updatedAt: new Date(),
  }).where(eq(tradingOrders.id, id)).returning();
  return rows[0] ? toOrder(rows[0]) : null;
}

// ── Trades ────────────────────────────────────────────────────────────────────

export async function getTrades(userId: string): Promise<TradeRecord[]> {
  if (!isDatabaseConfigured()) return (await ff()).getTrades(userId);
  const db   = getDb();
  const rows = await db.select().from(tradingTrades)
    .where(eq(tradingTrades.userId, userId))
    .orderBy(desc(tradingTrades.executedAt));
  return rows.map(toTrade);
}

export async function appendTrade(data: Omit<TradeRecord, 'id'>): Promise<TradeRecord> {
  if (!isDatabaseConfigured()) return (await ff()).appendTrade(data);
  const db   = getDb();
  const rows = await db.insert(tradingTrades).values({
    id:         randomUUID(),
    userId:     data.userId,
    orderId:    data.orderId,
    positionId: data.positionId || null,
    symbol:     data.symbol,
    assetClass: data.assetClass as DbTrade['assetClass'],
    side:       data.side as DbTrade['side'],
    quantity:   data.quantity,
    price:      data.price,
    fee:        data.fee,
    currency:   data.currency,
    pnl:        data.pnl ?? null,
    executedAt: new Date(data.executedAt),
  }).returning();
  return toTrade(rows[0]);
}

// ── Watchlist ─────────────────────────────────────────────────────────────────

export async function getWatchlist(userId: string): Promise<WatchlistEntry[]> {
  if (!isDatabaseConfigured()) return (await ff()).getWatchlist(userId);
  const db   = getDb();
  const rows = await db.select().from(tradingWatchlist)
    .where(eq(tradingWatchlist.userId, userId))
    .orderBy(tradingWatchlist.addedAt);
  return rows.map(toWatchlist);
}

export async function addToWatchlist(userId: string, symbol: string, assetClass: AssetClass): Promise<WatchlistEntry> {
  if (!isDatabaseConfigured()) return (await ff()).addToWatchlist(userId, symbol, assetClass);
  const db   = getDb();
  const rows = await db.insert(tradingWatchlist).values({
    id:         randomUUID(),
    userId,
    symbol,
    assetClass: assetClass as DbWatchlist['assetClass'],
    addedAt:    new Date(),
  }).onConflictDoNothing().returning();
  if (rows.length === 0) {
    // Already exists — return existing
    const existing = await db.select().from(tradingWatchlist)
      .where(and(eq(tradingWatchlist.userId, userId), eq(tradingWatchlist.symbol, symbol)))
      .limit(1);
    return toWatchlist(existing[0]);
  }
  return toWatchlist(rows[0]);
}

export async function removeFromWatchlist(userId: string, symbol: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return (await ff()).removeFromWatchlist(userId, symbol);
  const db     = getDb();
  const result = await db.delete(tradingWatchlist)
    .where(and(eq(tradingWatchlist.userId, userId), eq(tradingWatchlist.symbol, symbol)))
    .returning({ id: tradingWatchlist.id });
  return result.length > 0;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getTradingStats(userId: string): Promise<{
  totalTrades: number; totalPnl: number; openPositions: number; winRate: number;
}> {
  if (!isDatabaseConfigured()) return (await ff()).getTradingStats(userId);
  const db = getDb();

  const [tradeStats, positionCount] = await Promise.all([
    db.select({
      count:   drizzleSql<number>`COUNT(*)::int`,
      totalPnl: drizzleSql<number>`COALESCE(SUM(pnl), 0)::float`,
      wins:    drizzleSql<number>`COUNT(CASE WHEN pnl > 0 THEN 1 END)::int`,
    }).from(tradingTrades).where(eq(tradingTrades.userId, userId)),
    db.select({ count: drizzleSql<number>`COUNT(*)::int` })
      .from(tradingPositions)
      .where(and(eq(tradingPositions.userId, userId), eq(tradingPositions.status, 'open'))),
  ]);

  const stats = tradeStats[0];
  const total = stats?.count ?? 0;
  const wins  = stats?.wins  ?? 0;

  return {
    totalTrades:   total,
    totalPnl:      stats?.totalPnl ?? 0,
    openPositions: positionCount[0]?.count ?? 0,
    winRate:       total > 0 ? (wins / total) * 100 : 0,
  };
}

// ── Admin helpers ─────────────────────────────────────────────────────────────

export async function getAllPositions(): Promise<TradingPosition[]> {
  if (!isDatabaseConfigured()) return (await ff()).getAllPositions?.() ?? [];
  const db = getDb();
  const rows = await db.select().from(tradingPositions).orderBy(desc(tradingPositions.openedAt));
  return rows.map(r => toPosition(r));
}

export async function getAllOrders(): Promise<TradingOrder[]> {
  if (!isDatabaseConfigured()) return (await ff()).getAllOrders?.() ?? [];
  const db = getDb();
  const rows = await db.select().from(tradingOrders).orderBy(desc(tradingOrders.createdAt));
  return rows.map(r => toOrder(r));
}

export async function getAllTrades(): Promise<TradeRecord[]> {
  if (!isDatabaseConfigured()) return (await ff()).getAllTrades?.() ?? [];
  const db = getDb();
  const rows = await db.select().from(tradingTrades).orderBy(desc(tradingTrades.executedAt));
  return rows.map(r => toTrade(r));
}

/** Stub — market data is fetched from external providers, not stored in DB */
export function getMarketData(): Array<{ symbol: string; price: number; change24h: number }> {
  return [];
}


// ── Price alerts (flat-file backed — no DB schema yet) ────────────────────────

export interface PriceAlert {
  id:          string;
  userId:      string;
  symbol:      string;
  targetPrice: number;
  condition:   'above' | 'below';
  active:      boolean;
  createdAt:   string;
}

const ALERTS_FILE = '/private/trading/alerts.jsonl';

export function getAlerts(userId: string): PriceAlert[] {
  try {
    if (!fs.existsSync(ALERTS_FILE)) return [];
    const lines = fs.readFileSync(ALERTS_FILE, 'utf8').trim().split('\n').filter(Boolean);
    return lines.map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter((a): a is PriceAlert => a !== null && a.userId === userId);
  } catch { return []; }
}

/** Returns the last known price for a symbol (stub — returns 0 if no market data). */
export function getLivePrice(_symbol: string): number {
  return 0;
}

/** 24h price change % (stub). */
export function get24hChange(_symbol: string): number { return 0; }

/** 24h volume (stub). */
export function get24hVolume(_symbol: string): number { return 0; }

/** OHLCV candles (stub). */
export function getCandles(_symbol: string, _periods: number, _intervalMin: number): Array<{
  ts: number; open: number; high: number; low: number; close: number; volume: number;
}> { return []; }

/** Portfolio summary for a user. */
export async function getPortfolioSummary(userId: string): Promise<{
  totalValue: number;
  totalCost: number;
  unrealisedPnl: number;
  realisedPnl: number;
  openPositions: number;
}> {
  const positions = await getPositions(userId);
  const open      = positions.filter(p => p.status === 'open');
  const closed    = positions.filter(p => p.status === 'closed');
  const totalValue     = open.reduce((s, p) => s + p.currentPrice * p.quantity, 0);
  const totalCost      = open.reduce((s, p) => s + p.avgEntryPrice * p.quantity, 0);
  const unrealisedPnl  = open.reduce((s, p) => s + p.unrealisedPnl, 0);
  const realisedPnl    = closed.reduce((s, p) => s + p.realisedPnl, 0);
  return { totalValue, totalCost, unrealisedPnl, realisedPnl, openPositions: open.length };
}

/** Cancel an open order. */
export async function cancelOrder(orderId: string, userId: string): Promise<TradingOrder | null> {
  const order = (await getOrders(userId)).find(o => o.id === orderId);
  if (!order || order.userId !== userId) return null;
  if (!['pending', 'open'].includes(order.status)) return null;
  return updateOrder(orderId, { status: 'cancelled' });
}
