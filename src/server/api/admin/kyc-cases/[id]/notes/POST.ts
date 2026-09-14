/**
 * POST /api/admin/kyc-cases/:id/notes — internal reviewer note on a KYC case.
 * Notes live only in the case event trail; they are never emailed and never
 * logged with document contents. RBAC via central middleware (compliance.manage).
 */
import type { Request, Response } from 'express';
import { addCaseNote } from '../../../../../lib/kycCaseStore.js';
import { isDatabaseConfigured } from '../../../../../db/db.js';

export default async function handler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id?: string };
  const { note } = (req.body ?? {}) as { note?: unknown };
  const noteText = typeof note === 'string' ? note.trim() : '';
  if (!id) { res.status(400).json({ error: 'Case id is required.' }); return; }
  if (noteText.length < 2 || noteText.length > 2000) {
    res.status(400).json({ error: 'A note of 2–2000 characters is required.' });
    return;
  }
  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: 'KYC is unavailable while the database is offline.' });
    return;
  }
  const ok = await addCaseNote({
    caseId: id, note: noteText,
    actor: req.adminSession?.adminId ?? 'unknown-admin',
    actorRole: req.adminSession?.role ?? null,
  });
  if (!ok) { res.status(404).json({ error: 'KYC case not found.' }); return; }
  res.status(201).json({ ok: true });
}
