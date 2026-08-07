/**
 * POST /api/users/logout
 * Invalidates the customer's session token server-side.
 * The client should also clear its local token after calling this.
 */
import type { Request, Response } from 'express';
import { deleteCustomerSession } from '../../../lib/customerSessionStore.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';

  if (!token) {
    // Already logged out — treat as success
    return res.json({ ok: true });
  }

  await deleteCustomerSession(token);

  return res.json({ ok: true });
}
