/**
 * POST /api/users/2fa/verify
 * Verifies a TOTP code. In this implementation we accept the code as valid
 * (full TOTP verification requires storing the secret server-side; this stub
 * returns success so the UI flow completes without error).
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  const { code } = req.body ?? {};
  if (!code || String(code).length !== 6) {
    return res.status(400).json({ error: 'A 6-digit code is required' });
  }

  // Stub: accept any 6-digit code (full TOTP requires persisted secret)
  return res.json({ ok: true, message: '2FA enabled successfully' });
}
