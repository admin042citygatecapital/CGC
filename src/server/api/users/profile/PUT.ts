/**
 * PUT /api/users/profile
 * Update customer name, phone, and address.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken, updateUser } from '../../../lib/userStore.js';
import { sanitizeString } from '../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  const { name, phone, address } = req.body ?? {};

  const safeName    = name    ? sanitizeString(String(name),    100) : undefined;
  const safePhone   = phone   ? sanitizeString(String(phone),   30)  : undefined;
  const safeAddress = address ? sanitizeString(String(address), 300) : undefined;

  if (safeName !== undefined && !safeName) {
    return res.status(400).json({ error: 'Name cannot be empty' });
  }

  const updates: Record<string, string> = {};
  if (safeName    !== undefined) updates.name    = safeName;
  if (safePhone   !== undefined) updates.phone   = safePhone;
  if (safeAddress !== undefined) updates.address = safeAddress;

  await updateUser(user.id, updates);

  return res.json({ ok: true });
}
