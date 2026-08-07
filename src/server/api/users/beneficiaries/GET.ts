/**
 * GET /api/users/beneficiaries
 * Returns saved beneficiaries for the customer (stored in user record).
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import fs from 'node:fs';
import path from 'node:path';

const BENE_DIR  = '/private/beneficiaries';
const beneFile  = (userId: string) => path.join(BENE_DIR, `${userId}.json`);

export interface Beneficiary {
  id:              string;
  name:            string;
  accountNumber:   string;
  bankName:        string;
  country:         string;
  currency:        string;
  email?:          string;
  note?:           string;
  createdAt:       string;
}

export function loadBeneficiaries(userId: string): Beneficiary[] {
  try {
    const f = beneFile(userId);
    if (!fs.existsSync(f)) return [];
    return JSON.parse(fs.readFileSync(f, 'utf8')) as Beneficiary[];
  } catch { return []; }
}

export function saveBeneficiaries(userId: string, list: Beneficiary[]) {
  if (!fs.existsSync(BENE_DIR)) fs.mkdirSync(BENE_DIR, { recursive: true });
  fs.writeFileSync(beneFile(userId), JSON.stringify(list, null, 2));
}

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  return res.json({ beneficiaries: loadBeneficiaries(user.id) });
}
