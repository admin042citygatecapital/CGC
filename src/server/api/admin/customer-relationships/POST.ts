import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { createCustomerRelationship, CustomerRelationshipError, RELATIONSHIP_STATUSES, RELATIONSHIP_TYPES, updateCustomerRelationship } from '../../../lib/customerRelationshipStore.js';
import { isOneOf, safeParseId, sanitizeNote, sanitizeString } from '../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const actor = { id: session.adminId, email: session.email, ip: req.ip, correlationId: String(req.get('X-Request-ID') ?? crypto.randomUUID()) };
  try {
    const action = String(req.body?.action ?? 'create');
    if (action === 'create') {
      const customerId = safeParseId(req.body?.customerId); const relatedCustomerId = safeParseId(req.body?.relatedCustomerId);
      const relationshipType = isOneOf(req.body?.relationshipType, RELATIONSHIP_TYPES); const status = isOneOf(req.body?.status ?? 'pending', RELATIONSHIP_STATUSES);
      if (!customerId || !relatedCustomerId || !relationshipType || !status) return res.status(400).json({ error: 'Valid customers, relationship type and status are required.', code: 'INVALID_RELATIONSHIP' });
      const result = await createCustomerRelationship({ customerId, relatedCustomerId, relationshipType, status, label: sanitizeString(req.body?.label, 80), notes: sanitizeNote(req.body?.notes) }, actor);
      return res.status(201).json({ data: result });
    }
    if (action === 'update') {
      const id = safeParseId(req.body?.id); if (!id) return res.status(400).json({ error: 'Valid relationship ID is required.', code: 'INVALID_RELATIONSHIP_ID' });
      const relationshipType = req.body?.relationshipType === undefined ? undefined : isOneOf(req.body.relationshipType, RELATIONSHIP_TYPES);
      const status = req.body?.status === undefined ? undefined : isOneOf(req.body.status, RELATIONSHIP_STATUSES);
      if (req.body?.relationshipType !== undefined && !relationshipType || req.body?.status !== undefined && !status) return res.status(400).json({ error: 'Invalid relationship type or status.', code: 'INVALID_RELATIONSHIP' });
      const result = await updateCustomerRelationship(id, { relationshipType: relationshipType ?? undefined, status: status ?? undefined, label: req.body?.label === undefined ? undefined : sanitizeString(req.body.label, 80), notes: req.body?.notes === undefined ? undefined : sanitizeNote(req.body.notes) }, actor);
      return res.json({ data: result });
    }
    return res.status(400).json({ error: 'Unsupported relationship action.', code: 'INVALID_ACTION' });
  } catch (error) {
    if (error instanceof CustomerRelationshipError) return res.status(error.code === 'DATABASE_REQUIRED' ? 503 : 400).json({ error: error.message, code: error.code });
    console.error('customer.relationship.mutation.error', error);
    return res.status(500).json({ error: 'Unable to update customer relationship.' });
  }
}
