import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { getSecret } from '#runtime/secrets';
import { reviewSponsorEvidence, reviewSponsorPackage } from '../../../../lib/sponsorReadinessStore.js';
import { sponsorError } from '../../../../lib/sponsorReadinessHttp.js';

function safeEqualHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export default async function handler(req: Request, res: Response) {
  try {
    const configuredHash = String(getSecret('SPONSOR_REVIEWER_KEY_HASH') ?? '').trim().toLowerCase();
    const reviewerEmail = String(getSecret('SPONSOR_REVIEWER_EMAIL') ?? '').trim().toLowerCase();
    const providedKey = String(req.headers['x-sponsor-reviewer-key'] ?? '');
    const providedHash = crypto.createHash('sha256').update(providedKey).digest('hex');
    if (!configuredHash || !reviewerEmail || !providedKey || !safeEqualHex(configuredHash, providedHash)) {
      return res.status(403).json({ error: 'Independent reviewer authentication failed.', code: 'REVIEWER_AUTH_FAILED' });
    }
    const decision = req.body?.decision;
    if (decision !== 'approved' && decision !== 'rejected') {
      return res.status(400).json({ error: 'decision must be approved or rejected', code: 'VALIDATION_ERROR' });
    }
    const reviewerId = `external_checker_${crypto.createHash('sha256').update(reviewerEmail).digest('hex').slice(0, 16)}`;
    const actor = {
      id: reviewerId,
      email: reviewerEmail,
      role: 'COMPLIANCE_ADMIN',
      ip: req.ip ?? 'unknown',
    } as const;
    const requestedTarget = req.body?.target ?? 'package';
    if (requestedTarget !== 'evidence' && requestedTarget !== 'package') {
      return res.status(400).json({ error: 'target must be evidence or package', code: 'VALIDATION_ERROR' });
    }
    const target = requestedTarget;
    if (target === 'evidence') {
      const evidenceId = String(req.body?.evidenceId ?? '').trim();
      if (!/^sev_[A-Za-z0-9-]{8,100}$/.test(evidenceId)) {
        return res.status(400).json({ error: 'A valid evidenceId is required.', code: 'VALIDATION_ERROR' });
      }
      await reviewSponsorEvidence(evidenceId, decision, req.body?.note, actor);
      return res.json({ ok: true, reviewerId, target, evidenceId, decision });
    }
    await reviewSponsorPackage(decision, req.body?.note, actor);
    return res.json({ ok: true, reviewerId, target, decision });
  } catch (error) {
    return sponsorError(res, error);
  }
}
