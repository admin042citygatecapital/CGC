/**
 * POST /api/users/beneficiaries/delete
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { loadBeneficiaries, saveBeneficiaries } from '../GET.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  const { id } = req.body ?? {};
  if (!id) return res.status(400).json({ error: 'id is required' });

  const list    = loadBeneficiaries(user.id);
  const updated = list.filter(b => b.id !== id);
  saveBeneficiaries(user.id, updated);

  return res.json({ ok: true });
}
