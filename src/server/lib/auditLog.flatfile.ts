/**
 * auditLog.flatfile.ts — Original flat-file audit log (fallback).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AuditEntry } from './auditLog.js';

const AUDIT_FILE = '/private/admin/audit.jsonl';

function ensureDir() { const dir = path.dirname(AUDIT_FILE); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

export function appendAuditEntry(entry: Omit<AuditEntry, 'id' | 'ts'>): AuditEntry {
  ensureDir();
  const e: AuditEntry = { ...entry, id: 'al_' + crypto.randomBytes(8).toString('hex'), ts: new Date().toISOString() };
  fs.appendFileSync(AUDIT_FILE, JSON.stringify(e) + '\n');
  return e;
}

export function getAuditLog(opts: { adminId?: string; action?: string; limit?: number; from?: string } = {}): AuditEntry[] {
  try {
    if (!fs.existsSync(AUDIT_FILE)) return [];
    let rows = fs.readFileSync(AUDIT_FILE, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as AuditEntry).reverse();
    if (opts.adminId) rows = rows.filter(e => e.adminId === opts.adminId);
    if (opts.action)  rows = rows.filter(e => e.action === opts.action);
    if (opts.from)    rows = rows.filter(e => e.ts >= opts.from!);
    return rows.slice(0, opts.limit ?? 200);
  } catch { return []; }
}
