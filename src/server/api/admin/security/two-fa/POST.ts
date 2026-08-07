/** POST /api/admin/security/two-fa — update 2FA policy */
import type { Request, Response } from 'express';
import { read2FAPolicy, write2FAPolicy, type TwoFAPolicy } from '../../../../lib/securityStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const patch = req.body as Partial<TwoFAPolicy>;
    const adminEmail = (req as unknown as { admin?: { email: string } }).admin?.email ?? 'admin';
    const current = read2FAPolicy();
    const updated: TwoFAPolicy = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail,
    };
    write2FAPolicy(updated);
    res.json({ ok: true, policy: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update 2FA policy', message: String(err) });
  }
}
