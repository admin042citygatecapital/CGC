/**
 * GET /api/users/beneficiaries
 * Returns the authenticated customer's saved beneficiaries (bank + crypto).
 * Stored directly on the user record (UserRecord.beneficiaries, already
 * defined as an opaque JSON field) — there is no dedicated beneficiary
 * table/store in this codebase.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import type { Beneficiary } from '../../../lib/beneficiaries.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const beneficiaries = (Array.isArray(user.beneficiaries) ? user.beneficiaries : []) as Beneficiary[];
  return res.json({ ok: true, beneficiaries });
}
