/**
 * cardStore.flatfile.ts — Original flat-file card store (fallback).
 * Preserves the original AES-256-GCM encryption logic.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getSecret } from '#airo/secrets';
import type { VirtualCard, CardActivity } from './cardStore.js';
import { privateSubdirectory } from './storagePaths.js';

const CARDS_FILE    = privateSubdirectory('cards/cards.jsonl');
const ACTIVITY_FILE = privateSubdirectory('cards/activity.jsonl');
const ENC_PREFIX    = 'enc:';
const ALGORITHM     = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const raw = String(getSecret('CARD_ENCRYPTION_KEY') || '').trim();
  if (raw.length === 64 && /^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update('cgc-card-dev-key-do-not-use-in-production').digest();
}

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
  if (parts.length !== 3) return '';
  try {
    const [ivHex, authTagHex, ciphertextHex] = parts;
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex')) as crypto.DecipherGCM;
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    return decipher.update(Buffer.from(ciphertextHex, 'hex')).toString('utf8') + decipher.final('utf8');
  } catch { return ''; }
}

function ensureDir() { const dir = path.dirname(CARDS_FILE); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function loadAll(): VirtualCard[] {
  try {
    if (!fs.existsSync(CARDS_FILE)) return [];
    return fs.readFileSync(CARDS_FILE, 'utf8').split('\n').filter(Boolean).map(l => {
      const stored = JSON.parse(l) as VirtualCard & { number: string; cvv: string };
      return { ...stored, number: decrypt(stored.number), cvv: decrypt(stored.cvv) };
    });
  } catch { return []; }
}

function saveAll(cardsData: VirtualCard[]) {
  ensureDir();
  const lines = cardsData.map(c => JSON.stringify({ ...c, number: encrypt(c.number), cvv: encrypt(c.cvv) }));
  fs.writeFileSync(CARDS_FILE, lines.join('\n') + '\n');
}

export function getCardsForUser(userId: string): VirtualCard[] { return loadAll().filter(c => c.userId === userId); }
export function getAllCards(): VirtualCard[] { return loadAll(); }
export function findCardById(id: string): VirtualCard | undefined { return loadAll().find(c => c.id === id); }

export function createCard(data: Omit<VirtualCard, 'id' | 'createdAt' | 'updatedAt'>): VirtualCard {
  const cardsData = loadAll();
  const now = new Date().toISOString();
  const card: VirtualCard = { ...data, id: 'card_' + crypto.randomBytes(8).toString('hex'), createdAt: now, updatedAt: now };
  cardsData.push(card);
  saveAll(cardsData);
  return card;
}

export function updateCard(id: string, patch: Partial<VirtualCard>): VirtualCard | null {
  const cardsData = loadAll();
  const idx = cardsData.findIndex(c => c.id === id);
  if (idx === -1) return null;
  cardsData[idx] = { ...cardsData[idx], ...patch, updatedAt: new Date().toISOString() };
  saveAll(cardsData);
  return cardsData[idx];
}

export function deleteCard(id: string): boolean {
  const cardsData = loadAll();
  const idx = cardsData.findIndex(c => c.id === id);
  if (idx === -1) return false;
  cardsData[idx] = { ...cardsData[idx], status: 'deleted', updatedAt: new Date().toISOString() };
  saveAll(cardsData);
  return true;
}

export function appendCardActivity(activity: Omit<CardActivity, 'id'>): CardActivity {
  ensureDir();
  const a: CardActivity = { ...activity, id: 'ca_' + crypto.randomBytes(8).toString('hex') };
  fs.appendFileSync(ACTIVITY_FILE, JSON.stringify(a) + '\n');
  return a;
}

export function getCardActivity(cardId: string): CardActivity[] {
  try {
    if (!fs.existsSync(ACTIVITY_FILE)) return [];
    return fs.readFileSync(ACTIVITY_FILE, 'utf8').split('\n').filter(Boolean)
      .map(l => JSON.parse(l) as CardActivity).filter(a => a.cardId === cardId);
  } catch { return []; }
}

export function migrateCardsToEncrypted(): { migrated: number; errors: number } {
  const cardsData = loadAll();
  saveAll(cardsData); // re-saves with encryption
  return { migrated: cardsData.length, errors: 0 };
}
