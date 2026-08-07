/**
 * POST /api/users/beneficiaries/add
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { loadBeneficiaries, saveBeneficiaries } from '../GET.js';
import type { Beneficiary } from '../GET.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';
import crypto from 'node:crypto';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  const { name, accountNumber, bankName, country, currency, email, note } = req.body ?? {};

  if (!name || !accountNumber || !bankName || !country || !currency)
    return res.status(400).json({ error: 'name, accountNumber, bankName, country, and currency are required' });

  const beneficiary: Beneficiary = {
    id:            'bene_' + crypto.randomBytes(6).toString('hex'),
    name:          sanitizeString(String(name),          200),
    accountNumber: sanitizeString(String(accountNumber), 100),
    bankName:      sanitizeString(String(bankName),      200),
    country:       sanitizeString(String(country),       100),
    currency:      sanitizeString(String(currency),      10),
    email:         email ? sanitizeString(String(email), 200) : undefined,
    note:          note  ? sanitizeString(String(note),  500) : undefined,
    createdAt:     new Date().toISOString(),
  };

  const list = loadBeneficiaries(user.id);
  list.unshift(beneficiary);
  saveBeneficiaries(user.id, list);

  return res.status(201).json({ ok: true, beneficiary });
}
