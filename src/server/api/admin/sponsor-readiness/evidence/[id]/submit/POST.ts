import type { Request, Response } from 'express';
import { submitSponsorEvidence } from '../../../../../../lib/sponsorReadinessStore.js';
import { sponsorActor, sponsorError } from '../../../../../../lib/sponsorReadinessHttp.js';

export default async function handler(req: Request, res: Response) {
  try { return res.json({ evidence: await submitSponsorEvidence(String(req.params.id), sponsorActor(req)) }); }
  catch (error) { return sponsorError(res, error); }
}
