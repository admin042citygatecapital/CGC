import type { Request, Response } from 'express';
import { listSandboxTests, sandboxConfiguration } from '../../../../lib/sumsubSandbox.js';

export default async function handler(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  try { return res.json({ configuration: sandboxConfiguration(), tests: await listSandboxTests(req.adminSession!.adminId) }); }
  catch { return res.status(503).json({ error: 'Sandbox storage unavailable. Apply migration 0057 and check database connectivity.', code: 'SANDBOX_STORAGE_UNAVAILABLE' }); }
}
