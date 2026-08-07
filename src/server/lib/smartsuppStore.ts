/**
 * smartsuppStore.ts
 * Persistent store for Smartsupp integration data.
 * Stores: widget config, conversations, agents, tickets, FAQ entries, analytics snapshots.
 * All data lives in /private/chatbot/
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DIR = '/private/chatbot';
const FILES = {
  config:        path.join(DIR, 'config.json'),
  conversations: path.join(DIR, 'conversations.jsonl'),
  agents:        path.join(DIR, 'agents.jsonl'),
  tickets:       path.join(DIR, 'tickets.jsonl'),
  faq:           path.join(DIR, 'faq.jsonl'),
  analytics:     path.join(DIR, 'analytics.json'),
};

function ensureDir() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmartsuppConfig {
  apiKey: string;
  chatId: string;
  widgetEnabled: boolean;
  widgetColor: string;
  widgetPosition: 'bottom-right' | 'bottom-left';
  widgetGreeting: string;
  widgetName: string;
  widgetAvatar: string;
  offlineMessage: string;
  autoMessage: string;
  autoMessageDelay: number;   // seconds
  soundEnabled: boolean;
  ratingEnabled: boolean;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'visitor' | 'agent' | 'bot';
  text: string;
  ts: string;
  agentId?: string;
}

export interface Conversation {
  id: string;
  visitorName: string;
  visitorEmail: string;
  visitorIp: string;
  visitorCountry: string;
  status: 'open' | 'assigned' | 'resolved' | 'missed';
  assignedAgentId: string | null;
  messages: ChatMessage[];
  tags: string[];
  rating: number | null;    // 1–5
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  pageUrl: string;
  device: 'desktop' | 'mobile' | 'tablet';
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent';
  status: 'online' | 'away' | 'offline';
  avatar: string;
  assignedCount: number;
  resolvedCount: number;
  avgResponseTime: number;  // seconds
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  conversationId: string | null;
  visitorName: string;
  visitorEmail: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedAgentId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  notes: string;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  enabled: boolean;
  triggerKeywords: string[];
  viewCount: number;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsSnapshot {
  date: string;
  totalConversations: number;
  resolvedConversations: number;
  missedConversations: number;
  avgResponseTime: number;
  avgRating: number;
  totalMessages: number;
  uniqueVisitors: number;
  ticketsCreated: number;
  ticketsResolved: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: SmartsuppConfig = {
  apiKey: '',
  chatId: '',
  widgetEnabled: true,
  widgetColor: '#C9A84C',
  widgetPosition: 'bottom-right',
  widgetGreeting: 'Hello! How can we help you today?',
  widgetName: 'CGC Support',
  widgetAvatar: '',
  offlineMessage: 'We are currently offline. Leave a message and we will get back to you.',
  autoMessage: 'Hi! Is there anything I can help you with today?',
  autoMessageDelay: 30,
  soundEnabled: true,
  ratingEnabled: true,
  updatedAt: new Date().toISOString(),
};

export function readConfig(): SmartsuppConfig {
  try {
    ensureDir();
    if (!fs.existsSync(FILES.config)) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(FILES.config, 'utf8')) };
  } catch { return DEFAULT_CONFIG; }
}

export function writeConfig(patch: Partial<SmartsuppConfig>): SmartsuppConfig {
  ensureDir();
  const current = readConfig();
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  fs.writeFileSync(FILES.config, JSON.stringify(next, null, 2));
  return next;
}

// ─── JSONL helpers ────────────────────────────────────────────────────────────

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

// ─── Conversations ────────────────────────────────────────────────────────────

export function getConversations(opts: {
  status?: string; search?: string; page?: number; limit?: number;
} = {}): { data: Conversation[]; total: number } {
  let all = readJsonl<Conversation>(FILES.conversations);
  if (opts.status && opts.status !== 'all') all = all.filter(c => c.status === opts.status);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    all = all.filter(c =>
      c.visitorName.toLowerCase().includes(q) ||
      c.visitorEmail.toLowerCase().includes(q) ||
      c.messages.some(m => m.text.toLowerCase().includes(q))
    );
  }
  all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const total = all.length;
  const page  = opts.page  ?? 1;
  const limit = opts.limit ?? 20;
  return { data: all.slice((page - 1) * limit, page * limit), total };
}

export function getConversation(id: string): Conversation | null {
  return readJsonl<Conversation>(FILES.conversations).find(c => c.id === id) ?? null;
}

export function createConversation(data: Partial<Conversation>): Conversation {
  const conv: Conversation = {
    id: randomUUID(),
    visitorName: data.visitorName ?? 'Anonymous',
    visitorEmail: data.visitorEmail ?? '',
    visitorIp: data.visitorIp ?? '',
    visitorCountry: data.visitorCountry ?? 'Unknown',
    status: 'open',
    assignedAgentId: null,
    messages: data.messages ?? [],
    tags: data.tags ?? [],
    rating: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
    pageUrl: data.pageUrl ?? '/',
    device: data.device ?? 'desktop',
  };
  appendJsonl(FILES.conversations, conv);
  return conv;
}

export function updateConversation(id: string, patch: Partial<Conversation>): Conversation | null {
  const all = readJsonl<Conversation>(FILES.conversations);
  const idx = all.findIndex(c => c.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  writeJsonl(FILES.conversations, all);
  return all[idx];
}

export function addMessage(convId: string, msg: Omit<ChatMessage, 'id' | 'ts'>): Conversation | null {
  const message: ChatMessage = { ...msg, id: randomUUID(), ts: new Date().toISOString() };
  return updateConversation(convId, {
    messages: [...(getConversation(convId)?.messages ?? []), message],
  });
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export function getAgents(): Agent[] {
  const agents = readJsonl<Agent>(FILES.agents);
  if (agents.length === 0) {
    // Seed default agent
    const seed: Agent = {
      id: randomUUID(),
      name: 'Admin',
      email: 'admin@citygate.capital',
      role: 'admin',
      status: 'online',
      avatar: '',
      assignedCount: 0,
      resolvedCount: 0,
      avgResponseTime: 0,
      createdAt: new Date().toISOString(),
    };
    appendJsonl(FILES.agents, seed);
    return [seed];
  }
  return agents;
}

export function upsertAgent(data: Partial<Agent> & { id?: string }): Agent {
  const all = readJsonl<Agent>(FILES.agents);
  const idx = data.id ? all.findIndex(a => a.id === data.id) : -1;
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...data };
    writeJsonl(FILES.agents, all);
    return all[idx];
  }
  const agent: Agent = {
    id: randomUUID(),
    name: data.name ?? 'New Agent',
    email: data.email ?? '',
    role: data.role ?? 'agent',
    status: data.status ?? 'offline',
    avatar: data.avatar ?? '',
    assignedCount: 0,
    resolvedCount: 0,
    avgResponseTime: 0,
    createdAt: new Date().toISOString(),
  };
  appendJsonl(FILES.agents, agent);
  return agent;
}

export function deleteAgent(id: string): boolean {
  const all = readJsonl<Agent>(FILES.agents);
  const next = all.filter(a => a.id !== id);
  if (next.length === all.length) return false;
  writeJsonl(FILES.agents, next);
  return true;
}

// ─── Tickets ─────────────────────────────────────────────────────────────────

export function getTickets(opts: {
  status?: string; priority?: string; search?: string; page?: number; limit?: number;
} = {}): { data: SupportTicket[]; total: number } {
  let all = readJsonl<SupportTicket>(FILES.tickets);
  if (opts.status && opts.status !== 'all') all = all.filter(t => t.status === opts.status);
  if (opts.priority && opts.priority !== 'all') all = all.filter(t => t.priority === opts.priority);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    all = all.filter(t =>
      t.subject.toLowerCase().includes(q) ||
      t.visitorEmail.toLowerCase().includes(q) ||
      t.visitorName.toLowerCase().includes(q)
    );
  }
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const total = all.length;
  const page  = opts.page  ?? 1;
  const limit = opts.limit ?? 20;
  return { data: all.slice((page - 1) * limit, page * limit), total };
}

export function createTicket(data: Partial<SupportTicket>): SupportTicket {
  const ticket: SupportTicket = {
    id: `TKT-${Date.now().toString(36).toUpperCase()}`,
    conversationId: data.conversationId ?? null,
    visitorName: data.visitorName ?? 'Unknown',
    visitorEmail: data.visitorEmail ?? '',
    subject: data.subject ?? 'Support Request',
    description: data.description ?? '',
    status: 'open',
    priority: data.priority ?? 'medium',
    assignedAgentId: data.assignedAgentId ?? null,
    tags: data.tags ?? [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
    notes: data.notes ?? '',
  };
  appendJsonl(FILES.tickets, ticket);
  return ticket;
}

export function updateTicket(id: string, patch: Partial<SupportTicket>): SupportTicket | null {
  const all = readJsonl<SupportTicket>(FILES.tickets);
  const idx = all.findIndex(t => t.id === id);
  if (idx === -1) return null;
  if (patch.status === 'resolved' && !all[idx].resolvedAt) patch.resolvedAt = new Date().toISOString();
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  writeJsonl(FILES.tickets, all);
  return all[idx];
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

export function getFaq(opts: { category?: string; enabled?: boolean } = {}): FaqEntry[] {
  let all = readJsonl<FaqEntry>(FILES.faq);
  if (opts.category && opts.category !== 'all') all = all.filter(f => f.category === opts.category);
  if (opts.enabled !== undefined) all = all.filter(f => f.enabled === opts.enabled);
  if (all.length === 0) {
    // Seed default FAQ
    const defaults: FaqEntry[] = [
      { id: randomUUID(), question: 'How do I open an account?', answer: 'Click "Open Free Account" on our homepage and complete the registration form. KYC verification takes 1–2 business days.', category: 'Account', enabled: true, triggerKeywords: ['open account', 'register', 'sign up'], viewCount: 0, helpfulCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: randomUUID(), question: 'How do I transfer money internationally?', answer: 'Go to Dashboard → Transfers → International Wire. You will need the recipient\'s IBAN and SWIFT/BIC code. Transfers typically settle in 1–3 business days.', category: 'Transfers', enabled: true, triggerKeywords: ['transfer', 'wire', 'international', 'send money'], viewCount: 0, helpfulCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: randomUUID(), question: 'What are the withdrawal limits?', answer: 'Standard accounts: £10,000/day. Verified accounts: £50,000/day. Premium accounts: £250,000/day. Limits reset at midnight GMT.', category: 'Limits', enabled: true, triggerKeywords: ['withdrawal limit', 'how much', 'daily limit'], viewCount: 0, helpfulCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: randomUUID(), question: 'How do I freeze my card?', answer: 'Go to Dashboard → Cards → select your card → tap "Freeze". You can unfreeze it at any time from the same screen.', category: 'Cards', enabled: true, triggerKeywords: ['freeze card', 'lock card', 'lost card'], viewCount: 0, helpfulCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: randomUUID(), question: 'Is my money protected?', answer: 'Yes. City Gate Capital is regulated and your deposits are protected up to £85,000 under the Financial Services Compensation Scheme (FSCS).', category: 'Security', enabled: true, triggerKeywords: ['safe', 'protected', 'FSCS', 'insured', 'regulated'], viewCount: 0, helpfulCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    writeJsonl(FILES.faq, defaults);
    return defaults;
  }
  return all;
}

export function upsertFaq(data: Partial<FaqEntry> & { id?: string }): FaqEntry {
  const all = readJsonl<FaqEntry>(FILES.faq);
  const idx = data.id ? all.findIndex(f => f.id === data.id) : -1;
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
    writeJsonl(FILES.faq, all);
    return all[idx];
  }
  const entry: FaqEntry = {
    id: randomUUID(),
    question: data.question ?? '',
    answer: data.answer ?? '',
    category: data.category ?? 'General',
    enabled: data.enabled ?? true,
    triggerKeywords: data.triggerKeywords ?? [],
    viewCount: 0,
    helpfulCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  appendJsonl(FILES.faq, entry);
  return entry;
}

export function deleteFaq(id: string): boolean {
  const all = readJsonl<FaqEntry>(FILES.faq);
  const next = all.filter(f => f.id !== id);
  if (next.length === all.length) return false;
  writeJsonl(FILES.faq, next);
  return true;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export function getAnalytics(): { snapshots: AnalyticsSnapshot[]; summary: Record<string, number> } {
  try {
    ensureDir();
    const convs    = readJsonl<Conversation>(FILES.conversations);
    const tickets  = readJsonl<SupportTicket>(FILES.tickets);

    const summary = {
      totalConversations:   convs.length,
      openConversations:    convs.filter(c => c.status === 'open').length,
      assignedConversations:convs.filter(c => c.status === 'assigned').length,
      resolvedConversations:convs.filter(c => c.status === 'resolved').length,
      missedConversations:  convs.filter(c => c.status === 'missed').length,
      avgRating:            convs.filter(c => c.rating).reduce((s, c) => s + (c.rating ?? 0), 0) / (convs.filter(c => c.rating).length || 1),
      totalTickets:         tickets.length,
      openTickets:          tickets.filter(t => t.status === 'open').length,
      resolvedTickets:      tickets.filter(t => t.status === 'resolved').length,
      urgentTickets:        tickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved').length,
    };

    // Build 14-day snapshots
    const snapshots: AnalyticsSnapshot[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayConvs = convs.filter(c => c.createdAt.startsWith(dateStr));
      const dayTickets = tickets.filter(t => t.createdAt.startsWith(dateStr));
      snapshots.push({
        date: dateStr,
        totalConversations:   dayConvs.length,
        resolvedConversations:dayConvs.filter(c => c.status === 'resolved').length,
        missedConversations:  dayConvs.filter(c => c.status === 'missed').length,
        avgResponseTime:      120,
        avgRating:            dayConvs.filter(c => c.rating).reduce((s, c) => s + (c.rating ?? 0), 0) / (dayConvs.filter(c => c.rating).length || 1),
        totalMessages:        dayConvs.reduce((s, c) => s + c.messages.length, 0),
        uniqueVisitors:       new Set(dayConvs.map(c => c.visitorEmail)).size,
        ticketsCreated:       dayTickets.length,
        ticketsResolved:      dayTickets.filter(t => t.status === 'resolved').length,
      });
    }

    return { snapshots, summary };
  } catch {
    return { snapshots: [], summary: {} };
  }
}
