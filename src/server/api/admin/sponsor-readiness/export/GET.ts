import type { Request, Response } from 'express';
import { buildSponsorPackZip } from '../../../../lib/sponsorReadinessExport.js';
import { getSponsorReadiness, recordSponsorExport } from '../../../../lib/sponsorReadinessStore.js';
import { sponsorActor, sponsorError } from '../../../../lib/sponsorReadinessHttp.js';

export default async function handler(req: Request, res: Response) {
  try {
    const actor = sponsorActor(req);
    const snapshot = await getSponsorReadiness(actor);
    const zip = buildSponsorPackZip(snapshot);
    await recordSponsorExport(actor, snapshot.summary.sponsorSubmissionReady);
    const suffix = snapshot.summary.sponsorSubmissionReady ? 'submission-ready' : 'draft';
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="city-gate-uk-sponsor-pack-${suffix}.zip"`);
    res.setHeader('X-Sponsor-Package-Status', suffix);
    return res.send(Buffer.from(zip));
  } catch (error) { return sponsorError(res, error); }
}
