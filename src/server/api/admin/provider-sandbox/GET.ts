import type { Request, Response } from 'express';
import { getProviderSandboxRun, listProviderSandboxRuns } from '../../../lib/providerSandboxStore.js';
import { getSponsorReadiness } from '../../../lib/sponsorReadinessStore.js';
import { sponsorActor } from '../../../lib/sponsorReadinessHttp.js';
import { assessControlledPilotReadiness } from '../../../lib/pilotReadiness.js';

export default async function handler(req: Request, res: Response) {
  try {
    const id = String(req.query.id ?? '').trim();
    if (id) {
      const run = await getProviderSandboxRun(id);
      return run ? res.json(run) : res.status(404).json({ error: 'Sandbox run not found.' });
    }
    const [runs, sponsor] = await Promise.all([listProviderSandboxRuns(), getSponsorReadiness(sponsorActor(req))]);
    const pilotReadiness = assessControlledPilotReadiness({
      legalEntityState: sponsor.package.legalEntityState,
      packageApproved: sponsor.package.status === 'approved',
      controls: sponsor.controls,
      runs,
    });
    return res.json({ data: runs, pilotReadiness, syntheticOnly: true, financialOperationsLocked: true });
  } catch (error) {
    console.error('provider.sandbox.list.error', error);
    return res.status(500).json({ error: 'Unable to load provider sandbox runs.' });
  }
}
