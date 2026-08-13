import type { Request, Response } from 'express';
import { SPONSOR_CONTROLS } from '../../../../lib/sponsorReadinessCatalogue.js';
import { getSponsorReadiness } from '../../../../lib/sponsorReadinessStore.js';
import { sponsorError } from '../../../../lib/sponsorReadinessHttp.js';
import { authenticateIndependentSponsorReviewer } from '../../../../lib/independentSponsorReviewer.js';
import { getLegalEntityVerification } from '../../../../lib/legalEntityVerificationStore.js';

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export default async function handler(req: Request, res: Response) {
  try {
    const actor = authenticateIndependentSponsorReviewer(req);
    // A reviewer opening the queue must also persist any newly expired
    // evidence and invalidate a previously submitted package before it can be
    // acted on. The reviewer's isolated identity is retained in that audit.
    const [readiness, legal] = await Promise.all([getSponsorReadiness(actor), getLegalEntityVerification(actor)]);
    const controls = new Map(SPONSOR_CONTROLS.map(control => [control.key, control]));
    const evidence = readiness.evidence
      .filter(item => item.effectiveStatus === 'submitted')
      .map(item => {
        const control = controls.get(item.controlKey);
        return {
          id: item.id,
          controlKey: item.controlKey,
          controlTitle: control?.title ?? item.title,
          category: control?.category ?? 'unknown',
          phase: control?.phase ?? null,
          title: item.title,
          status: item.effectiveStatus,
          referenceType: item.referenceType,
          reference: item.reference,
          sha256: item.sha256,
          owner: item.owner,
          issuedAt: iso(item.issuedAt),
          expiresAt: iso(item.expiresAt),
          notes: item.notes,
          revision: item.revision,
          submittedRevision: item.submittedRevision,
          evidenceClass: item.evidenceClass,
          externalIssuer: item.externalIssuer,
          authorityType: item.authorityType,
          receivedAt: iso(item.receivedAt),
          submittedAt: iso(item.submittedAt),
        };
      });

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.json({
      ok: true,
      reviewer: { id: actor.id },
      queue: {
        evidence,
        legalEntity: legal.entity?.effectiveStatus === 'submitted' ? {
          id: legal.entity.id,
          legalName: legal.entity.legalName,
          jurisdiction: legal.entity.jurisdiction,
          registrationNumber: legal.entity.registrationNumber,
          legalForm: legal.entity.legalForm,
          registryUrl: legal.entity.registryUrl,
          registrySha256: legal.entity.registrySha256,
          authorityType: legal.entity.authorityType,
          authorityReference: legal.entity.authorityReference,
          authoritySha256: legal.entity.authoritySha256,
          authorizedOfficerRef: legal.entity.authorizedOfficerRef,
          authorityIssuedAt: iso(legal.entity.authorityIssuedAt),
          authorityExpiresAt: iso(legal.entity.authorityExpiresAt),
          expiresAt: iso(legal.entity.expiresAt),
          submittedAt: iso(legal.entity.submittedAt),
          status: 'submitted',
        } : null,
        beneficialOwners: legal.owners.filter(item => item.effectiveStatus === 'submitted').map(item => ({
          id: item.id,
          controllerRef: item.controllerRef,
          ownershipBand: item.ownershipBand,
          controlNature: item.controlNature,
          providerCode: item.providerCode,
          providerRef: item.providerRef,
          evidenceSha256: item.evidenceSha256,
          expiresAt: iso(item.expiresAt),
          submittedAt: iso(item.submittedAt),
          status: 'submitted',
        })),
        package: {
          id: readiness.package.id,
          version: readiness.package.version,
          status: readiness.package.status,
          label: readiness.package.label,
          submittedAt: iso(readiness.package.submittedAt),
          reviewable: readiness.package.status === 'submitted',
        },
        summary: {
          submittedEvidence: evidence.length,
          submittedStructuredRecords: (legal.entity?.effectiveStatus === 'submitted' ? 1 : 0) + legal.owners.filter(item => item.effectiveStatus === 'submitted').length,
          approvedControls: readiness.summary.approved,
          totalControls: readiness.summary.total,
          outstandingControls: readiness.summary.outstanding,
        },
        gaps: readiness.gaps.map(gap => ({
          key: gap.key,
          title: gap.title,
          status: gap.status,
        })),
      },
      financialOperationsLocked: true,
    });
  } catch (error) {
    return sponsorError(res, error);
  }
}
