/**
 * POST /api/applications/:id/submit — final submission after review.
 * Server re-validates every step; email verification must be genuine.
 */
import type { Request, Response } from 'express';
import { getApplication, submitApplication } from '../../../../lib/applicationsStore.js';
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
  const session = (req as { customerUser?: { id: string; email: string } }).customerUser;
  if (app.userId && (!session || session.id !== app.userId)) {
    res.status(403).json({ error: 'You do not have access to this application.' });
    return;
  }
  const result = await submitApplication({ applicationId: id, actor: session?.email ?? app.email ?? 'applicant' });
  if (!result.ok) { res.status(409).json({ error: result.error }); return; }
  res.json({ ok: true, application: result.row });
}