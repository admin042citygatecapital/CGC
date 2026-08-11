import type { Request, Response } from 'express';
import { appendAudit } from '../../../../lib/auditLog.js';
import { exchangePlaidToken } from '../../../../lib/plaidSandbox.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  const publicToken = typeof req.body?.publicToken === 'string' ? req.body.publicToken.trim() : '';
  if (!/^public-sandbox-[A-Za-z0-9-]{10,200}$/.test(publicToken)) return res.status(400).json({ error: 'Invalid sandbox public token' });
  const metadata = req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};
  try {
    const linked = await exchangePlaidToken(user.id, publicToken, metadata);
    appendAudit({ event: 'customer_plaid_item_linked', userId: user.id, email: user.email, ip: req.ip, meta: { itemId: linked.itemId, environment: 'sandbox' } });
    return res.status(201).json({ ok: true, item: linked, environment: 'sandbox' });
  } catch (error) {
    console.error(JSON.stringify({ event: 'plaid.exchange.failed', userId: user.id, error: error instanceof Error ? error.message : 'unknown' }));
    return res.status(502).json({ error: 'Unable to complete bank connection' });
  }
}
