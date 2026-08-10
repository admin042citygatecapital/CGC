/** POST /api/users/cards/delete — disabled until an approved issuer adapter exists. */
import type { Request, Response } from 'express';
import { requireCardOperations } from '../../../../lib/platformMode.js';

export default function handler(req: Request, res: Response) {
  if (!req.customerUser) return res.status(401).json({ error: 'Authentication required' });
  if (!requireCardOperations(res)) return;
  return res.status(501).json({ error: 'Card lifecycle route is not implemented', code: 'CARD_ISSUER_ROUTE_NOT_IMPLEMENTED' });
}
