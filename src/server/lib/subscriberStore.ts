/**
 * subscriberStore.ts — PostgreSQL-backed newsletter subscriber store.
 * Drop-in replacement for the flat-file implementation.
 */

import crypto from 'node:crypto';
import { eq, desc, sql as drizzleSql } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { subscribers } from '../db/schema.js';
import type { Subscriber as DbSubscriber } from '../db/schema.js';

export interface Subscriber {
  id:              string;
  email:           string;
  name?:           string;
  status:          'active' | 'unsubscribed';
  source?:         string;
  tags?:           string[];
  subscribedAt:    string;
  unsubscribedAt?: string;
  sequenceStep:    number;
  lastEmailAt?:    string;
}

function toSub(r: DbSubscriber): Subscriber {
  return {
    id:              r.id,
    email:           r.email,
    name:            r.name ?? undefined,
    status:          (r.status ?? 'active') as 'active' | 'unsubscribed',
    source:          r.source ?? undefined,
    tags:            Array.isArray(r.tags) ? r.tags as string[] : undefined,
    subscribedAt:    r.subscribedAt.toISOString(),
    unsubscribedAt:  r.unsubscribedAt?.toISOString() ?? undefined,
    sequenceStep:    r.sequenceStep ?? 0,
    lastEmailAt:     r.lastEmailAt?.toISOString() ?? undefined,
  };
}

// ── Flat-file fallback ────────────────────────────────────────────────────────

let _ff: typeof import('./subscriberStore.flatfile.js') | null = null;
async function ff() {
  if (!_ff) _ff = await import('./subscriberStore.flatfile.js');
  return _ff;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function addSubscriber(email: string, name?: string, source?: string): Promise<Subscriber> {
  if (!isDatabaseConfigured()) return (await ff()).addSubscriber(email, name, source);
  const db = getDb();
  const rows = await db.insert(subscribers).values({
    id:           'sub_' + crypto.randomBytes(8).toString('hex'),
    email:        email.toLowerCase(),
    name:         name ?? null,
    status:       'active',
    source:       source ?? null,
    subscribedAt: new Date(),
  }).onConflictDoUpdate({
    target: subscribers.email,
    set: { status: 'active', unsubscribedAt: null, name: name ?? null },
  }).returning();
  return toSub(rows[0]);
}

export async function unsubscribe(email: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return (await ff()).unsubscribe(email);
  const db     = getDb();
  const result = await db.update(subscribers)
    .set({ status: 'unsubscribed', unsubscribedAt: new Date() })
    .where(eq(subscribers.email, email.toLowerCase()))
    .returning({ id: subscribers.id });
  return result.length > 0;
}

export async function getActiveSubscribers(): Promise<Subscriber[]> {
  if (!isDatabaseConfigured()) return (await ff()).getActiveSubscribers();
  const db   = getDb();
  const rows = await db.select().from(subscribers)
    .where(eq(subscribers.status, 'active'))
    .orderBy(desc(subscribers.subscribedAt));
  return rows.map(toSub);
}

export async function getAllSubscribers(): Promise<Subscriber[]> {
  if (!isDatabaseConfigured()) return (await ff()).getAllSubscribers();
  const db   = getDb();
  const rows = await db.select().from(subscribers).orderBy(desc(subscribers.subscribedAt));
  return rows.map(toSub);
}

export async function getSubscriberStats(): Promise<{ total: number; active: number; unsubscribed: number }> {
  if (!isDatabaseConfigured()) return (await ff()).getSubscriberStats();
  const db = getDb();
  const rows = await db.select({
    status: subscribers.status,
    count:  drizzleSql<number>`COUNT(*)::int`,
  }).from(subscribers).groupBy(subscribers.status);

  let total = 0, active = 0, unsubscribed = 0;
  for (const r of rows) {
    total += r.count;
    if (r.status === 'active')       active       += r.count;
    if (r.status === 'unsubscribed') unsubscribed += r.count;
  }
  return { total, active, unsubscribed };
}

export async function findSubscriberByEmail(email: string): Promise<Subscriber | undefined> {
  if (!isDatabaseConfigured()) return (await ff()).findSubscriberByEmail(email);
  const db   = getDb();
  const rows = await db.select().from(subscribers)
    .where(eq(subscribers.email, email.toLowerCase()))
    .limit(1);
  return rows[0] ? toSub(rows[0]) : undefined;
}

/** Advance a subscriber's nurture-sequence step and stamp lastEmailAt (used by newsletter/send-sequence). */
export async function updateSequenceStep(email: string, step: number): Promise<void> {
  if (!isDatabaseConfigured()) return (await ff()).updateSequenceStep(email, step);
  const db = getDb();
  await db.update(subscribers)
    .set({ sequenceStep: step, lastEmailAt: new Date() })
    .where(eq(subscribers.email, email.toLowerCase()));
}
