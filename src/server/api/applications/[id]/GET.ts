/**
 * GET /api/applications/:id — application detail for its owner only.
 */
import type { Request, Response } from 'express';
import { getApplication, listApplicationEvents, sanitizeSteps } from '../../../lib/applicationsStore.js';
import { isDatabaseConfigured } from '../../../db/db.js';

export default async function handler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id?: string };
  if (!id) { res.status(400).json({ error: 'Application id is required.' }); return; }
  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: 'Applications are unavailable while the database is offline.' });
    return;
  }
  const app = await getApplication(id);
  if (!app) { res.status(404).json({ error: 'Application not found.' }); return; }
  const session = (req as { customerUser?: { id: string; email: string } }).customerUser;
  // Owner check: linked identity must match the session. Anonymous drafts are
  // readable by id-holder only until an identity is linked.
  if (app.userId && (!session || session.id !== app.userId)) {
    res.status(403).json({ error: 'You do not have access to this application.' });
    return;
  }
  const events = app.userId ? await listApplicationEvents(id) : [];
  // Never return credential fields; for unlinked drafts, return progress
  // metadata only (no steps content) — the id alone must not reveal PII.
  res.json({
    ok: true,
    application: {
      id: app.id, reference: app.reference, accountType: app.accountType,
      selectedPlan: app.selectedPlan, status: app.status, currentStep: app.currentStep,
      completionPct: app.completionPct,
      steps: app.userId ? sanitizeSteps(app.steps) : {},
      emailVerified: app.emailVerified,
      decision: app.decision, decisionReason: app.decisionReason,
      informationRequest: app.informationRequest, createdAt: app.createdAt, updatedAt: app.updatedAt,
    },
    events: events.map(e => ({
      event: e.event, at: e.createdAt,
      actor: e.actorRole ? 'Review team' : (e.event.startsWith('DECISION') ? 'Review team' : e.actor),
    })),
  });
}