import type { Request, Response } from 'express';
import { saveSponsorEvidence } from '../../../../lib/sponsorReadinessStore.js';
import { sponsorActor, sponsorError } from '../../../../lib/sponsorReadinessHttp.js';

export default async function handler(req: Request, res: Response) {
  try { return res.status(req.body?.id ? 200 : 201).json({ evidence: await saveSponsorEvidence(req.body, sponsorActor(req)) }); }
  catch (error) { return sponsorError(res, error); }
}
