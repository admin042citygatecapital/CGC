import type { Request, Response } from 'express';
import { listOngoingScreeningQueue } from '../../../../lib/onboardingProviderStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    const data = await listOngoingScreeningQueue();
    return res.json({ data, dueCount: data.filter(item => item.due).length, financialOperationsLocked: true });
  } catch (error) {
    const typed = error as Error & { status?: number; code?: string };
    return res.status(typed.status ?? 500).json({ error: typed.message, code: typed.code });
  }
}
