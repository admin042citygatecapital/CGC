/**
 * auditLog.flatfile.ts — Flat-file audit log (fallback store).
 *
 * Used when the database is not configured. The reader is deliberately
 * resilient: one malformed line must never erase the rest of the history,
 * and an unreadable file is reported loudly instead of silently read as
 * empty. Line-level data quality is returned to callers so the
 * administration UI can disclose it.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AuditEntry } from './auditLog.js';
import { privateSubdirectory } from './storagePaths.js';

const AUDIT_FILE = path.join(privateSubdirectory('admin'), 'audit.jsonl');

function ensureDir() { const dir = path.dirname(AUDIT_FILE); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

export function appendAuditEntry(entry: Omit<AuditEntry, 'id' | 'ts'>): AuditEntry {
  ensureDir();
  const e: AuditEntry = { ...entry, id: 'al_' + crypto.randomBytes(8).toString('hex'), ts: new Date().toISOString() };
  fs.appendFileSync(AUDIT_FILE, JSON.stringify(e) + '\n');
  return e;
}

export interface FlatFileAudit {
  entries: AuditEntry[];
  /** Lines that could not be parsed — disclosed to callers, never silent. */
  malformedLines: number;
  /** True when the log file itself could not be read at all. */
  unreadable: boolean;
}

/**
 * Read every parseable audit record in file order (oldest first).
 *
 * A single malformed line is skipped and counted; a wholly unreadable file
 * is logged and reported through `unreadable` so callers can distinguish
 * "no history" from "history could not be read".
 */
export function readAuditFile(): FlatFileAudit {
  const result: FlatFileAudit = { entries: [], malformedLines: 0, unreadable: false };
  let raw: string;
  try {
    if (!fs.existsSync(AUDIT_FILE)) return result;
    raw = fs.readFileSync(AUDIT_FILE, 'utf8');
  } catch (error) {
    result.unreadable = true;
    console.error('[audit] flat-file audit log could not be read', {
      file: AUDIT_FILE,
      error: error instanceof Error ? error.message : String(error),
    });
    return result;
  }

  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    try {
      const parsed = JSON.parse(line) as AuditEntry;
      if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string' || typeof parsed.action !== 'string') {
        result.malformedLines++;
        continue;
      }
      result.entries.push(parsed);
    } catch {
      result.malformedLines++;
    }
  }
  if (result.malformedLines > 0) {
    console.error('[audit] flat-file audit log has unparseable lines', {
      file: AUDIT_FILE,
      malformedLines: result.malformedLines,
      readableLines: result.entries.length,
    });
  }
  return result;
}

export function getAuditLog(opts: { adminId?: string; action?: string; limit?: number; from?: string } = {}): AuditEntry[] {
  const { entries, malformedLines, unreadable } = readAuditFile();
  if (unreadable) return [];
  let rows = entries.slice().reverse();
  if (opts.adminId) rows = rows.filter(e => e.adminId === opts.adminId);
  if (opts.action)  rows = rows.filter(e => e.action === opts.action);
  if (opts.from)    rows = rows.filter(e => e.ts >= opts.from!);
  if (malformedLines > 0 && rows.length > 0) {
    // Malformed lines are already logged by readAuditFile; the readable
    // remainder is still served rather than discarded.
  }
  return rows.slice(0, opts.limit ?? 200);
}