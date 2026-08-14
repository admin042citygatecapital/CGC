import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { appendAudit, appendCriticalAudit } from '../../../../lib/auditLog.js';
import { publishHomepageContent, validateHomepageContent } from '../../../../lib/homepageCmsStore.js';

export default async function handler(req: Request, res: Response) {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 5 || reason.length > 300) {
    return res.status(400).json({ error: 'Give a publication reason between 5 and 300 characters.' });
  }
  const validation = validateHomepageContent(req.body?.content);
  if (!validation.content) return res.status(400).json({ error: 'Homepage content is invalid.', details: validation.errors });

  const actor = req.adminSession?.email ?? req.adminSession?.adminId ?? 'unknown-admin';
  const adminId = req.adminSession?.adminId ?? 'unknown-admin';
  await appendCriticalAudit({
    event: 'admin_homepage_content_publish_intent',
    adminId,
    ip: req.ip ?? 'unknown',
    meta: { hash: crypto.createHash('sha256').update(JSON.stringify(validation.content)).digest('hex'), reason },
  });
  const document = await publishHomepageContent(validation.content, actor, reason);
  appendAudit({
    event: 'admin_homepage_content_published',
    adminId,
    ip: req.ip ?? 'unknown',
    meta: { version: document.version, hash: document.hash, reason },
  });
  return res.json({ ok: true, document });
}
