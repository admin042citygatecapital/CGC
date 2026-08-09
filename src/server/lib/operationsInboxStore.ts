import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { privateSubdirectory } from './storagePaths.js';

export type OperationsSource = 'account_application' | 'contact_form' | 'card_request' | 'newsletter_signup' | 'support_ticket';
export type OperationsStatus = 'new' | 'in_review' | 'waiting_customer' | 'approved' | 'rejected' | 'resolved' | 'archived';
export type OperationsPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface OperationsHistoryEntry {
  at: string;
  actor: string;
  action: string;
  detail?: string;
}

export interface OperationsItem {
  id: string;
  source: OperationsSource;
  referenceId: string;
  title: string;
  summary: string;
  requesterName?: string;
  requesterEmail?: string;
  userId?: string;
  status: OperationsStatus;
  priority: OperationsPriority;
  assignedTo?: string;
  adminNotes: Array<{ id: string; text: string; author: string; at: string }>;
  metadata: Record<string, string | number | boolean>;
  history: OperationsHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

const DIR = privateSubdirectory('operations');
const FILE = path.join(DIR, 'inbox.jsonl');
const VALID_STATUS = new Set<OperationsStatus>(['new', 'in_review', 'waiting_customer', 'approved', 'rejected', 'resolved', 'archived']);
const VALID_PRIORITY = new Set<OperationsPriority>(['low', 'normal', 'high', 'urgent']);

function readLatest(): OperationsItem[] {
  if (!fs.existsSync(FILE)) return [];
  const byId = new Map<string, OperationsItem>();
  for (const line of fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean)) {
    try {
      const item = JSON.parse(line) as OperationsItem;
      if (item?.id) byId.set(item.id, item);
    } catch { /* ignore a damaged line without hiding the rest of the inbox */ }
  }
  return [...byId.values()];
}

function append(item: OperationsItem): void {
  fs.mkdirSync(DIR, { recursive: true });
  fs.appendFileSync(FILE, `${JSON.stringify(item)}\n`, 'utf8');
}

export function createOperationsItem(input: {
  source: OperationsSource;
  referenceId: string;
  title: string;
  summary: string;
  requesterName?: string;
  requesterEmail?: string;
  userId?: string;
  priority?: OperationsPriority;
  metadata?: Record<string, string | number | boolean>;
}, skipDeduplication = false): OperationsItem {
  if (!skipDeduplication) {
    const existing = readLatest().find(item => item.source === input.source && item.referenceId === input.referenceId);
    if (existing) return existing;
  }
  const now = new Date().toISOString();
  const item: OperationsItem = {
    id: `op_${crypto.randomBytes(8).toString('hex')}`,
    ...input,
    title: input.title.slice(0, 200),
    summary: input.summary.slice(0, 2000),
    status: 'new',
    priority: input.priority ?? 'normal',
    adminNotes: [],
    metadata: input.metadata ?? {},
    history: [{ at: now, actor: 'system', action: 'created' }],
    createdAt: now,
    updatedAt: now,
  };
  append(item);
  return item;
}

export function listOperationsItems(query: { page?: number; limit?: number; status?: string; source?: string; priority?: string; search?: string } = {}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 25));
  const search = (query.search ?? '').trim().toLowerCase();
  let items = readLatest().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (query.status) items = items.filter(item => item.status === query.status);
  if (query.source) items = items.filter(item => item.source === query.source);
  if (query.priority) items = items.filter(item => item.priority === query.priority);
  if (search) items = items.filter(item => [item.title, item.summary, item.requesterName, item.requesterEmail, item.referenceId, item.assignedTo].some(v => v?.toLowerCase().includes(search)));
  const total = items.length;
  return { data: items.slice((page - 1) * limit, page * limit), total, page, pages: Math.max(1, Math.ceil(total / limit)), limit };
}

export function getOperationsStats() {
  const items = readLatest();
  const open = items.filter(item => !['resolved', 'rejected', 'archived'].includes(item.status));
  return {
    total: items.length,
    new: items.filter(item => item.status === 'new').length,
    inReview: items.filter(item => item.status === 'in_review').length,
    urgent: open.filter(item => item.priority === 'urgent').length,
    open: open.length,
  };
}

export function updateOperationsItem(id: string, changes: { status?: string; priority?: string; assignedTo?: string; note?: string }, actor: string): OperationsItem | null {
  const item = readLatest().find(candidate => candidate.id === id);
  if (!item) return null;
  const now = new Date().toISOString();
  const history = [...item.history];
  if (changes.status && VALID_STATUS.has(changes.status as OperationsStatus) && changes.status !== item.status) {
    history.push({ at: now, actor, action: 'status_changed', detail: `${item.status} -> ${changes.status}` });
    item.status = changes.status as OperationsStatus;
  }
  if (changes.priority && VALID_PRIORITY.has(changes.priority as OperationsPriority) && changes.priority !== item.priority) {
    history.push({ at: now, actor, action: 'priority_changed', detail: `${item.priority} -> ${changes.priority}` });
    item.priority = changes.priority as OperationsPriority;
  }
  if (typeof changes.assignedTo === 'string') {
    item.assignedTo = changes.assignedTo.trim().slice(0, 120) || undefined;
    history.push({ at: now, actor, action: 'assigned', detail: item.assignedTo ?? 'unassigned' });
  }
  const note = changes.note?.trim().slice(0, 2000);
  if (note) {
    item.adminNotes = [...item.adminNotes, { id: `note_${crypto.randomBytes(6).toString('hex')}`, text: note, author: actor, at: now }];
    history.push({ at: now, actor, action: 'note_added' });
  }
  item.history = history;
  item.updatedAt = now;
  append(item);
  return item;
}

/** Import submissions created before the centralized inbox was introduced. */
export function syncLegacyOperationsItems(): void {
  const known = new Set(readLatest().map(item => `${item.source}:${item.referenceId}`));
  const sources = [
    { file: path.join(privateSubdirectory('accounts'), 'applications.jsonl'), kind: 'account_application' as const },
    { file: path.join(privateSubdirectory('contacts'), 'submissions.jsonl'), kind: 'contact_form' as const },
  ];
  for (const source of sources) {
    if (!fs.existsSync(source.file)) continue;
    for (const line of fs.readFileSync(source.file, 'utf8').split('\n').filter(Boolean)) {
      try {
        const value = JSON.parse(line) as Record<string, string>;
        if (!value.id) continue;
        const key = `${source.kind}:${value.id}`;
        if (known.has(key)) continue;
        if (source.kind === 'account_application') {
          createOperationsItem({
            source: source.kind, referenceId: value.id,
            title: `Account application: ${value.firstName ?? ''} ${value.lastName ?? ''}`.trim(),
            summary: value.additionalNotes || `${value.accountType || 'Account'} application`,
            requesterName: `${value.firstName ?? ''} ${value.lastName ?? ''}`.trim(), requesterEmail: value.email,
            priority: value.accountType === 'business' ? 'high' : 'normal',
            metadata: { accountType: value.accountType || 'unspecified', nationality: value.nationality || 'unspecified' },
          }, true);
        } else {
          createOperationsItem({
            source: source.kind, referenceId: value.id, title: value.subject || 'Contact form', summary: value.message || '',
            requesterName: `${value.firstName ?? ''} ${value.lastName ?? ''}`.trim(), requesterEmail: value.email,
            metadata: { company: value.company || 'not provided' },
          }, true);
        }
        known.add(key);
      } catch { /* ignore malformed legacy rows */ }
    }
  }
}
