import type { Request, Response } from 'express';
import { SPONSOR_CONTROLS } from '../../../../lib/sponsorReadinessCatalogue.js';
import { getSponsorReadiness } from '../../../../lib/sponsorReadinessStore.js';
import { sponsorError } from '../../../../lib/sponsorReadinessHttp.js';
import { authenticateIndependentSponsorReviewer } from '../../../../lib/independentSponsorReviewer.js';

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export default async function handler(req: Request, res: Response) {
  try {
    const actor = authenticateIndependentSponsorReviewer(req);
    const readiness = await getSponsorReadiness();
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
          submittedAt: iso(item.submittedAt),
        };
      });

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.json({
      ok: true,
      reviewer: { id: actor.id },
      queue: {
        evidence,
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
