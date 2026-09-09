import { getQueryClient, isDatabaseConfigured } from '../db/db.js';
import { approvedOnboardingProviders } from './onboardingProviderWebhook.js';
import { sandboxConfiguration, SANDBOX_WEBHOOK_PATH } from './sumsubSandbox.js';

const MIN_PROVIDER_WEBHOOK_SECRET_LENGTH = 16;

export function sumsubConfiguration(environment = process.env) {
  const approved = approvedOnboardingProviders(environment).includes('sumsub');
  const webhookConfigured = String(environment.SUMSUB_SANDBOX_WEBHOOK_SECRET ?? '').trim().length >= MIN_PROVIDER_WEBHOOK_SECRET_LENGTH;
  const sandbox = sandboxConfiguration(environment);
  return {
    approved, webhookConfigured,
    receiverReady: sandbox.ready,
    applicantCreationImplemented: true,
    missing: sandbox.missing,
    scope: 'sandbox_kyc_only',
    amlInScope: false,
    liveFinancialActivityInScope: false,
    webhookPath: SANDBOX_WEBHOOK_PATH,
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
          count(*)::int AS "identityEvents", 0::int AS "screeningEvents"
        FROM sumsub_sandbox_events
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
    status: !configuration.receiverReady ? 'not_configured' : evidenceStatus === 'unavailable' ? 'unknown' : evidence && evidence.eventCount > 0 ? 'ready' : 'awaiting_test',
    message: !configuration.receiverReady ? `Sandbox configuration required: ${configuration.missing.join(', ')}`
      : evidenceStatus === 'unavailable' ? 'Sandbox storage unavailable. Apply migration 0057 and check database connectivity.'
      : evidence && evidence.eventCount > 0 ? 'A signed result has been recorded for a mapped sandbox applicant. Customer approval, AML clearance and financial activity remain separate.'
      : 'Sandbox applicant creation and isolated receiver are configured. Create a sandbox test and complete verification to record a signed result.',
  };
}
