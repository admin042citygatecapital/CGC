import type { Request, Response } from 'express';
import { getLegalEntityVerification } from '../../../lib/legalEntityVerificationStore.js';
import { sponsorActor } from '../../../lib/sponsorReadinessHttp.js';

export default async function handler(req: Request, res: Response) {
  try { return res.json(await getLegalEntityVerification(sponsorActor(req))); }
  catch (error) { const typed = error as Error & { status?: number; code?: string }; return res.status(typed.status ?? 500).json({ error: typed.message, code: typed.code }); }
}
