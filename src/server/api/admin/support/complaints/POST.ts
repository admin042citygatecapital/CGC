/**
 * POST /api/admin/support/complaints
 * Body: { id?: string, ...fields }
 * Creates a new complaint, or updates an existing one (status, resolution,
 * assignment, notes, regulatory flag, etc.) when `id` is given.
 */
import type { Request, Response } from 'express';
import { createComplaint, updateComplaint, type Complaint } from '../../../../lib/supportExtStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, isOneOf } from '../../../../lib/inputValidator.js';

const CATEGORIES = ['transaction', 'account', 'card', 'kyc', 'staff', 'technical', 'other'] as const;
const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const STATUSES = ['open', 'investigating', 'escalated', 'resolved', 'closed'] as const;

export default async function handler(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;

  if (typeof raw.id === 'string' && raw.id) {
    const patch: Partial<Complaint> = {};
    if (raw.status !== undefined) {
      const status = isOneOf(raw.status, STATUSES);
      if (!status) return res.status(400).json({ ok: false, error: 'Invalid status' });
      patch.status = status;
    }
    if (raw.severity !== undefined) {
      const severity = isOneOf(raw.severity, SEVERITIES);
      if (!severity) return res.status(400).json({ ok: false, error: 'Invalid severity' });
      patch.severity = severity;
    }
    if (typeof raw.assignedTo === 'string') patch.assignedTo = sanitizeString(raw.assignedTo, 100);
    if (typeof raw.resolution === 'string') patch.resolution = sanitizeString(raw.resolution, 5000);
    if (typeof raw.internalNotes === 'string') patch.internalNotes = sanitizeString(raw.internalNotes, 5000);
    if (typeof raw.regulatoryFlag === 'boolean') patch.regulatoryFlag = raw.regulatoryFlag;

    const complaint = updateComplaint(raw.id, patch);
    if (!complaint) return res.status(404).json({ ok: false, error: 'Complaint not found' });

    appendAudit({
      event: 'support_complaint_updated',
      adminId: req.adminSession?.adminId,
      email: req.adminSession?.email,
      ip: req.ip ?? 'unknown',
      meta: { id: complaint.id },
    });

    return res.json({ ok: true, complaint });
  }

  const subject = sanitizeString(raw.subject, 200);
  const description = sanitizeString(raw.description, 5000);
  if (!subject || !description) {
    return res.status(400).json({ ok: false, error: 'subject and description are required' });
  }

  const complaint = createComplaint({
    userId: typeof raw.userId === 'string' ? raw.userId : null,
    userName: sanitizeString(raw.userName, 200),
    userEmail: sanitizeString(raw.userEmail, 254),
    userPhone: sanitizeString(raw.userPhone, 50),
    category: isOneOf(raw.category, CATEGORIES) ?? 'other',
    severity: isOneOf(raw.severity, SEVERITIES) ?? 'medium',
    subject,
    description,
    evidence: Array.isArray(raw.evidence) ? raw.evidence.filter((e): e is string => typeof e === 'string') : [],
  });

  appendAudit({
    event: 'support_complaint_created',
    adminId: req.adminSession?.adminId,
    email: req.adminSession?.email,
    ip: req.ip ?? 'unknown',
    meta: { id: complaint.id },
  });

  return res.status(201).json({ ok: true, complaint });
}
