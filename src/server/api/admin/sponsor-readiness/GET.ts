import type { Request, Response } from 'express';
import { getSecret } from '../../../lib/runtimeSecrets.js';
import { getSponsorReadiness } from '../../../lib/sponsorReadinessStore.js';
import { sponsorActor, sponsorError } from '../../../lib/sponsorReadinessHttp.js';

export default async function handler(req: Request, res: Response) {
  try {
    const readiness = await getSponsorReadiness(sponsorActor(req));
    const reviewerEmail = String(getSecret('SPONSOR_REVIEWER_EMAIL') ?? '').trim().toLowerCase();
    const adminEmail = String(getSecret('ADMIN_EMAIL') ?? 'admin@citygate.capital').trim().toLowerCase();
    const emailConfigured = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reviewerEmail);
    const identityIndependent = emailConfigured && reviewerEmail !== adminEmail;
    const credentialHashConfigured = /^[0-9a-f]{64}$/i.test(String(getSecret('SPONSOR_REVIEWER_KEY_HASH') ?? '').trim());
    return res.json({
      ...readiness,
      independentReviewer: {
        configured: identityIndependent && credentialHashConfigured,
        emailConfigured,
        identityIndependent,
        credentialHashConfigured,
      },
    });
  }
  catch (error) { return sponsorError(res, error); }
}
