/**
 * POST /api/admin/support/feedback
 * Body: { id?: string, ...fields }
 * Updates an existing feedback entry (status, admin response) when `id`
 * is given, otherwise creates a new one logged on the customer's behalf.
 */
import type { Request, Response } from 'express';
import { createFeedback, updateFeedback, type FeedbackEntry } from '../../../../lib/supportExtStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, isOneOf } from '../../../../lib/inputValidator.js';

const TYPES = ['general', 'feature_request', 'bug_report', 'compliment', 'other'] as const;
const STATUSES = ['new', 'under_review', 'planned', 'implemented', 'declined', 'closed'] as const;

export default async function handler(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;

  if (typeof raw.id === 'string' && raw.id) {
    const patch: Partial<FeedbackEntry> = {};
    if (raw.status !== undefined) {
      const status = isOneOf(raw.status, STATUSES);
      if (!status) return res.status(400).json({ ok: false, error: 'Invalid status' });
      patch.status = status;
    }
    if (typeof raw.adminResponse === 'string') {
      patch.adminResponse = sanitizeString(raw.adminResponse, 5000);
      patch.respondedAt = new Date().toISOString();
    }
    if (Array.isArray(raw.tags)) {
      patch.tags = raw.tags.filter((t): t is string => typeof t === 'string').map(t => sanitizeString(t, 50));
    }

    const entry = updateFeedback(raw.id, patch);
    if (!entry) return res.status(404).json({ ok: false, error: 'Feedback entry not found' });

    appendAudit({
      event: 'support_feedback_updated',
      adminId: req.adminSession?.adminId,
      email: req.adminSession?.email,
      ip: req.ip ?? 'unknown',
      meta: { id: entry.id },
    });

    return res.json({ ok: true, entry });
  }

  const title = sanitizeString(raw.title, 200);
  const body = sanitizeString(raw.body, 5000);
  if (!title || !body) {
    return res.status(400).json({ ok: false, error: 'title and body are required' });
  }

  const entry = createFeedback({
    userId: typeof raw.userId === 'string' ? raw.userId : null,
    userName: sanitizeString(raw.userName, 200) || 'Anonymous',
    userEmail: sanitizeString(raw.userEmail, 254),
    type: isOneOf(raw.type, TYPES) ?? 'general',
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    title,
    body,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : [],
  });

  appendAudit({
    event: 'support_feedback_created',
    adminId: req.adminSession?.adminId,
    email: req.adminSession?.email,
    ip: req.ip ?? 'unknown',
    meta: { id: entry.id },
  });

  return res.status(201).json({ ok: true, entry });
}
