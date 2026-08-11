import type { Request, Response } from 'express';
import { updateUser } from '../../../lib/userStore.js';

export type BeneficiaryVerification = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface Beneficiary {
  id: string;
  name: string;
  type: 'individual' | 'business';
  accountNumber: string;
  bankName: string;
  bankCode?: string;
  country: string;
  currency: string;
  email?: string;
  reference?: string;
  favorite: boolean;
  verificationState: BeneficiaryVerification;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export function loadBeneficiaries(value: unknown): Beneficiary[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Beneficiary => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Partial<Beneficiary>;
    return typeof row.id === 'string' && typeof row.name === 'string' && typeof row.accountNumber === 'string';
  }).map(row => ({
    ...row,
    type: row.type === 'business' ? 'business' : 'individual',
    favorite: row.favorite === true,
    verificationState: row.verificationState ?? 'unverified',
    updatedAt: row.updatedAt ?? row.createdAt,
  }));
}

export async function saveBeneficiaries(userId: string, list: Beneficiary[]) {
  await updateUser(userId, { beneficiaries: list });
}

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  const query = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase().slice(0, 100) : '';
  const list = loadBeneficiaries(user.beneficiaries)
    .filter(item => !query || [item.name, item.bankName, item.currency, item.country].some(value => value.toLowerCase().includes(query)))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || Date.parse(b.lastUsedAt ?? b.createdAt) - Date.parse(a.lastUsedAt ?? a.createdAt));
  return res.json({ beneficiaries: list });
}
