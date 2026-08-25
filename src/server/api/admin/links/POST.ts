import type { Request, Response } from 'express';
import { writeLinks } from '../../../lib/linksStore.js';
import { appendCriticalAudit } from '../../../lib/auditLog.js';
import { authorizeAdminRole } from '../../../lib/rbacMiddleware.js';

export default async function handler(req: Request, res: Response) {
  if (!authorizeAdminRole(req, res, 'SUPER_ADMIN')) return;
  const { links } = req.body;
  if (!Array.isArray(links)) return res.status(400).json({ error: 'links must be an array' });
  if (links.length > 100) return res.status(400).json({ error: 'A maximum of 100 links is supported.' });
  const adminId = req.adminSession!.adminId;
  await appendCriticalAudit({ event: 'admin_external_links_updated', adminId, ip: req.ip, meta: { count: links.length } });
  await writeLinks(links, adminId);
  res.json({ ok: true });
}
