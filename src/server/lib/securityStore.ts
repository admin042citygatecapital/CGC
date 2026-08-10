/**
 * securityStore.ts — Persistent security data store.
 * Covers: security flags, IP blacklist/whitelist, country blocks,
 *         flag rules, 2FA policy, user session tracking, dashboard stats.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { privateSubdirectory } from './storagePaths.js';

// ── File paths ────────────────────────────────────────────────────────────────

const FLAGS_FILE      = privateSubdirectory('security/flags.jsonl');
const IP_FILE         = privateSubdirectory('security/ip-lists.json');
const RULES_FILE      = privateSubdirectory('security/flag-rules.json');
const POLICY_FILE     = privateSubdirectory('security/2fa-policy.json');
const USER_SESS_FILE  = privateSubdirectory('security/user-sessions.jsonl');

function ensureDir(file: string) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Security Flag ─────────────────────────────────────────────────────────────

export type FlagType =
  | 'suspicious_login' | 'unusual_transaction' | 'kyc_mismatch'
  | 'multiple_failed_attempts' | 'vpn_detected' | 'unusual_location'
  | 'large_transfer' | 'new_country' | 'new_device' | 'same_ip_accounts'
  | 'flagged_wallet' | 'manual';

export type FlagSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FlagStatus   = 'active' | 'resolved' | 'watchlist' | 'suspended';

export interface SecurityFlag {
  id:          string;
  userId:      string;
  userName:    string;
  userEmail:   string;
  type:        FlagType;
  severity:    FlagSeverity;
  status:      FlagStatus;
  title:       string;
  detail:      string;
  ip?:         string;
  country?:    string;
  device?:     string;
  ua?:         string;
  meta?:       Record<string, unknown>;
  createdAt:   string;
  updatedAt:   string;
  resolvedAt?: string;
  resolvedBy?: string;
  notes?:      string;
}

export function loadFlags(): SecurityFlag[] {
  try {
    if (!fs.existsSync(FLAGS_FILE)) return [];
    return fs.readFileSync(FLAGS_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .map(l => JSON.parse(l) as SecurityFlag)
      .reverse();
  } catch { return []; }
}

function saveFlags(flags: SecurityFlag[]) {
  ensureDir(FLAGS_FILE);
  // Keep chronological order in file
  const ordered = [...flags].reverse();
  fs.writeFileSync(FLAGS_FILE, ordered.map(f => JSON.stringify(f)).join('\n') + '\n');
}

export function createFlag(data: Omit<SecurityFlag, 'id' | 'createdAt' | 'updatedAt'>): SecurityFlag {
  const flags = loadFlags();
  const flag: SecurityFlag = {
    ...data,
    id:        'flg_' + crypto.randomBytes(8).toString('hex'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  flags.unshift(flag);
  saveFlags(flags);
  return flag;
}

export function updateFlag(id: string, patch: Partial<SecurityFlag>): SecurityFlag | null {
  const flags = loadFlags();
  const idx = flags.findIndex(f => f.id === id);
  if (idx === -1) return null;
  flags[idx] = { ...flags[idx], ...patch, updatedAt: new Date().toISOString() };
  saveFlags(flags);
  return flags[idx];
}

export function queryFlags(opts: {
  status?:   string;
  severity?: string;
  type?:     string;
  userId?:   string;
  search?:   string;
  page?:     number;
  limit?:    number;
}): { data: SecurityFlag[]; total: number; pages: number } {
  let rows = loadFlags();
  if (opts.status)   rows = rows.filter(f => f.status === opts.status);
  if (opts.severity) rows = rows.filter(f => f.severity === opts.severity);
  if (opts.type)     rows = rows.filter(f => f.type === opts.type);
  if (opts.userId)   rows = rows.filter(f => f.userId === opts.userId);
  if (opts.search) {
    const s = opts.search.toLowerCase();
    rows = rows.filter(f =>
      f.userName.toLowerCase().includes(s) ||
      f.userEmail.toLowerCase().includes(s) ||
      f.title.toLowerCase().includes(s) ||
      (f.ip ?? '').includes(s)
    );
  }
  const total = rows.length;
  const limit = opts.limit ?? 20;
  const page  = opts.page  ?? 1;
  return { data: rows.slice((page - 1) * limit, page * limit), total, pages: Math.max(1, Math.ceil(total / limit)) };
}

// ── Security Dashboard Stats ──────────────────────────────────────────────────

export interface SecurityDashStats {
  activeFlags:            number;
  resolvedThisMonth:      number;
  suspendedAccounts:      number;
  failedLoginsLast24h:    number;
  suspiciousTxLast7d:     number;
  flagsByType:            Record<string, number>;
  flagsBySeverity:        Record<string, number>;
}

export function getSecurityDashStats(): SecurityDashStats {
  const flags = loadFlags();
  const now   = Date.now();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const day24h     = new Date(now - 86_400_000).toISOString();
  const week7d     = new Date(now - 7 * 86_400_000).toISOString();

  const activeFlags       = flags.filter(f => f.status === 'active').length;
  const resolvedThisMonth = flags.filter(f => f.status === 'resolved' && (f.resolvedAt ?? '') >= monthStart).length;
  const suspendedAccounts = flags.filter(f => f.status === 'suspended').length;
  const failedLoginsLast24h = flags.filter(f =>
    f.type === 'multiple_failed_attempts' && f.createdAt >= day24h
  ).length;
  const suspiciousTxLast7d = flags.filter(f =>
    (f.type === 'unusual_transaction' || f.type === 'large_transfer' || f.type === 'flagged_wallet') &&
    f.createdAt >= week7d
  ).length;

  const flagsByType: Record<string, number> = {};
  const flagsBySeverity: Record<string, number> = {};
  for (const f of flags.filter(f => f.status === 'active')) {
    flagsByType[f.type]         = (flagsByType[f.type]         ?? 0) + 1;
    flagsBySeverity[f.severity] = (flagsBySeverity[f.severity] ?? 0) + 1;
  }

  return { activeFlags, resolvedThisMonth, suspendedAccounts, failedLoginsLast24h, suspiciousTxLast7d, flagsByType, flagsBySeverity };
}

// ── IP Lists ──────────────────────────────────────────────────────────────────

export interface IpEntry {
  ip:        string;
  note?:     string;
  addedBy?:  string;
  addedAt:   string;
}

export interface CountryBlock {
  code:      string;   // ISO 2-letter
  name:      string;
  blockedAt: string;
  addedBy?:  string;
}

export interface IpLists {
  blacklist:       IpEntry[];
  whitelist:       IpEntry[];
  countryBlocks:   CountryBlock[];
  vpnDetection:    'off' | 'flag' | 'block';
  updatedAt:       string;
}

const DEFAULT_IP_LISTS: IpLists = {
  blacklist:     [],
  whitelist:     [],
  countryBlocks: [],
  vpnDetection:  'flag',
  updatedAt:     new Date().toISOString(),
};

export function readIpLists(): IpLists {
  try {
    if (!fs.existsSync(IP_FILE)) return DEFAULT_IP_LISTS;
    return { ...DEFAULT_IP_LISTS, ...JSON.parse(fs.readFileSync(IP_FILE, 'utf8')) };
  } catch { return DEFAULT_IP_LISTS; }
}

export function writeIpLists(lists: IpLists): void {
  ensureDir(IP_FILE);
  fs.writeFileSync(IP_FILE, JSON.stringify({ ...lists, updatedAt: new Date().toISOString() }, null, 2));
}

export function addToBlacklist(ip: string, note: string, addedBy: string): IpLists {
  const lists = readIpLists();
  if (!lists.blacklist.find(e => e.ip === ip)) {
    lists.blacklist.push({ ip, note, addedBy, addedAt: new Date().toISOString() });
  }
  writeIpLists(lists);
  return lists;
}

export function removeFromBlacklist(ip: string): IpLists {
  const lists = readIpLists();
  lists.blacklist = lists.blacklist.filter(e => e.ip !== ip);
  writeIpLists(lists);
  return lists;
}

export function addToWhitelist(ip: string, note: string, addedBy: string): IpLists {
  const lists = readIpLists();
  if (!lists.whitelist.find(e => e.ip === ip)) {
    lists.whitelist.push({ ip, note, addedBy, addedAt: new Date().toISOString() });
  }
  writeIpLists(lists);
  return lists;
}

export function removeFromWhitelist(ip: string): IpLists {
  const lists = readIpLists();
  lists.whitelist = lists.whitelist.filter(e => e.ip !== ip);
  writeIpLists(lists);
  return lists;
}

export function isIpBlacklisted(ip: string): boolean {
  return readIpLists().blacklist.some(e => e.ip === ip);
}

// ── Flag Rules ────────────────────────────────────────────────────────────────

export interface FlagRule {
  id:           string;
  type:         FlagType;
  label:        string;
  description:  string;
  enabled:      boolean;
  severity:     FlagSeverity;
  threshold?:   number;   // e.g. transfer amount, failed attempt count
  thresholdLabel?: string;
}

const DEFAULT_FLAG_RULES: FlagRule[] = [
  { id: 'rule_new_country',     type: 'new_country',             label: 'Login from New Country',          description: 'Flag when a user logs in from a country not seen before on their account.',                  enabled: true,  severity: 'medium' },
  { id: 'rule_new_device',      type: 'new_device',              label: 'Login from New Device',           description: 'Flag when a user logs in from a device fingerprint not previously seen.',                    enabled: true,  severity: 'low' },
  { id: 'rule_large_transfer',  type: 'large_transfer',          label: 'Transfer Above Threshold',        description: 'Flag any transfer or withdrawal above the configured amount.',                               enabled: true,  severity: 'high',     threshold: 10000, thresholdLabel: 'Amount (USD)' },
  { id: 'rule_failed_logins',   type: 'multiple_failed_attempts', label: 'Multiple Failed Login Attempts', description: 'Flag when more than 3 failed login attempts occur within 1 hour from the same account.',     enabled: true,  severity: 'high',     threshold: 3,     thresholdLabel: 'Max attempts per hour' },
  { id: 'rule_same_ip',         type: 'same_ip_accounts',        label: 'Multiple Accounts — Same IP',    description: 'Flag when 3 or more accounts are registered or active from the same IP address.',            enabled: true,  severity: 'medium',   threshold: 3,     thresholdLabel: 'Max accounts per IP' },
  { id: 'rule_kyc_mismatch',    type: 'kyc_mismatch',            label: 'KYC Document Mismatch',          description: 'Flag when submitted KYC documents do not match the account registration details.',            enabled: true,  severity: 'critical' },
  { id: 'rule_flagged_wallet',  type: 'flagged_wallet',          label: 'Transaction to Flagged Wallet',  description: 'Flag when a user initiates a crypto transaction to a wallet address on the sanctions list.',   enabled: true,  severity: 'critical' },
  { id: 'rule_vpn',             type: 'vpn_detected',            label: 'VPN / Proxy Detected',           description: 'Flag or block logins from known VPN, proxy, or Tor exit nodes.',                             enabled: false, severity: 'low' },
  { id: 'rule_unusual_tx',      type: 'unusual_transaction',     label: 'Unusual Transaction Pattern',    description: 'Flag when transaction frequency or amounts deviate significantly from the user\'s history.',  enabled: true,  severity: 'medium' },
];

export function readFlagRules(): FlagRule[] {
  try {
    if (!fs.existsSync(RULES_FILE)) return DEFAULT_FLAG_RULES;
    const saved = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8')) as FlagRule[];
    // Merge with defaults to pick up any new rules
    const savedMap = new Map(saved.map(r => [r.id, r]));
    return DEFAULT_FLAG_RULES.map(def => savedMap.get(def.id) ?? def);
  } catch { return DEFAULT_FLAG_RULES; }
}

export function writeFlagRules(rules: FlagRule[]): void {
  ensureDir(RULES_FILE);
  fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
}

// ── 2FA Policy ────────────────────────────────────────────────────────────────

export interface TwoFAPolicy {
  mandatoryForAll:          boolean;
  mandatoryForWithdrawals:  boolean;
  withdrawalThreshold:      number;   // USD
  mandatoryForWires:        boolean;
  updatedAt:                string;
  updatedBy?:               string;
}

const DEFAULT_2FA_POLICY: TwoFAPolicy = {
  mandatoryForAll:         false,
  mandatoryForWithdrawals: true,
  withdrawalThreshold:     5000,
  mandatoryForWires:       true,
  updatedAt:               new Date().toISOString(),
};

export function read2FAPolicy(): TwoFAPolicy {
  try {
    if (!fs.existsSync(POLICY_FILE)) return DEFAULT_2FA_POLICY;
    return { ...DEFAULT_2FA_POLICY, ...JSON.parse(fs.readFileSync(POLICY_FILE, 'utf8')) };
  } catch { return DEFAULT_2FA_POLICY; }
}

export function write2FAPolicy(policy: TwoFAPolicy): void {
  ensureDir(POLICY_FILE);
  fs.writeFileSync(POLICY_FILE, JSON.stringify(policy, null, 2));
}

// ── User Sessions ─────────────────────────────────────────────────────────────

export interface UserSession {
  id:          string;
  userId:      string;
  userName:    string;
  userEmail:   string;
  token:       string;
  ip:          string;
  country?:    string;
  device:      string;
  browser:     string;
  os:          string;
  ua:          string;
  createdAt:   string;
  lastSeenAt:  string;
  active:      boolean;
}

export function loadUserSessions(): UserSession[] {
  try {
    if (!fs.existsSync(USER_SESS_FILE)) return [];
    return fs.readFileSync(USER_SESS_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .map(l => JSON.parse(l) as UserSession)
      .filter(s => s.active)
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  } catch { return []; }
}

export function upsertUserSession(session: Omit<UserSession, 'id'>): void {
  try {
    ensureDir(USER_SESS_FILE);
    let sessions: UserSession[] = [];
    if (fs.existsSync(USER_SESS_FILE)) {
      sessions = fs.readFileSync(USER_SESS_FILE, 'utf8')
        .split('\n').filter(Boolean)
        .map(l => JSON.parse(l) as UserSession);
    }
    const idx = sessions.findIndex(s => s.token === session.token);
    if (idx !== -1) {
      sessions[idx] = { ...sessions[idx], ...session };
    } else {
      sessions.push({ ...session, id: 'usess_' + crypto.randomBytes(6).toString('hex') });
    }
    fs.writeFileSync(USER_SESS_FILE, sessions.map(s => JSON.stringify(s)).join('\n') + '\n');
  } catch { /* silent */ }
}

export function terminateUserSession(token: string): boolean {
  try {
    if (!fs.existsSync(USER_SESS_FILE)) return false;
    const sessions = fs.readFileSync(USER_SESS_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .map(l => JSON.parse(l) as UserSession);
    const idx = sessions.findIndex(s => s.token === token);
    if (idx === -1) return false;
    sessions[idx].active = false;
    fs.writeFileSync(USER_SESS_FILE, sessions.map(s => JSON.stringify(s)).join('\n') + '\n');
    return true;
  } catch { return false; }
}

export function terminateAllUserSessions(userId?: string): number {
  try {
    if (!fs.existsSync(USER_SESS_FILE)) return 0;
    const sessions = fs.readFileSync(USER_SESS_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .map(l => JSON.parse(l) as UserSession);
    let count = 0;
    for (const s of sessions) {
      if (s.active && (!userId || s.userId === userId)) {
        s.active = false;
        count++;
      }
    }
    fs.writeFileSync(USER_SESS_FILE, sessions.map(s => JSON.stringify(s)).join('\n') + '\n');
    return count;
  } catch { return 0; }
}

// ── Audit Log (enhanced) ──────────────────────────────────────────────────────

const AUDIT_FILE = privateSubdirectory('admin/audit.jsonl');

export interface AuditEntry {
  id:       string;
  event:    string;
  adminId?: string;
  userId?:  string;
  email?:   string;
  ip?:      string;
  ua?:      string;
  reason?:  string;
  meta?:    Record<string, unknown>;
  ts:       string;
}

export function queryAuditLog(opts: {
  adminId?:  string;
  event?:    string;
  userId?:   string;
  search?:   string;
  dateFrom?: string;
  dateTo?:   string;
  page?:     number;
  limit?:    number;
}): { data: AuditEntry[]; total: number; pages: number } {
  try {
    if (!fs.existsSync(AUDIT_FILE)) return { data: [], total: 0, pages: 1 };
    let rows = fs.readFileSync(AUDIT_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .map((l, i) => {
        const e = JSON.parse(l) as AuditEntry;
        if (!e.id) e.id = `aud_${i}`;
        return e;
      })
      .reverse();

    if (opts.adminId) rows = rows.filter(r => r.adminId === opts.adminId);
    if (opts.event)   rows = rows.filter(r => r.event.includes(opts.event!));
    if (opts.userId)  rows = rows.filter(r => r.userId === opts.userId);
    if (opts.dateFrom) rows = rows.filter(r => r.ts >= opts.dateFrom!);
    if (opts.dateTo)   rows = rows.filter(r => r.ts <= opts.dateTo! + 'T23:59:59Z');
    if (opts.search) {
      const s = opts.search.toLowerCase();
      rows = rows.filter(r =>
        r.event.toLowerCase().includes(s) ||
        (r.adminId ?? '').toLowerCase().includes(s) ||
        (r.email ?? '').toLowerCase().includes(s) ||
        (r.userId ?? '').toLowerCase().includes(s)
      );
    }

    const total = rows.length;
    const limit = opts.limit ?? 50;
    const page  = opts.page  ?? 1;
    return { data: rows.slice((page - 1) * limit, page * limit), total, pages: Math.max(1, Math.ceil(total / limit)) };
  } catch { return { data: [], total: 0, pages: 1 }; }
}

export function exportAuditCsv(opts: Parameters<typeof queryAuditLog>[0]): string {
  const { data } = queryAuditLog({ ...opts, limit: 10000, page: 1 });
  const header = 'id,ts,event,adminId,userId,email,ip,reason,meta';
  const rows = data.map(r =>
    [r.id, r.ts, r.event, r.adminId ?? '', r.userId ?? '', r.email ?? '', r.ip ?? '', r.reason ?? '',
     JSON.stringify(r.meta ?? {}).replace(/"/g, '""')].map(v => `"${v}"`).join(',')
  );
  return [header, ...rows].join('\n');
}
