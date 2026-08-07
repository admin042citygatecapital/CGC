/**
 * GET /api/users/security/events
 * Returns recent security events for the customer (login attempts, password changes, etc.)
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  // Build synthetic events from user record metadata
  const events: Array<{
    id: string; type: string; description: string;
    severity: 'low' | 'medium' | 'high'; createdAt: string; ip?: string;
  }> = [];

  if (user.lastLoginAt) {
    events.push({
      id:          'ev_login_' + user.id,
      type:        'login',
      description: 'Successful login',
      severity:    'low',
      createdAt:   user.lastLoginAt,
      ip:          user.lastLoginIp,
    });
  }

  if (user.kycSubmittedAt) {
    events.push({
      id:          'ev_kyc_' + user.id,
      type:        'kyc_submitted',
      description: 'KYC documents submitted',
      severity:    'low',
      createdAt:   user.kycSubmittedAt,
    });
  }

  if (user.kycApprovedAt) {
    events.push({
      id:          'ev_kyc_approved_' + user.id,
      type:        'kyc_approved',
      description: 'Identity verification approved',
      severity:    'low',
      createdAt:   user.kycApprovedAt,
    });
  }

  // Sort newest first
  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json({ events });
}
