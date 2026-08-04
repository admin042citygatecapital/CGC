/**
 * POST /api/users/beneficiaries/update
 * Body: { id: string, name?, nickname?, currency?, bankName?, accountNumber?,
 *         routingNumber?, swiftCode?, network? }
 * Only cosmetic/contact fields are editable in place; `type`, `asset`, and
 * `walletAddress` cannot be changed on an existing beneficiary — delete and
 * re-add instead, so a saved crypto destination can't be silently retargeted.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken, updateUser } from '../../../../lib/userStore.js';
import type { Beneficiary } from '../../../../lib/beneficiaries.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const raw = req.body as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id : '';
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  const existing = (Array.isArray(user.beneficiaries) ? user.beneficiaries : []) as Beneficiary[];
  const idx = existing.findIndex(b => b.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Beneficiary not found' });

  const current = existing[idx];
  const patch: Partial<Beneficiary> = { updatedAt: new Date().toISOString() };
  if (raw.name !== undefined) patch.name = sanitizeString(raw.name, 200);
  if (raw.nickname !== undefined) patch.nickname = sanitizeString(raw.nickname, 100);
  if (raw.currency !== undefined) patch.currency = sanitizeString(raw.currency, 10).toUpperCase();
  if (current.type === 'bank') {
    if (raw.bankName !== undefined) patch.bankName = sanitizeString(raw.bankName, 200);
    if (raw.accountNumber !== undefined) patch.accountNumber = sanitizeString(raw.accountNumber, 50);
    if (raw.routingNumber !== undefined) patch.routingNumber = sanitizeString(raw.routingNumber, 50);
    if (raw.swiftCode !== undefined) patch.swiftCode = sanitizeString(raw.swiftCode, 20);
  } else if (raw.network !== undefined) {
    patch.network = sanitizeString(raw.network, 50);
  }

  const updatedBeneficiary: Beneficiary = { ...current, ...patch };
  const next = [...existing];
  next[idx] = updatedBeneficiary;

  const updated = await updateUser(user.id, { beneficiaries: next } as never);
  if (!updated) return res.status(500).json({ ok: false, error: 'Failed to update beneficiary' });

  appendAudit({ event: 'user_beneficiary_updated', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { beneficiaryId: id } });

  return res.json({ ok: true, beneficiary: updatedBeneficiary, beneficiaries: next });
}
