/**
 * walletStore.flatfile.ts — Original flat-file wallet store (fallback).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { WalletAddress } from './walletStore.js';
import { privateSubdirectory } from './storagePaths.js';

const WALLETS_FILE = privateSubdirectory('wallets/wallets.json');

const DEFAULTS: WalletAddress[] = [
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', network: 'Bitcoin Network', address: '', minDeposit: 0.0001, confirmations: 3, enabled: true, updatedAt: new Date().toISOString() },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', network: 'ERC-20', address: '', minDeposit: 0.01, confirmations: 12, enabled: true, updatedAt: new Date().toISOString() },
  { id: 'usdt_erc20', symbol: 'USDT', name: 'Tether (ERC-20)', network: 'ERC-20', address: '', minDeposit: 10, confirmations: 12, enabled: true, updatedAt: new Date().toISOString() },
  { id: 'usdt_trc20', symbol: 'USDT', name: 'Tether (TRC-20)', network: 'TRC-20', address: '', minDeposit: 10, confirmations: 20, enabled: true, updatedAt: new Date().toISOString() },
  { id: 'bnb', symbol: 'BNB', name: 'BNB', network: 'BEP-20', address: '', minDeposit: 0.01, confirmations: 15, enabled: true, updatedAt: new Date().toISOString() },
  { id: 'sol', symbol: 'SOL', name: 'Solana', network: 'Solana Network', address: '', minDeposit: 0.1, confirmations: 32, enabled: true, updatedAt: new Date().toISOString() },
];

function ensureDir() {
  const dir = path.dirname(WALLETS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadWallets(): WalletAddress[] {
  try {
    if (!fs.existsSync(WALLETS_FILE)) return DEFAULTS;
    const saved = JSON.parse(fs.readFileSync(WALLETS_FILE, 'utf8')) as WalletAddress[];
    const savedIds = new Set(saved.map(w => w.id));
    return [...saved, ...DEFAULTS.filter(d => !savedIds.has(d.id))];
  } catch { return DEFAULTS; }
}

export function saveWallets(walletsData: WalletAddress[]) {
  ensureDir();
  fs.writeFileSync(WALLETS_FILE, JSON.stringify(walletsData, null, 2));
}

export function updateWallet(id: string, patch: Partial<WalletAddress>): WalletAddress | null {
  const walletsData = loadWallets();
  const idx = walletsData.findIndex(w => w.id === id);
  if (idx === -1) return null;
  walletsData[idx] = { ...walletsData[idx], ...patch, updatedAt: new Date().toISOString() };
  saveWallets(walletsData);
  return walletsData[idx];
}

export function findWalletById(id: string): WalletAddress | undefined {
  return loadWallets().find(w => w.id === id);
}
