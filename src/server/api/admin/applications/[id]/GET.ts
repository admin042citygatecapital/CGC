/**
 * GET /api/admin/applications/:id — full application detail for the review
 * console: application (credential-free), event trail, and the relational
 * business ownership projection for BUSINESS applications.
 * Authorization: central middleware requires `compliance.view`.
 */
import type { Request, Response } from 'express';
import {
  getApplication, listApplicationEvents, sanitizeSteps, getBusinessOwnership,
} from '../../../../lib/applicationsStore.js';
import { isDatabaseConfigured } from '../../../../db/db.js';

export default async function handler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id?: string };
  if (!id) { res.status(400).json({ error: 'Application id is required.' }); return; }
  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: 'Applications are unavailable while the database is offline.' });
    return;
  }
  const app = await getApplication(id);
  if (!app) { res.status(404).json({ error: 'Application not found.' }); return; }

  const [events, ownership] = await Promise.all([
    listApplicationEvents(id),
    app.accountType === 'BUSINESS' ? getBusinessOwnership(id) : Promise.resolve(null),
  ]);

  res.json({
    ok: true,
    application: {
      id: app.id, reference: app.reference, email: app.email,
      firstName: app.firstName, lastName: app.lastName,
      accountType: app.accountType, selectedPlan: app.selectedPlan,
      status: app.status, currentStep: app.currentStep, completionPct: app.completionPct,
      steps: sanitizeSteps(app.steps),
      emailVerified: app.emailVerified,
      decision: app.decision, decisionReason: app.decisionReason,
      informationRequest: app.informationRequest,
      createdAt: app.createdAt, updatedAt: app.updatedAt,
    },
    events: events.map(e => ({
      event: e.event, at: e.createdAt, actor: e.actor, actorRole: e.actorRole,
      detail: e.detail,
    })),
    businessOwnership: ownership,
  });
}
