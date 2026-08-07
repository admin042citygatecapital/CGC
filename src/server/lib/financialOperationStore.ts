/**
 * Atomic balance debit + ledger writes for customer money movement.
 *
 * Production uses a PostgreSQL transaction with a conditional balance update,
 * preventing concurrent requests from spending the same funds. The flat-file
 * fallback is intentionally development-only and is serialized in-process.
 */
import crypto from 'node:crypto';
import { and, eq, sql as drizzleSql } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { transactions, users } from '../db/schema.js';
import { findUserById, updateUser, type UserRecord } from './userStore.js';
import {
  createTransaction,
  generateTransactionReference,
  getTransactionsForUser,
  toTransactionRecord,
  type Transaction,
} from './transactionStore.js';

type TransactionInput = Parameters<typeof createTransaction>[0];

export interface DebitOperationInput {
  user: UserRecord;
  debitUsd: number;
  primary: TransactionInput;
  fee?: TransactionInput;
}

export type DebitOperationResult =
  | { ok: true; replayed: boolean; newBalance: number; transaction: Transaction; feeTransaction?: Transaction }
  | { ok: false; balance: number; reason: 'insufficient_funds' | 'idempotency_conflict' };

export interface SwapOperationInput {
  user: UserRecord;
  fromAsset: Transaction['currency'];
  toAsset: Transaction['currency'];
  fromAmount: number;
  toAmount: number;
  feeInFrom: number;
  debit: TransactionInput;
  credit: TransactionInput;
  fee?: TransactionInput;
}

export type SwapOperationResult =
  | { ok: true; replayed: boolean; sourceBalance: number; usdBalance: number }
  | { ok: false; balance: number; reason: 'insufficient_funds' | 'idempotency_conflict' };

let flatFileQueue: Promise<void> = Promise.resolve();

function serializeFlatFile<T>(operation: () => Promise<T>): Promise<T> {
  const result = flatFileQueue.then(operation, operation);
  flatFileQueue = result.then(() => undefined, () => undefined);
  return result;
}

function insertValues(data: TransactionInput) {
  const now = new Date();
  return {
    id:              'tx_' + crypto.randomBytes(8).toString('hex'),
    type:            data.type,
    status:          data.status ?? 'pending',
    userId:          data.userId,
    userName:        data.userName,
    userEmail:       data.userEmail,
    amount:          data.amount,
    currency:        data.currency,
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
  };
}

export async function executeDebitOperation(
  input: DebitOperationInput,
): Promise<DebitOperationResult> {
  const debitUsd = Math.round(input.debitUsd * 100) / 100;
  if (!Number.isFinite(debitUsd) || debitUsd <= 0) {
    throw new Error('Debit amount must be a positive finite USD value.');
  }

  if (!isDatabaseConfigured()) {
    return serializeFlatFile(async () => {
      const current = await findUserById(input.user.id);
      const balance = current?.balance ?? 0;
      if (!current) return { ok: false, balance, reason: 'insufficient_funds' };
      if (input.primary.idempotencyKey) {
        const history = (await getTransactionsForUser(current.id, { limit: 100_000 })).transactions;
        const existing = history.find(transaction => transaction.idempotencyKey === input.primary.idempotencyKey);
        if (existing) {
          if (existing.idempotencyFingerprint !== input.primary.idempotencyFingerprint) {
            return { ok: false, balance, reason: 'idempotency_conflict' };
          }
          return { ok: true, replayed: true, newBalance: balance, transaction: existing };
        }
      }
      if (balance < debitUsd) return { ok: false, balance, reason: 'insufficient_funds' };

      const newBalance = Math.round((balance - debitUsd) * 100) / 100;
      await updateUser(current.id, { balance: newBalance });

      try {
        const transaction = await createTransaction(input.primary);
        const feeTransaction = input.fee
          ? await createTransaction(input.fee)
          : undefined;
        return { ok: true, replayed: false, newBalance, transaction, feeTransaction };
      } catch (error) {
        // Best-effort rollback for the development-only flat-file fallback.
        await updateUser(current.id, { balance });
        throw error;
      }
    });
  }

  const db = getDb();
  return db.transaction(async tx => {
    if (input.primary.idempotencyKey) {
      const lockKey = `${input.user.id}:${input.primary.idempotencyKey}`;
      await tx.execute(drizzleSql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
      const existingRows = await tx.select().from(transactions).where(and(
        eq(transactions.userId, input.user.id),
        eq(transactions.idempotencyKey, input.primary.idempotencyKey),
      )).limit(1);
      if (existingRows[0]) {
        const balanceRows = await tx.select({ balance: users.balance }).from(users)
          .where(eq(users.id, input.user.id)).limit(1);
        const balance = balanceRows[0]?.balance ?? 0;
        if (existingRows[0].idempotencyFingerprint !== input.primary.idempotencyFingerprint) {
          return { ok: false, balance, reason: 'idempotency_conflict' };
        }
        return { ok: true, replayed: true, newBalance: balance, transaction: toTransactionRecord(existingRows[0]) };
      }
    }
    const updated = await tx.update(users)
      .set({
        balance: drizzleSql<number>`ROUND((COALESCE(${users.balance}, 0) - ${debitUsd})::numeric, 2)`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(users.id, input.user.id),
        drizzleSql`COALESCE(${users.balance}, 0) >= ${debitUsd}`,
      ))
      .returning({ balance: users.balance });

    if (!updated[0]) {
      const current = await tx.select({ balance: users.balance })
        .from(users)
        .where(eq(users.id, input.user.id))
        .limit(1);
      return { ok: false, balance: current[0]?.balance ?? 0, reason: 'insufficient_funds' };
    }

    const primaryRows = await tx.insert(transactions)
      .values(insertValues(input.primary))
      .returning();
    const transaction = toTransactionRecord(primaryRows[0]);

    let feeTransaction: Transaction | undefined;
    if (input.fee) {
      const feeRows = await tx.insert(transactions)
        .values(insertValues(input.fee))
        .returning();
      feeTransaction = toTransactionRecord(feeRows[0]);
    }

    return {
      ok: true,
      replayed: false,
      newBalance: updated[0].balance ?? 0,
      transaction,
      feeTransaction,
    };
  });
}

const CREDIT_TYPES = new Set(['deposit', 'manual_credit', 'refund', 'crypto_sell']);
const DEBIT_TYPES = new Set(['withdrawal', 'manual_debit', 'fee', 'transfer', 'wire_transfer', 'crypto_buy']);

function ledgerBalance(rows: Transaction[], currency: string): number {
  return rows.reduce((balance, transaction) => {
    if (transaction.status !== 'completed' || transaction.currency !== currency) return balance;
    if (CREDIT_TYPES.has(transaction.type)) return balance + transaction.amount;
    if (DEBIT_TYPES.has(transaction.type)) return balance - transaction.amount;
    return balance;
  }, 0);
}

/** Atomically verifies the source asset and records both sides of a swap. */
export async function executeSwapOperation(
  input: SwapOperationInput,
): Promise<SwapOperationResult> {
  const totalSourceDebit = input.fromAmount + input.feeInFrom;
  if (![totalSourceDebit, input.toAmount].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Swap amounts must be positive finite values.');
  }

  if (!isDatabaseConfigured()) {
    return serializeFlatFile(async () => {
      const current = await findUserById(input.user.id);
      if (!current) return { ok: false, balance: 0, reason: 'insufficient_funds' };
      const history = (await getTransactionsForUser(current.id, { limit: 100_000 })).transactions;
      const available = input.fromAsset === 'USD'
        ? current.balance ?? 0
        : ledgerBalance(history, input.fromAsset);
      if (input.debit.idempotencyKey) {
        const existing = history.find(transaction => transaction.idempotencyKey === input.debit.idempotencyKey);
        if (existing) {
          if (existing.idempotencyFingerprint !== input.debit.idempotencyFingerprint) {
            return { ok: false, balance: available, reason: 'idempotency_conflict' };
          }
          return { ok: true, replayed: true, sourceBalance: available, usdBalance: current.balance ?? 0 };
        }
      }
      if (available < totalSourceDebit) return { ok: false, balance: available, reason: 'insufficient_funds' };

      let usdBalance = current.balance ?? 0;
      if (input.fromAsset === 'USD') usdBalance -= totalSourceDebit;
      if (input.toAsset === 'USD') usdBalance += input.toAmount;
      usdBalance = Math.round(usdBalance * 100) / 100;
      await updateUser(current.id, { balance: usdBalance });

      try {
        await createTransaction(input.debit);
        await createTransaction(input.credit);
        if (input.fee) await createTransaction(input.fee);
      } catch (error) {
        await updateUser(current.id, { balance: current.balance ?? 0 });
        throw error;
      }

      return {
        ok: true,
        replayed: false,
        sourceBalance: available - totalSourceDebit,
        usdBalance,
      };
    });
  }

  const db = getDb();
  return db.transaction(async tx => {
    // Serialise swaps for this user and source asset across all app instances.
    const lockKey = `${input.user.id}:${input.fromAsset}`;
    await tx.execute(drizzleSql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

    if (input.debit.idempotencyKey) {
      const existingRows = await tx.select().from(transactions).where(and(
        eq(transactions.userId, input.user.id),
        eq(transactions.idempotencyKey, input.debit.idempotencyKey),
      )).limit(1);
      if (existingRows[0]) {
        const balanceRows = await tx.select({ balance: users.balance }).from(users)
          .where(eq(users.id, input.user.id)).limit(1);
        const usdBalance = balanceRows[0]?.balance ?? 0;
        if (existingRows[0].idempotencyFingerprint !== input.debit.idempotencyFingerprint) {
          return { ok: false, balance: usdBalance, reason: 'idempotency_conflict' };
        }
        return { ok: true, replayed: true, sourceBalance: usdBalance, usdBalance };
      }
    }

    let available: number;
    if (input.fromAsset === 'USD') {
      const updated = await tx.update(users)
        .set({
          balance: drizzleSql<number>`ROUND((COALESCE(${users.balance}, 0) - ${totalSourceDebit})::numeric, 2)`,
          updatedAt: new Date(),
        })
        .where(and(
          eq(users.id, input.user.id),
          drizzleSql`COALESCE(${users.balance}, 0) >= ${totalSourceDebit}`,
        ))
        .returning({ balance: users.balance });
      if (!updated[0]) {
        const current = await tx.select({ balance: users.balance }).from(users)
          .where(eq(users.id, input.user.id)).limit(1);
        return { ok: false, balance: current[0]?.balance ?? 0, reason: 'insufficient_funds' };
      }
      available = (updated[0].balance ?? 0) + totalSourceDebit;
    } else {
      const rows = await tx.select({
        balance: drizzleSql<number>`COALESCE(SUM(CASE
          WHEN ${transactions.type} IN ('deposit', 'manual_credit', 'refund', 'crypto_sell') THEN ${transactions.amount}
          WHEN ${transactions.type} IN ('withdrawal', 'manual_debit', 'fee', 'transfer', 'wire_transfer', 'crypto_buy') THEN -${transactions.amount}
          ELSE 0 END), 0)::double precision`,
      })
        .from(transactions)
        .where(and(
          eq(transactions.userId, input.user.id),
          eq(transactions.currency, input.fromAsset),
          eq(transactions.status, 'completed'),
        ));
      available = Number(rows[0]?.balance ?? 0);
      if (available < totalSourceDebit) return { ok: false, balance: available, reason: 'insufficient_funds' };
    }

    if (input.toAsset === 'USD') {
      await tx.update(users)
        .set({
          balance: drizzleSql<number>`ROUND((COALESCE(${users.balance}, 0) + ${input.toAmount})::numeric, 2)`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, input.user.id));
    }

    await tx.insert(transactions).values(insertValues(input.debit));
    await tx.insert(transactions).values(insertValues(input.credit));
    if (input.fee) await tx.insert(transactions).values(insertValues(input.fee));

    const balanceRows = await tx.select({ balance: users.balance }).from(users)
      .where(eq(users.id, input.user.id)).limit(1);
    return {
      ok: true,
      replayed: false,
      sourceBalance: available - totalSourceDebit,
      usdBalance: balanceRows[0]?.balance ?? 0,
    };
  });
}
