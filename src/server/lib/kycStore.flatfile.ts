/**
 * kycStore.flatfile.ts — Original flat-file KYC store (fallback).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { KycSettings, KycNote } from './kycStore.js';

const SETTINGS_FILE = '/private/kyc/settings.json';
const NOTES_FILE    = '/private/kyc/admin-notes.jsonl';

const DEFAULT_SETTINGS: KycSettings = { expiryMonths: 12, renewalReminderDays: 30, autoRestrictExpired: true, updatedAt: new Date().toISOString() };

function ensureDir(file: string) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readKycSettings(): KycSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) };
  } catch { return DEFAULT_SETTINGS; }
}

export function writeKycSettings(s: KycSettings): void {
  ensureDir(SETTINGS_FILE);
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
}

export function appendKycNote(n: KycNote): void {
  ensureDir(NOTES_FILE);
  fs.appendFileSync(NOTES_FILE, JSON.stringify(n) + '\n');
}

export function getKycNotesForUser(userId: string): KycNote[] {
  try {
    if (!fs.existsSync(NOTES_FILE)) return [];
    return fs.readFileSync(NOTES_FILE, 'utf8').split('\n').filter(Boolean)
      .map(l => JSON.parse(l) as KycNote)
      .filter(n => n.userId === userId);
  } catch { return []; }
}
