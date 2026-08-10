/** POST /api/users/cards/request — disabled until cards enter an approved sponsor scope. */
import type { Request, Response } from 'express';
import { requireCardOperations } from '../../../../lib/platformMode.js';

export default function handler(req: Request, res: Response) {
  if (!req.customerUser) return res.status(401).json({ error: 'Authentication required' });
  if (!requireCardOperations(res)) return;
  return res.status(501).json({ error: 'Card request route is not implemented', code: 'CARD_ISSUER_ROUTE_NOT_IMPLEMENTED' });
}
