/**
 * POST /api/admin/applications/:id/notes — internal reviewer note on an
 * application. Notes live only in the application event trail (appendAudit
 * also runs via the central admin mutation middleware); they are never emailed.
 */
import type { Request, Response } from 'express';
import { getApplication, recordEvent } from '../../../../../lib/applicationsStore.js';
import { isDatabaseConfigured } from '../../../../../db/db.js';

export default async function handler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id?: string };
  const { note } = (req.body ?? {}) as { note?: unknown };
  const noteText = typeof note === 'string' ? note.trim() : '';
  if (!id) { res.status(400).json({ error: 'Application id is required.' }); return; }
  if (noteText.length < 2 || noteText.length > 2000) {
    res.status(400).json({ error: 'A note of 2–2000 characters is required.' });
    return;
  }
  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: 'Applications are unavailable while the database is offline.' });
    return;
  }
  const app = await getApplication(id);
  if (!app) { res.status(404).json({ error: 'Application not found.' }); return; }
  const adminId = req.adminSession?.adminId ?? req.adminSession?.email ?? 'unknown-admin';
  await recordEvent(id, adminId, req.adminSession?.role ?? null, 'NOTE_ADDED', { note: noteText });
  res.status(201).json({ ok: true });
}
