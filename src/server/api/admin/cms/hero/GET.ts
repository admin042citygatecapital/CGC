import type { Request, Response } from 'express';
import { getHeroMedia } from '../../../../lib/cmsExtStore.js';
export default function handler(_req: Request, res: Response) { res.json({ hero: getHeroMedia() }); }
