import type { Request, Response } from 'express';
import { appendAudit } from '../../../../lib/auditLog.js';
import { createPlaidLinkToken } from '../../../../lib/plaidSandbox.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const result = await createPlaidLinkToken({ id: user.id, email: user.email });
    appendAudit({ event: 'customer_plaid_link_started', userId: user.id, email: user.email, ip: req.ip, meta: { environment: 'sandbox' } });
    return res.json({ linkToken: result.link_token, expiration: result.expiration, environment: 'sandbox' });
  } catch (error) {
    console.error(JSON.stringify({ event: 'plaid.link_token.failed', userId: user.id, error: error instanceof Error ? error.message : 'unknown' }));
    return res.status(503).json({ error: 'Bank connection is temporarily unavailable' });
  }
}
