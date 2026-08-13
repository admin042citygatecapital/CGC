import type { Request, Response } from 'express';
import { getSecret } from '../../../lib/runtimeSecrets.js';
import { getSponsorReadiness } from '../../../lib/sponsorReadinessStore.js';
import { sponsorActor, sponsorError } from '../../../lib/sponsorReadinessHttp.js';

export default async function handler(req: Request, res: Response) {
  try {
    const readiness = await getSponsorReadiness(sponsorActor(req));
    const emailConfigured = Boolean(String(getSecret('SPONSOR_REVIEWER_EMAIL') ?? '').trim());
    const credentialHashConfigured = /^[0-9a-f]{64}$/i.test(String(getSecret('SPONSOR_REVIEWER_KEY_HASH') ?? '').trim());
    return res.json({
      ...readiness,
      independentReviewer: {
        configured: emailConfigured && credentialHashConfigured,
        emailConfigured,
        credentialHashConfigured,
      },
    });
  }
  catch (error) { return sponsorError(res, error); }
}
