/**
 * POST /api/users/beneficiaries/update
 */
import type { Request, Response } from 'express';
import { loadBeneficiaries, saveBeneficiaries } from '../GET.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';
import { verifyCustomerStepUp } from '../../../../lib/customerStepUp.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  const stepUp = await verifyCustomerStepUp(user, req.body);
  if (!stepUp.ok) return res.status(stepUp.status).json({ error: stepUp.error, code: stepUp.code });

  const { id, name, type, accountNumber, bankName, bankCode, country, currency, email, reference, favorite } = req.body ?? {};
  if (!id) return res.status(400).json({ error: 'id is required' });

  const list = loadBeneficiaries(user.beneficiaries);
  const idx  = list.findIndex(b => b.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Beneficiary not found' });

  if (name)          list[idx].name          = sanitizeString(String(name),          200);
  if (type === 'individual' || type === 'business') list[idx].type = type;
  if (accountNumber) list[idx].accountNumber = sanitizeString(String(accountNumber), 100);
  if (bankName)      list[idx].bankName      = sanitizeString(String(bankName),      200);
  if (country)       list[idx].country       = sanitizeString(String(country),       100);
  if (currency)      list[idx].currency      = sanitizeString(String(currency),      10);
  if (bankCode !== undefined) list[idx].bankCode = bankCode ? sanitizeString(String(bankCode), 50) : undefined;
  if (email !== undefined) list[idx].email   = email ? sanitizeString(String(email), 200) : undefined;
  if (reference !== undefined) list[idx].reference = reference ? sanitizeString(String(reference), 140) : undefined;
  if (typeof favorite === 'boolean') list[idx].favorite = favorite;
  list[idx].updatedAt = new Date().toISOString();
  if (accountNumber || bankName || bankCode || country || currency) list[idx].verificationState = 'unverified';

  await saveBeneficiaries(user.id, list);
  appendAudit({ event: 'customer_beneficiary_updated', userId: user.id, email: user.email, ip: req.ip, meta: { beneficiaryId: list[idx].id } });

  return res.json({ ok: true, beneficiary: list[idx] });
}
