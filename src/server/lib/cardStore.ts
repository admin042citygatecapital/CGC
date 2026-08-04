/**
 * cardStore.ts — PostgreSQL-backed virtual card store.
 *
 * Security: AES-256-GCM encryption for PAN & CVV is preserved.
 * The `number_enc` and `cvv_enc` columns store "enc:<iv>:<authTag>:<ciphertext>".
 * All exported functions return VirtualCard with plaintext number/cvv.
 *
 * Falls back to flat-file when DATABASE_URL is not configured.
 */

import crypto from 'node:crypto';
import { eq, and, desc } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { cards, cardActivity } from '../db/schema.js';
import type { Card as DbCard } from '../db/schema.js';
import { getSecret } from '#airo/secrets';

// ── Encryption (identical to original) ───────────────────────────────────────

const ENC_PREFIX = 'enc:';
const ALGORITHM  = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const raw = String(getSecret('CARD_ENCRYPTION_KEY') || '').trim();
  if (raw.length === 64 && /^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  if (raw && raw.length !== 64) {
    console.warn(JSON.stringify({ event: 'cardStore.encryption.key_invalid', reason: `CARD_ENCRYPTION_KEY must be 64-char hex. Got length ${raw.length}. Using dev fallback.` }));
  }
  if (!raw && !devKeyWarned) {
    console.warn(JSON.stringify({ event: 'cardStore.encryption.no_key', reason: 'CARD_ENCRYPTION_KEY not set. Using dev fallback — NOT safe for production.' }));
    devKeyWarned = true;
  }
  return crypto.createHash('sha256').update('cgc-card-dev-key-do-not-use-in-production').digest();
}

let devKeyWarned = false;

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag   = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(value: string): string {
  if (!value.startsWith(ENC_PREFIX)) return value;
  const parts = value.slice(ENC_PREFIX.length).split(':');
  if (parts.length !== 3) { console.error(JSON.stringify({ event: 'cardStore.encryption.malformed' })); return ''; }
  try {
    const [ivHex, authTagHex, ciphertextHex] = parts;
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex')) as crypto.DecipherGCM;
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    return decipher.update(Buffer.from(ciphertextHex, 'hex')).toString('utf8') + decipher.final('utf8');
  } catch (err) {
    console.error(JSON.stringify({ event: 'cardStore.encryption.decrypt_failed', error: String(err) }));
    return '';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type CardStatus  = 'active' | 'frozen' | 'deleted' | 'replaced';
export type CardNetwork = 'visa' | 'mastercard';

export interface VirtualCard {
  id:             string;
  userId:         string;
  cardholderName: string;
  number:         string;   // plaintext PAN
  expiry:         string;
  cvv:            string;   // plaintext CVV
  network:        CardNetwork;
  status:         CardStatus;
  spendingLimit?: number;
  pinHash?:       string;
  replacedById?:  string;
  issuedByAdmin?: boolean;
  color?:         string;
  createdAt:      string;
  updatedAt:      string;
}

export interface CardActivity {
  id:        string;
  cardId:    string;
  userId:    string;
  event:     string;
  amount?:   number;
  currency?: string;
  merchant?: string;
  ip?:       string;
  adminId?:  string;
  meta?:     Record<string, unknown>;
  ts:        string;
}

// ── DB row → VirtualCard (decrypts PAN/CVV) ───────────────────────────────────

function toCard(r: DbCard): VirtualCard {
  return {
    id:             r.id,
    userId:         r.userId,
    cardholderName: r.cardholderName,
    number:         decrypt(r.numberEnc),
    expiry:         r.expiry,
    cvv:            decrypt(r.cvvEnc),
    network:        (r.network?.toLowerCase() ?? 'visa') as CardNetwork,
    status:         (r.status ?? 'active') as CardStatus,
    spendingLimit:  r.spendingLimit ?? undefined,
    pinHash:        r.pin ?? undefined,
    color:          r.color ?? undefined,
    createdAt:      r.createdAt.toISOString(),
    updatedAt:      r.updatedAt.toISOString(),
  };
}

// ── Flat-file fallback ────────────────────────────────────────────────────────

let _ff: typeof import('./cardStore.flatfile.js') | null = null;
async function ff() {
  if (!_ff) _ff = await import('./cardStore.flatfile.js');
  return _ff;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getCardsForUser(userId: string): Promise<VirtualCard[]> {
  if (!isDatabaseConfigured()) return (await ff()).getCardsForUser(userId);
  const db   = getDb();
  const rows = await db.select().from(cards)
    .where(eq(cards.userId, userId))
    .orderBy(desc(cards.createdAt));
  return rows.map(toCard);
}

export async function getAllCards(): Promise<VirtualCard[]> {
  if (!isDatabaseConfigured()) return (await ff()).getAllCards();
  const db   = getDb();
  const rows = await db.select().from(cards).orderBy(desc(cards.createdAt));
  return rows.map(toCard);
}

export async function findCardById(id: string): Promise<VirtualCard | undefined> {
  if (!isDatabaseConfigured()) return (await ff()).findCardById(id);
  const db   = getDb();
  const rows = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
  return rows[0] ? toCard(rows[0]) : undefined;
}

export async function createCard(data: Omit<VirtualCard, 'id' | 'createdAt' | 'updatedAt'>): Promise<VirtualCard> {
  if (!isDatabaseConfigured()) return (await ff()).createCard(data);
  const db  = getDb();
  const now = new Date();
  const rows = await db.insert(cards).values({
    id:             'card_' + crypto.randomBytes(8).toString('hex'),
    userId:         data.userId,
    numberEnc:      encrypt(data.number),
    cvvEnc:         encrypt(data.cvv),
    last4:          data.number.slice(-4),
    expiry:         data.expiry,
    cardholderName: data.cardholderName,
    type:           'virtual',
    network:        data.network ?? 'visa',
    status:         data.status ?? 'active',
    frozen:         data.status === 'frozen',
    spendingLimit:  data.spendingLimit ?? null,
    pin:            data.pinHash ?? null,
    color:          data.color ?? '#1a1a2e',
    createdAt:      now,
    updatedAt:      now,
  }).returning();
  return toCard(rows[0]);
}

// Patch type widens spendingLimit/pinHash to accept `null` explicitly (meaning
// "clear this field") in addition to `undefined` (meaning "leave unchanged") —
// VirtualCard itself only ever returns `number | undefined` / `string | undefined`
// on reads, but writers need the tri-state (set / clear / leave) distinction.
export type CardPatch = Partial<Omit<VirtualCard, 'spendingLimit' | 'pinHash'>> & {
  spendingLimit?: number | null;
  pinHash?:       string | null;
};

export async function updateCard(id: string, patch: CardPatch): Promise<VirtualCard | null> {
  if (!isDatabaseConfigured()) return (await ff()).updateCard(id, patch);
  const db = getDb();

  const dbPatch: Partial<DbCard> = { updatedAt: new Date() };
  if (patch.number        !== undefined) { dbPatch.numberEnc = encrypt(patch.number); dbPatch.last4 = patch.number.slice(-4); }
  if (patch.cvv           !== undefined) dbPatch.cvvEnc         = encrypt(patch.cvv);
  if (patch.status        !== undefined) { dbPatch.status = patch.status; dbPatch.frozen = patch.status === 'frozen'; }
  if (patch.spendingLimit !== undefined) dbPatch.spendingLimit   = patch.spendingLimit ?? null;
  if (patch.pinHash       !== undefined) dbPatch.pin             = patch.pinHash ?? null;
  if (patch.color         !== undefined) dbPatch.color           = patch.color ?? null;

  const rows = await db.update(cards).set(dbPatch).where(eq(cards.id, id)).returning();
  return rows[0] ? toCard(rows[0]) : null;
}

/**
 * deleteCard — soft-deletes a card by id.
 *
 * FIX (Category C, task #38 — see AUDIT_REPORT.md §7): the caller
 * (users/cards/delete/POST.ts) has always passed the authenticated user's id
 * as a second argument, but this function previously accepted only `id` and
 * silently ignored it — the WHERE clause matched on card id alone, so any
 * authenticated customer could delete (soft-delete) any other customer's
 * card by guessing/observing its id (IDOR). `userId` is now required and
 * enforced in the WHERE clause: the update only succeeds if the card both
 * exists and belongs to the caller. Non-owners and non-existent ids both
 * resolve to `false` (caller returns a generic 404), which avoids leaking
 * whether a given cardId exists but belongs to someone else.
 */
export async function deleteCard(id: string, userId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return (await ff()).deleteCard(id, userId);
  const db     = getDb();
  const result = await db.update(cards)
    .set({ status: 'deleted', updatedAt: new Date() })
    .where(and(eq(cards.id, id), eq(cards.userId, userId)))
    .returning({ id: cards.id });
  return result.length > 0;
}

// ── Card Activity ─────────────────────────────────────────────────────────────

export async function appendCardActivity(activity: Omit<CardActivity, 'id'>): Promise<CardActivity> {
  if (!isDatabaseConfigured()) return (await ff()).appendCardActivity(activity);
  const db   = getDb();
  const rows = await db.insert(cardActivity).values({
    id:          'ca_' + crypto.randomBytes(8).toString('hex'),
    cardId:      activity.cardId,
    userId:      activity.userId,
    type:        activity.event,
    amount:      activity.amount ?? null,
    currency:    activity.currency ?? null,
    merchant:    activity.merchant ?? null,
    description: activity.meta ? JSON.stringify(activity.meta) : null,
    status:      'completed',
    createdAt:   new Date(),
  }).returning();
  return {
    id:        rows[0].id,
    cardId:    rows[0].cardId,
    userId:    rows[0].userId,
    event:     rows[0].type,
    amount:    rows[0].amount ?? undefined,
    currency:  rows[0].currency ?? undefined,
    merchant:  rows[0].merchant ?? undefined,
    ts:        rows[0].createdAt.toISOString(),
  };
}

export async function getCardActivity(cardId: string): Promise<CardActivity[]> {
  if (!isDatabaseConfigured()) return (await ff()).getCardActivity(cardId);
  const db   = getDb();
  const rows = await db.select().from(cardActivity)
    .where(eq(cardActivity.cardId, cardId))
    .orderBy(desc(cardActivity.createdAt));
  return rows.map(r => ({
    id:       r.id,
    cardId:   r.cardId,
    userId:   r.userId,
    event:    r.type,
    amount:   r.amount ?? undefined,
    currency: r.currency ?? undefined,
    merchant: r.merchant ?? undefined,
    ts:       r.createdAt.toISOString(),
  }));
}

// ── Migration helper ──────────────────────────────────────────────────────────

/** Re-encrypt all cards with the current key (call after rotating CARD_ENCRYPTION_KEY) */
export async function migrateCardsToEncrypted(): Promise<{ migrated: number; errors: number }> {
  if (!isDatabaseConfigured()) return (await ff()).migrateCardsToEncrypted();
  const db   = getDb();
  const rows = await db.select().from(cards);
  let migrated = 0, errors = 0;

  for (const r of rows) {
    try {
      const plainNumber = decrypt(r.numberEnc);
      const plainCvv    = decrypt(r.cvvEnc);
      if (plainNumber && plainCvv) {
        await db.update(cards).set({
          numberEnc: encrypt(plainNumber),
          cvvEnc:    encrypt(plainCvv),
          updatedAt: new Date(),
        }).where(eq(cards.id, r.id));
        migrated++;
      }
    } catch { errors++; }
  }
  return { migrated, errors };
}

// ── Legacy compatibility shims ────────────────────────────────────────────────

/**
 * adminFreezeCard — toggle a card between frozen/active.
 * Legacy callers expect a synchronous return; we fire-and-forget the DB write
 * and return the optimistic card shape.
 */
export function adminFreezeCard(cardId: string): VirtualCard | null {
  // Fire async update; callers don't await this
  (async () => {
    const card = await findCardById(cardId);
    if (!card) return;
    const newStatus: CardStatus = card.status === 'frozen' ? 'active' : 'frozen';
    await updateCard(cardId, { status: newStatus });
  })().catch(() => {});

  // Return a placeholder so the handler can respond immediately.
  // The actual updated card will be reflected on next read.
  return null; // Callers must be updated to async — see freeze/POST.ts
}

/**
 * appendActivity — legacy alias for appendCardActivity.
 * Old callers pass { cardId, userId, event, adminId }.
 */
export function appendActivity(payload: {
  cardId:   string;
  userId:   string;
  event:    string;
  adminId?: string;
  amount?:  number;
  currency?: string;
  merchant?: string;
  meta?:    Record<string, unknown>;
}): void {
  appendCardActivity({
    cardId:   payload.cardId,
    userId:   payload.userId,
    event:    payload.event,
    amount:   payload.amount,
    currency: payload.currency,
    merchant: payload.merchant,
    meta:     payload.adminId ? { adminId: payload.adminId, ...payload.meta } : payload.meta,
    ts:       new Date().toISOString(),
  }).catch(() => {});
}

