/**
 * POST /api/users/beneficiaries/update
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { loadBeneficiaries, saveBeneficiaries } from '../GET.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  const { id, name, accountNumber, bankName, country, currency, email, note } = req.body ?? {};
  if (!id) return res.status(400).json({ error: 'id is required' });

  const list = loadBeneficiaries(user.id);
  const idx  = list.findIndex(b => b.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Beneficiary not found' });

  if (name)          list[idx].name          = sanitizeString(String(name),          200);
  if (accountNumber) list[idx].accountNumber = sanitizeString(String(accountNumber), 100);
  if (bankName)      list[idx].bankName      = sanitizeString(String(bankName),      200);
  if (country)       list[idx].country       = sanitizeString(String(country),       100);
  if (currency)      list[idx].currency      = sanitizeString(String(currency),      10);
  if (email !== undefined) list[idx].email   = email ? sanitizeString(String(email), 200) : undefined;
  if (note  !== undefined) list[idx].note    = note  ? sanitizeString(String(note),  500) : undefined;

  saveBeneficiaries(user.id, list);

  return res.json({ ok: true, beneficiary: list[idx] });
}
