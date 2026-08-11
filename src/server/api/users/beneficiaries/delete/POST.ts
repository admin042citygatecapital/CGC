/**
 * POST /api/users/beneficiaries/delete
 */
import type { Request, Response } from 'express';
import { loadBeneficiaries, saveBeneficiaries } from '../GET.js';
import { verifyCustomerStepUp } from '../../../../lib/customerStepUp.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  const stepUp = await verifyCustomerStepUp(user, req.body);
  if (!stepUp.ok) return res.status(stepUp.status).json({ error: stepUp.error, code: stepUp.code });

  const { id } = req.body ?? {};
  if (!id) return res.status(400).json({ error: 'id is required' });

  const list    = loadBeneficiaries(user.beneficiaries);
  const updated = list.filter(b => b.id !== id);
  if (updated.length === list.length) return res.status(404).json({ error: 'Beneficiary not found' });
  await saveBeneficiaries(user.id, updated);
  appendAudit({ event: 'customer_beneficiary_deleted', userId: user.id, email: user.email, ip: req.ip, meta: { beneficiaryId: id } });

  return res.json({ ok: true });
}
