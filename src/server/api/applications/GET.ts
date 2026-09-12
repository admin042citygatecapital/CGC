/**
 * GET /api/applications — the signed-in customer's own applications.
 * Never exposes another applicant's data.
 */
import type { Request, Response } from 'express';
import { listApplicationsForUser, sanitizeSteps } from '../../lib/applicationsStore.js';
import { isDatabaseConfigured } from '../../db/db.js';

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = (req as { customerUser?: { id: string; email: string } }).customerUser;
  if (!session?.id) {
    res.status(401).json({ error: 'Sign in to view your applications.' });
    return;
  }
  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: 'Applications are unavailable while the database is offline.' });
    return;
  }
  const rows = await listApplicationsForUser(session.id);
  res.json({
    ok: true,
    applications: rows.map(row => ({
      id: row.id,
      reference: row.reference,
      accountType: row.accountType,
      selectedPlan: row.selectedPlan,
      status: row.status,
      currentStep: row.currentStep,
      completionPct: row.completionPct,
      steps: sanitizeSteps(row.steps),
      decision: row.decision,
      decisionReason: row.decisionReason,
      informationRequest: row.informationRequest,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
  });
}