/**
 * notificationStore.ts — PostgreSQL-backed notification store.
 * Drop-in replacement for the flat-file JSONL implementation.
 */

import crypto from 'node:crypto';
import { eq, desc, and } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { notifications } from '../db/schema.js';
import type { Notification as DbNotification } from '../db/schema.js';

export interface Notification {
  id:        string;
  userId:    string;
  title:     string;
  message:   string;
  link?:     string;
  read:      boolean;
  createdAt: string;
}

function toNotif(r: DbNotification): Notification {
  return {
    id:        r.id,
    userId:    r.userId,
    title:     r.title,
    message:   r.message,
    link:      r.link ?? undefined,
    read:      r.read,
    createdAt: r.createdAt.toISOString(),
  };
}

// ── Flat-file fallback ────────────────────────────────────────────────────────

let _ff: typeof import('./notificationStore.flatfile.js') | null = null;
async function ff() {
  if (!_ff) _ff = await import('./notificationStore.flatfile.js');
  return _ff;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  link?: string,
): Promise<Notification> {
  if (!isDatabaseConfigured()) return (await ff()).createNotification(userId, title, message, link);
  const db = getDb();
  const rows = await db.insert(notifications).values({
    id:        'notif_' + crypto.randomBytes(8).toString('hex'),
    userId,
    title,
    message,
    link:      link ?? null,
    read:      false,
    createdAt: new Date(),
  }).returning();
  return toNotif(rows[0]);
}

export async function getNotificationsForUser(
  userId: string,
  opts: { limit?: number; unreadOnly?: boolean } = {},
): Promise<{ notifications: Notification[]; unreadCount: number }> {
  if (!isDatabaseConfigured()) return (await ff()).getNotificationsForUser(userId, opts);
  const db = getDb();

  const conditions = [eq(notifications.userId, userId)];
  if (opts.unreadOnly) conditions.push(eq(notifications.read, false));

  const [unreadResult, rows] = await Promise.all([
    db.select({ count: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false))),
    db.select().from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(opts.limit ?? 50),
  ]);

  return {
    notifications: rows.map(toNotif),
    unreadCount:   unreadResult.length,
  };
}

export async function markAsRead(notificationId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return (await ff()).markAsRead(notificationId);
  const db   = getDb();
  const rows = await db.update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, notificationId))
    .returning({ id: notifications.id });
  return rows.length > 0;
}

export async function markAllReadForUser(userId: string): Promise<number> {
  if (!isDatabaseConfigured()) return (await ff()).markAllReadForUser(userId);
  const db     = getDb();
  const result = await db.update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
    .returning({ id: notifications.id });
  return result.length;
}

export async function deleteNotification(id: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const db   = getDb();
  const rows = await db.delete(notifications)
    .where(eq(notifications.id, id))
    .returning({ id: notifications.id });
  return rows.length > 0;
}
