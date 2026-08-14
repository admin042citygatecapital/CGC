import type { Request, Response } from 'express';
import { getHeroMedia } from '../../../../lib/cmsExtStore.js';
export default async function handler(_req: Request, res: Response) { res.json({ hero: await getHeroMedia() }); }
