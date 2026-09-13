/**
 * transactionStore.ts — PostgreSQL-backed transaction repository.
 * Drop-in replacement for the flat-file JSONL implementation.
 */

import crypto from 'node:crypto';
import { eq, desc, and, gte, lte, ilike, inArray, or, sql as drizzleSql } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { transactions } from '../db/schema.js';
import type { Transaction as DbTransaction } from '../db/schema.js';
import { escapeLikePattern, stripDangerousKeys } from './inputValidator.js';

// ── Types (backward compat) ───────────────────────────────────────────────────

export type TxType     = 'deposit' | 'withdrawal' | 'transfer' | 'crypto_buy' | 'crypto_sell' | 'wire_transfer' | 'fee' | 'refund' | 'manual_credit' | 'manual_debit';
export type TxStatus   = 'pending' | 'completed' | 'failed' | 'rejected' | 'flagged' | 'frozen';
export type TxCurrency = 'USD' | 'EUR' | 'GBP' | 'BTC' | 'ETH' | 'USDT' | 'BNB' | 'SOL' | 'CHF' | 'JPY' | 'CAD' | 'AUD' | 'SGD' | 'AED' | 'NGN';

export interface Transaction {
  id:              string;
  type:            TxType;
  status:          TxStatus;
  userId:          string;
  userName:        string;
  userEmail:       string;
  amount:          number;
  currency:        TxCurrency;
  reference:       string;
  idempotencyKey?: string;
  idempotencyFingerprint?: string;
  description:     string;
  note?:           string;
  walletAddress?:  string;
  network?:        string;
  txHash?:         string;
  bankName?:       string;
  accountNumber?:  string;
  routingNumber?:  string;
  swiftCode?:      string;
  approvedBy?:     string;
  approvedAt?:     string;
  rejectedBy?:     string;
  rejectedAt?:     string;
  rejectionReason?: string;
  frozenBy?:       string;
  frozenAt?:       string;
  adminNote?:      string;
  flagged:         boolean;
  dataClassification?: string;
  quarantineBatchId?: string;
  ip?:             string;
  createdAt:       string;
  updatedAt:       string;
}

export interface TxQuery {
  userId?:   string;
  type?:     TxType;
  status?:   TxStatus;
  currency?: TxCurrency;
  search?:   string;
  flagged?:  boolean;
  from?:     string;
  to?:       string;
  page?:     number;
  limit?:    number;
}

// ── DB row → Transaction ──────────────────────────────────────────────────────

export function toTransactionRecord(r: DbTransaction): Transaction {
  return {
    id:              r.id,
    type:            r.type as TxType,
    status:          r.status as TxStatus,
    userId:          r.userId,
    userName:        r.userName,
    userEmail:       r.userEmail,
    amount:          r.amount,
    currency:        r.currency as TxCurrency,
    reference:       r.reference,
    idempotencyKey:  r.idempotencyKey ?? undefined,
    idempotencyFingerprint: r.idempotencyFingerprint ?? undefined,
    description:     r.description,
    note:            r.note ?? undefined,
    walletAddress:   r.walletAddress ?? undefined,
    network:         r.network ?? undefined,
    txHash:          r.txHash ?? undefined,
    bankName:        r.bankName ?? undefined,
    accountNumber:   r.accountNumber ?? undefined,
    routingNumber:   r.routingNumber ?? undefined,
    swiftCode:       r.swiftCode ?? undefined,
    approvedBy:      r.approvedBy ?? undefined,
    approvedAt:      r.approvedAt?.toISOString() ?? undefined,
    rejectedBy:      r.rejectedBy ?? undefined,
    rejectedAt:      r.rejectedAt?.toISOString() ?? undefined,
    rejectionReason: r.rejectionReason ?? undefined,
    frozenBy:        r.frozenBy ?? undefined,
    frozenAt:        r.frozenAt?.toISOString() ?? undefined,
    adminNote:       r.adminNote ?? undefined,
    flagged:         r.flagged,
    dataClassification: r.dataClassification,
    quarantineBatchId: r.quarantineBatchId ?? undefined,
    ip:              r.ip ?? undefined,
    createdAt:       r.createdAt.toISOString(),
    updatedAt:       r.updatedAt.toISOString(),
  };
}

export function generateTransactionReference(): string {
  return 'CGC' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super('Idempotency key was already used with a different request.');
    this.name = 'IdempotencyConflictError';
  }
}

let flatFileIdempotencyQueue: Promise<void> = Promise.resolve();

function serializeFlatFileIdempotency<T>(operation: () => Promise<T>): Promise<T> {
  const result = flatFileIdempotencyQueue.then(operation, operation);
  flatFileIdempotencyQueue = result.then(() => undefined, () => undefined);
  return result;
}

// ── Flat-file fallback ────────────────────────────────────────────────────────

let _ff: typeof import('./transactionStore.flatfile.js') | null = null;
async function ff() {
  if (!_ff) _ff = await import('./transactionStore.flatfile.js');
  return _ff;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function createTransaction(
  data: Omit<Transaction, 'id' | 'reference' | 'flagged' | 'createdAt' | 'updatedAt'>
): Promise<Transaction> {
  if (!isDatabaseConfigured()) return (await ff()).createTransaction(data);
  const db  = getDb();
  const now = new Date();
  const rows = await db.insert(transactions).values({
    id:              'tx_' + crypto.randomBytes(8).toString('hex'),
    type:            data.type as DbTransaction['type'],
    status:          (data.status ?? 'pending') as DbTransaction['status'],
    userId:          data.userId,
    userName:        data.userName,
    userEmail:       data.userEmail,
    amount:          data.amount,
    currency:        data.currency as DbTransaction['currency'],
    reference:       generateTransactionReference(),
    idempotencyKey:  data.idempotencyKey ?? null,
    idempotencyFingerprint: data.idempotencyFingerprint ?? null,
    description:     data.description,
    note:            data.note ?? null,
    walletAddress:   data.walletAddress ?? null,
    network:         data.network ?? null,
    txHash:          data.txHash ?? null,
    bankName:        data.bankName ?? null,
    accountNumber:   data.accountNumber ?? null,
    routingNumber:   data.routingNumber ?? null,
    swiftCode:       data.swiftCode ?? null,
    flagged:         false,
    ip:              data.ip ?? null,
    createdAt:       now,
    updatedAt:       now,
  }).returning();
  return toTransactionRecord(rows[0]);
}

export async function createTransactionIdempotent(
  data: Omit<Transaction, 'id' | 'reference' | 'flagged' | 'createdAt' | 'updatedAt'>,
): Promise<{ transaction: Transaction; replayed: boolean }> {
  if (!data.idempotencyKey || !data.idempotencyFingerprint) {
    return { transaction: await createTransaction(data), replayed: false };
  }

  if (!isDatabaseConfigured()) {
    return serializeFlatFileIdempotency(async () => {
      const store = await ff();
      const existing = store.getTransactionsForUser(data.userId, { limit: 100_000 }).transactions
        .find(transaction => transaction.idempotencyKey === data.idempotencyKey);
      if (existing) {
        if (existing.idempotencyFingerprint !== data.idempotencyFingerprint) throw new IdempotencyConflictError();
        return { transaction: existing, replayed: true };
      }
      return { transaction: store.createTransaction(data), replayed: false };
    });
  }

  const db = getDb();
  return db.transaction(async tx => {
    const lockKey = `${data.userId}:${data.idempotencyKey}`;
    await tx.execute(drizzleSql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
    const existingRows = await tx.select().from(transactions).where(and(
      eq(transactions.userId, data.userId),
      eq(transactions.idempotencyKey, data.idempotencyKey!),
    )).limit(1);
    if (existingRows[0]) {
      if (existingRows[0].idempotencyFingerprint !== data.idempotencyFingerprint) throw new IdempotencyConflictError();
      return { transaction: toTransactionRecord(existingRows[0]), replayed: true };
    }

    const now = new Date();
    const rows = await tx.insert(transactions).values({
      id: 'tx_' + crypto.randomBytes(8).toString('hex'),
      type: data.type as DbTransaction['type'],
      status: (data.status ?? 'pending') as DbTransaction['status'],
      userId: data.userId,
      userName: data.userName,
      userEmail: data.userEmail,
      amount: data.amount,
      currency: data.currency as DbTransaction['currency'],
      reference: generateTransactionReference(),
      idempotencyKey: data.idempotencyKey,
      idempotencyFingerprint: data.idempotencyFingerprint,
      description: data.description,
      note: data.note ?? null,
      walletAddress: data.walletAddress ?? null,
      network: data.network ?? null,
      txHash: data.txHash ?? null,
      bankName: data.bankName ?? null,
      accountNumber: data.accountNumber ?? null,
      routingNumber: data.routingNumber ?? null,
      swiftCode: data.swiftCode ?? null,
      flagged: false,
      ip: data.ip ?? null,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return { transaction: toTransactionRecord(rows[0]), replayed: false };
  });
}

export async function updateTransaction(id: string, patch: Partial<Transaction>): Promise<Transaction | null> {
  if (!isDatabaseConfigured()) return (await ff()).updateTransaction(id, patch);
  const db   = getDb();
  const safe = stripDangerousKeys(patch as Record<string, unknown>) as Partial<Transaction>;

  const dbPatch: Partial<DbTransaction> = { updatedAt: new Date() };
  if (safe.description !== undefined)     dbPatch.description     = safe.description;
  if (safe.status !== undefined)          dbPatch.status          = safe.status as DbTransaction['status'];
  if (safe.note !== undefined)            dbPatch.note            = safe.note ?? null;
  if (safe.txHash !== undefined)          dbPatch.txHash          = safe.txHash ?? null;
  if (safe.approvedBy !== undefined)      dbPatch.approvedBy      = safe.approvedBy ?? null;
  if (safe.approvedAt !== undefined)      dbPatch.approvedAt      = safe.approvedAt ? new Date(safe.approvedAt) : null;
  if (safe.rejectedBy !== undefined)      dbPatch.rejectedBy      = safe.rejectedBy ?? null;
  if (safe.rejectedAt !== undefined)      dbPatch.rejectedAt      = safe.rejectedAt ? new Date(safe.rejectedAt) : null;
  if (safe.rejectionReason !== undefined) dbPatch.rejectionReason = safe.rejectionReason ?? null;
  if (safe.frozenBy !== undefined)        dbPatch.frozenBy        = safe.frozenBy ?? null;
  if (safe.frozenAt !== undefined)        dbPatch.frozenAt        = safe.frozenAt ? new Date(safe.frozenAt) : null;
  if (safe.adminNote !== undefined)       dbPatch.adminNote       = safe.adminNote ?? null;
  if (safe.flagged !== undefined)         dbPatch.flagged         = safe.flagged;

  const rows = await db.update(transactions).set(dbPatch).where(eq(transactions.id, id)).returning();
  return rows[0] ? toTransactionRecord(rows[0]) : null;
}

export async function findTransactionById(id: string): Promise<Transaction | undefined> {
  if (!isDatabaseConfigured()) return (await ff()).findTransactionById(id);
  const db   = getDb();
  const rows = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return rows[0] ? toTransactionRecord(rows[0]) : undefined;
}

export async function findTransactionByIdempotencyKey(userId: string, key: string): Promise<Transaction | undefined> {
  if (!isDatabaseConfigured()) {
    const rows = (await ff()).getTransactionsForUser(userId, { limit: 100_000 }).transactions;
    return rows.find(transaction => transaction.idempotencyKey === key);
  }
  const db = getDb();
  const rows = await db.select().from(transactions).where(and(
    eq(transactions.userId, userId),
    eq(transactions.idempotencyKey, key),
  )).limit(1);
  return rows[0] ? toTransactionRecord(rows[0]) : undefined;
}

export async function queryTransactions(q: TxQuery = {}): Promise<{ data: Transaction[]; total: number }> {
  if (!isDatabaseConfigured()) return (await ff()).queryTransactions(q);
  const db = getDb();

  const conditions = [];
  if (q.userId)   conditions.push(eq(transactions.userId, q.userId));
  if (q.type)     conditions.push(eq(transactions.type, q.type as DbTransaction['type']));
  if (q.status)   conditions.push(eq(transactions.status, q.status as DbTransaction['status']));
  if (q.currency) conditions.push(eq(transactions.currency, q.currency as DbTransaction['currency']));
  if (q.flagged !== undefined) conditions.push(eq(transactions.flagged, q.flagged));
  if (q.from)     conditions.push(gte(transactions.createdAt, new Date(q.from)));
  if (q.to)       conditions.push(lte(transactions.createdAt, new Date(q.to)));
  if (q.search) {
    const s = `%${escapeLikePattern(q.search)}%`;
    conditions.push(or(
      ilike(transactions.userName, s),
      ilike(transactions.userEmail, s),
      ilike(transactions.reference, s),
      ilike(transactions.id, s),
      ilike(transactions.description, s),
    ));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult, rows] = await Promise.all([
    db.select({ count: drizzleSql<number>`COUNT(*)::int` })
      .from(transactions)
      .where(where),
    db.select().from(transactions)
      .where(where)
      .orderBy(desc(transactions.createdAt))
      .limit(q.limit ?? 25)
      .offset(((q.page ?? 1) - 1) * (q.limit ?? 25)),
  ]);

  return {
    data:  rows.map(toTransactionRecord),
    total: countResult[0]?.count ?? 0,
  };
}

export async function getTransactionsForUser(
  userId: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<{ transactions: Transaction[]; total: number }> {
  if (!isDatabaseConfigured()) return (await ff()).getTransactionsForUser(userId, opts);
  const db = getDb();

  const [countResult, rows] = await Promise.all([
    db.select({ count: drizzleSql<number>`COUNT(*)::int` })
      .from(transactions)
      .where(eq(transactions.userId, userId)),
    db.select().from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(opts.limit ?? 20)
      .offset(opts.offset ?? 0),
  ]);

  return {
    transactions: rows.map(toTransactionRecord),
    total:        countResult[0]?.count ?? 0,
  };
}

/**
 * Return only transaction records relevant to the customer's withdrawal-limit
 * calculation. The production query is date- and state-bounded so a limit
 * check never loads the customer's complete history.
 */
export async function getWithdrawalTransactionsSince(userId: string, since: Date): Promise<Transaction[]> {
  if (!isDatabaseConfigured()) {
    const { transactions: userTransactions } = await (await ff()).getTransactionsForUser(userId, { limit: 100_000 });
    return userTransactions.filter(transaction =>
      ['withdrawal', 'wire_transfer', 'manual_debit'].includes(transaction.type)
      && ['completed', 'pending'].includes(transaction.status)
      && new Date(transaction.createdAt) >= since
    );
  }

  const rows = await getDb().select().from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      inArray(transactions.type, ['withdrawal', 'wire_transfer', 'manual_debit']),
      inArray(transactions.status, ['completed', 'pending']),
      gte(transactions.createdAt, since),
    ))
    .orderBy(desc(transactions.createdAt));
  return rows.map(toTransactionRecord);
}

export async function txStats(): Promise<{
  total: number; pending: number; completed: number;
  failed: number; flagged: number; frozen: number;
}> {
  if (!isDatabaseConfigured()) return (await ff()).txStats();
  const db = getDb();

  const rows = await db.select({
    status:  transactions.status,
    flagged: transactions.flagged,
    count:   drizzleSql<number>`COUNT(*)::int`,
  })
    .from(transactions)
    .groupBy(transactions.status, transactions.flagged);

  let total = 0, pending = 0, completed = 0, failed = 0, flagged = 0, frozen = 0;
  for (const r of rows) {
    total += r.count;
    if (r.status === 'pending')   pending   += r.count;
    if (r.status === 'completed') completed += r.count;
    if (r.status === 'failed')    failed    += r.count;
    if (r.status === 'frozen')    frozen    += r.count;
    if (r.flagged)                flagged   += r.count;
  }
  return { total, pending, completed, failed, flagged, frozen };
}
