/**
 * POST /api/users/beneficiaries/add
 */
import type { Request, Response } from 'express';
import { loadBeneficiaries, saveBeneficiaries } from '../GET.js';
import type { Beneficiary } from '../GET.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';
import crypto from 'node:crypto';
import { verifyCustomerStepUp } from '../../../../lib/customerStepUp.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  const stepUp = await verifyCustomerStepUp(user, req.body);
  if (!stepUp.ok) return res.status(stepUp.status).json({ error: stepUp.error, code: stepUp.code });

  const { name, type, accountNumber, bankName, bankCode, country, currency, email, reference } = req.body ?? {};

  if (!name || !accountNumber || !bankName || !country || !currency)
    return res.status(400).json({ error: 'name, accountNumber, bankName, country, and currency are required' });

  const beneficiary: Beneficiary = {
    id:            'bene_' + crypto.randomBytes(6).toString('hex'),
    name:          sanitizeString(String(name),          200),
    type:          type === 'business' ? 'business' : 'individual',
    accountNumber: sanitizeString(String(accountNumber), 100),
    bankName:      sanitizeString(String(bankName),      200),
    country:       sanitizeString(String(country),       100),
    currency:      sanitizeString(String(currency),      10),
    bankCode:      bankCode ? sanitizeString(String(bankCode), 50) : undefined,
    email:         email ? sanitizeString(String(email), 200) : undefined,
    reference:     reference ? sanitizeString(String(reference), 140) : undefined,
    favorite:      false,
    verificationState: 'unverified',
    createdAt:     new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
  };

  const list = loadBeneficiaries(user.beneficiaries);
  list.unshift(beneficiary);
  await saveBeneficiaries(user.id, list);
  appendAudit({ event: 'customer_beneficiary_created', userId: user.id, email: user.email, ip: req.ip, meta: { beneficiaryId: beneficiary.id } });

  return res.status(201).json({ ok: true, beneficiary });
}
