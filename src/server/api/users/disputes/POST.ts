import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { syntheticDisputes, SyntheticDisputeError, type DisputeActor } from '../../../lib/syntheticDisputes.js';

export default async function handler(req: Request, res: Response) {
  const customer = req.customerUser;
  if (!customer) return res.status(401).json({ error: 'Authentication required' });

  const actor: DisputeActor = {
    id: customer.id,
    email: customer.email,
    ip: req.ip,
    correlationId: String(req.get('X-Request-ID') ?? crypto.randomUUID()),
    actorType: 'customer',
  };

  try {
    const result = await syntheticDisputes.createForCustomer({
      transactionId: req.body?.transactionId,
      category: req.body?.category,
      claim: req.body?.claim,
      idempotencyKey: req.get('Idempotency-Key'),
    }, customer, actor);
    const visible = (await syntheticDisputes.listForCustomer(customer.id)).find(item => item.id === result.case.id);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(result.replayed ? 200 : 201).json({ case: visible, replayed: result.replayed });
  } catch (error) {
    if (error instanceof SyntheticDisputeError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error('customer.dispute.submit.error', {
      customerId: customer.id,
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    return res.status(500).json({ error: 'Your dispute could not be submitted.', code: 'INTERNAL_ERROR' });
  }
}
