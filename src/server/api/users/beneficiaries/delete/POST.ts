/**
 * POST /api/users/beneficiaries/delete
 * Body: { id: string }
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken, updateUser } from '../../../../lib/userStore.js';
import type { Beneficiary } from '../../../../lib/beneficiaries.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { id } = req.body as { id?: string };
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  const existing = (Array.isArray(user.beneficiaries) ? user.beneficiaries : []) as Beneficiary[];
  const next = existing.filter(b => b.id !== id);
  if (next.length === existing.length) {
    return res.status(404).json({ ok: false, error: 'Beneficiary not found' });
  }

  const updated = await updateUser(user.id, { beneficiaries: next } as never);
  if (!updated) return res.status(500).json({ ok: false, error: 'Failed to delete beneficiary' });

  appendAudit({ event: 'user_beneficiary_deleted', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { beneficiaryId: id } });

  return res.json({ ok: true, beneficiaries: next });
}
