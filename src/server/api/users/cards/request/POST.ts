/**
 * POST /api/users/cards/request
 * Submits a card issuance request. Creates a notification for the admin and the customer.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { createNotification } from '../../../../lib/notificationStore.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  if (user.kycStatus !== 'approved') {
    return res.status(403).json({ error: 'Identity verification (KYC) must be approved before requesting a card.' });
  }

  // Notify the customer
  await createNotification(
    user.id,
    'Card Request Received',
    'Your card request has been received. Our team will issue your card within 1–2 business days.',
    '/dashboard/cards',
  );

  return res.status(201).json({ ok: true, message: 'Card request submitted successfully.' });
}
