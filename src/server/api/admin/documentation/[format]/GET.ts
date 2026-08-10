import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';

const REFERENCES: Record<string, { filename: string; contentType: string }> = {
  markdown: { filename: 'api-documentation.md', contentType: 'text/markdown; charset=utf-8' },
  csv: { filename: 'api-documentation.csv', contentType: 'text/csv; charset=utf-8' },
  postman: { filename: 'postman-collection.json', contentType: 'application/json; charset=utf-8' },
  openapi: { filename: 'openapi.yaml', contentType: 'application/yaml; charset=utf-8' },
};

function documentationRoot(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'dist', 'admin-docs'),
    path.resolve(process.cwd(), 'docs', 'api-reference'),
  ];
  return candidates.find(candidate => fs.existsSync(candidate)) ?? null;
}

export default function handler(req: Request, res: Response) {
  const reference = REFERENCES[String(req.params.format ?? '')];
  if (!reference) return res.status(404).json({ error: 'Documentation format not found' });

  const root = documentationRoot();
  if (!root) return res.status(503).json({ error: 'Documentation snapshot unavailable' });
  const filePath = path.join(root, reference.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Documentation file not found' });

  const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment';
  res.setHeader('Content-Type', reference.contentType);
  res.setHeader('Content-Disposition', `${disposition}; filename="${reference.filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-CGC-Documentation-Status', 'reference-snapshot');
  return res.send(fs.readFileSync(filePath));
}
