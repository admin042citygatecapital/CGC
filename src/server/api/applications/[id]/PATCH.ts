/**
 * PATCH /api/applications/:id — save one step of an application.
 *
 * Ownership: only the linked customer (or the anonymous applicant in possession
 * of the application id, until an identity is linked) may edit. The
 * verification step can never be self-asserted — the server derives
 * `verified` from the linked user's actual emailVerified state.
 */
import type { Request, Response } from 'express';
import { APPLICATION_FLOWS, type AccountType } from '../../../../shared/applicationFlow.js';
import { getApplication, saveStep, linkUser, markEmailVerified, recordEvent } from '../../../lib/applicationsStore.js';
import { isDatabaseConfigured } from '../../../db/db.js';
import { findUserById, createUserWithRegistrationCase } from '../../../lib/userStore.js';
import { hashPassword } from '../../../lib/passwordHash.js';
import { sendVerificationEmail } from '../../../lib/emailService.js';
import crypto from 'node:crypto';

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: 'Applications are unavailable while the database is offline.' });
    return;
  }
  const { id } = req.params as { id?: string };
  const { stepId, data } = (req.body ?? {}) as { stepId?: unknown; data?: unknown };
  const dataRec = (data ?? {}) as Record<string, unknown>;
  if (!id || typeof stepId !== 'string' || !data || typeof data !== 'object') {
    res.status(400).json({ error: 'application id, stepId and data are required.' });
    return;
  }
  const app = await getApplication(id);
  if (!app) {
    res.status(404).json({ error: 'Application not found.' });
    return;
  }

  // Ownership gate: linked customers only through their session; anonymous
  // drafts are editable only while no identity is linked.
  const session = (req as { customerUser?: { id: string; email: string } }).customerUser;
  if (app.userId) {
    if (!session || session.id !== app.userId) {
      res.status(403).json({ error: 'You do not have access to this application.' });
      return;
    }
  } else if (stepId !== 'contact') {
    res.status(403).json({ error: 'Complete the login-identity step before continuing.' });
    return;
  }

  const type = app.accountType as AccountType;
  const step = APPLICATION_FLOWS[type]?.find(s => s.id === stepId);
  if (!step) {
    res.status(400).json({ error: 'Unknown step for this application type.' });
    return;
  }

  // Identity step: link an existing verified customer, or provision a new one
  // through the platform's registration path — always hashed, never plaintext,
  // and always with a real verification email.
  if (stepId === 'contact') {
    const email = String(dataRec.email ?? '').toLowerCase();
    const existing = await findUserByEmailForApplication(email);
    if (existing) {
      if (session?.id === existing.id) {
        await linkUser(id, existing.id, email);
      } else {
        res.status(409).json({
          error: 'A verified customer already exists with this email. Sign in to apply for an additional account.',
          code: 'EXISTING_CUSTOMER',
        });
        return;
      }
    } else if (!app.userId) {
      const password = typeof dataRec.password === 'string' ? dataRec.password : '';
      const verifyToken = crypto.randomBytes(32).toString('hex');
      const { user } = await createUserWithRegistrationCase({
        email,
        name: email.split('@')[0],
        passwordHash: await hashPassword(password),
        emailVerifyToken: verifyToken,
        emailVerifyExpiry: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        ip: req.ip ?? 'unknown',
        status: 'pending_verification',
        kycStatus: 'not_submitted',
        emailVerified: false,
      }, 'individual');
      await linkUser(id, user.id, email);
      const env = process.env.PUBLIC_URL || process.env.SITE_URL;
      const base = (env ? env.replace(/\/+$/, '') : `${req.protocol}://${req.hostname}`);
      await sendVerificationEmail(email, user.name, verifyToken, base).catch(() => {
        console.error(JSON.stringify({ event: 'applications.verification_email_failed', applicationId: id }));
      });
      await recordEvent(id, email, null, 'IDENTITY_CREATED', {});
    }
  }

  // Verification step: server-derived truth only.
  if (stepId === 'verification') {
    if (!app.userId) {
      res.status(400).json({ error: 'Link your login identity before verification.' });
      return;
    }
    const user = await findUserById(app.userId);
    if (!user || !user.emailVerified) {
      res.status(400).json({ error: 'Your email address is not verified yet. Use the link we emailed you.' });
      return;
    }
    // The verified address must be the one actually recorded on the
    // application — a contact re-save that changed the email invalidates
    // verification carried over from a previous address.
    if ((user.email ?? '').toLowerCase() !== (app.email ?? '').toLowerCase()) {
      res.status(400).json({ error: 'The application email changed after verification — re-verify the new address.' });
      return;
    }
    await markEmailVerified(id, app.email || 'applicant');
    const updated = await getApplication(id);
    res.json({ ok: true, application: updated });
    return;
  }

  const result = await saveStep({
    applicationId: id,
    stepId: String(stepId),
    data: data as Record<string, unknown>,
    actor: session?.email ?? app.email ?? 'anonymous',
  });
  if (!result.ok) {
    res.status(result.errors ? 400 : 409).json({ error: result.error, errors: result.errors });
    return;
  }
  res.json({ ok: true, application: result.row });
}

async function findUserByEmailForApplication(email: string): Promise<{ id: string } | null> {
  if (!email) return null;
  const { findUserByEmail } = await import('../../../lib/userStore.js');
  const user = await findUserByEmail(email);
  return user ? { id: user.id } : null;
}