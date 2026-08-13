import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { reviewSponsorEvidence, reviewSponsorPackage } from '../../../../lib/sponsorReadinessStore.js';
import { sponsorError } from '../../../../lib/sponsorReadinessHttp.js';
import { authenticateIndependentSponsorReviewer } from '../../../../lib/independentSponsorReviewer.js';
import { reviewBeneficialOwner, reviewLegalEntity } from '../../../../lib/legalEntityVerificationStore.js';
import { syntheticTransactionMonitoring } from '../../../../lib/syntheticTransactionMonitoring.js';
import { syntheticReconciliation } from '../../../../lib/syntheticReconciliation.js';
import { syntheticDisputes } from '../../../../lib/syntheticDisputes.js';

export default async function handler(req: Request, res: Response) {
  try {
    const actor = authenticateIndependentSponsorReviewer(req);
    const decision = req.body?.decision;
    if (decision !== 'approved' && decision !== 'rejected') {
      return res.status(400).json({ error: 'decision must be approved or rejected', code: 'VALIDATION_ERROR' });
    }
    const reviewerId = actor.id;
    const requestedTarget = req.body?.target ?? 'package';
    if (!['evidence', 'package', 'legal_entity', 'beneficial_owner', 'monitoring_alert', 'reconciliation_exception', 'dispute_case'].includes(requestedTarget)) {
      return res.status(400).json({ error: 'target is not supported', code: 'VALIDATION_ERROR' });
    }
    const target = requestedTarget;
    if (target === 'dispute_case') {
      const caseId=String(req.body?.caseId??'').trim();
      if(!/^syn_dispute_[A-Za-z0-9-]{8,100}$/.test(caseId))return res.status(400).json({error:'A valid caseId is required.',code:'VALIDATION_ERROR'});
      await syntheticDisputes.review(caseId,decision,String(req.body?.note??''),{...actor,correlationId:String(req.get('X-Request-ID')??crypto.randomUUID()),actorType:'independent_checker'});
      return res.json({ok:true,reviewerId,target,caseId,decision});
    }
    if (target === 'reconciliation_exception') {
      const exceptionId = String(req.body?.exceptionId ?? '').trim();
      if (!/^syn_recon_exception_[A-Za-z0-9-]{8,100}$/.test(exceptionId)) return res.status(400).json({ error: 'A valid exceptionId is required.', code: 'VALIDATION_ERROR' });
      const reconciliationDecision = String(req.body?.reconciliationDecision ?? '');
      if (reconciliationDecision !== 'resolved' && reconciliationDecision !== 'accepted_risk') return res.status(400).json({ error: 'reconciliationDecision must be resolved or accepted_risk.', code: 'VALIDATION_ERROR' });
      await syntheticReconciliation.resolve(exceptionId, reconciliationDecision, String(req.body?.note ?? ''), { ...actor, correlationId: String(req.get('X-Request-ID') ?? crypto.randomUUID()), actorType: 'independent_checker' });
      return res.json({ ok: true, reviewerId, target, exceptionId, decision: reconciliationDecision });
    }
    if (target === 'monitoring_alert') {
      const alertId = String(req.body?.alertId ?? '').trim();
      if (!/^syn_alert_[A-Za-z0-9-]{8,100}$/.test(alertId)) return res.status(400).json({ error: 'A valid alertId is required.', code: 'VALIDATION_ERROR' });
      const monitoringDecision = decision === 'approved' ? String(req.body?.monitoringDecision ?? '') : 'case';
      if (monitoringDecision !== 'false_positive' && monitoringDecision !== 'case') return res.status(400).json({ error: 'monitoringDecision must be false_positive or case.', code: 'VALIDATION_ERROR' });
      await syntheticTransactionMonitoring.resolve(alertId, monitoringDecision, String(req.body?.note ?? ''), { ...actor, correlationId: String(req.get('X-Request-ID') ?? crypto.randomUUID()), actorType: 'independent_checker' });
      return res.json({ ok: true, reviewerId, target, alertId, decision: monitoringDecision });
    }
    if (target === 'evidence') {
      const evidenceId = String(req.body?.evidenceId ?? '').trim();
      if (!/^sev_[A-Za-z0-9-]{8,100}$/.test(evidenceId)) {
        return res.status(400).json({ error: 'A valid evidenceId is required.', code: 'VALIDATION_ERROR' });
      }
      await reviewSponsorEvidence(evidenceId, decision, req.body?.note, actor);
      return res.json({ ok: true, reviewerId, target, evidenceId, decision });
    }
    if (target === 'legal_entity') {
      await reviewLegalEntity(decision === 'approved' ? 'verified' : 'rejected', req.body?.note, actor);
      return res.json({ ok: true, reviewerId, target, decision });
    }
    if (target === 'beneficial_owner') {
      const recordId = String(req.body?.recordId ?? '').trim();
      if (!/^bor_[A-Za-z0-9-]{8,100}$/.test(recordId)) return res.status(400).json({ error: 'A valid recordId is required.', code: 'VALIDATION_ERROR' });
      await reviewBeneficialOwner(recordId, decision === 'approved' ? 'verified' : 'rejected', req.body?.note, actor);
      return res.json({ ok: true, reviewerId, target, recordId, decision });
    }
    await reviewSponsorPackage(decision, req.body?.note, actor);
    return res.json({ ok: true, reviewerId, target, decision });
  } catch (error) {
    return sponsorError(res, error);
  }
}
