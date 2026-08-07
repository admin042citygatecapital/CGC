/**
 * GET /api/users/login-history
 * Returns login history for the customer.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  // Build from available user metadata
  const history: Array<{
    id: string; createdAt: string; ip?: string; success: boolean; description: string;
  }> = [];

  if (user.lastLoginAt) {
    history.push({
      id:          'hist_' + user.id,
      createdAt:   user.lastLoginAt,
      ip:          user.lastLoginIp,
      success:     true,
      description: 'Login successful',
    });
  }

  if (user.createdAt) {
    history.push({
      id:          'hist_reg_' + user.id,
      createdAt:   user.createdAt,
      ip:          user.ip,
      success:     true,
      description: 'Account created',
    });
  }

  history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json({ history });
}
