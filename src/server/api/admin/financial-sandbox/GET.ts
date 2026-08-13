import type { Request, Response } from 'express';
import { financialSandbox } from '../../../lib/financialSandboxStore.js';

function serialize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item));
}

export default async function handler(req: Request, res: Response) {
  const result = await financialSandbox.listTransactions({ search: String(req.query.search ?? ''), status: String(req.query.status ?? ''), asset: String(req.query.asset ?? ''), page: Number(req.query.page ?? 1), pageSize: Number(req.query.pageSize ?? 20) });
  return res.json(serialize({ ...result, accounts: await financialSandbox.listAccounts(), syntheticOnly: true, executionSource: 'SIMULATION', liveProviderAdaptersImplemented: false }));
}
