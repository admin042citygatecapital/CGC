/**
 * POST /api/admin/kyc/note
 * Add an admin note to a KYC submission.
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../lib/userStore.js';
import { appendKycNote } from '../../../../lib/kycStore.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, note } = req.body as { userId?: string; note?: string };
  if (!userId) return res.status(400).json({ error: 'userId required' });
  if (!note)   return res.status(400).json({ error: 'note required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  appendKycNote({ userId, adminId: session.adminId, note, createdAt: new Date().toISOString() });
  return res.json({ ok: true });
}
