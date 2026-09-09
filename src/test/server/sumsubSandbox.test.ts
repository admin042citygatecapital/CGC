import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../server/db/db.js', () => ({ getQueryClient: () => database.query, isDatabaseConfigured: () => true }));
import { createSandboxTest, parseSandboxEvent, receiveSandboxEvent, sandboxConfiguration, sandboxRequest, signSumsubRequest, validateSandboxApplicant, validateSandboxLink } from '../../server/lib/sumsubSandbox.js';
import { mapSumsubWebhookPayload } from '../../server/lib/onboardingProviderWebhook.js';

const configuration = {
  SUMSUB_MODE: 'sandbox', APPROVED_ONBOARDING_PROVIDERS: 'sumsub',
  SUMSUB_SANDBOX_APP_TOKEN: 'sandbox-test-token', SUMSUB_SANDBOX_SECRET_KEY: 'sandbox-test-signing-key',
  SUMSUB_SANDBOX_LEVEL_NAME: 'basic test+level', SUMSUB_SANDBOX_WEBHOOK_SECRET: 'sandbox-webhook-secret-for-tests',
};
const requestId = '01234567-89ab-4def-8123-456789abcdef';
const externalUserId = `sbx_${requestId.replaceAll('-', '')}`;
const applicantId = '5cb56e8e0a975a35f333cb83';
const event = { sandboxMode: true, externalUserId, applicantId, type: 'applicantReviewed', reviewStatus: 'completed',
  createdAtMs: '2026-01-01 12:00:00.001', reviewResult: { reviewAnswer: 'GREEN' } };
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

beforeEach(() => {
  database.query.mockReset();
  for (const [name, value] of Object.entries(configuration)) vi.stubEnv(name, value);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('isolated Sumsub sandbox', () => {
  it('requires sandbox mode and dedicated credentials instead of production credentials', () => {
    expect(sandboxConfiguration(configuration).ready).toBe(true);
    expect(sandboxConfiguration({ ...configuration, SUMSUB_MODE: 'live' }).ready).toBe(false);
    expect(sandboxConfiguration({ SUMSUB_MODE: 'sandbox', SUMSUB_APP_TOKEN: 'production-token' }).ready).toBe(false);
  });
  it('signs the exact encoded URI and transmitted JSON bytes', async () => {
    const mockedFetch = vi.fn().mockResolvedValue(reply({ ok: true }));
    vi.stubGlobal('fetch', mockedFetch);
    const path = '/resources/applicants?levelName=basic%20test%2Blevel';
    await sandboxRequest('POST', path, { externalUserId });
    const [url, options] = mockedFetch.mock.calls[0];
    expect(url).toBe(`https://api.sumsub.com${path}`);
    expect(options.redirect).toBe('error');
    const headers = options.headers;
    expect(headers['X-App-Access-Sig']).toBe(crypto.createHmac('sha256', configuration.SUMSUB_SANDBOX_SECRET_KEY)
      .update(headers['X-App-Access-Ts'] + 'POST' + path + options.body).digest('hex'));
    expect(signSumsubRequest('1', 'GET', '/test', '', 'key')).not.toBe(signSumsubRequest('1', 'POST', '/test', '', 'key'));
  });
  it('recovers an existing applicant after an interrupted create without creating another', async () => {
    database.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ applicant_id: null, created_by: 'admin' }]).mockResolvedValueOnce([]);
    const mockedFetch = vi.fn().mockResolvedValueOnce(reply({ id: applicantId, externalUserId, sandboxMode: true }))
      .mockResolvedValueOnce(reply({ url: 'https://api.sumsub.com/idensic/l/test' }));
    vi.stubGlobal('fetch', mockedFetch);
    await expect(createSandboxTest(requestId, 'admin')).resolves.toMatchObject({ externalUserId, applicantId, mode: 'sandbox' });
    expect(mockedFetch.mock.calls[0][1].method).toBe('GET');
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });
  it('creates a new synthetic applicant only after a provider 404', async () => {
    database.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ applicant_id: null, created_by: 'admin' }]).mockResolvedValueOnce([]);
    const mockedFetch = vi.fn().mockResolvedValueOnce(reply({}, 404))
      .mockResolvedValueOnce(reply({ id: applicantId, externalUserId, sandboxMode: true }))
      .mockResolvedValueOnce(reply({ url: 'https://api.sumsub.com/idensic/l/test' }));
    vi.stubGlobal('fetch', mockedFetch);
    await createSandboxTest(requestId, 'admin');
    expect(JSON.parse(mockedFetch.mock.calls[1][1].body)).toEqual({ externalUserId, type: 'individual' });
    expect(mockedFetch.mock.calls[1][0]).toContain('levelName=basic%20test%2Blevel');
  });
  it('sanitizes provider errors instead of returning provider bodies or secrets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ description: 'private-data-secret' }, 401)));
    await expect(sandboxRequest('GET', '/resources/applicants/test/one')).rejects.toMatchObject({ code: 'SUMSUB_HTTP_401' });
    await expect(sandboxRequest('GET', '/resources/applicants/test/one')).rejects.not.toThrow('private-data-secret');
  });
  it('rejects a production or mismatched applicant and untrusted link destinations', () => {
    expect(() => validateSandboxApplicant({ id: applicantId, externalUserId, sandboxMode: false }, externalUserId)).toThrow();
    expect(() => validateSandboxApplicant({ id: applicantId, externalUserId: 'other', sandboxMode: true }, externalUserId)).toThrow();
    for (const link of ['javascript:alert(1)', 'https://sumsub.com.evil.test/a', 'https://user:password@api.sumsub.com/a', 'http://api.sumsub.com/a']) expect(() => validateSandboxLink(link)).toThrow();
  });
  it('rejects sandbox evidence on the production mapper even when sandbox mode is enabled', () => {
    expect(() => mapSumsubWebhookPayload({ ...event, externalUserId: 'oc_0123456789abcdef0123' }, { SUMSUB_MODE: 'sandbox' })).toThrow(expect.objectContaining({ code: 'NON_PRODUCTION_PROVIDER_EVENT' }));
  });
  it('requires explicitly sandbox events, synthetic references and a valid provider timestamp', () => {
    expect(parseSandboxEvent(event)).toMatchObject({ status: 'accepted', occurredAt: '2026-01-01T12:00:00.001Z' });
    expect(parseSandboxEvent({ ...event, reviewResult: { reviewAnswer: 'RED', reviewRejectType: 'RETRY' } })).toMatchObject({ status: 'review' });
    expect(parseSandboxEvent({ ...event, reviewResult: { reviewAnswer: 'RED', reviewRejectType: 'FINAL' } })).toMatchObject({ status: 'rejected' });
    for (const patch of [{ sandboxMode: false }, { sandboxMode: undefined }, { externalUserId: 'oc_0123456789abcdef0123' }, { createdAtMs: '' }]) expect(() => parseSandboxEvent({ ...event, ...patch })).toThrow();
    expect(parseSandboxEvent({ ...event, type: 'applicantPending' })).toBeNull();
  });
  it('rejects a tampered signature before accessing storage', async () => {
    const raw = Buffer.from(JSON.stringify(event));
    await expect(receiveSandboxEvent(raw, '0'.repeat(64), 'HMAC_SHA256_HEX')).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
    expect(database.query).not.toHaveBeenCalled();
  });
  it('requires the persisted applicant mapping and deduplicates signed deliveries', async () => {
    const raw = Buffer.from(JSON.stringify(event));
    const signature = crypto.createHmac('sha256', configuration.SUMSUB_SANDBOX_WEBHOOK_SECRET).update(raw).digest('hex');
    database.query.mockResolvedValueOnce([{ applicant_id: 'other' }]);
    await expect(receiveSandboxEvent(raw, signature, 'HMAC_SHA256_HEX')).rejects.toMatchObject({ code: 'SANDBOX_APPLICANT_UNMATCHED' });
    database.query.mockResolvedValueOnce([{ applicant_id: applicantId }]).mockResolvedValueOnce([{ payload_sha256: 'digest' }]);
    await expect(receiveSandboxEvent(raw, signature, 'HMAC_SHA256_HEX')).resolves.toMatchObject({ duplicate: false, financialActivationEffect: 'NONE' });
    database.query.mockResolvedValueOnce([{ applicant_id: applicantId }]).mockResolvedValueOnce([]);
    await expect(receiveSandboxEvent(raw, signature, 'HMAC_SHA256_HEX')).resolves.toMatchObject({ duplicate: true });
    const sql = database.query.mock.calls.map(call => call[0].join('')).join('\n');
    expect(sql).toContain('ON CONFLICT (payload_sha256) DO NOTHING');
    expect(sql).not.toMatch(/\b(onboarding_evidence|onboarding_provider_events|users|onboarding_cases)\b/);
  });
});
