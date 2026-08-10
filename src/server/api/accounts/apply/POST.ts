/**
 * POST /api/accounts/apply
 * Stores a new account application to /private/accounts/applications.jsonl
 */
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeString, isValidEmail } from '../../../lib/inputValidator.js';
import { createOperationsItem } from '../../../lib/operationsInboxStore.js';
import { requireIntakeEnabled } from '../../../lib/operationalControls.js';
import { privateSubdirectory } from '../../../lib/storagePaths.js';

const DATA_DIR  = privateSubdirectory('accounts');
const DATA_FILE = path.join(DATA_DIR, 'applications.jsonl');

interface Application {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  gender?: string;
  nationality: string;
  address: string;
  accountType: string;
  govIdNumber: string;
  tin?: string;
  additionalNotes?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  ip: string;
}

const VALID_ACCOUNT_TYPES = new Set(['personal', 'savings', 'business']);

export default async function handler(req: Request, res: Response) {
  try {
    if (!requireIntakeEnabled(res, 'accountApplicationsEnabled')) return;
    const raw = req.body as Record<string, unknown>;

    // Sanitize all string inputs
    const firstName    = sanitizeString(raw.firstName);
    const lastName     = sanitizeString(raw.lastName);
    const email        = sanitizeString(raw.email).toLowerCase();
    const phone        = sanitizeString(raw.phone);
    const dob          = sanitizeString(raw.dob);
    const gender       = sanitizeString(raw.gender);
    const nationality  = sanitizeString(raw.nationality);
    const address      = sanitizeString(raw.address);
    const accountType  = sanitizeString(raw.accountType).toLowerCase();
    const govIdNumber  = sanitizeString(raw.govIdNumber);
    const tin          = sanitizeString(raw.tin);
    const additionalNotes = sanitizeString(raw.additionalNotes).slice(0, 1000);

    // Validation
    if (!firstName) return res.status(400).json({ error: 'First name is required.' });
    if (!lastName)  return res.status(400).json({ error: 'Last name is required.' });
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'A valid email address is required.' });
    if (!phone)     return res.status(400).json({ error: 'Phone number is required.' });
    if (!accountType || !VALID_ACCOUNT_TYPES.has(accountType)) {
      return res.status(400).json({ error: 'Invalid account type.' });
    }

    const application: Application = {
      id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      firstName,
      lastName,
      email,
      phone,
      dob,
      gender:    gender || undefined,
      nationality,
      address,
      accountType,
      govIdNumber,
      tin:       tin || undefined,
      additionalNotes: additionalNotes || undefined,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      ip: req.ip ?? 'unknown',
    };

    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(DATA_FILE, JSON.stringify(application) + '\n', 'utf8');

    await createOperationsItem({
      source: 'account_application',
      referenceId: application.id,
      title: `Account application: ${firstName} ${lastName}`,
      summary: additionalNotes || `${accountType} account application from ${nationality || 'unspecified nationality'}`,
      requesterName: `${firstName} ${lastName}`,
      requesterEmail: email,
      priority: accountType === 'business' ? 'high' : 'normal',
      metadata: { accountType, nationality: nationality || 'unspecified' },
    });

    return res.status(201).json({
      ok: true,
      applicationId: application.id,
      status: 'pending',
      message: 'Application received. You will receive a confirmation email shortly.',
    });
  } catch (err) {
    console.error('accounts.apply.error', err);
    return res.status(500).json({ error: 'Failed to submit application' });
  }
}
