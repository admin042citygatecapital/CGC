import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { getDb, getQueryClient, isDatabaseConfigured } from '../db/db.js';
import { operationsItems } from '../db/schema.js';
import type { OperationsItemRow } from '../db/schema.js';
import { privateSubdirectory } from './storagePaths.js';
import { escapeLikePattern } from './inputValidator.js';

export type OperationsSource = 'account_application' | 'contact_form' | 'card_request' | 'newsletter_signup' | 'support_ticket';
export type OperationsStatus = 'new' | 'in_review' | 'waiting_customer' | 'approved' | 'rejected' | 'resolved' | 'archived';
export type OperationsPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface OperationsHistoryEntry { at: string; actor: string; action: string; detail?: string }
export interface OperationsNote { id: string; text: string; author: string; at: string }
export interface OperationsItem {
  id: string; source: OperationsSource; referenceId: string; title: string; summary: string;
  requesterName?: string; requesterEmail?: string; userId?: string; status: OperationsStatus;
  priority: OperationsPriority; assignedTo?: string; adminNotes: OperationsNote[];
  metadata: Record<string, string | number | boolean>; history: OperationsHistoryEntry[];
  createdAt: string; updatedAt: string;
}
export interface CreateOperationsInput {
  source: OperationsSource; referenceId: string; title: string; summary: string;
  requesterName?: string; requesterEmail?: string; userId?: string;
  priority?: OperationsPriority; metadata?: Record<string, string | number | boolean>;
}
export interface OperationsUpdate { status?: string; priority?: string; assignedTo?: string; note?: string }
export interface OperationsQuery { page?: number; limit?: number; status?: string; source?: string; priority?: string; search?: string }

const VALID_STATUS = new Set<OperationsStatus>(['new', 'in_review', 'waiting_customer', 'approved', 'rejected', 'resolved', 'archived']);
const VALID_PRIORITY = new Set<OperationsPriority>(['low', 'normal', 'high', 'urgent']);
let legacySyncComplete = false;
let _ff: typeof import('./operationsInboxStore.flatfile.js') | null = null;
async function ff() { if (!_ff) _ff = await import('./operationsInboxStore.flatfile.js'); return _ff; }

function shouldUseDevelopmentFallback(): boolean {
  if (isDatabaseConfigured()) return false;
  if (process.env.NODE_ENV === 'production') throw new Error('OPERATIONS_DATABASE_UNAVAILABLE');
  return true;
}

function toItem(row: OperationsItemRow): OperationsItem {
  return {
    id: row.id, source: row.source as OperationsSource, referenceId: row.referenceId,
    title: row.title, summary: row.summary, requesterName: row.requesterName ?? undefined,
    requesterEmail: row.requesterEmail ?? undefined, userId: row.userId ?? undefined,
    status: row.status as OperationsStatus, priority: row.priority as OperationsPriority,
    assignedTo: row.assignedTo ?? undefined, adminNotes: (row.adminNotes ?? []) as OperationsNote[],
    metadata: (row.metadata ?? {}) as Record<string, string | number | boolean>,
    history: (row.history ?? []) as OperationsHistoryEntry[],
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createOperationsItem(input: CreateOperationsInput, skipDeduplication = false): Promise<OperationsItem> {
  if (shouldUseDevelopmentFallback()) return (await ff()).createOperationsItem(input, skipDeduplication);
  const now = new Date();
  const values = {
    id: `op_${crypto.randomBytes(8).toString('hex')}`, source: input.source, referenceId: input.referenceId,
    title: input.title.slice(0, 200), summary: input.summary.slice(0, 2000),
    requesterName: input.requesterName?.slice(0, 200) ?? null,
    requesterEmail: input.requesterEmail?.slice(0, 254).toLowerCase() ?? null,
    userId: input.userId ?? null, status: 'new', priority: input.priority ?? 'normal',
    assignedTo: null, adminNotes: [] as OperationsNote[], metadata: input.metadata ?? {},
    history: [{ at: now.toISOString(), actor: 'system', action: 'created' }] as OperationsHistoryEntry[],
    createdAt: now, updatedAt: now,
  };
  const inserted = await getDb().insert(operationsItems).values(values)
    .onConflictDoNothing({ target: [operationsItems.source, operationsItems.referenceId] }).returning();
  if (inserted[0]) return toItem(inserted[0]);
  const existing = await getDb().select().from(operationsItems)
    .where(and(eq(operationsItems.source, input.source), eq(operationsItems.referenceId, input.referenceId))).limit(1);
  if (!existing[0]) throw new Error('Operations inbox deduplication failed');
  return toItem(existing[0]);
}

async function importOperationsItem(item: OperationsItem): Promise<void> {
  await getDb().insert(operationsItems).values({
    id: item.id, source: item.source, referenceId: item.referenceId,
    title: item.title.slice(0, 200), summary: item.summary.slice(0, 2000),
    requesterName: item.requesterName?.slice(0, 200) ?? null,
    requesterEmail: item.requesterEmail?.slice(0, 254).toLowerCase() ?? null,
    userId: item.userId ?? null,
    status: VALID_STATUS.has(item.status) ? item.status : 'new',
    priority: VALID_PRIORITY.has(item.priority) ? item.priority : 'normal',
    assignedTo: item.assignedTo?.slice(0, 120) ?? null,
    adminNotes: item.adminNotes ?? [], metadata: item.metadata ?? {}, history: item.history ?? [],
    createdAt: new Date(item.createdAt), updatedAt: new Date(item.updatedAt),
  }).onConflictDoNothing({ target: [operationsItems.source, operationsItems.referenceId] });
}

export async function listOperationsItems(query: OperationsQuery = {}) {
  if (shouldUseDevelopmentFallback()) return (await ff()).listOperationsItems(query);
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 25));
  const conditions: SQL[] = [];
  if (query.status && VALID_STATUS.has(query.status as OperationsStatus)) conditions.push(eq(operationsItems.status, query.status));
  if (query.source) conditions.push(eq(operationsItems.source, query.source));
  if (query.priority && VALID_PRIORITY.has(query.priority as OperationsPriority)) conditions.push(eq(operationsItems.priority, query.priority));
  const search = query.search?.trim();
  if (search) {
    const pattern = `%${escapeLikePattern(search)}%`;
    const match = or(
      ilike(operationsItems.title, pattern), ilike(operationsItems.summary, pattern),
      ilike(operationsItems.requesterName, pattern), ilike(operationsItems.requesterEmail, pattern),
      ilike(operationsItems.referenceId, pattern), ilike(operationsItems.assignedTo, pattern),
    );
    if (match) conditions.push(match);
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const [rows, totals] = await Promise.all([
    getDb().select().from(operationsItems).where(where).orderBy(desc(operationsItems.updatedAt)).limit(limit).offset((page - 1) * limit),
    getDb().select({ value: count() }).from(operationsItems).where(where),
  ]);
  const total = Number(totals[0]?.value ?? 0);
  return { data: rows.map(toItem), total, page, pages: Math.max(1, Math.ceil(total / limit)), limit };
}

export async function getOperationsStats() {
  if (shouldUseDevelopmentFallback()) return (await ff()).getOperationsStats();
  const rows = await getDb().select({
    total: sql<number>`count(*)::int`,
    new: sql<number>`count(*) filter (where ${operationsItems.status} = 'new')::int`,
    inReview: sql<number>`count(*) filter (where ${operationsItems.status} = 'in_review')::int`,
    urgent: sql<number>`count(*) filter (where ${operationsItems.priority} = 'urgent' and ${operationsItems.status} not in ('resolved','rejected','archived'))::int`,
    open: sql<number>`count(*) filter (where ${operationsItems.status} not in ('resolved','rejected','archived'))::int`,
  }).from(operationsItems);
  return rows[0] ?? { total: 0, new: 0, inReview: 0, urgent: 0, open: 0 };
}

export async function updateOperationsItem(id: string, changes: OperationsUpdate, actor: string): Promise<OperationsItem | null> {
  if (shouldUseDevelopmentFallback()) return (await ff()).updateOperationsItem(id, changes, actor);
  const now = new Date().toISOString();
  const status = changes.status && VALID_STATUS.has(changes.status as OperationsStatus) ? changes.status : null;
  const priority = changes.priority && VALID_PRIORITY.has(changes.priority as OperationsPriority) ? changes.priority : null;
  const assignmentProvided = typeof changes.assignedTo === 'string';
  const assignedTo = assignmentProvided ? changes.assignedTo!.trim().slice(0, 120) || null : null;
  const noteText = changes.note?.trim().slice(0, 2000) || null;
  const history: OperationsHistoryEntry[] = [];
  if (status) history.push({ at: now, actor, action: 'status_changed', detail: status });
  if (priority) history.push({ at: now, actor, action: 'priority_changed', detail: priority });
  if (assignmentProvided) history.push({ at: now, actor, action: 'assigned', detail: assignedTo ?? 'unassigned' });
  if (noteText) history.push({ at: now, actor, action: 'note_added' });
  const notes: OperationsNote[] = noteText ? [{ id: `note_${crypto.randomBytes(6).toString('hex')}`, text: noteText, author: actor, at: now }] : [];
  if (!status && !priority && !assignmentProvided && !noteText) {
    const unchanged = await getDb().select().from(operationsItems).where(eq(operationsItems.id, id)).limit(1);
    return unchanged[0] ? toItem(unchanged[0]) : null;
  }
  const client = getQueryClient();
  const rows = await client<OperationsItemRow[]>`
    UPDATE operations_items SET
      status = CASE WHEN ${status}::text IS NULL THEN status ELSE ${status}::text END,
      priority = CASE WHEN ${priority}::text IS NULL THEN priority ELSE ${priority}::text END,
      assigned_to = CASE WHEN ${assignmentProvided}::boolean THEN ${assignedTo}::text ELSE assigned_to END,
      admin_notes = admin_notes || ${JSON.stringify(notes)}::jsonb,
      history = history || ${JSON.stringify(history)}::jsonb,
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, source, reference_id AS "referenceId", title, summary,
      requester_name AS "requesterName", requester_email AS "requesterEmail", user_id AS "userId",
      status, priority, assigned_to AS "assignedTo", admin_notes AS "adminNotes", metadata, history,
      created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  return rows[0] ? toItem(rows[0]) : null;
}

/** One-time, idempotent import of the append-only inbox and older intake files. */
export async function syncLegacyOperationsItems(): Promise<void> {
  if (legacySyncComplete) return;
  if (shouldUseDevelopmentFallback()) {
    (await ff()).syncLegacyOperationsItems();
    legacySyncComplete = true;
    return;
  }
  const flat = await ff();
  flat.syncLegacyOperationsItems();
  const candidates = flat.getAllOperationsItems();
  for (const item of candidates) {
    await importOperationsItem(item);
  }
  legacySyncComplete = true;
}

export function operationsFallbackFile(): string {
  return path.join(privateSubdirectory('operations'), 'inbox.jsonl');
}

export function hasOperationsFallbackData(): boolean {
  return fs.existsSync(operationsFallbackFile());
}
