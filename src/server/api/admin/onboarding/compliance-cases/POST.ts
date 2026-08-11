import type { Request, Response } from 'express';
import { openComplianceCase, transitionComplianceCase, type ComplianceCaseKind, type ComplianceCaseStatus, type ComplianceRisk } from '../../../../lib/complianceCaseStore.js';
import { appendAuditEntry } from '../../../../lib/auditLog.js';
import { createNotification } from '../../../../lib/notificationStore.js';
import { findUserById, updateUser } from '../../../../lib/userStore.js';

const KINDS = new Set(['aml', 'sanctions']); const STATUSES = new Set(['open', 'investigating', 'escalated', 'cleared', 'blocked']); const RISKS = new Set(['unrated', 'low', 'medium', 'high']);
export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  try {
    if (req.body?.caseId) {
      const status = String(req.body.status) as ComplianceCaseStatus; const riskLevel = String(req.body.riskLevel ?? 'unrated') as ComplianceRisk;
      if (!STATUSES.has(status) || !RISKS.has(riskLevel)) return res.status(400).json({ error: 'Invalid case status or risk level.' });
      const record = await transitionComplianceCase({ caseId: String(req.body.caseId), status, riskLevel, reason: String(req.body.reason ?? ''), actorId: session.adminId });
      if (status === 'blocked') await updateUser(record.userId, { status: 'frozen', amlStatus: 'blocked', amlRiskLevel: riskLevel });
      await createNotification(record.userId, `Compliance case ${status}`, status === 'blocked' ? 'Your platform profile is restricted pending compliance review.' : 'Your compliance review status has changed.', '/kyc');
      await appendAuditEntry({ adminId: session.adminId, adminEmail: session.email, action: 'admin_compliance_case_transition', target: 'compliance_case', targetId: record.id, ip: req.ip, details: { status, riskLevel } });
      return res.json({ ok: true, case: record });
    }
    const userId = String(req.body?.userId ?? ''); const kind = String(req.body?.kind ?? '') as ComplianceCaseKind; const riskLevel = String(req.body?.riskLevel ?? 'unrated') as ComplianceRisk;
    if (!userId || !KINDS.has(kind) || !RISKS.has(riskLevel)) return res.status(400).json({ error: 'Valid userId, kind and riskLevel are required.' });
    if (!await findUserById(userId)) return res.status(404).json({ error: 'Customer not found.' });
    const record = await openComplianceCase({ userId, kind, riskLevel, summary: String(req.body?.summary ?? ''), actorId: session.adminId });
    await appendAuditEntry({ adminId: session.adminId, adminEmail: session.email, action: 'admin_compliance_case_open', target: 'compliance_case', targetId: record.id, ip: req.ip, details: { userId, kind, riskLevel } });
    return res.status(201).json({ ok: true, case: record });
  } catch (error) {
    const typed = error as Error & { code?: string }; return res.status(typed.code === 'NOT_FOUND' ? 404 : typed.code === 'MAKER_CHECKER_REQUIRED' ? 409 : 400).json({ error: typed.message, code: typed.code });
  }
}
