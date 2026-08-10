import type { Request, Response } from 'express';
import { reviewSponsorEvidence } from '../../../../../../lib/sponsorReadinessStore.js';
import { sponsorActor, sponsorError } from '../../../../../../lib/sponsorReadinessHttp.js';

export default async function handler(req: Request, res: Response) {
  try {
    if (req.body?.decision !== 'approved' && req.body?.decision !== 'rejected') return res.status(400).json({ error: 'decision must be approved or rejected', code: 'VALIDATION_ERROR' });
    return res.json({ evidence: await reviewSponsorEvidence(String(req.params.id), req.body.decision, req.body.note, sponsorActor(req)) });
  } catch (error) { return sponsorError(res, error); }
}
