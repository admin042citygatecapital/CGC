/**
 * notificationStore.flatfile.ts — Original flat-file notification store (fallback).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Notification } from './notificationStore.js';

const NOTIF_FILE = '/private/notifications/notifications.jsonl';

function ensureDir() {
  const dir = path.dirname(NOTIF_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadAll(): Notification[] {
  try {
    if (!fs.existsSync(NOTIF_FILE)) return [];
    return fs.readFileSync(NOTIF_FILE, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Notification);
  } catch { return []; }
}

function saveAll(notifs: Notification[]) {
  ensureDir();
  fs.writeFileSync(NOTIF_FILE, notifs.map(n => JSON.stringify(n)).join('\n') + '\n');
}

export function createNotification(userId: string, title: string, message: string, link?: string): Notification {
  const notifs = loadAll();
  const notif: Notification = { id: 'notif_' + crypto.randomBytes(8).toString('hex'), userId, title, message, link, read: false, createdAt: new Date().toISOString() };
  notifs.push(notif);
  saveAll(notifs);
  return notif;
}

export function getNotificationsForUser(userId: string, opts: { limit?: number; unreadOnly?: boolean } = {}): { notifications: Notification[]; unreadCount: number } {
  const all = loadAll().filter(n => n.userId === userId).reverse();
  const unreadCount = all.filter(n => !n.read).length;
  let filtered = opts.unreadOnly ? all.filter(n => !n.read) : all;
  if (opts.limit) filtered = filtered.slice(0, opts.limit);
  return { notifications: filtered, unreadCount };
}

export function markAsRead(notificationId: string): boolean {
  const notifs = loadAll();
  const idx = notifs.findIndex(n => n.id === notificationId);
  if (idx === -1) return false;
  notifs[idx].read = true;
  saveAll(notifs);
  return true;
}

export function markAllReadForUser(userId: string): number {
  const notifs = loadAll();
  let count = 0;
  for (const n of notifs) { if (n.userId === userId && !n.read) { n.read = true; count++; } }
  if (count > 0) saveAll(notifs);
  return count;
}
