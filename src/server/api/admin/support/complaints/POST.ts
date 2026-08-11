import type { Request, Response } from 'express';
import { updateComplaint, createComplaint } from '../../../../lib/complaintStore.js';
import { appendAuditEntry } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const { action, id, ...data } = req.body ?? {};
  const session = req.adminSession!;
  try {
    if (action === 'update') {
      if (!id) return res.status(400).json({ error: 'id required' });
      const c = await updateComplaint(id, data, session.adminId);
      await appendAuditEntry({ adminId: session.adminId, adminEmail: session.email, action: 'complaint_updated', target: 'complaint', targetId: id, ip: req.ip, details: { status: c.status, severity: c.severity, regulatoryFlag: c.regulatoryFlag } });
      return res.json({ ok: true, complaint: c });
    }
    const c = await createComplaint(data, session.adminId);
    await appendAuditEntry({ adminId: session.adminId, adminEmail: session.email, action: 'complaint_created', target: 'complaint', targetId: c.id, ip: req.ip, details: { severity: c.severity, category: c.category } });
    res.status(201).json({ ok: true, complaint: c });
  } catch (err) {
    const typed = err as Error & { status?: number; code?: string }; res.status(typed.status ?? 500).json({ error: typed.message, code: typed.code });
  }
}
