import type { Request, Response } from 'express';
import { submitSponsorPackage } from '../../../../../lib/sponsorReadinessStore.js';
import { sponsorActor, sponsorError } from '../../../../../lib/sponsorReadinessHttp.js';

export default async function handler(req: Request, res: Response) {
  try { await submitSponsorPackage(sponsorActor(req)); return res.json({ ok: true }); }
  catch (error) { return sponsorError(res, error); }
}
