/**
 * Persistent balance transaction log backed by /private/balance/transactions.jsonl
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TX_FILE = '/private/balance/transactions.jsonl';

export type BalanceTxType = 'manual_credit' | 'manual_debit';

export interface BalanceTx {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: BalanceTxType;
  amount: number;
  previousBalance: number;
  newBalance: number;
  note: string;
  adminId: string;
  adminName: string;
  ip: string;
  createdAt: string;
}

function ensureDir() {
  const dir = path.dirname(TX_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadBalanceTxs(): BalanceTx[] {
  try {
    if (!fs.existsSync(TX_FILE)) return [];
    return fs.readFileSync(TX_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .map(l => JSON.parse(l) as BalanceTx);
  } catch { return []; }
}

export function appendBalanceTx(tx: Omit<BalanceTx, 'id' | 'createdAt'>): BalanceTx {
  ensureDir();
  const record: BalanceTx = {
    ...tx,
    id: 'btx_' + crypto.randomBytes(8).toString('hex'),
    createdAt: new Date().toISOString(),
  };
  fs.appendFileSync(TX_FILE, JSON.stringify(record) + '\n');
  return record;
}

export function queryBalanceTxs(opts: {
  userId?: string;
  limit?: number;
  page?: number;
}): { data: BalanceTx[]; total: number } {
  let rows = loadBalanceTxs().reverse(); // newest first
  if (opts.userId) rows = rows.filter(r => r.userId === opts.userId);
  const total = rows.length;
  const limit = opts.limit ?? 50;
  const page  = opts.page  ?? 1;
  const data  = rows.slice((page - 1) * limit, page * limit);
  return { data, total };
}
