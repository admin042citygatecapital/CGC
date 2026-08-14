/** PostgreSQL-backed newsletter campaigns and delivery records. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { privateSubdirectory } from './storagePaths.js';
import { getQueryClient, isDatabaseConfigured } from '../db/db.js';

const DATA_DIR = privateSubdirectory('newsletter');
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');
const LOG_FILE = path.join(DATA_DIR, 'email-log.jsonl');

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
export type RecipientGroup = 'all' | 'personal' | 'savings' | 'business' | 'custom';
export interface CampaignSegment { group: RecipientGroup; registeredAfter?: string; registeredBefore?: string; country?: string; }
export interface Campaign {
  id: string; name: string; subject: string; body: string; segment: CampaignSegment;
  status: CampaignStatus; scheduledAt?: string; sentAt?: string; createdAt: string;
  updatedAt: string; createdBy: string;
  stats: { totalRecipients: number; sent: number; failed: number; openRate: null; clickRate: null; engagementTracking: 'not_configured'; unsubscribes: number };
}
export type DeliveryStatus = 'delivered' | 'bounced' | 'failed' | 'pending';
export interface EmailLogEntry { id: string; to: string; subject: string; template: string; status: DeliveryStatus; sentAt: string; errorMessage?: string; campaignId?: string; }

function safeStats(stats?: Partial<Campaign['stats']>): Campaign['stats'] {
  return {
    totalRecipients: Number(stats?.totalRecipients ?? 0), sent: Number(stats?.sent ?? 0),
    failed: Number(stats?.failed ?? 0), openRate: null, clickRate: null,
    engagementTracking: 'not_configured', unsubscribes: Number(stats?.unsubscribes ?? 0),
  };
}

function normalizeCampaign(campaign: Campaign): Campaign {
  return { ...campaign, scheduledAt: campaign.scheduledAt || undefined, sentAt: campaign.sentAt || undefined, stats: safeStats(campaign.stats) };
}

function readLegacyCampaigns(): Campaign[] {
  try {
    if (!fs.existsSync(CAMPAIGNS_FILE)) return [];
    return (JSON.parse(fs.readFileSync(CAMPAIGNS_FILE, 'utf8')) as Campaign[]).map(normalizeCampaign);
  } catch { return []; }
}

function readLegacyLogs(): EmailLogEntry[] {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    return fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean).flatMap(line => {
      try { return [JSON.parse(line) as EmailLogEntry]; } catch { return []; }
    });
  } catch { return []; }
}

let migrationPromise: Promise<void> | null = null;
async function ensureLegacyMigrated(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    const sql = getQueryClient();
    const campaigns = readLegacyCampaigns();
    const logs = readLegacyLogs();
    await sql.begin(async transaction => {
      for (const campaign of campaigns) {
        await transaction`
          INSERT INTO newsletter_campaigns
            (id, name, subject, body, segment, status, scheduled_at, sent_at, created_at, updated_at, created_by, stats)
          VALUES (${campaign.id}, ${campaign.name}, ${campaign.subject}, ${campaign.body}, ${transaction.json(campaign.segment as never)},
            ${campaign.status}, ${campaign.scheduledAt ?? null}, ${campaign.sentAt ?? null}, ${campaign.createdAt}, ${campaign.updatedAt},
            ${campaign.createdBy}, ${transaction.json(safeStats(campaign.stats) as never)})
          ON CONFLICT (id) DO NOTHING
        `;
      }
      for (const entry of logs) {
        await transaction`
          INSERT INTO newsletter_delivery_log
            (id, to_email, subject, template, status, sent_at, error_message, campaign_id)
          VALUES (${entry.id}, ${entry.to}, ${entry.subject}, ${entry.template}, ${entry.status}, ${entry.sentAt},
            ${entry.errorMessage ?? null}, ${entry.campaignId ?? null})
          ON CONFLICT (id) DO NOTHING
        `;
      }
    });
  })();
  return migrationPromise;
}

function writeLegacyCampaigns(campaigns: Campaign[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2), 'utf8');
}

function mapCampaignRow(row: Record<string, unknown>): Campaign {
  return normalizeCampaign({
    id: String(row.id), name: String(row.name), subject: String(row.subject), body: String(row.body),
    segment: row.segment as CampaignSegment, status: row.status as CampaignStatus,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at as string | Date).toISOString() : undefined,
    sentAt: row.sent_at ? new Date(row.sent_at as string | Date).toISOString() : undefined,
    createdAt: new Date(row.created_at as string | Date).toISOString(), updatedAt: new Date(row.updated_at as string | Date).toISOString(),
    createdBy: String(row.created_by), stats: safeStats(row.stats as Campaign['stats']),
  });
}

export async function listCampaigns(): Promise<Campaign[]> {
  if (!isDatabaseConfigured()) return readLegacyCampaigns().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await ensureLegacyMigrated();
  const rows = await getQueryClient()<Array<Record<string, unknown>>>`SELECT * FROM newsletter_campaigns ORDER BY created_at DESC`;
  return rows.map(mapCampaignRow);
}

export async function getCampaign(id: string): Promise<Campaign | undefined> {
  if (!isDatabaseConfigured()) return readLegacyCampaigns().find(c => c.id === id);
  await ensureLegacyMigrated();
  const rows = await getQueryClient()<Array<Record<string, unknown>>>`SELECT * FROM newsletter_campaigns WHERE id = ${id} LIMIT 1`;
  return rows[0] ? mapCampaignRow(rows[0]) : undefined;
}

export async function createCampaign(data: { name: string; subject: string; body: string; segment: CampaignSegment; scheduledAt?: string; status?: CampaignStatus; createdBy?: string }): Promise<Campaign> {
  const now = new Date().toISOString();
  const campaign: Campaign = { id: `camp_${crypto.randomBytes(12).toString('hex')}`, name: data.name, subject: data.subject, body: data.body,
    segment: data.segment, status: data.status ?? 'draft', scheduledAt: data.scheduledAt, createdAt: now, updatedAt: now,
    createdBy: data.createdBy ?? 'admin', stats: safeStats() };
  if (!isDatabaseConfigured()) { const all = readLegacyCampaigns(); all.push(campaign); writeLegacyCampaigns(all); return campaign; }
  await ensureLegacyMigrated();
  await getQueryClient()`INSERT INTO newsletter_campaigns
    (id, name, subject, body, segment, status, scheduled_at, created_at, updated_at, created_by, stats)
    VALUES (${campaign.id}, ${campaign.name}, ${campaign.subject}, ${campaign.body}, ${getQueryClient().json(campaign.segment as never)},
      ${campaign.status}, ${campaign.scheduledAt ?? null}, ${campaign.createdAt}, ${campaign.updatedAt}, ${campaign.createdBy}, ${getQueryClient().json(campaign.stats as never)})`;
  return campaign;
}

export async function updateCampaign(id: string, patch: Partial<Pick<Campaign, 'name' | 'subject' | 'body' | 'segment' | 'scheduledAt' | 'status'>>): Promise<Campaign> {
  const current = await getCampaign(id);
  if (!current) throw new Error('Campaign not found');
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  if (!isDatabaseConfigured()) { const all = readLegacyCampaigns().map(c => c.id === id ? next : c); writeLegacyCampaigns(all); return next; }
  await getQueryClient()`UPDATE newsletter_campaigns SET name=${next.name}, subject=${next.subject}, body=${next.body},
    segment=${getQueryClient().json(next.segment as never)}, status=${next.status}, scheduled_at=${next.scheduledAt ?? null}, updated_at=${next.updatedAt} WHERE id=${id}`;
  return next;
}

/** Atomically claim a campaign so concurrent requests cannot deliver twice. */
export async function claimCampaignForSending(id: string): Promise<Campaign | undefined> {
  if (!isDatabaseConfigured()) {
    const current = await getCampaign(id);
    if (!current || current.status === 'sent' || current.status === 'sending') return undefined;
    return updateCampaign(id, { status: 'sending' });
  }
  await ensureLegacyMigrated();
  const rows = await getQueryClient()<Array<Record<string, unknown>>>`
    UPDATE newsletter_campaigns SET status='sending', updated_at=NOW()
    WHERE id=${id} AND status NOT IN ('sent','sending') RETURNING *`;
  return rows[0] ? mapCampaignRow(rows[0]) : undefined;
}

export async function markCampaignSent(id: string, stats: Campaign['stats']): Promise<Campaign> {
  const current = await getCampaign(id); if (!current) throw new Error('Campaign not found');
  const next = { ...current, status: 'sent' as const, sentAt: new Date().toISOString(), stats: safeStats(stats), updatedAt: new Date().toISOString() };
  if (!isDatabaseConfigured()) { writeLegacyCampaigns(readLegacyCampaigns().map(c => c.id === id ? next : c)); return next; }
  await getQueryClient()`UPDATE newsletter_campaigns SET status='sent', sent_at=${next.sentAt}, stats=${getQueryClient().json(next.stats as never)}, updated_at=${next.updatedAt} WHERE id=${id}`;
  return next;
}

export async function duplicateCampaign(id: string, createdBy = 'admin'): Promise<Campaign> {
  const original = await getCampaign(id); if (!original) throw new Error('Campaign not found');
  return createCampaign({ name: `${original.name} (Copy)`, subject: original.subject, body: original.body, segment: original.segment, status: 'draft', createdBy });
}

export async function deleteCampaign(id: string): Promise<void> {
  if (!isDatabaseConfigured()) { writeLegacyCampaigns(readLegacyCampaigns().filter(c => c.id !== id)); return; }
  await ensureLegacyMigrated();
  await getQueryClient()`DELETE FROM newsletter_campaigns WHERE id=${id}`;
}

export async function appendEmailLog(entry: Omit<EmailLogEntry, 'id'>): Promise<void> {
  const record: EmailLogEntry = { id: `log_${crypto.randomBytes(12).toString('hex')}`, ...entry };
  if (!isDatabaseConfigured()) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.appendFileSync(LOG_FILE, JSON.stringify(record) + '\n', 'utf8'); return; }
  await ensureLegacyMigrated();
  await getQueryClient()`INSERT INTO newsletter_delivery_log
    (id, to_email, subject, template, status, sent_at, error_message, campaign_id)
    VALUES (${record.id}, ${record.to}, ${record.subject}, ${record.template}, ${record.status}, ${record.sentAt}, ${record.errorMessage ?? null}, ${record.campaignId ?? null})`;
}

export async function readEmailLog(opts: { limit?: number; status?: DeliveryStatus; template?: string; dateFrom?: string; dateTo?: string } = {}): Promise<EmailLogEntry[]> {
  if (!isDatabaseConfigured()) {
    let entries = readLegacyLogs();
    if (opts.status) entries = entries.filter(e => e.status === opts.status);
    if (opts.template) entries = entries.filter(e => e.template === opts.template);
    if (opts.dateFrom) entries = entries.filter(e => e.sentAt >= opts.dateFrom!);
    if (opts.dateTo) entries = entries.filter(e => e.sentAt <= opts.dateTo!);
    return entries.sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, opts.limit ?? 200);
  }
  await ensureLegacyMigrated();
  const limit = Math.max(1, Math.min(opts.limit ?? 200, 500));
  const rows = await getQueryClient()<Array<Record<string, unknown>>>`
    SELECT * FROM newsletter_delivery_log
    WHERE (${opts.status ?? null}::text IS NULL OR status=${opts.status ?? null})
      AND (${opts.template ?? null}::text IS NULL OR template=${opts.template ?? null})
      AND (${opts.dateFrom ?? null}::timestamptz IS NULL OR sent_at >= ${opts.dateFrom ?? null})
      AND (${opts.dateTo ?? null}::timestamptz IS NULL OR sent_at <= ${opts.dateTo ?? null})
    ORDER BY sent_at DESC LIMIT ${limit}`;
  return rows.map(row => ({ id: String(row.id), to: String(row.to_email), subject: String(row.subject), template: String(row.template),
    status: row.status as DeliveryStatus, sentAt: new Date(row.sent_at as string | Date).toISOString(),
    errorMessage: row.error_message ? String(row.error_message) : undefined, campaignId: row.campaign_id ? String(row.campaign_id) : undefined }));
}
