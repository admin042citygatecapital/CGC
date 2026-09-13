/** POST /api/admin/cards/freeze — disabled until an approved issuer adapter exists. */
import type { Request, Response } from 'express';
import { LIVE_CARD_ISSUER_ADAPTER_IMPLEMENTED, requireCardOperations } from '../../../../lib/platformMode.js';

export default function handler(req: Request, res: Response) {
  if (!req.adminSession) return res.status(401).json({ error: 'Authentication required' });
  // No issuance provider is contracted, so this mutation is not implemented
  // rather than temporarily unavailable. Refuse with the operator-facing state.
  if (!LIVE_CARD_ISSUER_ADAPTER_IMPLEMENTED) {
    return res.status(501).json({
      error: 'Card freeze and unfreeze are unavailable: no card issuer-processor is contracted for this platform, so card records remain read-only.',
      code: 'CARD_PROVIDER_NOT_CONFIGURED',
    });
  }
  if (!requireCardOperations(res)) return;
  return res.status(501).json({ error: 'Card lifecycle route is not implemented', code: 'CARD_ISSUER_ROUTE_NOT_IMPLEMENTED' });
}
