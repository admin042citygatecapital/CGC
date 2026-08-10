import type { Request, Response } from 'express';
import { findUserById } from '../../../../lib/userStore.js';

export default async function handler(req: Request, res: Response) {
  const id = String(req.params.id ?? '').trim();
  if (!id) return res.status(400).json({ error: 'User ID required' });

  const user = await findUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    kycStatus: user.kycStatus,
    accountTier: user.accountTier,
    createdAt: user.createdAt,
    dataClassification: 'customer_support_profile',
  });
}
