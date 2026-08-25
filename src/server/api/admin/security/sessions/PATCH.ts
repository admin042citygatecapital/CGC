/**
 * PATCH /api/admin/security/sessions
 * Session extension is intentionally unsupported. A fresh authentication is
 * required rather than lengthening an existing privileged session.
 */
import type { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  void req;
  return res.status(501).json({
    error: 'Session extension is not supported. Sign in again to start a new session.',
  });
}
