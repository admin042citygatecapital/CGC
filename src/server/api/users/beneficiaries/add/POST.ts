/**
 * POST /api/users/beneficiaries/add
 * Body (bank): { type: 'bank', name, bankName, accountNumber, routingNumber?, swiftCode?, nickname?, currency? }
 * Body (crypto): { type: 'crypto', name, asset, walletAddress, network?, nickname?, currency? }
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken, updateUser } from '../../../../lib/userStore.js';
import { buildBeneficiary, newBeneficiaryId, type Beneficiary } from '../../../../lib/beneficiaries.js';
import { appendAudit } from '../../../../lib/auditLog.js';

const MAX_BENEFICIARIES = 50;

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const existing = (Array.isArray(user.beneficiaries) ? user.beneficiaries : []) as Beneficiary[];
  if (existing.length >= MAX_BENEFICIARIES) {
    return res.status(400).json({ ok: false, error: `You can save up to ${MAX_BENEFICIARIES} beneficiaries` });
  }

  const built = buildBeneficiary(req.body as Record<string, unknown>);
  if (!built.ok) return res.status(400).json({ ok: false, error: built.error });

  const now = new Date().toISOString();
  const beneficiary: Beneficiary = { ...built.data, id: newBeneficiaryId(), createdAt: now, updatedAt: now };
  const next = [...existing, beneficiary];

  const updated = await updateUser(user.id, { beneficiaries: next } as never);
  if (!updated) return res.status(500).json({ ok: false, error: 'Failed to save beneficiary' });

  appendAudit({ event: 'user_beneficiary_added', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { beneficiaryId: beneficiary.id, type: beneficiary.type } });

  return res.status(201).json({ ok: true, beneficiary, beneficiaries: next });
}
