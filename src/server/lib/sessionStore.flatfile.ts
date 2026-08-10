/**
 * sessionStore.flatfile.ts — Original flat-file admin session store (fallback).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Session } from './sessionStore.js';
import { privateSubdirectory } from './storagePaths.js';

const SESSIONS_FILE   = path.join(privateSubdirectory('admin'), 'sessions.json');
const INACTIVITY_MS   = (parseInt(process.env.SESSION_TIMEOUT_MINUTES ?? '60', 10)) * 60_000;
const ABSOLUTE_TTL_MS = (parseInt(process.env.SESSION_MAX_HOURS        ?? '8',  10)) * 3_600_000;
const MAX_SESSIONS_PER_ADMIN = 5;

function load(): Record<string, Session> {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return {};
    const raw = fs.readFileSync(SESSIONS_FILE, 'utf8').trim();
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, Session>;
  } catch { return {}; }
}

function save(sessions: Record<string, Session>): void {
  const dir = path.dirname(SESSIONS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = SESSIONS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(sessions, null, 2));
  fs.renameSync(tmp, SESSIONS_FILE);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function createSession(token: string, data: Omit<Session, 'lastSeenAt'>): void {
  const sessions = load();
  const adminSessions = Object.entries(sessions).filter(([, s]) => s.adminId === data.adminId);
  if (adminSessions.length >= MAX_SESSIONS_PER_ADMIN) {
    adminSessions.sort((a, b) => new Date(a[1].createdAt).getTime() - new Date(b[1].createdAt).getTime());
    const toEvict = adminSessions.slice(0, adminSessions.length - MAX_SESSIONS_PER_ADMIN + 1);
    for (const [t] of toEvict) delete sessions[t];
  }
  sessions[token] = { ...data, lastSeenAt: new Date().toISOString() };
  save(sessions);
}

export function getSession(token: string): Session | null {
  if (!token || token.length !== 64) return null;
  const sessions = load();
  const s = sessions[token];
  if (!s) return null;
  const now = Date.now();
  if (now - new Date(s.lastSeenAt).getTime() > INACTIVITY_MS) { delete sessions[token]; save(sessions); return null; }
  if (now - new Date(s.createdAt).getTime() > ABSOLUTE_TTL_MS) { delete sessions[token]; save(sessions); return null; }
  sessions[token] = { ...s, lastSeenAt: new Date().toISOString() };
  save(sessions);
  return sessions[token];
}

export function deleteSession(token: string): void {
  const sessions = load();
  delete sessions[token];
  save(sessions);
}

export function listSessions(): Array<{ token: string } & Session> {
  return Object.entries(load()).map(([token, s]) => ({ token, ...s }));
}

export function purgeAllSessions(): void {
  save({});
}

export function getSessionsByAdmin(adminId: string): Array<{ token: string } & Session> {
  return Object.entries(load()).filter(([, s]) => s.adminId === adminId).map(([token, s]) => ({ token, ...s }));
}
