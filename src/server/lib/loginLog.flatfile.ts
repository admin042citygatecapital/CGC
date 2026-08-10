/**
 * loginLog.flatfile.ts — Original flat-file login log (fallback).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { LoginActor, LoginResult, LoginEvent } from './loginLog.js';
import { privateSubdirectory } from './storagePaths.js';

const LOGIN_LOG_FILE = path.join(privateSubdirectory('logs'), 'login.jsonl');

function ensureDir() { const dir = path.dirname(LOGIN_LOG_FILE); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function parseUA(ua: string): { device: string; browser: string; os: string } {
  const u = ua.toLowerCase();
  let device = 'desktop';
  if (/bot|crawler|spider/i.test(ua)) device = 'bot';
  else if (/mobile|iphone|ipod/i.test(ua)) device = 'mobile';
  else if (/ipad|tablet/i.test(ua)) device = 'tablet';
  let browser = 'Unknown';
  if (u.includes('chrome/') && !u.includes('chromium')) browser = 'Chrome';
  else if (u.includes('firefox/')) browser = 'Firefox';
  else if (u.includes('safari/') && !u.includes('chrome')) browser = 'Safari';
  let os = 'Unknown';
  if (u.includes('windows')) os = 'Windows';
  else if (u.includes('mac os x')) os = 'macOS';
  else if (u.includes('android')) os = 'Android';
  else if (u.includes('iphone') || u.includes('ipad')) os = 'iOS';
  else if (u.includes('linux')) os = 'Linux';
  return { device, browser, os };
}

export function appendLoginEvent(actor: LoginActor, email: string, result: LoginResult, ip: string, ua: string, opts: { userId?: string; reason?: string; sessionId?: string; duration?: number } = {}): LoginEvent {
  ensureDir();
  const { device, browser, os } = parseUA(ua);
  const event: LoginEvent = { id: 'le_' + crypto.randomBytes(8).toString('hex'), ts: new Date().toISOString(), actor, email, result, ip, ua, device, browser, os, country: 'Unknown', ...opts };
  fs.appendFileSync(LOGIN_LOG_FILE, JSON.stringify(event) + '\n');
  return event;
}

export function getLoginHistory(opts: { email?: string; userId?: string; actor?: LoginActor; limit?: number; from?: string; to?: string } = {}): LoginEvent[] {
  try {
    if (!fs.existsSync(LOGIN_LOG_FILE)) return [];
    let rows = fs.readFileSync(LOGIN_LOG_FILE, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as LoginEvent).reverse();
    if (opts.email)  rows = rows.filter(e => e.email === opts.email);
    if (opts.userId) rows = rows.filter(e => e.userId === opts.userId);
    if (opts.actor)  rows = rows.filter(e => e.actor === opts.actor);
    if (opts.from)   rows = rows.filter(e => e.ts >= opts.from!);
    if (opts.to)     rows = rows.filter(e => e.ts <= opts.to!);
    return rows.slice(0, opts.limit ?? 100);
  } catch { return []; }
}

export function getLoginStats(): { total: number; success: number; failed: number; blocked: number } {
  const rows = getLoginHistory({ limit: 10000 });
  return { total: rows.length, success: rows.filter(e => e.result === 'success').length, failed: rows.filter(e => e.result === 'failed').length, blocked: rows.filter(e => e.result === 'blocked').length };
}
