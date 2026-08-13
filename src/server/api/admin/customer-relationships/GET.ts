import type { Request, Response } from 'express';
import { CustomerRelationshipError, listCustomerRelationships } from '../../../lib/customerRelationshipStore.js';
import { safeParseId } from '../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  try {
    const rawCustomerId = String(req.query.customerId ?? '').trim();
    const customerId = rawCustomerId ? safeParseId(rawCustomerId) : undefined;
    if (rawCustomerId && !customerId) return res.status(400).json({ error: 'Invalid customer ID.', code: 'INVALID_CUSTOMER_ID' });
    return res.json({ data: await listCustomerRelationships(customerId ?? undefined), relationshipMetadataOnly: true });
  } catch (error) {
    if (error instanceof CustomerRelationshipError) return res.status(error.code === 'DATABASE_REQUIRED' ? 503 : 400).json({ error: error.message, code: error.code });
    console.error('customer.relationship.list.error', error);
    return res.status(500).json({ error: 'Unable to load customer relationships.' });
  }
}
