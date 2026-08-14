import type { Request, Response } from 'express';
import { getLogoConfig } from '../../../../lib/cmsExtStore.js';
export default async function handler(_req: Request, res: Response) { res.json({ logo: await getLogoConfig() }); }
