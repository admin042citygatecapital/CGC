import type { Request, Response } from 'express';
import { getSponsorReadiness } from '../../../lib/sponsorReadinessStore.js';
import { sponsorActor, sponsorError } from '../../../lib/sponsorReadinessHttp.js';

export default async function handler(req: Request, res: Response) {
  try { return res.json(await getSponsorReadiness(sponsorActor(req))); }
  catch (error) { return sponsorError(res, error); }
}
