import type { Request, Response } from 'express';
import { listPlaidItems } from '../../../lib/plaidSandbox.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  try { return res.json({ items: await listPlaidItems(user.id), environment: 'sandbox' }); }
  catch { return res.status(503).json({ error: 'Linked accounts are temporarily unavailable' }); }
}
