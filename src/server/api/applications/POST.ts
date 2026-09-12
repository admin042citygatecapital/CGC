/**
 * POST /api/applications — start an account application.
 *
 * Authenticated customers start an additional application linked to their
 * identity (no duplicate users); anonymous visitors create a draft that links
 * to their identity at the contact step. Rate-limited globally at /api.
 */
import type { Request, Response } from 'express';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_META, ACCOUNT_PLANS, type AccountType } from '../../../shared/applicationFlow.js';
import { createApplication } from '../../lib/applicationsStore.js';
import { isDatabaseConfigured } from '../../db/db.js';

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: 'Applications are unavailable while the database is offline.' });
    return;
  }
  const { accountType, plan: planRaw } = (req.body ?? {}) as { accountType?: unknown; plan?: unknown };
  const type = typeof accountType === 'string' ? accountType.toUpperCase() : '';
  if (!ACCOUNT_TYPES.includes(type as AccountType)) {
    res.status(400).json({ error: 'Unknown account type.' });
    return;
  }
  const plan = typeof planRaw === 'string' ? planRaw.toUpperCase() : null;
  if (plan && !ACCOUNT_PLANS.includes(plan as never)) {
    res.status(400).json({ error: 'Unknown plan.' });
    return;
  }
  const meta = ACCOUNT_TYPE_META[type as AccountType];
  if (plan && !meta.plans.includes(plan as never)) {
    res.status(400).json({ error: `Plan ${plan} is not offered for ${meta.label} accounts.` });
    return;
  }

  const session = (req as { customerUser?: { id: string; email: string } }).customerUser;
  try {
    const row = await createApplication({
      accountType: type as AccountType,
      plan: plan ?? null,
      userId: session?.id ?? null,
      email: session?.email ?? '',
      ip: req.ip ?? 'unknown',
    });
    res.status(201).json({
      ok: true,
      application: {
        id: row.id,
        reference: row.reference,
        accountType: row.accountType,
        selectedPlan: row.selectedPlan,
        status: row.status,
        currentStep: row.currentStep,
        completionPct: row.completionPct,
        steps: row.steps,
      },
    });
  } catch (error) {
    console.error('applications.create.error', error instanceof Error ? error.message : 'unknown');
    res.status(500).json({ error: 'Could not start the application. Please try again.' });
  }
}