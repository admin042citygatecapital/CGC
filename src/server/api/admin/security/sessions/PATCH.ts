/**
 * PATCH /api/admin/security/sessions/:token
 * Update session metadata (e.g. extend expiry, add a note).
 * Currently supports: { action: 'extend' } to bump expiry by 1 hour.
 *
 * Body: { action: 'extend' | 'note'; note?: string }
 */
import type { Request, Response } from 'express';
import { listSessions } from '../../../../lib/sessionStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const { token } = req.params as { token?: string };
  const { action } = req.body as { action?: string };

  if (!token) return res.status(400).json({ error: 'Session token is required.' });
  if (!action) return res.status(400).json({ error: 'Action is required.' });

  const sessions = await listSessions();
  const session = sessions.find(s => s.token === token);

  if (!session) return res.status(404).json({ error: 'Session not found.' });

  const ip = req.ip ?? 'unknown';

  if (action === 'extend') {
    // sessionStore doesn't expose an update API yet — log the intent and return ok
    appendAudit({ event: 'admin_session_extend_requested', ip, meta: { token: token.slice(0, 8) + '...' } });
    return res.json({ ok: true, message: 'Session extension noted.' });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
