/** Data-minimised account-interest intake. */
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { sanitizeString, isValidEmail } from '../../../lib/inputValidator.js';
import { createOperationsItem } from '../../../lib/operationsInboxStore.js';
import { requireIntakeEnabled } from '../../../lib/operationalControls.js';

const VALID_ACCOUNT_TYPES = new Set(['personal', 'savings', 'business']);
const PROHIBITED_FIELDS = ['dob', 'gender', 'address', 'govIdNumber', 'tin', 'password', 'confirmPassword', 'otp', 'document'];

export default async function handler(req: Request, res: Response) {
  try {
    if (!requireIntakeEnabled(res, 'accountApplicationsEnabled')) return;
    const raw = req.body as Record<string, unknown>;
    const firstName = sanitizeString(raw.firstName);
    const lastName = sanitizeString(raw.lastName);
    const email = sanitizeString(raw.email).toLowerCase();
    const phone = sanitizeString(raw.phone);
    const nationality = sanitizeString(raw.nationality);
    const accountType = sanitizeString(raw.accountType).toLowerCase();
    const additionalNotes = sanitizeString(raw.additionalNotes).slice(0, 1_000);

    if (PROHIBITED_FIELDS.some(field => sanitizeString(raw[field]).length > 0)) {
      return res.status(400).json({ error: 'Do not submit identity, tax, address, password, OTP, or document data through this application form.' });
    }
    if (!firstName) return res.status(400).json({ error: 'First name is required.' });
    if (!lastName) return res.status(400).json({ error: 'Last name is required.' });
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'A valid email address is required.' });
    if (!phone) return res.status(400).json({ error: 'Phone number is required.' });
    if (!VALID_ACCOUNT_TYPES.has(accountType)) return res.status(400).json({ error: 'Invalid account type.' });

    const applicationId = `app_${crypto.randomBytes(12).toString('hex')}`;
    await createOperationsItem({
      source: 'account_application',
      referenceId: applicationId,
      title: `Account application: ${firstName} ${lastName}`,
      summary: additionalNotes || `${accountType} account application from ${nationality || 'unspecified nationality'}`,
      requesterName: `${firstName} ${lastName}`,
      requesterEmail: email,
      priority: accountType === 'business' ? 'high' : 'normal',
      metadata: { accountType, nationality: nationality || 'unspecified', phone, requestIp: req.ip ?? 'unknown' },
    });

    return res.status(201).json({
      ok: true,
      applicationId,
      status: 'pending',
      message: 'Application received. We will contact you about the next appropriate step.',
    });
  } catch (error) {
    console.error('accounts.apply.error', error instanceof Error ? error.message : 'unknown');
    return res.status(500).json({ error: 'We could not submit your application. Please try again.' });
  }
}
