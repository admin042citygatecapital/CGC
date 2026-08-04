/**
 * GET /api/admin/security/two-fa
 * Platform-wide 2FA policy (mandatory for all / for withdrawals above a
 * threshold / for wire transfers).
 */
import type { Request, Response } from 'express';
import { read2FAPolicy } from '../../../../lib/securityStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    return res.json({ ok: true, policy: read2FAPolicy() });
  } catch (err) {
    console.error('[admin/security/two-fa GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load 2FA policy' });
  }
}
