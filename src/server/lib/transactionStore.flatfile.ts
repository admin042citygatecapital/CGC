/**
 * transactionStore.flatfile.ts — Original flat-file implementation (fallback).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { stripDangerousKeys } from './inputValidator.js';
import type { Transaction, TxQuery } from './transactionStore.js';
import { privateSubdirectory } from './storagePaths.js';

const TX_FILE = path.join(privateSubdirectory('transactions'), 'transactions.jsonl');

function ensureDir() {
  const dir = path.dirname(TX_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadAll(): Transaction[] {
  try {
    if (!fs.existsSync(TX_FILE)) return [];
    return fs.readFileSync(TX_FILE, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Transaction);
  } catch { return []; }
}

function saveAll(txs: Transaction[]) {
  ensureDir();
  fs.writeFileSync(TX_FILE, txs.map(t => JSON.stringify(t)).join('\n') + '\n');
}

function genRef(): string {
  return 'CGC' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();
}

export function createTransaction(data: Omit<Transaction, 'id' | 'reference' | 'flagged' | 'createdAt' | 'updatedAt'>): Transaction {
  const txs = loadAll();
  const tx: Transaction = { ...data, id: 'tx_' + crypto.randomBytes(8).toString('hex'), reference: genRef(), flagged: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  txs.push(tx);
  saveAll(txs);
  return tx;
}

export function updateTransaction(id: string, patch: Partial<Transaction>): Transaction | null {
  const txs = loadAll();
  const idx = txs.findIndex(t => t.id === id);
  if (idx === -1) return null;
  const safePatch = stripDangerousKeys(patch as Record<string, unknown>) as Partial<Transaction>;
  const allowedPatch: Partial<Transaction> = {};
  for (const key of [
    'description', 'status', 'note', 'txHash', 'approvedBy', 'approvedAt',
    'rejectedBy', 'rejectedAt', 'rejectionReason', 'frozenBy', 'frozenAt',
    'adminNote', 'flagged',
  ] as const) {
    if (safePatch[key] !== undefined) Object.assign(allowedPatch, { [key]: safePatch[key] });
  }
  txs[idx] = { ...txs[idx], ...allowedPatch, updatedAt: new Date().toISOString() };
  saveAll(txs);
  return txs[idx];
}

export function findTransactionById(id: string): Transaction | undefined {
  return loadAll().find(t => t.id === id);
}

export function queryTransactions(q: TxQuery = {}): { data: Transaction[]; total: number } {
  let rows = loadAll().reverse();
  if (q.userId)   rows = rows.filter(t => t.userId === q.userId);
  if (q.type)     rows = rows.filter(t => t.type === q.type);
  if (q.status)   rows = rows.filter(t => t.status === q.status);
  if (q.currency) rows = rows.filter(t => t.currency === q.currency);
  if (q.flagged !== undefined) rows = rows.filter(t => t.flagged === q.flagged);
  if (q.from)     rows = rows.filter(t => t.createdAt >= q.from!);
  if (q.to)       rows = rows.filter(t => t.createdAt <= q.to!);
  if (q.search) {
    const s = q.search.toLowerCase();
    rows = rows.filter(t => t.userName.toLowerCase().includes(s) || t.userEmail.toLowerCase().includes(s) || t.reference.toLowerCase().includes(s) || t.id.includes(s));
  }
  const total = rows.length;
  const limit = q.limit ?? 25;
  const page  = q.page  ?? 1;
  return { data: rows.slice((page - 1) * limit, page * limit), total };
}

export function getTransactionsForUser(userId: string, opts: { limit?: number; offset?: number } = {}): { transactions: Transaction[]; total: number } {
  const all   = loadAll().filter(t => t.userId === userId).reverse();
  const total = all.length;
  return { transactions: all.slice(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 20)), total };
}

export function txStats(): { total: number; pending: number; completed: number; failed: number; flagged: number; frozen: number } {
  const rows = loadAll();
  return { total: rows.length, pending: rows.filter(t => t.status === 'pending').length, completed: rows.filter(t => t.status === 'completed').length, failed: rows.filter(t => t.status === 'failed').length, flagged: rows.filter(t => t.flagged).length, frozen: rows.filter(t => t.status === 'frozen').length };
}
