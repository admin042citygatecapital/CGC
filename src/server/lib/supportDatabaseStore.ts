import crypto from 'node:crypto';
import { getQueryClient, isDatabaseConfigured } from '../db/db.js';

export interface SupportMessage {
  id: string;
  from: 'customer' | 'admin';
  text: string;
  ts: string;
  adminName?: string;
}

export interface InternalNote {
  id: string;
  text: string;
  adminId: string;
  adminName?: string;
  ts: string;
}

export interface SupportConversation {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'pending' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  messages: SupportMessage[];
  internalNotes: InternalNote[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  firstReplyAt?: string;
}

interface SupportRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: string;
  priority: SupportConversation['priority'];
  status: SupportConversation['status'];
  assignedTo: string | null;
  messages: Array<{ id: string; from: string; text: string; ts: Date | string; adminName: string | null }>;
  internalNotes: Array<{ id: string; text: string; adminId: string; adminName: string | null; ts: Date | string }>;
  createdAt: Date | string;
  updatedAt: Date | string;
  resolvedAt: Date | string | null;
  firstReplyAt: Date | string | null;
}

export type SortOption = 'newest' | 'oldest' | 'priority' | 'longest';
export interface BulkResult { updated: number; ids: string[] }

export interface CannedResponse {
  id: string; title: string; body: string; category: string; createdAt: string; updatedAt: string;
}

export interface RoutingRule { id: string; category: string; assignTo: string; enabled: boolean }
export interface RoutingConfig { rules: RoutingRule[]; updatedAt: string }
export interface SupportNotificationSettings {
  urgentTicketInPanel: boolean; urgentTicketEmail: boolean;
  noResponseInPanel: boolean; noResponseEmail: boolean; noResponseHours: number;
  reopenedInPanel: boolean; reopenedEmail: boolean; notifyEmail: string; updatedAt: string;
}

const ROUTING_CONFIG_KEY = 'support_routing';
const NOTIFICATION_CONFIG_KEY = 'support_notifications';

let legacySync: Promise<number> | null = null;

/** Import disk-era support cases exactly once before the managed store is used. */
export function syncLegacySupportConversations(): Promise<number> {
  if (!isDatabaseConfigured()) return Promise.resolve(0);
  if (legacySync) return legacySync;
  legacySync = (async () => {
    const legacy = await import('./supportStore.js');
    const { data } = legacy.queryConversations({ page: 1, limit: Number.MAX_SAFE_INTEGER });
    const sql = getQueryClient();
    for (const conversation of data) {
      await sql.begin(async transaction => {
        await transaction`
          INSERT INTO support_conversations
            (id,user_id,user_name,user_email,subject,category,priority,status,assigned_to,first_reply_at,resolved_at,created_at,updated_at)
          VALUES
            (${conversation.id},${conversation.userId},${conversation.userName},${conversation.userEmail.toLowerCase()},${conversation.subject},${conversation.category},${conversation.priority},${conversation.status},${conversation.assignedTo ?? null},${conversation.firstReplyAt ?? null},${conversation.resolvedAt ?? null},${conversation.createdAt},${conversation.updatedAt})
          ON CONFLICT (id) DO NOTHING
        `;
        for (const message of conversation.messages) {
          await transaction`
            INSERT INTO support_messages (id,conversation_id,"from",text,admin_name,ts)
            VALUES (${message.id},${conversation.id},${message.from},${message.text},${message.adminName ?? null},${message.ts})
            ON CONFLICT (id) DO NOTHING
          `;
        }
        for (const note of conversation.internalNotes ?? []) {
          await transaction`
            INSERT INTO support_notes (id,conversation_id,text,admin_id,admin_name,ts)
            VALUES (${note.id},${conversation.id},${note.text},${note.adminId},${note.adminName ?? null},${note.ts})
            ON CONFLICT (id) DO NOTHING
          `;
        }
      });
    }
    for (const response of legacy.readCannedResponses()) {
      await sql`
        INSERT INTO canned_responses (id,title,body,category,created_at,updated_at)
        VALUES (${response.id},${response.title},${response.body},${response.category},${response.createdAt},${response.updatedAt})
        ON CONFLICT (id) DO NOTHING
      `;
    }
    const routing = legacy.readRoutingConfig();
    const notifications = legacy.readNotificationSettings();
    await sql`
      INSERT INTO config (key,value,updated_at,updated_by)
      VALUES (${ROUTING_CONFIG_KEY},${sql.json(routing as unknown as Parameters<typeof sql.json>[0])},NOW(),'system:migration')
      ON CONFLICT (key) DO NOTHING
    `;
    await sql`
      INSERT INTO config (key,value,updated_at,updated_by)
      VALUES (${NOTIFICATION_CONFIG_KEY},${sql.json(notifications as unknown as Parameters<typeof sql.json>[0])},NOW(),'system:migration')
      ON CONFLICT (key) DO NOTHING
    `;
    return data.length;
  })().catch(error => {
    legacySync = null;
    throw error;
  });
  return legacySync;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRow(row: SupportRow): SupportConversation {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    subject: row.subject,
    category: row.category,
    priority: row.priority,
    status: row.status,
    assignedTo: row.assignedTo ?? undefined,
    messages: (row.messages ?? []).map(message => ({
      id: message.id,
      from: message.from === 'admin' ? 'admin' : 'customer',
      text: message.text,
      ts: iso(message.ts),
      adminName: message.adminName ?? undefined,
    })),
    internalNotes: (row.internalNotes ?? []).map(note => ({
      id: note.id,
      text: note.text,
      adminId: note.adminId,
      adminName: note.adminName ?? undefined,
      ts: iso(note.ts),
    })),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    resolvedAt: row.resolvedAt ? iso(row.resolvedAt) : undefined,
    firstReplyAt: row.firstReplyAt ? iso(row.firstReplyAt) : undefined,
  };
}

async function selectRows(where: 'all' | 'id' | 'user', value?: string): Promise<SupportRow[]> {
  await syncLegacySupportConversations();
  const sql = getQueryClient();
  const base = sql<SupportRow[]>`
    SELECT c.id, c.user_id AS "userId", c.user_name AS "userName",
      c.user_email AS "userEmail", c.subject, c.category, c.priority, c.status,
      c.assigned_to AS "assignedTo", c.created_at AS "createdAt", c.updated_at AS "updatedAt",
      c.resolved_at AS "resolvedAt", c.first_reply_at AS "firstReplyAt",
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', m.id, 'from', m."from", 'text', m.text,
          'adminName', m.admin_name, 'ts', m.ts
        ) ORDER BY m.ts)
        FROM support_messages m WHERE m.conversation_id = c.id
      ), '[]'::json) AS messages,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', n.id, 'text', n.text, 'adminId', n.admin_id,
          'adminName', n.admin_name, 'ts', n.ts
        ) ORDER BY n.ts)
        FROM support_notes n WHERE n.conversation_id = c.id
      ), '[]'::json) AS "internalNotes"
    FROM support_conversations c
    ${where === 'id' ? sql`WHERE c.id = ${value ?? ''}` : where === 'user' ? sql`WHERE c.user_id = ${value ?? ''}` : sql``}
    ORDER BY c.updated_at DESC
  `;
  return base;
}

function defaultAssignment(category: string): string {
  const assignments: Record<string, string> = {
    'Identity Verification': 'Compliance Team',
    'Transfer Workspace': 'Payments Team',
    'Card Workspace': 'Cards Team',
    'Trading Workspace': 'Markets Team',
    'Technical Support': 'Technical Team',
    'Account Access': 'Account Services',
  };
  return assignments[category] ?? 'General Queue';
}

export async function createConversation(data: {
  userId: string; userName: string; userEmail: string;
  subject: string; category: string; message: string;
  priority?: SupportConversation['priority'];
}): Promise<SupportConversation> {
  await syncLegacySupportConversations();
  const sql = getQueryClient();
  const id = `sup_${crypto.randomBytes(8).toString('hex')}`;
  const messageId = `msg_${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date();
  await sql.begin(async transaction => {
    await transaction`
      INSERT INTO support_conversations
        (id,user_id,user_name,user_email,subject,category,priority,status,assigned_to,created_at,updated_at)
      VALUES
        (${id},${data.userId},${data.userName},${data.userEmail.toLowerCase()},${data.subject},${data.category},${data.priority ?? 'medium'},'open',${defaultAssignment(data.category)},${now},${now})
    `;
    await transaction`
      INSERT INTO support_messages (id,conversation_id,"from",text,ts)
      VALUES (${messageId},${id},'customer',${data.message},${now})
    `;
  });
  const created = await getConversationById(id);
  if (!created) throw new Error('SUPPORT_CONVERSATION_CREATE_FAILED');
  return created;
}

async function appendMessage(
  conversationId: string,
  from: 'customer' | 'admin',
  text: string,
  adminName?: string,
  ownerUserId?: string,
): Promise<boolean> {
  await syncLegacySupportConversations();
  const sql = getQueryClient();
  return sql.begin(async transaction => {
    const conversations = await transaction<{ status: string; firstReplyAt: Date | null }[]>`
      SELECT status, first_reply_at AS "firstReplyAt"
      FROM support_conversations
      WHERE id = ${conversationId}
        AND (${ownerUserId ?? null}::text IS NULL OR user_id = ${ownerUserId ?? null})
      FOR UPDATE
    `;
    if (!conversations[0]) return false;
    const now = new Date();
    await transaction`
      INSERT INTO support_messages (id,conversation_id,"from",text,admin_name,ts)
      VALUES (${`msg_${crypto.randomBytes(6).toString('hex')}`},${conversationId},${from},${text},${adminName ?? null},${now})
    `;
    const reopened = from === 'customer' && ['resolved', 'closed'].includes(conversations[0].status);
    await transaction`
      UPDATE support_conversations SET
        status = CASE
          WHEN ${from} = 'admin' THEN 'in_progress'::support_status
          WHEN ${reopened} THEN 'open'::support_status
          ELSE status
        END,
        first_reply_at = CASE
          WHEN ${from} = 'admin' AND first_reply_at IS NULL THEN ${now}
          ELSE first_reply_at
        END,
        updated_at = ${now}
      WHERE id = ${conversationId}
    `;
    return true;
  });
}

export async function addMessage(conversationId: string, from: 'customer' | 'admin', text: string, adminName?: string) {
  return (await appendMessage(conversationId, from, text, adminName))
    ? getConversationById(conversationId)
    : null;
}

export async function addCustomerMessage(conversationId: string, userId: string, text: string) {
  return (await appendMessage(conversationId, 'customer', text, undefined, userId))
    ? getConversationById(conversationId)
    : null;
}

export async function addInternalNote(conversationId: string, text: string, adminId: string, adminName?: string) {
  await syncLegacySupportConversations();
  const sql = getQueryClient();
  const rows = await sql<{ id: string }[]>`
    INSERT INTO support_notes (id,conversation_id,text,admin_id,admin_name,ts)
    SELECT ${`note_${crypto.randomBytes(6).toString('hex')}`}, id, ${text}, ${adminId}, ${adminName ?? null}, NOW()
    FROM support_conversations WHERE id = ${conversationId}
    RETURNING conversation_id AS id
  `;
  if (!rows[0]) return null;
  await sql`UPDATE support_conversations SET updated_at=NOW() WHERE id=${conversationId}`;
  return getConversationById(conversationId);
}

export async function getConversationsForUser(userId: string): Promise<SupportConversation[]> {
  return (await selectRows('user', userId)).map(mapRow);
}

export async function getConversationById(id: string): Promise<SupportConversation | undefined> {
  const rows = await selectRows('id', id);
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function queryConversations(opts: {
  status?: string; priority?: string; category?: string; assignedTo?: string; search?: string;
  dateRange?: 'today' | '7d' | '30d' | 'custom'; dateFrom?: string; dateTo?: string;
  sort?: SortOption; page?: number; limit?: number;
}): Promise<{ data: SupportConversation[]; total: number; pages: number }> {
  let rows = (await selectRows('all')).map(mapRow);
  if (opts.status) rows = rows.filter(row => row.status === opts.status);
  if (opts.priority) rows = rows.filter(row => row.priority === opts.priority);
  if (opts.category) rows = rows.filter(row => row.category.toLowerCase() === opts.category!.toLowerCase());
  if (opts.assignedTo) rows = rows.filter(row => (row.assignedTo ?? '').toLowerCase().includes(opts.assignedTo!.toLowerCase()));
  if (opts.search) {
    const search = opts.search.toLowerCase();
    rows = rows.filter(row => [row.subject, row.userName, row.userEmail, row.id].some(value => value.toLowerCase().includes(search)));
  }
  const now = Date.now();
  if (opts.dateRange === 'today') {
    const today = new Date().toISOString().slice(0, 10);
    rows = rows.filter(row => row.createdAt.startsWith(today));
  } else if (opts.dateRange === '7d') {
    const cutoff = new Date(now - 7 * 86_400_000).toISOString();
    rows = rows.filter(row => row.createdAt >= cutoff);
  } else if (opts.dateRange === '30d') {
    const cutoff = new Date(now - 30 * 86_400_000).toISOString();
    rows = rows.filter(row => row.createdAt >= cutoff);
  } else if (opts.dateRange === 'custom' && opts.dateFrom) {
    rows = rows.filter(row => row.createdAt >= opts.dateFrom! && (!opts.dateTo || row.createdAt <= `${opts.dateTo}T23:59:59Z`));
  }
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  if (opts.sort === 'oldest' || opts.sort === 'longest') rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  else if (opts.sort === 'priority') rows.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  else rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const total = rows.length;
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const page = Math.max(1, opts.page ?? 1);
  return { data: rows.slice((page - 1) * limit, page * limit), total, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function updateConversationStatus(id: string, status: SupportConversation['status']): Promise<boolean> {
  await syncLegacySupportConversations();
  const sql = getQueryClient();
  const rows = await sql<{ id: string }[]>`
    UPDATE support_conversations SET status=${status},updated_at=NOW(),
      resolved_at=CASE WHEN ${status}='resolved' THEN NOW() ELSE resolved_at END
    WHERE id=${id} RETURNING id
  `;
  return Boolean(rows[0]);
}

export async function updateConversationPriority(id: string, priority: SupportConversation['priority']): Promise<boolean> {
  await syncLegacySupportConversations();
  const sql = getQueryClient();
  const rows = await sql<{ id: string }[]>`UPDATE support_conversations SET priority=${priority},updated_at=NOW() WHERE id=${id} RETURNING id`;
  return Boolean(rows[0]);
}

export async function assignConversation(id: string, assignedTo: string): Promise<boolean> {
  await syncLegacySupportConversations();
  const sql = getQueryClient();
  const rows = await sql<{ id: string }[]>`UPDATE support_conversations SET assigned_to=${assignedTo},updated_at=NOW() WHERE id=${id} RETURNING id`;
  return Boolean(rows[0]);
}

async function bulkUpdate(ids: string[], field: 'status' | 'priority' | 'assigned_to', value: string): Promise<BulkResult> {
  await syncLegacySupportConversations();
  if (ids.length === 0) return { updated: 0, ids: [] };
  const sql = getQueryClient();
  const rows = field === 'status'
    ? await sql<{ id: string }[]>`UPDATE support_conversations SET status=${value}::support_status,updated_at=NOW(),resolved_at=CASE WHEN ${value}='resolved' THEN NOW() ELSE resolved_at END WHERE id IN ${sql(ids)} RETURNING id`
    : field === 'priority'
      ? await sql<{ id: string }[]>`UPDATE support_conversations SET priority=${value}::support_priority,updated_at=NOW() WHERE id IN ${sql(ids)} RETURNING id`
      : await sql<{ id: string }[]>`UPDATE support_conversations SET assigned_to=${value},updated_at=NOW() WHERE id IN ${sql(ids)} RETURNING id`;
  return { updated: rows.length, ids: rows.map(row => row.id) };
}

export function bulkUpdateStatus(ids: string[], status: SupportConversation['status']) { return bulkUpdate(ids, 'status', status); }
export function bulkUpdatePriority(ids: string[], priority: SupportConversation['priority']) { return bulkUpdate(ids, 'priority', priority); }
export function bulkAssign(ids: string[], assignedTo: string) { return bulkUpdate(ids, 'assigned_to', assignedTo); }

export async function bulkExportCsv(ids: string[]): Promise<string> {
  const conversations = (await selectRows('all')).map(mapRow).filter(conversation => ids.includes(conversation.id));
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = 'id,subject,userName,userEmail,category,priority,status,assignedTo,messages,createdAt,updatedAt';
  const rows = conversations.map(conversation => [
    conversation.id, escape(conversation.subject), escape(conversation.userName), conversation.userEmail,
    conversation.category, conversation.priority, conversation.status, escape(conversation.assignedTo ?? ''),
    conversation.messages.length, conversation.createdAt, conversation.updatedAt,
  ].join(','));
  return [header, ...rows].join('\n');
}

export async function getSupportStats() {
  const conversations = (await selectRows('all')).map(mapRow);
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let resolvedToday = 0;
  let oldestMs = 0;
  const responseTimes: number[] = [];
  for (const conversation of conversations) {
    byStatus[conversation.status] = (byStatus[conversation.status] ?? 0) + 1;
    byPriority[conversation.priority] = (byPriority[conversation.priority] ?? 0) + 1;
    byCategory[conversation.category] = (byCategory[conversation.category] ?? 0) + 1;
    if (conversation.resolvedAt?.startsWith(today)) resolvedToday++;
    if (!['resolved', 'closed'].includes(conversation.status)) oldestMs = Math.max(oldestMs, now - new Date(conversation.createdAt).getTime());
    if (conversation.firstReplyAt) responseTimes.push(new Date(conversation.firstReplyAt).getTime() - new Date(conversation.createdAt).getTime());
  }
  const average = responseTimes.length ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length / 3_600_000 : 0;
  return {
    totalOpen: byStatus.open ?? 0,
    totalPending: byStatus.pending ?? 0,
    resolvedToday,
    avgResponseTimeHrs: Math.round(average * 10) / 10,
    oldestUnresolvedDays: Math.floor(oldestMs / 86_400_000),
    byStatus,
    byPriority,
    byCategory,
  };
}

export async function readCannedResponses(): Promise<CannedResponse[]> {
  await syncLegacySupportConversations();
  const sql = getQueryClient();
  const rows = await sql<Array<{ id: string; title: string; body: string; category: string; createdAt: Date | string; updatedAt: Date | string }>>`
    SELECT id,title,body,category,created_at AS "createdAt",updated_at AS "updatedAt"
    FROM canned_responses ORDER BY category,title
  `;
  return rows.map(row => ({ ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }));
}

export async function createCannedResponse(data: { title: string; body: string; category: string }): Promise<CannedResponse> {
  await syncLegacySupportConversations();
  const sql = getQueryClient();
  const rows = await sql<Array<{ id: string; title: string; body: string; category: string; createdAt: Date | string; updatedAt: Date | string }>>`
    INSERT INTO canned_responses (id,title,body,category,created_at,updated_at)
    VALUES (${`cr_${crypto.randomBytes(6).toString('hex')}`},${data.title},${data.body},${data.category},NOW(),NOW())
    RETURNING id,title,body,category,created_at AS "createdAt",updated_at AS "updatedAt"
  `;
  const row = rows[0];
  return { ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
}

export async function updateCannedResponse(id: string, patch: Partial<Pick<CannedResponse, 'title' | 'body' | 'category'>>): Promise<CannedResponse | null> {
  await syncLegacySupportConversations();
  const existing = (await readCannedResponses()).find(response => response.id === id);
  if (!existing) return null;
  const sql = getQueryClient();
  const rows = await sql<Array<{ id: string; title: string; body: string; category: string; createdAt: Date | string; updatedAt: Date | string }>>`
    UPDATE canned_responses SET
      title=${patch.title ?? existing.title}, body=${patch.body ?? existing.body},
      category=${patch.category ?? existing.category}, updated_at=NOW()
    WHERE id=${id}
    RETURNING id,title,body,category,created_at AS "createdAt",updated_at AS "updatedAt"
  `;
  const row = rows[0];
  return row ? { ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) } : null;
}

export async function deleteCannedResponse(id: string): Promise<boolean> {
  await syncLegacySupportConversations();
  const sql = getQueryClient();
  const rows = await sql<{ id: string }[]>`DELETE FROM canned_responses WHERE id=${id} RETURNING id`;
  return Boolean(rows[0]);
}

async function readSupportConfig<T>(key: string): Promise<T> {
  await syncLegacySupportConversations();
  const sql = getQueryClient();
  const rows = await sql<Array<{ value: T }>>`SELECT value FROM config WHERE key=${key} LIMIT 1`;
  if (!rows[0]) throw new Error('SUPPORT_CONFIGURATION_UNAVAILABLE');
  return rows[0].value;
}

async function writeSupportConfig<T extends object>(key: string, value: T, updatedBy: string): Promise<void> {
  await syncLegacySupportConversations();
  const sql = getQueryClient();
  await sql`
    INSERT INTO config (key,value,updated_at,updated_by)
    VALUES (${key},${sql.json(value as unknown as Parameters<typeof sql.json>[0])},NOW(),${updatedBy})
    ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW(),updated_by=EXCLUDED.updated_by
  `;
}

export function readRoutingConfig(): Promise<RoutingConfig> {
  return readSupportConfig<RoutingConfig>(ROUTING_CONFIG_KEY);
}

export function writeRoutingConfig(config: RoutingConfig, updatedBy = 'admin'): Promise<void> {
  return writeSupportConfig(ROUTING_CONFIG_KEY, config, updatedBy);
}

export function readNotificationSettings(): Promise<SupportNotificationSettings> {
  return readSupportConfig<SupportNotificationSettings>(NOTIFICATION_CONFIG_KEY);
}

export function writeNotificationSettings(settings: SupportNotificationSettings, updatedBy = 'admin'): Promise<void> {
  return writeSupportConfig(NOTIFICATION_CONFIG_KEY, settings, updatedBy);
}
