import type { Request, Response } from 'express';
import { SponsorReadinessError } from './sponsorReadinessStore.js';
import type { SponsorActor } from './sponsorReadinessStore.js';

export function sponsorActor(req: Request): SponsorActor {
  const session = req.adminSession!;
  return { id: session.adminId, email: session.email, role: session.role, ip: req.ip };
}

export function sponsorError(res: Response, error: unknown): Response {
  if (error instanceof SponsorReadinessError) return res.status(error.status).json({ error: error.message, code: error.code });
  console.error('sponsor.readiness.error', error);
  return res.status(500).json({ error: 'Sponsor-readiness operation failed.', code: 'INTERNAL_ERROR' });
}
