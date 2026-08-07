/**
 * loginLog.ts — PostgreSQL-backed login event store.
 * Drop-in replacement for the flat-file JSONL implementation.
 */

import crypto from 'node:crypto';
import { eq, desc, and, gte, lte, sql as drizzleSql } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { loginEvents } from '../db/schema.js';
import type { LoginEvent as DbLoginEvent } from '../db/schema.js';

export type LoginActor = 'admin' | 'user';
export type LoginResult = 'success' | 'failed' | 'blocked' | 'totp_failed' | 'otp_sent' | 'otp_failed' | 'account_locked' | 'status_denied';

export interface LoginEvent {
  id:         string;
  ts:         string;
  actor:      LoginActor;
  email:      string;
  userId?:    string;
  result:     LoginResult;
  ip:         string;
  ua:         string;
  device:     string;
  browser:    string;
  os:         string;
  country:    string;
  reason?:    string;
  sessionId?: string;
  duration?:  number;
}

// ── UA parsing (unchanged from original) ─────────────────────────────────────

function parseUA(ua: string): { device: string; browser: string; os: string } {
  const u = ua.toLowerCase();
  let device = 'desktop';
  if (/bot|crawler|spider|slurp|bingbot|googlebot|facebookexternalhit/i.test(ua)) device = 'bot';
  else if (/mobile|android.*mobile|iphone|ipod|blackberry|windows phone/i.test(ua)) device = 'mobile';
  else if (/ipad|android(?!.*mobile)|tablet/i.test(ua)) device = 'tablet';

  let browser = 'Unknown';
  if (u.includes('edg/') || u.includes('edge/'))    browser = 'Edge';
  else if (u.includes('opr/') || u.includes('opera')) browser = 'Opera';
  else if (u.includes('chrome/') && !u.includes('chromium')) browser = 'Chrome';
  else if (u.includes('firefox/'))                   browser = 'Firefox';
  else if (u.includes('safari/') && !u.includes('chrome')) browser = 'Safari';
  else if (u.includes('msie') || u.includes('trident/')) browser = 'IE';
  else if (u.includes('curl/'))                      browser = 'cURL';
  else if (u.includes('postman'))                    browser = 'Postman';

  let os = 'Unknown';
  if (u.includes('windows nt 10'))       os = 'Windows 10/11';
  else if (u.includes('windows nt 6.3')) os = 'Windows 8.1';
  else if (u.includes('windows nt 6.1')) os = 'Windows 7';
  else if (u.includes('windows'))        os = 'Windows';
  else if (u.includes('mac os x'))       os = 'macOS';
  else if (u.includes('android'))        os = 'Android';
  else if (u.includes('iphone') || u.includes('ipad')) os = 'iOS';
  else if (u.includes('linux'))          os = 'Linux';

  return { device, browser, os };
}

function toEvent(r: DbLoginEvent): LoginEvent {
  return {
    id:        r.id,
    ts:        r.ts.toISOString(),
    actor:     r.actor as LoginActor,
    email:     r.email,
    userId:    r.userId ?? undefined,
    result:    r.result as LoginResult,
    ip:        r.ip,
    ua:        r.ua,
    device:    r.device,
    browser:   r.browser,
    os:        r.os,
    country:   r.country,
    reason:    r.reason ?? undefined,
    sessionId: r.sessionId ?? undefined,
    duration:  r.duration ?? undefined,
  };
}

// ── Flat-file fallback ────────────────────────────────────────────────────────

let _ff: typeof import('./loginLog.flatfile.js') | null = null;
async function ff() {
  if (!_ff) _ff = await import('./loginLog.flatfile.js');
  return _ff;
}

// ── Public API ────────────────────────────────────────────────────────────────

type LoginEventInput = Pick<LoginEvent, 'actor' | 'email' | 'result' | 'ip' | 'ua'> &
  Partial<Pick<LoginEvent, 'userId' | 'reason' | 'sessionId' | 'duration'>>;

export function appendLoginEvent(input: LoginEventInput): Promise<LoginEvent>;
export function appendLoginEvent(
  actor: LoginActor,
  email: string,
  result: LoginResult,
  ip: string,
  ua: string,
  opts?: { userId?: string; reason?: string; sessionId?: string; duration?: number }
): Promise<LoginEvent>;
export async function appendLoginEvent(
  actorOrInput: LoginActor | LoginEventInput,
  emailArg?: string,
  resultArg?: LoginResult,
  ipArg?: string,
  uaArg?: string,
  optsArg: { userId?: string; reason?: string; sessionId?: string; duration?: number } = {}
): Promise<LoginEvent> {
  const input = typeof actorOrInput === 'string'
    ? { actor: actorOrInput, email: emailArg!, result: resultArg!, ip: ipArg!, ua: uaArg!, ...optsArg }
    : actorOrInput;
  const { actor, email, result, ip, ua, ...opts } = input;
  const { device, browser, os } = parseUA(ua);
  const event: Omit<LoginEvent, 'id'> = {
    ts:        new Date().toISOString(),
    actor,
    email,
    result,
    ip,
    ua,
    device,
    browser,
    os,
    country:   'Unknown',
    ...opts,
  };

  if (!isDatabaseConfigured()) return (await ff()).appendLoginEvent(actor, email, result, ip, ua, opts);

  const db   = getDb();
  const rows = await db.insert(loginEvents).values({
    id:        'le_' + crypto.randomBytes(8).toString('hex'),
    ts:        new Date(event.ts),
    actor:     actor as DbLoginEvent['actor'],
    email,
    userId:    opts.userId ?? null,
    result:    result as DbLoginEvent['result'],
    ip,
    ua,
    device,
    browser,
    os,
    country:   'Unknown',
    reason:    opts.reason ?? null,
    sessionId: opts.sessionId ?? null,
    duration:  opts.duration ?? null,
  }).returning();
  return toEvent(rows[0]);
}

export async function getLoginHistory(
  opts: { email?: string; userId?: string; actor?: LoginActor; limit?: number; from?: string; to?: string } = {}
): Promise<LoginEvent[]> {
  if (!isDatabaseConfigured()) return (await ff()).getLoginHistory(opts);
  const db = getDb();

  const conditions = [];
  if (opts.email)  conditions.push(eq(loginEvents.email, opts.email));
  if (opts.userId) conditions.push(eq(loginEvents.userId, opts.userId));
  if (opts.actor)  conditions.push(eq(loginEvents.actor, opts.actor as DbLoginEvent['actor']));
  if (opts.from)   conditions.push(gte(loginEvents.ts, new Date(opts.from)));
  if (opts.to)     conditions.push(lte(loginEvents.ts, new Date(opts.to)));

  const rows = await db.select().from(loginEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(loginEvents.ts))
    .limit(opts.limit ?? 100);

  return rows.map(toEvent);
}

export async function getLoginStats(): Promise<{
  total: number; success: number; failed: number; blocked: number;
}> {
  if (!isDatabaseConfigured()) return (await ff()).getLoginStats();
  const db = getDb();
  const rows = await db.select({
    result: loginEvents.result,
    count:  drizzleSql<number>`COUNT(*)::int`,
  }).from(loginEvents).groupBy(loginEvents.result);

  let total = 0, success = 0, failed = 0, blocked = 0;
  for (const r of rows) {
    total += r.count;
    if (r.result === 'success')  success += r.count;
    if (r.result === 'failed')   failed  += r.count;
    if (r.result === 'blocked')  blocked += r.count;
  }
  return { total, success, failed, blocked };
}
