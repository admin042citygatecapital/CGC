/**
 * GET /api/admin/contacts
 * Return paginated contact form submissions.
 * Query: page, limit, search
 */
import type { Request, Response } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { privateSubdirectory } from '../../../lib/storagePaths.js';

const STORE_FILE = privateSubdirectory('contacts/submissions.jsonl');

interface Submission {
  id: string; firstName: string; lastName: string; email: string;
  company: string; subject: string; message: string;
  ip: string; userAgent: string; createdAt: string;
}

function loadAll(): Submission[] {
  if (!existsSync(STORE_FILE)) return [];
  return readFileSync(STORE_FILE, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line) as Submission; } catch { return null; } })
    .filter((x): x is Submission => x !== null)
    .reverse(); // newest first
}

export default function handler(req: Request, res: Response) {
  try {
    const page   = Math.max(1, parseInt(String(req.query.page  ?? '1'), 10));
    const limit  = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '25'), 10)));
    const search = String(req.query.search ?? '').toLowerCase().trim();

    let all = loadAll();

    if (search) {
      all = all.filter(s =>
        s.email.toLowerCase().includes(search) ||
        s.firstName.toLowerCase().includes(search) ||
        s.lastName.toLowerCase().includes(search) ||
        s.subject.toLowerCase().includes(search) ||
        s.company.toLowerCase().includes(search)
      );
    }

    const total = all.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const data  = all.slice((page - 1) * limit, page * limit);

    return res.json({ data, total, page, pages, limit });
  } catch (err) {
    console.error('admin.contacts.get.error', err);
    return res.status(500).json({ error: 'Failed to load contact submissions.' });
  }
}
