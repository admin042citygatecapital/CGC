/**
 * GET /api/admin/transactions
 *
 * Compatibility route for the persistent administration transaction register.
 * Records come from the configured transaction store; this route must never
 * generate illustrative customers, references, dates, or monetary amounts.
 */
import type { Request, Response } from 'express';
import {
  queryTransactions,
  txStats,
  type TxCurrency,
  type TxStatus,
  type TxType,
} from '../../../lib/transactionStore.js';

function positiveInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function handler(req: Request, res: Response) {
  const page = positiveInt(req.query.page, 1);
  const limit = Math.min(100, positiveInt(req.query.limit, 25));
  const type = String(req.query.type ?? '').trim();
  const status = String(req.query.status ?? '').trim();
  const currency = String(req.query.currency ?? '').trim();
  const search = String(req.query.search ?? '').trim();

  const result = await queryTransactions({
    page,
    limit,
    type: type ? type as TxType : undefined,
    status: status ? status as TxStatus : undefined,
    currency: currency ? currency as TxCurrency : undefined,
    search: search || undefined,
  });

  return res.json({
    ...result,
    stats: await txStats(),
    page,
    limit,
    pages: Math.max(1, Math.ceil(result.total / limit)),
    dataClassification: 'synthetic_preview',
    authoritativeSource: 'application_transaction_store',
  });
}
