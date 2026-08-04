/**
 * campaignStore.ts
 * Persistent store for newsletter campaigns.
 * Stored in /private/newsletter/campaigns.json
 *
 * Handles campaign creation, scheduling, history, and stats.
 */
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR  = '/private/newsletter';
const DATA_FILE = path.join(DATA_DIR, 'campaigns.json');

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
export type RecipientGroup =
  | 'all'
  | 'personal'
  | 'savings'
  | 'business'
  | 'custom';

export interface CampaignSegment {
  group: RecipientGroup;
  /** For custom: filter by registration date range */
  registeredAfter?: string;
  registeredBefore?: string;
  /** For custom: filter by country */
  country?: string;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string;             // HTML body with {variable} placeholders
  segment: CampaignSegment;
  status: CampaignStatus;
  scheduledAt?: string;     // ISO — null means send now
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** Stats populated after send */
  stats: {
    totalRecipients: number;
    sent: number;
    failed: number;
    openRate: number;       // percentage 0–100 (simulated for now)
    clickRate: number;      // percentage 0–100 (simulated for now)
    unsubscribes: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): Campaign[] {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as Campaign[];
  } catch {
    return [];
  }
}

function writeAll(campaigns: Campaign[]) {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(campaigns, null, 2), 'utf-8');
}

// ── Public API ────────────────────────────────────────────────────────────────

export function listCampaigns(): Campaign[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getCampaign(id: string): Campaign | undefined {
  return readAll().find(c => c.id === id);
}

export function createCampaign(data: {
  name: string;
  subject: string;
  body: string;
  segment: CampaignSegment;
  scheduledAt?: string;
  status?: CampaignStatus;
  createdBy?: string;
}): Campaign {
  const campaign: Campaign = {
    id:          `camp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name:        data.name,
    subject:     data.subject,
    body:        data.body,
    segment:     data.segment,
    status:      data.status ?? 'draft',
    scheduledAt: data.scheduledAt,
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
    createdBy:   data.createdBy ?? 'admin',
    stats:       { totalRecipients: 0, sent: 0, failed: 0, openRate: 0, clickRate: 0, unsubscribes: 0 },
  };
  const all = readAll();
  all.push(campaign);
  writeAll(all);
  return campaign;
}

export function updateCampaign(id: string, patch: Partial<Pick<Campaign, 'name' | 'subject' | 'body' | 'segment' | 'scheduledAt' | 'status'>>): Campaign {
  const all = readAll();
  const idx = all.findIndex(c => c.id === id);
  if (idx < 0) throw new Error('Campaign not found');
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  writeAll(all);
  return all[idx];
}

export function markCampaignSent(id: string, stats: Campaign['stats']): Campaign {
  const all = readAll();
  const idx = all.findIndex(c => c.id === id);
  if (idx < 0) throw new Error('Campaign not found');
  all[idx] = { ...all[idx], status: 'sent', sentAt: new Date().toISOString(), stats, updatedAt: new Date().toISOString() };
  writeAll(all);
  return all[idx];
}

export function duplicateCampaign(id: string, createdBy = 'admin'): Campaign {
  const original = getCampaign(id);
  if (!original) throw new Error('Campaign not found');
  return createCampaign({
    name:      `${original.name} (Copy)`,
    subject:   original.subject,
    body:      original.body,
    segment:   original.segment,
    status:    'draft',
    createdBy,
  });
}

export function deleteCampaign(id: string): void {
  const all = readAll().filter(c => c.id !== id);
  writeAll(all);
}

/** Email delivery log — separate append-only file */
const LOG_FILE = path.join(DATA_DIR, 'email-log.jsonl');

export type DeliveryStatus = 'delivered' | 'bounced' | 'failed' | 'pending';

export interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  template: string;       // template id or 'campaign:{id}'
  status: DeliveryStatus;
  sentAt: string;
  errorMessage?: string;
  campaignId?: string;
}

export function appendEmailLog(entry: Omit<EmailLogEntry, 'id'>): void {
  ensureDir();
  const record: EmailLogEntry = { id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, ...entry };
  fs.appendFileSync(LOG_FILE, JSON.stringify(record) + '\n', 'utf-8');
}

export function readEmailLog(opts: {
  limit?: number;
  status?: DeliveryStatus;
  template?: string;
  dateFrom?: string;
  dateTo?: string;
} = {}): EmailLogEntry[] {
  ensureDir();
  if (!fs.existsSync(LOG_FILE)) return [];
  const raw = fs.readFileSync(LOG_FILE, 'utf-8');
  let entries: EmailLogEntry[] = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (t) { try { entries.push(JSON.parse(t) as EmailLogEntry); } catch { /* skip */ } }
  }
  // Apply filters
  if (opts.status)   entries = entries.filter(e => e.status === opts.status);
  if (opts.template) entries = entries.filter(e => e.template === opts.template);
  if (opts.dateFrom) entries = entries.filter(e => e.sentAt >= opts.dateFrom!);
  if (opts.dateTo)   entries = entries.filter(e => e.sentAt <= opts.dateTo!);
  // Newest first
  entries.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  if (opts.limit) entries = entries.slice(0, opts.limit);
  return entries;
}
