/**
 * supportExtStore.ts
 * Persistent store for Support Center extensions:
 *   - Direct messages (inbox-style)
 *   - Contact form submissions
 *   - Feedback entries
 *   - Complaints
 *   - Announcements (admin → customers)
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DIR = '/private/support';
const FILES = {
  messages:     path.join(DIR, 'messages.jsonl'),
  contactForms: path.join(DIR, 'contact_forms.jsonl'),
  feedback:     path.join(DIR, 'feedback.jsonl'),
  complaints:   path.join(DIR, 'complaints.jsonl'),
  announcements:path.join(DIR, 'announcements.jsonl'),
};

function ensureDir() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
}
function readJsonl<T>(file: string): T[] {
  try {
    ensureDir();
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  } catch { return []; }
}
function writeJsonl<T>(file: string, items: T[]): void {
  ensureDir();
  fs.writeFileSync(file, items.map(i => JSON.stringify(i)).join('\n') + '\n');
}
function appendJsonl<T>(file: string, item: T): void {
  ensureDir();
  fs.appendFileSync(file, JSON.stringify(item) + '\n');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DirectMessage {
  id: string;
  fromUserId: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  read: boolean;
  starred: boolean;
  archived: boolean;
  replyBody: string | null;
  repliedAt: string | null;
  repliedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactFormSubmission {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  source: string;       // which page the form was on
  status: 'new' | 'read' | 'replied' | 'archived';
  assignedTo: string | null;
  notes: string;
  replyBody: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackEntry {
  id: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  type: 'general' | 'feature_request' | 'bug_report' | 'compliment' | 'other';
  rating: number | null;   // 1–5
  title: string;
  body: string;
  status: 'new' | 'under_review' | 'planned' | 'implemented' | 'declined' | 'closed';
  upvotes: number;
  adminResponse: string | null;
  respondedAt: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Complaint {
  id: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  userPhone: string;
  category: 'transaction' | 'account' | 'card' | 'kyc' | 'staff' | 'technical' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  subject: string;
  description: string;
  evidence: string[];    // file URLs
  status: 'open' | 'investigating' | 'escalated' | 'resolved' | 'closed';
  assignedTo: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  escalatedAt: string | null;
  internalNotes: string;
  regulatoryFlag: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'success' | 'maintenance' | 'promotion';
  audience: 'all' | 'verified' | 'premium' | 'admins';
  channels: ('banner' | 'email' | 'push' | 'dashboard')[];
  status: 'draft' | 'scheduled' | 'active' | 'expired';
  scheduledAt: string | null;
  expiresAt: string | null;
  publishedAt: string | null;
  createdBy: string;
  viewCount: number;
  dismissCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Pagination helper ────────────────────────────────────────────────────────

function paginate<T>(items: T[], page = 1, limit = 20): { data: T[]; total: number } {
  return { data: items.slice((page - 1) * limit, page * limit), total: items.length };
}

// ─── Direct Messages ──────────────────────────────────────────────────────────

export function getMessages(opts: { search?: string; read?: boolean; starred?: boolean; archived?: boolean; page?: number; limit?: number } = {}) {
  let all = readJsonl<DirectMessage>(FILES.messages);
  if (opts.search) { const q = opts.search.toLowerCase(); all = all.filter(m => m.subject.toLowerCase().includes(q) || m.fromName.toLowerCase().includes(q) || m.fromEmail.toLowerCase().includes(q)); }
  if (opts.read !== undefined) all = all.filter(m => m.read === opts.read);
  if (opts.starred !== undefined) all = all.filter(m => m.starred === opts.starred);
  if (opts.archived !== undefined) all = all.filter(m => m.archived === opts.archived);
  else all = all.filter(m => !m.archived);
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return paginate(all, opts.page, opts.limit);
}

export function updateMessage(id: string, patch: Partial<DirectMessage>): DirectMessage | null {
  const all = readJsonl<DirectMessage>(FILES.messages);
  const idx = all.findIndex(m => m.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  writeJsonl(FILES.messages, all);
  return all[idx];
}

export function replyToMessage(id: string, body: string, adminName: string): DirectMessage | null {
  return updateMessage(id, { replyBody: body, repliedAt: new Date().toISOString(), repliedBy: adminName, read: true });
}

export function createMessage(data: Partial<DirectMessage>): DirectMessage {
  const msg: DirectMessage = {
    id: randomUUID(), fromUserId: data.fromUserId ?? '', fromName: data.fromName ?? 'Unknown',
    fromEmail: data.fromEmail ?? '', subject: data.subject ?? '(no subject)', body: data.body ?? '',
    read: false, starred: false, archived: false, replyBody: null, repliedAt: null, repliedBy: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  appendJsonl(FILES.messages, msg);
  return msg;
}

// ─── Contact Forms ────────────────────────────────────────────────────────────

export function getContactForms(opts: { status?: string; search?: string; page?: number; limit?: number } = {}) {
  let all = readJsonl<ContactFormSubmission>(FILES.contactForms);
  if (opts.status && opts.status !== 'all') all = all.filter(c => c.status === opts.status);
  if (opts.search) { const q = opts.search.toLowerCase(); all = all.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q)); }
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return paginate(all, opts.page, opts.limit);
}

export function updateContactForm(id: string, patch: Partial<ContactFormSubmission>): ContactFormSubmission | null {
  const all = readJsonl<ContactFormSubmission>(FILES.contactForms);
  const idx = all.findIndex(c => c.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  writeJsonl(FILES.contactForms, all);
  return all[idx];
}

export function createContactForm(data: Partial<ContactFormSubmission>): ContactFormSubmission {
  const sub: ContactFormSubmission = {
    id: randomUUID(), name: data.name ?? '', email: data.email ?? '', phone: data.phone ?? '',
    subject: data.subject ?? '', message: data.message ?? '', source: data.source ?? 'website',
    status: 'new', assignedTo: null, notes: '', replyBody: null, repliedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  appendJsonl(FILES.contactForms, sub);
  return sub;
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export function getFeedback(opts: { type?: string; status?: string; search?: string; page?: number; limit?: number } = {}) {
  let all = readJsonl<FeedbackEntry>(FILES.feedback);
  if (opts.type && opts.type !== 'all') all = all.filter(f => f.type === opts.type);
  if (opts.status && opts.status !== 'all') all = all.filter(f => f.status === opts.status);
  if (opts.search) { const q = opts.search.toLowerCase(); all = all.filter(f => f.title.toLowerCase().includes(q) || f.body.toLowerCase().includes(q)); }
  all.sort((a, b) => b.upvotes - a.upvotes || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return paginate(all, opts.page, opts.limit);
}

export function updateFeedback(id: string, patch: Partial<FeedbackEntry>): FeedbackEntry | null {
  const all = readJsonl<FeedbackEntry>(FILES.feedback);
  const idx = all.findIndex(f => f.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  writeJsonl(FILES.feedback, all);
  return all[idx];
}

export function createFeedback(data: Partial<FeedbackEntry>): FeedbackEntry {
  const entry: FeedbackEntry = {
    id: randomUUID(), userId: data.userId ?? null, userName: data.userName ?? 'Anonymous',
    userEmail: data.userEmail ?? '', type: data.type ?? 'general', rating: data.rating ?? null,
    title: data.title ?? '', body: data.body ?? '', status: 'new', upvotes: 0,
    adminResponse: null, respondedAt: null, tags: data.tags ?? [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  appendJsonl(FILES.feedback, entry);
  return entry;
}

// ─── Complaints ───────────────────────────────────────────────────────────────

export function getComplaints(opts: { status?: string; severity?: string; category?: string; search?: string; page?: number; limit?: number } = {}) {
  let all = readJsonl<Complaint>(FILES.complaints);
  if (opts.status && opts.status !== 'all') all = all.filter(c => c.status === opts.status);
  if (opts.severity && opts.severity !== 'all') all = all.filter(c => c.severity === opts.severity);
  if (opts.category && opts.category !== 'all') all = all.filter(c => c.category === opts.category);
  if (opts.search) { const q = opts.search.toLowerCase(); all = all.filter(c => c.subject.toLowerCase().includes(q) || c.userName.toLowerCase().includes(q) || c.userEmail.toLowerCase().includes(q)); }
  all.sort((a, b) => {
    const sev = { critical: 4, high: 3, medium: 2, low: 1 };
    return (sev[b.severity] - sev[a.severity]) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return paginate(all, opts.page, opts.limit);
}

export function updateComplaint(id: string, patch: Partial<Complaint>): Complaint | null {
  const all = readJsonl<Complaint>(FILES.complaints);
  const idx = all.findIndex(c => c.id === id);
  if (idx === -1) return null;
  if (patch.status === 'resolved' && !all[idx].resolvedAt) patch.resolvedAt = new Date().toISOString();
  if (patch.status === 'escalated' && !all[idx].escalatedAt) patch.escalatedAt = new Date().toISOString();
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  writeJsonl(FILES.complaints, all);
  return all[idx];
}

export function createComplaint(data: Partial<Complaint>): Complaint {
  const c: Complaint = {
    id: `CMP-${Date.now().toString(36).toUpperCase()}`,
    userId: data.userId ?? null, userName: data.userName ?? '', userEmail: data.userEmail ?? '',
    userPhone: data.userPhone ?? '', category: data.category ?? 'other',
    severity: data.severity ?? 'medium', subject: data.subject ?? '', description: data.description ?? '',
    evidence: data.evidence ?? [], status: 'open', assignedTo: null, resolution: null,
    resolvedAt: null, escalatedAt: null, internalNotes: '', regulatoryFlag: false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  appendJsonl(FILES.complaints, c);
  return c;
}

// ─── Announcements ────────────────────────────────────────────────────────────

export function getAnnouncements(opts: { status?: string; audience?: string; page?: number; limit?: number } = {}) {
  let all = readJsonl<Announcement>(FILES.announcements);
  if (opts.status && opts.status !== 'all') all = all.filter(a => a.status === opts.status);
  if (opts.audience && opts.audience !== 'all') all = all.filter(a => a.audience === opts.audience);
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return paginate(all, opts.page, opts.limit);
}

export function upsertAnnouncement(data: Partial<Announcement> & { id?: string }): Announcement {
  const all = readJsonl<Announcement>(FILES.announcements);
  const idx = data.id ? all.findIndex(a => a.id === data.id) : -1;
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
    if (data.status === 'active' && !all[idx].publishedAt) all[idx].publishedAt = new Date().toISOString();
    writeJsonl(FILES.announcements, all);
    return all[idx];
  }
  const ann: Announcement = {
    id: randomUUID(), title: data.title ?? '', body: data.body ?? '',
    type: data.type ?? 'info', audience: data.audience ?? 'all',
    channels: data.channels ?? ['banner'], status: data.status ?? 'draft',
    scheduledAt: data.scheduledAt ?? null, expiresAt: data.expiresAt ?? null,
    publishedAt: data.status === 'active' ? new Date().toISOString() : null,
    createdBy: data.createdBy ?? 'admin', viewCount: 0, dismissCount: 0,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  appendJsonl(FILES.announcements, ann);
  return ann;
}

export function deleteAnnouncement(id: string): boolean {
  const all = readJsonl<Announcement>(FILES.announcements);
  const next = all.filter(a => a.id !== id);
  if (next.length === all.length) return false;
  writeJsonl(FILES.announcements, next);
  return true;
}

// ─── Summary stats ────────────────────────────────────────────────────────────

export function getSupportExtSummary() {
  const msgs    = readJsonl<DirectMessage>(FILES.messages);
  const forms   = readJsonl<ContactFormSubmission>(FILES.contactForms);
  const fb      = readJsonl<FeedbackEntry>(FILES.feedback);
  const comps   = readJsonl<Complaint>(FILES.complaints);
  const anns    = readJsonl<Announcement>(FILES.announcements);
  return {
    unreadMessages:    msgs.filter(m => !m.read && !m.archived).length,
    newContactForms:   forms.filter(f => f.status === 'new').length,
    newFeedback:       fb.filter(f => f.status === 'new').length,
    openComplaints:    comps.filter(c => c.status === 'open' || c.status === 'investigating').length,
    criticalComplaints:comps.filter(c => c.severity === 'critical' && c.status !== 'resolved' && c.status !== 'closed').length,
    activeAnnouncements: anns.filter(a => a.status === 'active').length,
  };
}
