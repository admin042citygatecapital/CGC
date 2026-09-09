import crypto from 'node:crypto';
import { getQueryClient } from '../db/db.js';
import { approvedOnboardingProviders, OnboardingProviderError, verifySumsubSandboxWebhook } from './onboardingProviderWebhook.js';

export const SANDBOX_WEBHOOK_PATH = '/api/providers/onboarding/webhook/sumsub-sandbox';

export function sandboxConfiguration(environment = process.env) {
  const missing = ['SUMSUB_SANDBOX_APP_TOKEN', 'SUMSUB_SANDBOX_SECRET_KEY', 'SUMSUB_SANDBOX_LEVEL_NAME', 'SUMSUB_SANDBOX_WEBHOOK_SECRET']
    .filter(key => !environment[key]?.trim());
  if (environment.SUMSUB_MODE !== 'sandbox') missing.push('SUMSUB_MODE=sandbox');
  if (!approvedOnboardingProviders(environment).includes('sumsub')) missing.push('APPROVED_ONBOARDING_PROVIDERS=sumsub');
  if (environment.SUMSUB_SANDBOX_WEBHOOK_SECRET && environment.SUMSUB_SANDBOX_WEBHOOK_SECRET.trim().length < 16) missing.push('SUMSUB_SANDBOX_WEBHOOK_SECRET (minimum 16 characters)');
  return { ready: missing.length === 0, missing, webhookPath: SANDBOX_WEBHOOK_PATH };
}

function assertSandbox(environment = process.env) {
  const configuration = sandboxConfiguration(environment);
  if (!configuration.ready) throw new OnboardingProviderError(`Sandbox configuration required: ${configuration.missing.join(', ')}`, 'SANDBOX_NOT_CONFIGURED', 503);
}

export function signSumsubRequest(timestamp: string, method: string, path: string, body: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(timestamp + method + path + body).digest('hex');
}

export async function sandboxRequest(method: 'GET' | 'POST', path: string, payload?: Record<string, unknown>) {
  assertSandbox();
  const body = payload ? JSON.stringify(payload) : '';
  const timestamp = String(Math.floor(Date.now() / 1000));
  let response: globalThis.Response;
  try {
    response = await fetch(`https://api.sumsub.com${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: {
        'Content-Type': 'application/json',
        'X-App-Token': process.env.SUMSUB_SANDBOX_APP_TOKEN!.trim(),
        'X-App-Access-Ts': timestamp,
        'X-App-Access-Sig': signSumsubRequest(timestamp, method, path, body, process.env.SUMSUB_SANDBOX_SECRET_KEY!.trim()),
      },
      ...(body ? { body } : {}),
    });
  } catch {
    throw new OnboardingProviderError('Sumsub could not be reached. Retry this test to recover the same applicant.', 'SUMSUB_UNAVAILABLE', 502);
  }
  if (!response.ok) throw new OnboardingProviderError(`Sumsub request failed (HTTP ${response.status}). Check sandbox credentials, permissions and verification level.`, `SUMSUB_HTTP_${response.status}`, 502);
  try { return await response.json() as Record<string, unknown>; }
  catch { throw new OnboardingProviderError('Sumsub returned an invalid response.', 'SUMSUB_INVALID_RESPONSE', 502); }
}

export function validateSandboxApplicant(value: Record<string, unknown>, externalUserId: string): string {
  if (value.sandboxMode !== true || value.externalUserId !== externalUserId || !/^[a-f0-9]{24}$/.test(String(value.id ?? ''))) {
    throw new OnboardingProviderError('Applicant must be a sandbox applicant matching this test reference.', 'SANDBOX_APPLICANT_MISMATCH', 502);
  }
  return String(value.id);
}

export function validateSandboxLink(value: unknown): string {
  let url: URL;
  try { url = new URL(String(value)); } catch { throw new OnboardingProviderError('Invalid verification link.', 'SUMSUB_INVALID_LINK', 502); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !(url.hostname === 'sumsub.com' || url.hostname.endsWith('.sumsub.com'))) {
    throw new OnboardingProviderError('Unexpected verification link destination.', 'SUMSUB_INVALID_LINK', 502);
  }
  return url.href;
}

export async function createSandboxTest(requestId: string, adminId: string) {
  assertSandbox();
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(requestId)) {
    throw new OnboardingProviderError('A UUID requestId is required.', 'INVALID_REQUEST_ID');
  }
  const externalUserId = `sbx_${requestId.replaceAll('-', '')}`;
  const sql = getQueryClient();
  // Reserve before contacting Sumsub. Repeated requests recover the same external ID.
  await sql`INSERT INTO sumsub_sandbox_applicants (external_user_id, created_by) VALUES (${externalUserId}, ${adminId}) ON CONFLICT DO NOTHING`;
  const [record] = await sql`SELECT applicant_id, created_by FROM sumsub_sandbox_applicants WHERE external_user_id = ${externalUserId}`;
  if (!record || record.created_by !== adminId) throw new OnboardingProviderError('Test reference is owned by another administrator.', 'SANDBOX_TEST_CONFLICT', 409);
  let applicantId = record.applicant_id as string | null;
  if (!applicantId) {
    const lookup = `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`;
    let applicant: Record<string, unknown>;
    try { applicant = await sandboxRequest('GET', lookup); }
    catch (error) {
      if (!(error instanceof OnboardingProviderError) || error.code !== 'SUMSUB_HTTP_404') throw error;
      try {
        applicant = await sandboxRequest('POST', `/resources/applicants?levelName=${encodeURIComponent(process.env.SUMSUB_SANDBOX_LEVEL_NAME!.trim())}`, { externalUserId, type: 'individual' });
      } catch (createError) {
        if (!(createError instanceof OnboardingProviderError) || createError.code !== 'SUMSUB_HTTP_409') throw createError;
        applicant = await sandboxRequest('GET', lookup);
      }
    }
    applicantId = validateSandboxApplicant(applicant, externalUserId);
    await sql`UPDATE sumsub_sandbox_applicants SET applicant_id = ${applicantId} WHERE external_user_id = ${externalUserId} AND (applicant_id IS NULL OR applicant_id = ${applicantId})`;
  }
  const link = await sandboxRequest('POST', '/resources/sdkIntegrations/levels/-/websdkLink', {
    levelName: process.env.SUMSUB_SANDBOX_LEVEL_NAME!.trim(), userId: externalUserId, ttlInSecs: 1800,
  });
  return { externalUserId, applicantId, verificationUrl: validateSandboxLink(link.url), expiresAt: new Date(Date.now() + 1800_000).toISOString(), mode: 'sandbox' };
}

export function parseSandboxEvent(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new OnboardingProviderError('Invalid sandbox payload.', 'INVALID_PAYLOAD');
  const value = input as Record<string, unknown>;
  if (value.sandboxMode !== true) throw new OnboardingProviderError('This receiver accepts explicitly marked sandbox events only.', 'SANDBOX_EVENT_REQUIRED', 422);
  const externalUserId = String(value.externalUserId ?? '');
  const applicantId = String(value.applicantId ?? '');
  if (!/^sbx_[a-f0-9]{32}$/.test(externalUserId) || !/^[a-f0-9]{24}$/.test(applicantId)) throw new OnboardingProviderError('Unknown sandbox test reference.', 'INVALID_SANDBOX_REFERENCE', 422);
  if (value.type !== 'applicantReviewed' || value.reviewStatus !== 'completed') return null;
  const result = value.reviewResult as Record<string, unknown> | undefined;
  if (!result || !['GREEN', 'RED'].includes(String(result.reviewAnswer))) throw new OnboardingProviderError('Completed review result is required.', 'INVALID_REVIEW_RESULT', 422);
  // Sumsub timestamps are UTC, including the space-separated createdAtMs format.
  const rawTime = String(value.createdAtMs ?? value.createdAt ?? '');
  const normalizedTime = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(rawTime) ? rawTime.replace(' ', 'T') + 'Z' : rawTime;
  const time = /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(normalizedTime) ? Date.parse(normalizedTime) : NaN;
  if (!Number.isFinite(time) || time > Date.now() + 60_000) throw new OnboardingProviderError('Valid provider event time is required.', 'INVALID_EVENT_TIME', 422);
  return { externalUserId, applicantId, occurredAt: new Date(time).toISOString(), status: result.reviewAnswer === 'GREEN' ? 'accepted' : result.reviewRejectType === 'RETRY' ? 'review' : 'rejected' };
}

export async function receiveSandboxEvent(rawBody: Buffer, signature: string, algorithm: string) {
  assertSandbox();
  verifySumsubSandboxWebhook({ rawBody, signature, algorithm, secret: process.env.SUMSUB_SANDBOX_WEBHOOK_SECRET!.trim() });
  let input: unknown;
  try { input = JSON.parse(rawBody.toString('utf8')); } catch { throw new OnboardingProviderError('Invalid JSON.', 'INVALID_PAYLOAD'); }
  const event = parseSandboxEvent(input);
  if (!event) return { ignored: true, mode: 'sandbox' };
  const sql = getQueryClient();
  const [applicant] = await sql`SELECT applicant_id FROM sumsub_sandbox_applicants WHERE external_user_id = ${event.externalUserId}`;
  if (!applicant?.applicant_id || applicant.applicant_id !== event.applicantId) throw new OnboardingProviderError('Sandbox applicant mapping is not ready or does not match.', 'SANDBOX_APPLICANT_UNMATCHED', 409);
  const digest = crypto.createHash('sha256').update(rawBody).digest('hex');
  const rows = await sql`INSERT INTO sumsub_sandbox_events (payload_sha256, external_user_id, applicant_id, status, occurred_at)
    VALUES (${digest}, ${event.externalUserId}, ${event.applicantId}, ${event.status}, ${event.occurredAt})
    ON CONFLICT (payload_sha256) DO NOTHING RETURNING payload_sha256`;
  return { ok: true, duplicate: rows.length === 0, mode: 'sandbox', financialActivationEffect: 'NONE' };
}

export async function listSandboxTests(adminId: string) {
  return getQueryClient()`SELECT a.external_user_id AS "externalUserId", a.applicant_id AS "applicantId", a.created_at AS "createdAt",
    e.status, e.occurred_at AS "reviewedAt", (a.created_by = ${adminId}) AS "canRetry" FROM sumsub_sandbox_applicants a
    LEFT JOIN LATERAL (SELECT status, occurred_at FROM sumsub_sandbox_events WHERE external_user_id = a.external_user_id ORDER BY occurred_at DESC, received_at DESC LIMIT 1) e ON true
    ORDER BY a.created_at DESC LIMIT 20`;
}
