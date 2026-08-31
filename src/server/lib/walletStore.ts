/**
 * walletStore.ts — PostgreSQL-backed wallet deposit address store.
 * Drop-in replacement for the flat-file JSON implementation.
 */

import { eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { wallets } from '../db/schema.js';
import type { Wallet } from '../db/schema.js';

export interface WalletAddress {
  id:            string;
  symbol:        string;
  name:          string;
  network:       string;
  address:       string;
  qrCode?:       string;
  minDeposit:    number;
  confirmations: number;
  enabled:       boolean;
  updatedAt:     string;
  updatedBy?:    string;
}

const DEFAULTS: WalletAddress[] = [
  { id: 'btc',        symbol: 'BTC',  name: 'Bitcoin',          network: 'Bitcoin Network', address: '', minDeposit: 0.0001, confirmations: 3,  enabled: false, updatedAt: new Date().toISOString() },
  { id: 'eth',        symbol: 'ETH',  name: 'Ethereum',         network: 'ERC-20',          address: '', minDeposit: 0.01,   confirmations: 12, enabled: false, updatedAt: new Date().toISOString() },
  { id: 'usdt_erc20', symbol: 'USDT', name: 'Tether (ERC-20)',  network: 'ERC-20',          address: '', minDeposit: 10,     confirmations: 12, enabled: false, updatedAt: new Date().toISOString() },
  { id: 'usdt_trc20', symbol: 'USDT', name: 'Tether (TRC-20)',  network: 'TRC-20',          address: '', minDeposit: 10,     confirmations: 20, enabled: false, updatedAt: new Date().toISOString() },
  { id: 'bnb',        symbol: 'BNB',  name: 'BNB',              network: 'BEP-20',          address: '', minDeposit: 0.01,   confirmations: 15, enabled: false, updatedAt: new Date().toISOString() },
  { id: 'sol',        symbol: 'SOL',  name: 'Solana',           network: 'Solana Network',  address: '', minDeposit: 0.1,    confirmations: 32, enabled: false, updatedAt: new Date().toISOString() },
];

function toWallet(r: Wallet): WalletAddress {
  return {
    id:            r.id,
    symbol:        r.symbol,
    name:          r.name,
    network:       r.network,
    address:       r.address,
    qrCode:        r.qrCode ?? undefined,
    minDeposit:    r.minDeposit,
    confirmations: r.confirmations,
    enabled:       r.enabled,
    updatedAt:     r.updatedAt.toISOString(),
    updatedBy:     r.updatedBy ?? undefined,
  };
}

// ── Flat-file fallback ────────────────────────────────────────────────────────

let _ff: typeof import('./walletStore.flatfile.js') | null = null;
async function ff() {
  if (!_ff) _ff = await import('./walletStore.flatfile.js');
  return _ff;
}

// ── Ensure defaults exist in DB ───────────────────────────────────────────────

async function ensureDefaults() {
  const db = getDb();
  for (const d of DEFAULTS) {
    await db.insert(wallets).values({
      id:            d.id,
      symbol:        d.symbol,
      name:          d.name,
      network:       d.network,
      address:       d.address,
      minDeposit:    d.minDeposit,
      confirmations: d.confirmations,
      enabled:       d.enabled,
      updatedAt:     new Date(),
    }).onConflictDoNothing();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function loadWallets(): Promise<WalletAddress[]> {
  if (!isDatabaseConfigured()) return (await ff()).loadWallets();
  const db = getDb();
  await ensureDefaults();
  const rows = await db.select().from(wallets).orderBy(wallets.id);
  return rows.map(toWallet);
}

export async function saveWallets(walletsData: WalletAddress[]): Promise<void> {
  if (!isDatabaseConfigured()) return (await ff()).saveWallets(walletsData);
  const db = getDb();
  for (const w of walletsData) {
    await db.insert(wallets).values({
      id:            w.id,
      symbol:        w.symbol,
      name:          w.name,
      network:       w.network,
      address:       w.address,
      qrCode:        w.qrCode ?? null,
      minDeposit:    w.minDeposit,
      confirmations: w.confirmations,
      enabled:       w.enabled,
      updatedAt:     new Date(),
      updatedBy:     w.updatedBy ?? null,
    }).onConflictDoUpdate({
      target: wallets.id,
      set: {
        address:       w.address,
        enabled:       w.enabled,
        updatedAt:     new Date(),
        updatedBy:     w.updatedBy ?? null,
      },
    });
  }
}

export async function updateWallet(id: string, patch: Partial<WalletAddress>): Promise<WalletAddress | null> {
  if (!isDatabaseConfigured()) return (await ff()).updateWallet(id, patch);
  const db = getDb();
  const rows = await db.update(wallets).set({
    ...(patch.address       !== undefined && { address:       patch.address }),
    ...(patch.qrCode        !== undefined && { qrCode:        patch.qrCode ?? null }),
    ...(patch.enabled       !== undefined && { enabled:       patch.enabled }),
    ...(patch.minDeposit    !== undefined && { minDeposit:    patch.minDeposit }),
    ...(patch.confirmations !== undefined && { confirmations: patch.confirmations }),
    ...(patch.updatedBy     !== undefined && { updatedBy:     patch.updatedBy ?? null }),
    updatedAt: new Date(),
  }).where(eq(wallets.id, id)).returning();
  return rows[0] ? toWallet(rows[0]) : null;
}

export async function findWalletById(id: string): Promise<WalletAddress | undefined> {
  if (!isDatabaseConfigured()) return (await ff()).findWalletById(id);
  const db   = getDb();
  const rows = await db.select().from(wallets).where(eq(wallets.id, id)).limit(1);
  return rows[0] ? toWallet(rows[0]) : undefined;
}
