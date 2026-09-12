/**
 * POST /api/admin/applications/:id/decision — review decision.
 * Requires reason; records the decision on the application and in its event
 * trail (appendAudit also runs via the central admin mutation middleware).
 */
import type { Request, Response } from 'express';
import { decideApplication, type AdminDecision } from '../../../../../lib/applicationsStore.js';
import { isDatabaseConfigured } from '../../../../../db/db.js';

const VALID_DECISIONS: readonly string[] = ['APPROVED', 'REJECTED', 'NEEDS_INFORMATION', 'REVIEW_REQUIRED', 'ACTIVATION_PENDING'];

export default async function handler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id?: string };
  const { decision, reason, informationRequest } = (req.body ?? {}) as {
    decision?: unknown; reason?: unknown; informationRequest?: unknown;
  };
  if (!id || typeof decision !== 'string' || !VALID_DECISIONS.includes(decision)) {
    res.status(400).json({ error: `decision must be one of: ${VALID_DECISIONS.join(', ')}` });
    return;
  }
  const reasonText = typeof reason === 'string' ? reason.trim() : '';
  if (reasonText.length < 4) {
    res.status(400).json({ error: 'A reason of at least 4 characters is required for every decision.' });
    return;
  }
  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: 'Applications are unavailable while the database is offline.' });
    return;
  }
  const adminId = req.adminSession?.adminId ?? req.adminSession?.email ?? 'unknown-admin';
  const result = await decideApplication({
    applicationId: id,
    decision: decision as AdminDecision,
    reason: reasonText,
    informationRequest: typeof informationRequest === 'string' ? informationRequest : undefined,
    adminId,
    adminRole: req.adminSession?.role ?? '',
  });
  if (!result.ok) { res.status(409).json({ error: result.error }); return; }
  res.json({ ok: true, application: { id: result.row.id, status: result.row.status, decision: result.row.decision } });
}