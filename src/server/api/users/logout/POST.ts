/**
 * POST /api/users/logout
 * Invalidates the customer's HttpOnly session cookie server-side.
 */
import type { Request, Response } from 'express';
import { deleteCustomerSession } from '../../../lib/customerSessionStore.js';
import { clearCustomerSessionCookie } from '../../../lib/customerSessionConfig.js';

export default async function handler(req: Request, res: Response) {
  const token = req.customerToken ?? '';

  if (!token) {
    // Already logged out — treat as success
    return res.json({ ok: true });
  }

  await deleteCustomerSession(token);
  clearCustomerSessionCookie(res);

  return res.json({ ok: true });
}
