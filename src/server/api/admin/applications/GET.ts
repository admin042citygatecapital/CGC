/**
 * GET /api/admin/applications — filtered application list for the review console.
 * Authorization: central middleware maps /users-style reads; this route requires
 * `compliance.view` (mapped below) — see adminAuthorizationMiddleware.
 */
import type { Request, Response } from 'express';
import { listApplicationsForAdmin } from '../../../lib/applicationsStore.js';
import { isDatabaseConfigured } from '../../../db/db.js';

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: 'Applications are unavailable while the database is offline.' });
    return;
  }
  const { type, status, search } = req.query as { type?: string; status?: string; search?: string };
  const rows = await listApplicationsForAdmin({
    type: type?.toUpperCase(),
    status: status?.toUpperCase(),
    search: search?.trim() || undefined,
  });
  res.json({
    ok: true,
    applications: rows.map(row => ({
      id: row.id, reference: row.reference, email: row.email,
      firstName: row.firstName, lastName: row.lastName,
      accountType: row.accountType, selectedPlan: row.selectedPlan,
      status: row.status, currentStep: row.currentStep, completionPct: row.completionPct,
      decision: row.decision, decisionReason: row.decisionReason,
      createdAt: row.createdAt, updatedAt: row.updatedAt,
    })),
  });
}