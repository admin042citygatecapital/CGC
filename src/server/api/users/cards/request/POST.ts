/**
 * POST /api/users/cards/request
 * Submits a card issuance request. Creates a notification for the admin and the customer.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { createNotification } from '../../../../lib/notificationStore.js';
import { requireFinancialOperations } from '../../../../lib/platformMode.js';
import { requireCustomerFinancialAccess } from '../../../../lib/complianceGate.js';
import { createOperationsItem } from '../../../../lib/operationsInboxStore.js';
import { requireIntakeEnabled } from '../../../../lib/operationalControls.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });
  if (!requireIntakeEnabled(res, 'cardRequestsEnabled')) return;
  if (!requireFinancialOperations(res)) return;

  if (!await requireCustomerFinancialAccess(user, res)) return;

  // Notify the customer
  await createNotification(
    user.id,
    'Card Request Received',
    'Your card request has been received. Our team will issue your card within 1–2 business days.',
    '/dashboard/cards',
  );

  await createOperationsItem({
    source: 'card_request', referenceId: `${user.id}:${Date.now()}`, title: 'Card issuance request',
    summary: `${user.name} requested a new payment card.`, requesterName: user.name,
    requesterEmail: user.email, userId: user.id, priority: 'high',
  });

  return res.status(201).json({ ok: true, message: 'Card request submitted successfully.' });
}
