import type { Request, Response } from 'express';
import { reviewSponsorPackage } from '../../../../../lib/sponsorReadinessStore.js';
import { sponsorActor, sponsorError } from '../../../../../lib/sponsorReadinessHttp.js';

export default async function handler(req: Request, res: Response) {
  try {
    if (req.body?.decision !== 'approved' && req.body?.decision !== 'rejected') return res.status(400).json({ error: 'decision must be approved or rejected', code: 'VALIDATION_ERROR' });
    await reviewSponsorPackage(req.body.decision, req.body.note, sponsorActor(req)); return res.json({ ok: true });
  } catch (error) { return sponsorError(res, error); }
}
