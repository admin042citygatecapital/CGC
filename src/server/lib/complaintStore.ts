import crypto from 'node:crypto';
import { asc, desc, eq } from 'drizzle-orm';
import { complaintEvents, complaints } from '../db/schema.js';
import { getDb, isDatabaseConfigured } from '../db/db.js';

export type ComplaintStatus = 'open' | 'investigating' | 'escalated' | 'resolved' | 'closed';
export type ComplaintSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ComplaintCategory = 'transaction' | 'account' | 'card' | 'kyc' | 'staff' | 'technical' | 'other';

const STATUSES = new Set<ComplaintStatus>(['open','investigating','escalated','resolved','closed']);
const SEVERITIES = new Set<ComplaintSeverity>(['low','medium','high','critical']);
const CATEGORIES = new Set<ComplaintCategory>(['transaction','account','card','kyc','staff','technical','other']);
const TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  open: ['investigating','escalated','resolved'], investigating: ['escalated','resolved'],
  escalated: ['investigating','resolved'], resolved: ['investigating','closed'], closed: ['investigating'],
};

export class ComplaintError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 400) { super(message); }
}

function requireDatabase() { if (!isDatabaseConfigured()) throw new ComplaintError('Complaints require PostgreSQL.', 'DATABASE_REQUIRED', 503); }
function text(value: unknown, name: string, min: number, max: number): string {
  const result = String(value ?? '').trim();
  if (result.length < min || result.length > max) throw new ComplaintError(`${name} must be ${min}-${max} characters.`, 'VALIDATION_ERROR');
  return result;
}
function evidenceReferences(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10) throw new ComplaintError('Evidence must contain at most 10 controlled HTTPS references.', 'INVALID_EVIDENCE');
  return value.map(item => {
    const raw = text(item, 'Evidence reference', 8, 500); let url: URL;
    try { url = new URL(raw); } catch { throw new ComplaintError('Evidence references must be valid HTTPS URLs.', 'INVALID_EVIDENCE'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new ComplaintError('Evidence references must use HTTPS and contain no credentials.', 'INVALID_EVIDENCE');
    return raw;
  });
}
function targetDays(): number {
  const configured = Number.parseInt(process.env.COMPLAINT_RESPONSE_TARGET_DAYS ?? '15', 10);
  return Number.isInteger(configured) && configured >= 1 && configured <= 90 ? configured : 15;
}

export function assertComplaintTransition(from: ComplaintStatus, to: ComplaintStatus, resolution?: string | null): void {
  if (from === to) return;
  if (!TRANSITIONS[from].includes(to)) throw new ComplaintError(`Complaint cannot transition from ${from} to ${to}.`, 'INVALID_TRANSITION', 409);
  if ((to === 'resolved' || to === 'closed') && String(resolution ?? '').trim().length < 10) throw new ComplaintError('A resolution of at least 10 characters is required.', 'RESOLUTION_REQUIRED');
}

export async function listComplaints(opts: { status?: string; severity?: string; category?: string; search?: string; page?: number; limit?: number } = {}) {
  requireDatabase(); let rows = await getDb().select().from(complaints).orderBy(desc(complaints.createdAt));
  if (opts.status && opts.status !== 'all') rows = rows.filter(row => row.status === opts.status);
  if (opts.severity && opts.severity !== 'all') rows = rows.filter(row => row.severity === opts.severity);
  if (opts.category && opts.category !== 'all') rows = rows.filter(row => row.category === opts.category);
  if (opts.search) { const query = opts.search.toLowerCase(); rows = rows.filter(row => `${row.subject} ${row.userName} ${row.userEmail}`.toLowerCase().includes(query)); }
  const page = Math.max(1, opts.page ?? 1); const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  return { data: rows.slice((page - 1) * limit, page * limit), total: rows.length };
}

export async function createComplaint(input: Record<string, unknown>, actorId: string) {
  requireDatabase();
  const category = String(input.category ?? 'other') as ComplaintCategory; const severity = String(input.severity ?? 'medium') as ComplaintSeverity;
  if (!CATEGORIES.has(category) || !SEVERITIES.has(severity)) throw new ComplaintError('Invalid complaint category or severity.', 'VALIDATION_ERROR');
  const now = new Date(); const responseDueAt = new Date(now.getTime() + targetDays() * 86_400_000); const id = `CMP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const values = {
    id, userId: input.userId ? String(input.userId) : null, userName: text(input.userName, 'Customer name', 1, 120),
    userEmail: text(input.userEmail, 'Customer email', 3, 254), userPhone: String(input.userPhone ?? '').trim().slice(0, 40),
    category, severity, subject: text(input.subject, 'Subject', 3, 200), description: text(input.description, 'Description', 10, 5000),
    evidence: evidenceReferences(input.evidence), status: 'open' as const, assignedTo: null, resolution: null, internalNotes: '', regulatoryFlag: Boolean(input.regulatoryFlag),
    responseDueAt, createdBy: actorId, lastEditedBy: actorId, createdAt: now, updatedAt: now,
  };
  await getDb().transaction(async tx => {
    await tx.insert(complaints).values(values);
    await tx.insert(complaintEvents).values({ id: `ce_${crypto.randomUUID()}`, complaintId: id, action: 'created', actorId, toStatus: 'open', details: { severity, category, responseDueAt: responseDueAt.toISOString(), targetType: 'internal_operational' } });
  });
  return values;
}

export async function updateComplaint(id: string, input: Record<string, unknown>, actorId: string) {
  requireDatabase(); const rows = await getDb().select().from(complaints).where(eq(complaints.id, id)).limit(1); const current = rows[0];
  if (!current) throw new ComplaintError('Complaint not found.', 'NOT_FOUND', 404);
  const nextStatus = input.status === undefined ? current.status : String(input.status) as ComplaintStatus;
  if (!STATUSES.has(nextStatus)) throw new ComplaintError('Invalid complaint status.', 'VALIDATION_ERROR');
  const resolution = input.resolution === undefined ? current.resolution : String(input.resolution ?? '').trim() || null;
  assertComplaintTransition(current.status, nextStatus, resolution);
  const severity = input.severity === undefined ? current.severity : String(input.severity) as ComplaintSeverity;
  if (!SEVERITIES.has(severity)) throw new ComplaintError('Invalid complaint severity.', 'VALIDATION_ERROR');
  const now = new Date(); const patch = {
    status: nextStatus, severity, assignedTo: input.assignedTo === undefined ? current.assignedTo : String(input.assignedTo ?? '').trim() || null,
    resolution, internalNotes: input.internalNotes === undefined ? current.internalNotes : String(input.internalNotes ?? '').trim().slice(0, 5000),
    regulatoryFlag: input.regulatoryFlag === undefined ? current.regulatoryFlag : Boolean(input.regulatoryFlag),
    resolvedAt: nextStatus === 'resolved' || nextStatus === 'closed' ? current.resolvedAt ?? now : null,
    escalatedAt: nextStatus === 'escalated' ? current.escalatedAt ?? now : current.escalatedAt,
    lastEditedBy: actorId, updatedAt: now,
  };
  const updated = await getDb().transaction(async tx => {
    const saved = await tx.update(complaints).set(patch).where(eq(complaints.id, id)).returning();
    await tx.insert(complaintEvents).values({ id: `ce_${crypto.randomUUID()}`, complaintId: id, action: current.status === nextStatus ? 'edited' : 'status_changed', actorId, fromStatus: current.status, toStatus: nextStatus, details: { severity, assignedTo: patch.assignedTo, regulatoryFlag: patch.regulatoryFlag } });
    return saved[0];
  });
  return updated;
}

export async function getComplaintHistory(id: string) {
  requireDatabase(); return getDb().select().from(complaintEvents).where(eq(complaintEvents.complaintId, id)).orderBy(asc(complaintEvents.createdAt));
}
