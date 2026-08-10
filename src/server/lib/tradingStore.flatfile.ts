/**
 * tradingStore.flatfile.ts — Original flat-file trading store (fallback).
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { TradingPosition, TradingOrder, TradeRecord, WatchlistEntry, AssetClass } from './tradingStore.js';
import { privateSubdirectory } from './storagePaths.js';

const TRADING_DIR = privateSubdirectory('trading');
function ensureDir() { if (!fs.existsSync(TRADING_DIR)) fs.mkdirSync(TRADING_DIR, { recursive: true }); }
function fp(name: string) { ensureDir(); return path.join(TRADING_DIR, name); }
function readAll<T>(file: string): T[] {
  const f = fp(file);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as T);
}
function writeAll<T>(file: string, records: T[]): void {
  fs.writeFileSync(fp(file), records.map(r => JSON.stringify(r)).join('\n') + (records.length ? '\n' : ''), 'utf8');
}
function appendOne<T>(file: string, record: T): void { ensureDir(); fs.appendFileSync(fp(file), JSON.stringify(record) + '\n', 'utf8'); }

export function getPositions(userId: string): TradingPosition[] { return readAll<TradingPosition>('positions.jsonl').filter(p => p.userId === userId); }
export function getAllPositions(): TradingPosition[] { return readAll<TradingPosition>('positions.jsonl'); }
export function getOpenPositions(userId: string): TradingPosition[] { return getPositions(userId).filter(p => p.status === 'open'); }
export function createPosition(data: Omit<TradingPosition, 'id'>): TradingPosition {
  const p = { ...data, id: randomUUID() } as TradingPosition;
  appendOne('positions.jsonl', p);
  return p;
}
export function updatePosition(id: string, patch: Partial<TradingPosition>): TradingPosition | null {
  const all = readAll<TradingPosition>('positions.jsonl');
  const idx = all.findIndex(p => p.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  writeAll('positions.jsonl', all);
  return all[idx];
}
export function getOrders(userId: string): TradingOrder[] { return readAll<TradingOrder>('orders.jsonl').filter(o => o.userId === userId); }
export function getAllOrders(): TradingOrder[] { return readAll<TradingOrder>('orders.jsonl'); }
export function createOrder(data: Omit<TradingOrder, 'id' | 'createdAt' | 'updatedAt'>): TradingOrder {
  const now = new Date().toISOString();
  const o = { ...data, id: randomUUID(), createdAt: now, updatedAt: now } as TradingOrder;
  appendOne('orders.jsonl', o);
  return o;
}
export function updateOrder(id: string, patch: Partial<TradingOrder>): TradingOrder | null {
  const all = readAll<TradingOrder>('orders.jsonl');
  const idx = all.findIndex(o => o.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  writeAll('orders.jsonl', all);
  return all[idx];
}
export function getTrades(userId: string): TradeRecord[] { return readAll<TradeRecord>('trades.jsonl').filter(t => t.userId === userId); }
export function getAllTrades(): TradeRecord[] { return readAll<TradeRecord>('trades.jsonl'); }
export function appendTrade(data: Omit<TradeRecord, 'id'>): TradeRecord {
  const t = { ...data, id: randomUUID() } as TradeRecord;
  appendOne('trades.jsonl', t);
  return t;
}
export function getWatchlist(userId: string): WatchlistEntry[] { return readAll<WatchlistEntry>('watchlist.jsonl').filter(w => w.userId === userId); }
export function addToWatchlist(userId: string, symbol: string, assetClass: AssetClass): WatchlistEntry {
  const existing = getWatchlist(userId).find(w => w.symbol === symbol);
  if (existing) return existing;
  const w: WatchlistEntry = { id: randomUUID(), userId, symbol, assetClass, addedAt: new Date().toISOString() };
  appendOne('watchlist.jsonl', w);
  return w;
}
export function removeFromWatchlist(userId: string, symbol: string): boolean {
  const all = readAll<WatchlistEntry>('watchlist.jsonl');
  const filtered = all.filter(w => !(w.userId === userId && w.symbol === symbol));
  if (filtered.length === all.length) return false;
  writeAll('watchlist.jsonl', filtered);
  return true;
}
export function getTradingStats(userId: string): { totalTrades: number; totalPnl: number; openPositions: number; winRate: number } {
  const trades = getTrades(userId);
  const positions = getOpenPositions(userId);
  const totalPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const wins = trades.filter(t => (t.pnl ?? 0) > 0).length;
  return { totalTrades: trades.length, totalPnl, openPositions: positions.length, winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0 };
}
