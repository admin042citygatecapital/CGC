import type { Request, Response } from 'express';
import { getNavigation } from '../../../../lib/cmsExtStore.js';
export default async function handler(_req: Request, res: Response) { res.json({ navigation: await getNavigation() }); }
