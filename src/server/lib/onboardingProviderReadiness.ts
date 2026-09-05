import { getQueryClient, isDatabaseConfigured } from '../db/db.js';
import { approvedOnboardingProviders, providerWebhookSecret } from './onboardingProviderWebhook.js';

export function sumsubConfiguration(environment = process.env) {
  const approved = approvedOnboardingProviders(environment).includes('sumsub');
  const webhookConfigured = providerWebhookSecret('sumsub', environment).length >= 32;
  return {
    approved, webhookConfigured,
    receiverReady: approved && webhookConfigured,
    applicantCreationImplemented: false,
    screeningMappingImplemented: false,
    webhookPath: '/api/providers/onboarding/webhook/sumsub',
    supportedEvents: ['applicantReviewed'],
  };
}

export async function getSumsubReadiness() {
  const configuration = sumsubConfiguration();
  let evidence: { eventCount: number; latestEventAt: string | null; identityEvents: number; screeningEvents: number } | null = null;
  let evidenceStatus: 'available' | 'unavailable' = 'unavailable';
  if (isDatabaseConfigured()) {
    try {
      const rows = await getQueryClient()`
        SELECT count(*)::int AS "eventCount", max(received_at)::text AS "latestEventAt",
          count(*) FILTER (WHERE kind IN ('identity', 'kyb'))::int AS "identityEvents",
          count(*) FILTER (WHERE kind = 'screening')::int AS "screeningEvents"
        FROM onboarding_provider_events WHERE provider_code = 'sumsub'
      `;
      if (rows[0]) {
        evidence = {
          eventCount: Number(rows[0].eventCount), latestEventAt: rows[0].latestEventAt,
          identityEvents: Number(rows[0].identityEvents), screeningEvents: Number(rows[0].screeningEvents),
        };
        evidenceStatus = 'available';
      }
    } catch { /* A failed evidence query must never appear as zero events. */ }
  }
  return {
    ...configuration, evidenceStatus, evidence,
    status: !configuration.receiverReady ? 'not_configured' : evidenceStatus === 'unavailable' ? 'unknown' : 'incomplete',
    message: 'Signed identity/KYB results are supported. Applicant creation and explicit AML screening integration remain incomplete. A GREEN identity result does not establish sanctions, PEP or adverse-media clearance.',
  };
}
