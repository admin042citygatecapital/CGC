/**
 * POST /api/admin/kyc/note
 * Body: { userId, note }
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../lib/userStore.js';
import { appendKycNote } from '../../../../lib/kycStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId } = req.body as { userId?: string };
  const note = sanitizeString((req.body as { note?: unknown }).note, 2000);
  if (!userId) return res.status(400).json({ ok: false, error: 'userId is required' });
  if (!note) return res.status(400).json({ ok: false, error: 'note is required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  await appendKycNote({
    userId, adminId: session.adminId, adminName: session.email, note, createdAt: new Date().toISOString(),
  });
  appendAudit({ event: 'admin_kyc_note', adminId: session.adminId, userId, email: user.email, ip: req.ip ?? 'unknown' });

  return res.status(201).json({ ok: true });
}
