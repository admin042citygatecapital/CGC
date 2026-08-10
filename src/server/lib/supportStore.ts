/**
 * supportStore.ts — Customer support store v2.
 * Backed by /private/support/conversations.jsonl
 * Adds: assignee, internal notes, canned responses, routing rules,
 *       notification settings, bulk ops, rich stats, date-range queries.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ── File paths ────────────────────────────────────────────────────────────────

const SUPPORT_FILE   = '/private/support/conversations.jsonl';
const CANNED_FILE    = '/private/support/canned-responses.json';
const ROUTING_FILE   = '/private/support/routing-rules.json';
const NOTIF_FILE     = '/private/support/notification-settings.json';

// ── Core types ────────────────────────────────────────────────────────────────

export interface SupportMessage {
  id:         string;
  from:       'customer' | 'admin';
  text:       string;
  ts:         string;
  adminName?: string;
}

export interface InternalNote {
  id:        string;
  text:      string;
  adminId:   string;
  adminName?: string;
  ts:        string;
}

export interface SupportConversation {
  id:            string;
  userId:        string;
  userName:      string;
  userEmail:     string;
  subject:       string;
  category:      string;
  priority:      'low' | 'medium' | 'high' | 'urgent';
  status:        'open' | 'pending' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?:   string;   // agent name / team label
  messages:      SupportMessage[];
  internalNotes: InternalNote[];
  createdAt:     string;
  updatedAt:     string;
  resolvedAt?:   string;
  firstReplyAt?: string;   // timestamp of first admin reply (for avg response time)
}

// ── Canned responses ──────────────────────────────────────────────────────────

export interface CannedResponse {
  id:       string;
  title:    string;
  body:     string;
  category: string;   // 'KYC' | 'Transfer Delays' | 'Card Issues' | 'Account Verification' | 'General'
  createdAt: string;
  updatedAt: string;
}

// ── Routing rules ─────────────────────────────────────────────────────────────

export interface RoutingRule {
  id:        string;
  category:  string;   // ticket category to match
  assignTo:  string;   // team / agent label
  enabled:   boolean;
}

export interface RoutingConfig {
  rules:     RoutingRule[];
  updatedAt: string;
}

// ── Notification settings ─────────────────────────────────────────────────────

export interface SupportNotificationSettings {
  urgentTicketInPanel:    boolean;
  urgentTicketEmail:      boolean;
  noResponseInPanel:      boolean;
  noResponseEmail:        boolean;
  noResponseHours:        number;   // default 24
  reopenedInPanel:        boolean;
  reopenedEmail:          boolean;
  notifyEmail:            string;   // admin email to receive alerts
  updatedAt:              string;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_CANNED: CannedResponse[] = [
  {
    id: 'cr_default_1', category: 'General',
    title: 'Acknowledgement',
    body: "Thank you for contacting City Gate Capital. We've received your request and our team is reviewing it. We'll update you within 24 hours.",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'cr_default_2', category: 'General',
    title: 'Resolved',
    body: "Your request has been resolved. Please let us know if you need any further assistance. We're always happy to help.",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'cr_default_3', category: 'General',
    title: 'More Information Needed',
    body: "Thank you for reaching out. To assist you further, we need some additional information. Could you please provide more details about your request?",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'cr_default_4', category: 'KYC',
    title: 'KYC Preview Status',
    body: "The KYC screen is a product demonstration only. Do not upload identity documents. An administrator may review demonstration profile data, but this is not regulated identity verification or approval for a financial account.",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'cr_default_5', category: 'KYC',
    title: 'KYC Documents Unavailable',
    body: "Real identity-document collection is unavailable. Do not send or upload government ID, tax numbers, bank credentials, card details, or proof-of-address documents in this environment.",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'cr_default_6', category: 'Transfer Delays',
    title: 'Transfer Demonstration Explanation',
    body: "No live transfer was submitted or is processing. Transfer records and timelines in this environment are demonstrations only, and City Gate Capital does not hold or move customer funds.",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'cr_default_7', category: 'Card Issues',
    title: 'Card Preview Support',
    body: "No payment card is issued in this environment. Card numbers, controls, balances, and activity shown in the dashboard are demonstration data and cannot be used for purchases.",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'cr_default_8', category: 'Account Verification',
    title: 'Profile Verification Steps',
    body: "Email confirmation provides access to a demonstration profile only. Administrative KYC/AML statuses do not open a bank or payment account and must not be treated as regulated approval.",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_ROUTING: RoutingConfig = {
  rules: [
    { id: 'rr_1', category: 'KYC',      assignTo: 'KYC Team',     enabled: true },
    { id: 'rr_2', category: 'Transfer', assignTo: 'Banking Team', enabled: true },
    { id: 'rr_3', category: 'Wire',     assignTo: 'Banking Team', enabled: true },
    { id: 'rr_4', category: 'Card',     assignTo: 'Cards Team',   enabled: true },
    { id: 'rr_5', category: 'Exchange', assignTo: 'Banking Team', enabled: true },
    { id: 'rr_6', category: 'Account',  assignTo: 'General Queue', enabled: true },
    { id: 'rr_7', category: 'Other',    assignTo: 'General Queue', enabled: true },
  ],
  updatedAt: new Date().toISOString(),
};

const DEFAULT_NOTIF: SupportNotificationSettings = {
  urgentTicketInPanel:  true,
  urgentTicketEmail:    true,
  noResponseInPanel:    true,
  noResponseEmail:      false,
  noResponseHours:      24,
  reopenedInPanel:      true,
  reopenedEmail:        false,
  notifyEmail:          '',
  updatedAt:            new Date().toISOString(),
};

// ── File helpers ──────────────────────────────────────────────────────────────

function ensureDir(file: string) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadAll(): SupportConversation[] {
  try {
    if (!fs.existsSync(SUPPORT_FILE)) return [];
    return fs.readFileSync(SUPPORT_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .map(l => {
        const c = JSON.parse(l) as SupportConversation;
        // Ensure internalNotes always exists
        if (!c.internalNotes) c.internalNotes = [];
        return c;
      });
  } catch { return []; }
}

function saveAll(convs: SupportConversation[]) {
  ensureDir(SUPPORT_FILE);
  fs.writeFileSync(SUPPORT_FILE, convs.map(c => JSON.stringify(c)).join('\n') + '\n');
}

// ── Auto-assignment helper ────────────────────────────────────────────────────

function autoAssign(category: string): string | undefined {
  const config = readRoutingConfig();
  const rule = config.rules.find(r =>
    r.enabled && r.category.toLowerCase() === category.toLowerCase()
  );
  return rule?.assignTo;
}

// ── Conversation CRUD ─────────────────────────────────────────────────────────

export function createConversation(data: {
  userId: string; userName: string; userEmail: string;
  subject: string; category: string; message: string;
  priority?: SupportConversation['priority'];
}): SupportConversation {
  const convs = loadAll();
  const conv: SupportConversation = {
    id:            'sup_' + crypto.randomBytes(8).toString('hex'),
    userId:        data.userId,
    userName:      data.userName,
    userEmail:     data.userEmail,
    subject:       data.subject,
    category:      data.category,
    priority:      data.priority ?? 'medium',
    status:        'open',
    assignedTo:    autoAssign(data.category),
    messages:      [{
      id:   'msg_' + crypto.randomBytes(6).toString('hex'),
      from: 'customer',
      text: data.message,
      ts:   new Date().toISOString(),
    }],
    internalNotes: [],
    createdAt:     new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
  };
  convs.push(conv);
  saveAll(convs);
  return conv;
}

export function addMessage(
  convId: string,
  from: 'customer' | 'admin',
  text: string,
  adminName?: string,
): SupportConversation | null {
  const convs = loadAll();
  const idx = convs.findIndex(c => c.id === convId);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  convs[idx].messages.push({
    id:   'msg_' + crypto.randomBytes(6).toString('hex'),
    from, text, ts: now, adminName,
  });
  convs[idx].updatedAt = now;
  if (from === 'admin') {
    convs[idx].status = 'in_progress';
    if (!convs[idx].firstReplyAt) convs[idx].firstReplyAt = now;
  }
  // If customer replies to a resolved ticket, reopen it
  if (from === 'customer' && (convs[idx].status === 'resolved' || convs[idx].status === 'closed')) {
    convs[idx].status = 'open';
  }
  saveAll(convs);
  return convs[idx];
}

export function addInternalNote(
  convId: string,
  text: string,
  adminId: string,
  adminName?: string,
): SupportConversation | null {
  const convs = loadAll();
  const idx = convs.findIndex(c => c.id === convId);
  if (idx === -1) return null;
  if (!convs[idx].internalNotes) convs[idx].internalNotes = [];
  convs[idx].internalNotes.push({
    id:        'note_' + crypto.randomBytes(6).toString('hex'),
    text,
    adminId,
    adminName,
    ts:        new Date().toISOString(),
  });
  convs[idx].updatedAt = new Date().toISOString();
  saveAll(convs);
  return convs[idx];
}

export function getConversationsForUser(userId: string): SupportConversation[] {
  return loadAll()
    .filter(c => c.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getConversationById(id: string): SupportConversation | undefined {
  return loadAll().find(c => c.id === id);
}

// ── Query with full filter/sort support ───────────────────────────────────────

export type SortOption = 'newest' | 'oldest' | 'priority' | 'longest';

export function queryConversations(opts: {
  status?:    string;
  priority?:  string;
  category?:  string;
  assignedTo?: string;
  search?:    string;
  dateRange?: 'today' | '7d' | '30d' | 'custom';
  dateFrom?:  string;
  dateTo?:    string;
  sort?:      SortOption;
  page?:      number;
  limit?:     number;
}): { data: SupportConversation[]; total: number; pages: number } {
  let rows = loadAll();

  // Filters
  if (opts.status)    rows = rows.filter(c => c.status === opts.status);
  if (opts.priority)  rows = rows.filter(c => c.priority === opts.priority);
  if (opts.category)  rows = rows.filter(c => c.category.toLowerCase() === opts.category!.toLowerCase());
  if (opts.assignedTo) rows = rows.filter(c => (c.assignedTo ?? '').toLowerCase().includes(opts.assignedTo!.toLowerCase()));

  if (opts.search) {
    const s = opts.search.toLowerCase();
    rows = rows.filter(c =>
      c.subject.toLowerCase().includes(s) ||
      c.userName.toLowerCase().includes(s) ||
      c.userEmail.toLowerCase().includes(s) ||
      c.id.includes(s)
    );
  }

  // Date range
  const now = Date.now();
  if (opts.dateRange === 'today') {
    const today = new Date().toISOString().slice(0, 10);
    rows = rows.filter(c => c.createdAt.startsWith(today));
  } else if (opts.dateRange === '7d') {
    const cutoff = new Date(now - 7 * 86400_000).toISOString();
    rows = rows.filter(c => c.createdAt >= cutoff);
  } else if (opts.dateRange === '30d') {
    const cutoff = new Date(now - 30 * 86400_000).toISOString();
    rows = rows.filter(c => c.createdAt >= cutoff);
  } else if (opts.dateRange === 'custom' && opts.dateFrom) {
    rows = rows.filter(c => c.createdAt >= opts.dateFrom!);
    if (opts.dateTo) rows = rows.filter(c => c.createdAt <= opts.dateTo! + 'T23:59:59Z');
  }

  // Sort
  const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  switch (opts.sort ?? 'newest') {
    case 'oldest':
      rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      break;
    case 'priority':
      rows.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
      break;
    case 'longest':
      rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // oldest first = longest unresolved
      break;
    default: // newest
      rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const total = rows.length;
  const limit = opts.limit ?? 20;
  const page  = opts.page  ?? 1;
  return {
    data:  rows.slice((page - 1) * limit, page * limit),
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ── Status update ─────────────────────────────────────────────────────────────

export function updateConversationStatus(id: string, status: SupportConversation['status']): boolean {
  const convs = loadAll();
  const idx = convs.findIndex(c => c.id === id);
  if (idx === -1) return false;
  convs[idx].status = status;
  convs[idx].updatedAt = new Date().toISOString();
  if (status === 'resolved') convs[idx].resolvedAt = new Date().toISOString();
  saveAll(convs);
  return true;
}

export function updateConversationPriority(id: string, priority: SupportConversation['priority']): boolean {
  const convs = loadAll();
  const idx = convs.findIndex(c => c.id === id);
  if (idx === -1) return false;
  convs[idx].priority = priority;
  convs[idx].updatedAt = new Date().toISOString();
  saveAll(convs);
  return true;
}

export function assignConversation(id: string, assignedTo: string): boolean {
  const convs = loadAll();
  const idx = convs.findIndex(c => c.id === id);
  if (idx === -1) return false;
  convs[idx].assignedTo = assignedTo;
  convs[idx].updatedAt = new Date().toISOString();
  saveAll(convs);
  return true;
}

// ── Bulk operations ───────────────────────────────────────────────────────────

export interface BulkResult { updated: number; ids: string[] }

export function bulkUpdateStatus(ids: string[], status: SupportConversation['status']): BulkResult {
  const convs = loadAll();
  const updated: string[] = [];
  const now = new Date().toISOString();
  for (const id of ids) {
    const idx = convs.findIndex(c => c.id === id);
    if (idx !== -1) {
      convs[idx].status = status;
      convs[idx].updatedAt = now;
      if (status === 'resolved') convs[idx].resolvedAt = now;
      updated.push(id);
    }
  }
  saveAll(convs);
  return { updated: updated.length, ids: updated };
}

export function bulkAssign(ids: string[], assignedTo: string): BulkResult {
  const convs = loadAll();
  const updated: string[] = [];
  const now = new Date().toISOString();
  for (const id of ids) {
    const idx = convs.findIndex(c => c.id === id);
    if (idx !== -1) {
      convs[idx].assignedTo = assignedTo;
      convs[idx].updatedAt = now;
      updated.push(id);
    }
  }
  saveAll(convs);
  return { updated: updated.length, ids: updated };
}

export function bulkUpdatePriority(ids: string[], priority: SupportConversation['priority']): BulkResult {
  const convs = loadAll();
  const updated: string[] = [];
  const now = new Date().toISOString();
  for (const id of ids) {
    const idx = convs.findIndex(c => c.id === id);
    if (idx !== -1) {
      convs[idx].priority = priority;
      convs[idx].updatedAt = now;
      updated.push(id);
    }
  }
  saveAll(convs);
  return { updated: updated.length, ids: updated };
}

export function bulkExportCsv(ids: string[]): string {
  const convs = loadAll().filter(c => ids.includes(c.id));
  const header = 'id,subject,userName,userEmail,category,priority,status,assignedTo,messages,createdAt,updatedAt';
  const rows = convs.map(c =>
    [c.id, `"${c.subject.replace(/"/g, '""')}"`, `"${c.userName}"`, c.userEmail,
     c.category, c.priority, c.status, c.assignedTo ?? '',
     c.messages.length, c.createdAt, c.updatedAt].join(',')
  );
  return [header, ...rows].join('\n');
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface SupportStats {
  totalOpen:           number;
  totalPending:        number;
  resolvedToday:       number;
  avgResponseTimeHrs:  number;
  oldestUnresolvedDays: number;
  byStatus:            Record<string, number>;
  byPriority:          Record<string, number>;
  byCategory:          Record<string, number>;
}

export function getSupportStats(): SupportStats {
  const convs = loadAll();
  const now   = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  const byStatus:   Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  let resolvedToday = 0;
  let totalOpen     = 0;
  let totalPending  = 0;
  let oldestMs      = 0;
  const responseTimes: number[] = [];

  for (const c of convs) {
    byStatus[c.status]     = (byStatus[c.status]     ?? 0) + 1;
    byPriority[c.priority] = (byPriority[c.priority] ?? 0) + 1;
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;

    if (c.status === 'open')    totalOpen++;
    if (c.status === 'pending') totalPending++;

    if (c.resolvedAt?.startsWith(today)) resolvedToday++;

    if (c.status !== 'resolved' && c.status !== 'closed') {
      const age = now - new Date(c.createdAt).getTime();
      if (age > oldestMs) oldestMs = age;
    }

    if (c.firstReplyAt) {
      const ms = new Date(c.firstReplyAt).getTime() - new Date(c.createdAt).getTime();
      if (ms > 0) responseTimes.push(ms);
    }
  }

  const avgResponseTimeHrs = responseTimes.length
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 3_600_000
    : 0;

  return {
    totalOpen,
    totalPending,
    resolvedToday,
    avgResponseTimeHrs: Math.round(avgResponseTimeHrs * 10) / 10,
    oldestUnresolvedDays: Math.floor(oldestMs / 86_400_000),
    byStatus,
    byPriority,
    byCategory,
  };
}

// ── Canned responses ──────────────────────────────────────────────────────────

export function readCannedResponses(): CannedResponse[] {
  try {
    if (!fs.existsSync(CANNED_FILE)) return DEFAULT_CANNED;
    return JSON.parse(fs.readFileSync(CANNED_FILE, 'utf8')) as CannedResponse[];
  } catch { return DEFAULT_CANNED; }
}

export function writeCannedResponses(items: CannedResponse[]): void {
  ensureDir(CANNED_FILE);
  fs.writeFileSync(CANNED_FILE, JSON.stringify(items, null, 2));
}

export function createCannedResponse(data: { title: string; body: string; category: string }): CannedResponse {
  const items = readCannedResponses();
  const item: CannedResponse = {
    id:        'cr_' + crypto.randomBytes(6).toString('hex'),
    title:     data.title,
    body:      data.body,
    category:  data.category,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  items.push(item);
  writeCannedResponses(items);
  return item;
}

export function updateCannedResponse(id: string, patch: Partial<Pick<CannedResponse, 'title' | 'body' | 'category'>>): CannedResponse | null {
  const items = readCannedResponses();
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
  writeCannedResponses(items);
  return items[idx];
}

export function deleteCannedResponse(id: string): boolean {
  const items = readCannedResponses();
  const filtered = items.filter(i => i.id !== id);
  if (filtered.length === items.length) return false;
  writeCannedResponses(filtered);
  return true;
}

// ── Routing rules ─────────────────────────────────────────────────────────────

export function readRoutingConfig(): RoutingConfig {
  try {
    if (!fs.existsSync(ROUTING_FILE)) return DEFAULT_ROUTING;
    return JSON.parse(fs.readFileSync(ROUTING_FILE, 'utf8')) as RoutingConfig;
  } catch { return DEFAULT_ROUTING; }
}

export function writeRoutingConfig(config: RoutingConfig): void {
  ensureDir(ROUTING_FILE);
  fs.writeFileSync(ROUTING_FILE, JSON.stringify(config, null, 2));
}

// ── Notification settings ─────────────────────────────────────────────────────

export function readNotificationSettings(): SupportNotificationSettings {
  try {
    if (!fs.existsSync(NOTIF_FILE)) return DEFAULT_NOTIF;
    return { ...DEFAULT_NOTIF, ...JSON.parse(fs.readFileSync(NOTIF_FILE, 'utf8')) };
  } catch { return DEFAULT_NOTIF; }
}

export function writeNotificationSettings(s: SupportNotificationSettings): void {
  ensureDir(NOTIF_FILE);
  fs.writeFileSync(NOTIF_FILE, JSON.stringify(s, null, 2));
}

// ── Stale ticket check (for notification polling) ─────────────────────────────

export function getStaleTickets(hours: number): SupportConversation[] {
  const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();
  return loadAll().filter(c =>
    (c.status === 'open' || c.status === 'in_progress') &&
    c.updatedAt < cutoff
  );
}
