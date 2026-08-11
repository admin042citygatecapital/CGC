import type { Request, Response } from 'express';
import type { Currency } from '../../../lib/providerContracts.js';
import { runProviderSandbox } from '../../../lib/providerSandboxStore.js';
import { ProviderSandboxError } from '../../../lib/syntheticProviderSandbox.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  try {
    const idempotencyKey = String(req.get('Idempotency-Key') ?? req.body?.idempotencyKey ?? '');
    const run = await runProviderSandbox({
      idempotencyKey,
      subjectType: String(req.body?.subjectType ?? '') as 'individual' | 'business',
      currencies: Array.isArray(req.body?.currencies) ? req.body.currencies.map(String) as Currency[] : undefined,
    }, { id: session.adminId, email: session.email, ip: req.ip });
    return res.status(201).json(run);
  } catch (error) {
    if (error instanceof ProviderSandboxError) return res.status(error.code === 'DATABASE_REQUIRED' ? 503 : 400).json({ error: error.message, code: error.code });
    console.error('provider.sandbox.run.error', error);
    return res.status(500).json({ error: 'Provider sandbox run failed.', code: 'INTERNAL_ERROR' });
  }
}
