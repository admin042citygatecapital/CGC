import type { Request, Response } from 'express';
import { appendAudit } from '../../../../lib/auditLog.js';
import { disconnectPlaidItem } from '../../../../lib/plaidSandbox.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  const id = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
  if (!/^plaid_[a-f0-9]{24}$/.test(id)) return res.status(400).json({ error: 'Invalid connection ID' });
  try {
    const removed = await disconnectPlaidItem(user.id, id);
    if (!removed) return res.status(404).json({ error: 'Connection not found' });
    appendAudit({ event: 'customer_plaid_item_disconnected', userId: user.id, email: user.email, ip: req.ip, meta: { connectionId: id, environment: 'sandbox' } });
    return res.json({ ok: true });
  } catch { return res.status(502).json({ error: 'Unable to disconnect the institution' }); }
}
