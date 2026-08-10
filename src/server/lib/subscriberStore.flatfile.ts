/**
 * subscriberStore.flatfile.ts — Original flat-file subscriber store (fallback).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Subscriber } from './subscriberStore.js';
import { privateSubdirectory } from './storagePaths.js';

const SUB_FILE = privateSubdirectory('subscribers/subscribers.jsonl');

function ensureDir() { const dir = path.dirname(SUB_FILE); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function loadAll(): Subscriber[] {
  try {
    if (!fs.existsSync(SUB_FILE)) return [];
    return fs.readFileSync(SUB_FILE, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Subscriber);
  } catch { return []; }
}
function saveAll(subs: Subscriber[]) { ensureDir(); fs.writeFileSync(SUB_FILE, subs.map(s => JSON.stringify(s)).join('\n') + '\n'); }

export function addSubscriber(email: string, name?: string, source?: string): Subscriber {
  const subs = loadAll();
  const existing = subs.findIndex(s => s.email.toLowerCase() === email.toLowerCase());
  if (existing >= 0) { subs[existing].status = 'active'; subs[existing].unsubscribedAt = undefined; saveAll(subs); return subs[existing]; }
  const sub: Subscriber = { id: 'sub_' + crypto.randomBytes(8).toString('hex'), email: email.toLowerCase(), name, status: 'active', source, subscribedAt: new Date().toISOString() };
  subs.push(sub);
  saveAll(subs);
  return sub;
}

export function unsubscribe(email: string): boolean {
  const subs = loadAll();
  const idx = subs.findIndex(s => s.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) return false;
  subs[idx].status = 'unsubscribed';
  subs[idx].unsubscribedAt = new Date().toISOString();
  saveAll(subs);
  return true;
}

export function getActiveSubscribers(): Subscriber[] { return loadAll().filter(s => s.status === 'active'); }
export function getAllSubscribers(): Subscriber[] { return loadAll(); }
export function findSubscriberByEmail(email: string): Subscriber | undefined { return loadAll().find(s => s.email.toLowerCase() === email.toLowerCase()); }
export function getSubscriberStats(): { total: number; active: number; unsubscribed: number } {
  const all = loadAll();
  return { total: all.length, active: all.filter(s => s.status === 'active').length, unsubscribed: all.filter(s => s.status === 'unsubscribed').length };
}
