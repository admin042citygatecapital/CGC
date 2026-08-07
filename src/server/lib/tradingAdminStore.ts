/**
 * tradingAdminStore.ts — persistence for Trading Administration
 *
 * Files (all under /private/trading/admin/):
 *   markets.jsonl       — per-market enable/disable config + spread
 *   fees.jsonl          — fee tiers per asset class / user tier
 *   providers.jsonl     — API provider config + health snapshots
 *   freeze.jsonl        — global freeze events log
 *   trading_logs.jsonl  — admin action audit log
 *
 * Design: sync I/O, JSONL, same pattern as tradingStore.ts
 */

import fs   from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const ADMIN_DIR = path.resolve(process.cwd(), '/private/trading/admin');
function ensureDir() {
  if (!fs.existsSync(ADMIN_DIR)) fs.mkdirSync(ADMIN_DIR, { recursive: true });
}
function fp(name: string) { ensureDir(); return path.join(ADMIN_DIR, name); }

function readAll<T>(file: string): T[] {
  const f = fp(file);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as T);
}
function writeAll<T>(file: string, records: T[]): void {
  fs.writeFileSync(fp(file), records.map(r => JSON.stringify(r)).join('\n') + (records.length ? '\n' : ''), 'utf8');
}
function appendOne<T>(file: string, record: T): void {
  ensureDir();
  fs.appendFileSync(fp(file), JSON.stringify(record) + '\n', 'utf8');
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type AssetClass = 'crypto' | 'forex' | 'stock' | 'commodity' | 'etf';
export type ProviderStatus = 'active' | 'degraded' | 'offline' | 'disabled';
export type MarketStatus   = 'active' | 'suspended' | 'maintenance' | 'disabled';

export interface MarketConfig {
  id:          string;
  symbol:      string;
  name:        string;
  assetClass:  AssetClass;
  status:      MarketStatus;
  spreadBps:   number;   // spread in basis points (1 bps = 0.01%)
  minOrderSize: number;
  maxOrderSize: number;
  maxLeverage:  number;
  tradingHours: string;  // e.g. "24/7" or "09:30-16:00 EST"
  suspendedAt?: string;
  suspendedBy?: string;
  suspendReason?: string;
  updatedAt:   string;
  createdAt:   string;
}

export interface FeeTier {
  id:          string;
  name:        string;          // e.g. "Standard", "VIP", "Institutional"
  assetClass:  AssetClass | 'all';
  makerFeeRate: number;         // e.g. 0.001 = 0.1%
  takerFeeRate: number;
  minVolume30d: number;         // USD volume threshold for this tier
  maxVolume30d: number | null;  // null = unlimited
  isDefault:   boolean;
  updatedAt:   string;
  createdAt:   string;
}

export interface ProviderConfig {
  id:          string;
  name:        string;
  type:        'crypto' | 'forex' | 'stock' | 'multi';
  status:      ProviderStatus;
  priority:    number;          // lower = higher priority in fallback chain
  apiKeySet:   boolean;         // whether an API key is configured
  capabilities: string[];       // ['ticker','candles','orderbook','search']
  rateLimit:   number;          // requests per minute
  lastChecked: string;
  latencyMs:   number | null;
  errorRate:   number;          // 0-1
  uptime24h:   number;          // 0-1
  notes:       string;
  updatedAt:   string;
}

export interface FreezeEvent {
  id:          string;
  type:        'freeze_all' | 'unfreeze_all' | 'suspend_market' | 'resume_market';
  targetSymbol?: string;
  reason:      string;
  adminId:     string;
  adminEmail:  string;
  createdAt:   string;
}

export interface TradingLog {
  id:          string;
  action:      string;
  category:    'market' | 'fee' | 'provider' | 'freeze' | 'account' | 'config';
  targetId?:   string;
  targetLabel?: string;
  details:     string;
  adminId:     string;
  adminEmail:  string;
  ip?:         string;
  createdAt:   string;
}

// ── Default data seeds ─────────────────────────────────────────────────────────

const DEFAULT_MARKETS: Omit<MarketConfig, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { symbol: 'BTC/USD',  name: 'Bitcoin',       assetClass: 'crypto',    status: 'active',    spreadBps: 5,  minOrderSize: 0.0001, maxOrderSize: 10,      maxLeverage: 10, tradingHours: '24/7' },
  { symbol: 'ETH/USD',  name: 'Ethereum',      assetClass: 'crypto',    status: 'active',    spreadBps: 6,  minOrderSize: 0.001,  maxOrderSize: 100,     maxLeverage: 10, tradingHours: '24/7' },
  { symbol: 'SOL/USD',  name: 'Solana',        assetClass: 'crypto',    status: 'active',    spreadBps: 8,  minOrderSize: 0.01,   maxOrderSize: 1000,    maxLeverage: 5,  tradingHours: '24/7' },
  { symbol: 'BNB/USD',  name: 'BNB',           assetClass: 'crypto',    status: 'active',    spreadBps: 7,  minOrderSize: 0.01,   maxOrderSize: 500,     maxLeverage: 5,  tradingHours: '24/7' },
  { symbol: 'XRP/USD',  name: 'Ripple',        assetClass: 'crypto',    status: 'active',    spreadBps: 9,  minOrderSize: 1,      maxOrderSize: 100000,  maxLeverage: 5,  tradingHours: '24/7' },
  { symbol: 'DOGE/USD', name: 'Dogecoin',      assetClass: 'crypto',    status: 'active',    spreadBps: 12, minOrderSize: 10,     maxOrderSize: 1000000, maxLeverage: 3,  tradingHours: '24/7' },
  { symbol: 'EUR/USD',  name: 'Euro / Dollar', assetClass: 'forex',     status: 'active',    spreadBps: 2,  minOrderSize: 1000,   maxOrderSize: 10000000,maxLeverage: 50, tradingHours: 'Mon-Fri 00:00-24:00 UTC' },
  { symbol: 'GBP/USD',  name: 'Cable',         assetClass: 'forex',     status: 'active',    spreadBps: 3,  minOrderSize: 1000,   maxOrderSize: 10000000,maxLeverage: 50, tradingHours: 'Mon-Fri 00:00-24:00 UTC' },
  { symbol: 'XAU/USD',  name: 'Gold',          assetClass: 'commodity', status: 'active',    spreadBps: 10, minOrderSize: 0.01,   maxOrderSize: 100,     maxLeverage: 20, tradingHours: 'Mon-Fri 01:00-24:00 UTC' },
  { symbol: 'AAPL',     name: 'Apple Inc.',    assetClass: 'stock',     status: 'active',    spreadBps: 4,  minOrderSize: 0.01,   maxOrderSize: 10000,   maxLeverage: 5,  tradingHours: 'Mon-Fri 09:30-16:00 EST' },
  { symbol: 'NVDA',     name: 'NVIDIA Corp.',  assetClass: 'stock',     status: 'active',    spreadBps: 5,  minOrderSize: 0.01,   maxOrderSize: 5000,    maxLeverage: 5,  tradingHours: 'Mon-Fri 09:30-16:00 EST' },
  { symbol: 'SPY',      name: 'S&P 500 ETF',   assetClass: 'etf',       status: 'active',    spreadBps: 3,  minOrderSize: 0.01,   maxOrderSize: 50000,   maxLeverage: 5,  tradingHours: 'Mon-Fri 09:30-16:00 EST' },
];

const DEFAULT_FEES: Omit<FeeTier, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Standard',      assetClass: 'all',       makerFeeRate: 0.001,  takerFeeRate: 0.002,  minVolume30d: 0,          maxVolume30d: 50000,    isDefault: true  },
  { name: 'Active Trader', assetClass: 'all',       makerFeeRate: 0.0008, takerFeeRate: 0.0015, minVolume30d: 50000,      maxVolume30d: 500000,   isDefault: false },
  { name: 'VIP',           assetClass: 'all',       makerFeeRate: 0.0005, takerFeeRate: 0.001,  minVolume30d: 500000,     maxVolume30d: 5000000,  isDefault: false },
  { name: 'Institutional', assetClass: 'all',       makerFeeRate: 0.0002, takerFeeRate: 0.0005, minVolume30d: 5000000,    maxVolume30d: null,     isDefault: false },
  { name: 'Forex Std',     assetClass: 'forex',     makerFeeRate: 0.0002, takerFeeRate: 0.0003, minVolume30d: 0,          maxVolume30d: null,     isDefault: false },
  { name: 'Crypto Std',    assetClass: 'crypto',    makerFeeRate: 0.001,  takerFeeRate: 0.002,  minVolume30d: 0,          maxVolume30d: null,     isDefault: false },
];

const DEFAULT_PROVIDERS: Omit<ProviderConfig, 'id' | 'updatedAt'>[] = [
  { name: 'Binance',       type: 'crypto', status: 'degraded', priority: 1, apiKeySet: false, capabilities: ['ticker','candles','orderbook'], rateLimit: 1200, lastChecked: new Date().toISOString(), latencyMs: null, errorRate: 0.05, uptime24h: 0.95, notes: 'Geo-restricted on server — auto-falls to Coinbase' },
  { name: 'Coinbase',      type: 'crypto', status: 'active',   priority: 2, apiKeySet: false, capabilities: ['ticker','candles','orderbook'], rateLimit: 300,  lastChecked: new Date().toISOString(), latencyMs: 120,  errorRate: 0.01, uptime24h: 0.99, notes: 'Primary fallback for crypto' },
  { name: 'Kraken',        type: 'crypto', status: 'active',   priority: 3, apiKeySet: false, capabilities: ['ticker','candles','orderbook'], rateLimit: 60,   lastChecked: new Date().toISOString(), latencyMs: 180,  errorRate: 0.02, uptime24h: 0.98, notes: 'Secondary crypto fallback' },
  { name: 'Alpha Vantage', type: 'multi',  status: 'active',   priority: 4, apiKeySet: false, capabilities: ['ticker','candles','search'],    rateLimit: 5,    lastChecked: new Date().toISOString(), latencyMs: 350,  errorRate: 0.03, uptime24h: 0.97, notes: 'Stocks + forex + crypto. Free tier: 5 req/min' },
  { name: 'Finnhub',       type: 'multi',  status: 'active',   priority: 5, apiKeySet: false, capabilities: ['ticker','candles','search'],    rateLimit: 60,   lastChecked: new Date().toISOString(), latencyMs: 200,  errorRate: 0.02, uptime24h: 0.98, notes: 'Stocks + forex. Good free tier' },
  { name: 'Polygon.io',    type: 'stock',  status: 'active',   priority: 6, apiKeySet: false, capabilities: ['ticker','candles','orderbook','search'], rateLimit: 5, lastChecked: new Date().toISOString(), latencyMs: 160, errorRate: 0.01, uptime24h: 0.99, notes: 'US equities specialist' },
  { name: 'Twelve Data',   type: 'multi',  status: 'active',   priority: 7, apiKeySet: false, capabilities: ['ticker','candles'],             rateLimit: 8,    lastChecked: new Date().toISOString(), latencyMs: 280,  errorRate: 0.02, uptime24h: 0.97, notes: 'Broad coverage fallback' },
];

// ── Markets ────────────────────────────────────────────────────────────────────

export function getMarkets(): MarketConfig[] {
  const stored = readAll<MarketConfig>('markets.jsonl');
  if (stored.length > 0) return stored;
  // Seed defaults on first call
  const now = new Date().toISOString();
  const seeded = DEFAULT_MARKETS.map(m => ({ ...m, id: randomUUID(), createdAt: now, updatedAt: now }));
  writeAll('markets.jsonl', seeded);
  return seeded;
}

export function getMarket(id: string): MarketConfig | null {
  return getMarkets().find(m => m.id === id) ?? null;
}

export function upsertMarket(market: MarketConfig): void {
  const all = getMarkets();
  const idx = all.findIndex(m => m.id === market.id);
  if (idx >= 0) all[idx] = market; else all.push(market);
  writeAll('markets.jsonl', all);
}

export function suspendMarket(id: string, reason: string, adminId: string): MarketConfig | null {
  const market = getMarket(id);
  if (!market) return null;
  const updated: MarketConfig = {
    ...market,
    status: 'suspended',
    suspendedAt: new Date().toISOString(),
    suspendedBy: adminId,
    suspendReason: reason,
    updatedAt: new Date().toISOString(),
  };
  upsertMarket(updated);
  return updated;
}

export function resumeMarket(id: string): MarketConfig | null {
  const market = getMarket(id);
  if (!market) return null;
  const updated: MarketConfig = {
    ...market,
    status: 'active',
    suspendedAt: undefined,
    suspendedBy: undefined,
    suspendReason: undefined,
    updatedAt: new Date().toISOString(),
  };
  upsertMarket(updated);
  return updated;
}

// ── Fees ───────────────────────────────────────────────────────────────────────

export function getFees(): FeeTier[] {
  const stored = readAll<FeeTier>('fees.jsonl');
  if (stored.length > 0) return stored;
  const now = new Date().toISOString();
  const seeded = DEFAULT_FEES.map(f => ({ ...f, id: randomUUID(), createdAt: now, updatedAt: now }));
  writeAll('fees.jsonl', seeded);
  return seeded;
}

export function upsertFee(fee: FeeTier): void {
  const all = getFees();
  const idx = all.findIndex(f => f.id === fee.id);
  if (idx >= 0) all[idx] = fee; else all.push(fee);
  writeAll('fees.jsonl', all);
}

export function deleteFee(id: string): boolean {
  const all = getFees();
  const filtered = all.filter(f => f.id !== id);
  if (filtered.length === all.length) return false;
  writeAll('fees.jsonl', filtered);
  return true;
}

// ── Providers ──────────────────────────────────────────────────────────────────

export function getProviders(): ProviderConfig[] {
  const stored = readAll<ProviderConfig>('providers.jsonl');
  if (stored.length > 0) return stored;
  const now = new Date().toISOString();
  const seeded = DEFAULT_PROVIDERS.map(p => ({ ...p, id: randomUUID(), updatedAt: now }));
  writeAll('providers.jsonl', seeded);
  return seeded;
}

export function upsertProvider(provider: ProviderConfig): void {
  const all = getProviders();
  const idx = all.findIndex(p => p.id === provider.id);
  if (idx >= 0) all[idx] = provider; else all.push(provider);
  writeAll('providers.jsonl', all);
}

// ── Freeze / Suspend ───────────────────────────────────────────────────────────

export function getFreezeEvents(): FreezeEvent[] {
  return readAll<FreezeEvent>('freeze.jsonl');
}

export function appendFreezeEvent(event: Omit<FreezeEvent, 'id' | 'createdAt'>): FreezeEvent {
  const full: FreezeEvent = { ...event, id: randomUUID(), createdAt: new Date().toISOString() };
  appendOne('freeze.jsonl', full);
  return full;
}

/** Returns true if trading is currently globally frozen */
export function isTradingFrozen(): boolean {
  const events = getFreezeEvents();
  if (events.length === 0) return false;
  // Last event determines state
  const last = events[events.length - 1];
  return last.type === 'freeze_all';
}

// ── Trading Logs ───────────────────────────────────────────────────────────────

export function getTradingLogs(limit = 200): TradingLog[] {
  const all = readAll<TradingLog>('trading_logs.jsonl');
  return all.slice(-limit).reverse();
}

export function appendTradingLog(log: Omit<TradingLog, 'id' | 'createdAt'>): TradingLog {
  const full: TradingLog = { ...log, id: randomUUID(), createdAt: new Date().toISOString() };
  appendOne('trading_logs.jsonl', full);
  return full;
}
