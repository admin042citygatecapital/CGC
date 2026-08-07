/**
 * POST /api/users/notifications/preferences
 * Save notification preferences for the customer.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { loadPrefs, savePrefs } from './GET.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  const current = loadPrefs(user.id);
  const body    = req.body ?? {};

  const updated = {
    email:       typeof body.email       === 'boolean' ? body.email       : current.email,
    push:        typeof body.push        === 'boolean' ? body.push        : current.push,
    sms:         typeof body.sms         === 'boolean' ? body.sms         : current.sms,
    deposits:    typeof body.deposits    === 'boolean' ? body.deposits    : current.deposits,
    withdrawals: typeof body.withdrawals === 'boolean' ? body.withdrawals : current.withdrawals,
    transfers:   typeof body.transfers   === 'boolean' ? body.transfers   : current.transfers,
    security:    typeof body.security    === 'boolean' ? body.security    : current.security,
    marketing:   typeof body.marketing   === 'boolean' ? body.marketing   : current.marketing,
  };

  savePrefs(user.id, updated);
  return res.json({ ok: true, preferences: updated });
}
