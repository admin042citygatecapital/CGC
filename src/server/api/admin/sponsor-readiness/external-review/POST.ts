import type { Request, Response } from 'express';
import { reviewSponsorEvidence, reviewSponsorPackage } from '../../../../lib/sponsorReadinessStore.js';
import { sponsorError } from '../../../../lib/sponsorReadinessHttp.js';
import { authenticateIndependentSponsorReviewer } from '../../../../lib/independentSponsorReviewer.js';

export default async function handler(req: Request, res: Response) {
  try {
    const actor = authenticateIndependentSponsorReviewer(req);
    const decision = req.body?.decision;
    if (decision !== 'approved' && decision !== 'rejected') {
      return res.status(400).json({ error: 'decision must be approved or rejected', code: 'VALIDATION_ERROR' });
    }
    const reviewerId = actor.id;
    const requestedTarget = req.body?.target ?? 'package';
    if (requestedTarget !== 'evidence' && requestedTarget !== 'package') {
      return res.status(400).json({ error: 'target must be evidence or package', code: 'VALIDATION_ERROR' });
    }
    const target = requestedTarget;
    if (target === 'evidence') {
      const evidenceId = String(req.body?.evidenceId ?? '').trim();
      if (!/^sev_[A-Za-z0-9-]{8,100}$/.test(evidenceId)) {
        return res.status(400).json({ error: 'A valid evidenceId is required.', code: 'VALIDATION_ERROR' });
      }
      await reviewSponsorEvidence(evidenceId, decision, req.body?.note, actor);
      return res.json({ ok: true, reviewerId, target, evidenceId, decision });
    }
    await reviewSponsorPackage(decision, req.body?.note, actor);
    return res.json({ ok: true, reviewerId, target, decision });
  } catch (error) {
    return sponsorError(res, error);
  }
}
