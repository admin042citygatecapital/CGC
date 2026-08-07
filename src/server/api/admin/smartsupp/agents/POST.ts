/**
 * POST /api/admin/smartsupp/agents
 * Actions: upsert, delete, status
 */
import type { Request, Response } from 'express';
import { upsertAgent, deleteAgent } from '../../../../lib/smartsuppStore.js';

export default function handler(req: Request, res: Response) {
  const { action, ...data } = req.body ?? {};
  try {
    if (action === 'delete') {
      const ok = deleteAgent(data.id);
      return res.json({ ok });
    }
    const agent = upsertAgent(data);
    res.json({ ok: true, agent });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
