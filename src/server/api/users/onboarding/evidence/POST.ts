import type { Request, Response } from 'express';
import { addOnboardingEvidence, getOrCreateOnboardingCase, type EvidenceKind, type EvidenceReferenceType } from '../../../../lib/onboardingStore.js';
import { appendAuditEntry } from '../../../../lib/auditLog.js';

const KINDS = new Set(['identity', 'address', 'selfie', 'company', 'ownership', 'authority']);
const REFERENCES = new Set(['provider', 'controlled_url', 'internal']);

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser!;
  const kind = String(req.body?.kind ?? '') as EvidenceKind;
  const referenceType = String(req.body?.referenceType ?? '') as EvidenceReferenceType;
  if (!KINDS.has(kind) || !REFERENCES.has(referenceType)) return res.status(400).json({ error: 'Invalid evidence kind or reference type.' });
  // Customers may provide opaque provider references only. URLs and internal
  // references are created by authorised administrators to prevent URL abuse.
  if (referenceType !== 'provider') return res.status(403).json({ error: 'Customers may submit approved-provider references only.' });
  try {
    const record = await getOrCreateOnboardingCase(user.id, user.accountTier === 'business' ? 'business' : 'individual', user.id);
    const evidence = await addOnboardingEvidence({
      caseId: record.id, userId: user.id, actorId: user.id, actorType: 'customer', kind, referenceType,
      reference: String(req.body?.reference ?? ''), sha256: req.body?.sha256 ? String(req.body.sha256) : undefined,
      issuedAt: req.body?.issuedAt ? String(req.body.issuedAt) : undefined,
      expiresAt: req.body?.expiresAt ? String(req.body.expiresAt) : undefined,
    });
    await appendAuditEntry({ adminId: user.id, adminEmail: user.email, action: 'customer_onboarding_evidence_added', target: 'onboarding_case', targetId: record.id, details: { evidenceId: evidence.id, kind } });
    return res.status(201).json({ ok: true, evidence });
  } catch (error) {
    const typed = error as Error & { code?: string };
    return res.status(typed.code === 'NOT_FOUND' ? 404 : typed.code === 'CASE_LOCKED' ? 409 : 400).json({ error: typed.message, code: typed.code });
  }
}
