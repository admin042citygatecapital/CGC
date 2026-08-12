import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  getSecret: vi.fn(),
  reviewSponsorEvidence: vi.fn(),
  reviewSponsorPackage: vi.fn(),
}));
vi.mock('#runtime/secrets', () => ({ getSecret: dependencies.getSecret }));
vi.mock('../../server/lib/sponsorReadinessStore.js', () => ({
  reviewSponsorEvidence: dependencies.reviewSponsorEvidence,
  reviewSponsorPackage: dependencies.reviewSponsorPackage,
}));
vi.mock('../../server/lib/sponsorReadinessHttp.js', () => ({
  sponsorError: (res: { status: (code: number) => { json: (body: unknown) => unknown } }, error: Error) => res.status(400).json({ error: error.message }),
}));

import handler from '../../server/api/admin/sponsor-readiness/external-review/POST.js';

const key = 'independent-reviewer-test-key';
const keyHash = crypto.createHash('sha256').update(key).digest('hex');

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res); res.json.mockReturnValue(res);
  return res;
}
function request(body: Record<string, unknown>, suppliedKey = key) {
  return { body, headers: { 'x-sponsor-reviewer-key': suppliedKey }, ip: '127.0.0.1' };
}

describe('independent sponsor reviewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getSecret.mockImplementation((name: string) => name === 'SPONSOR_REVIEWER_KEY_HASH' ? keyHash : name === 'SPONSOR_REVIEWER_EMAIL' ? 'reviewer@example.test' : undefined);
    dependencies.reviewSponsorEvidence.mockResolvedValue(undefined);
    dependencies.reviewSponsorPackage.mockResolvedValue(undefined);
  });

  it('reviews submitted evidence without creating a second administrator session', async () => {
    const res = response();
    await handler(request({ target: 'evidence', evidenceId: 'sev_12345678', decision: 'approved', note: 'Independently checked against controlled evidence.' }) as never, res as never);

    expect(dependencies.reviewSponsorEvidence).toHaveBeenCalledWith('sev_12345678', 'approved', expect.any(String), expect.objectContaining({
      id: expect.stringMatching(/^external_checker_/), role: 'COMPLIANCE_ADMIN',
    }));
    expect(dependencies.reviewSponsorPackage).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, target: 'evidence', decision: 'approved' }));
  });

  it('reviews the final package through the same isolated credential', async () => {
    const res = response();
    await handler(request({ target: 'package', decision: 'rejected', note: 'Outstanding external approval evidence remains.' }) as never, res as never);
    expect(dependencies.reviewSponsorPackage).toHaveBeenCalledWith('rejected', expect.any(String), expect.objectContaining({ id: expect.stringMatching(/^external_checker_/) }));
  });

  it('rejects an invalid credential and malformed evidence identifier', async () => {
    const badKey = response();
    await handler(request({ target: 'package', decision: 'approved', note: 'Independent approval.' }, 'wrong-key') as never, badKey as never);
    expect(badKey.status).toHaveBeenCalledWith(403);

    const badId = response();
    await handler(request({ target: 'evidence', evidenceId: '../secret', decision: 'approved', note: 'Independent approval.' }) as never, badId as never);
    expect(badId.status).toHaveBeenCalledWith(400);
    expect(dependencies.reviewSponsorEvidence).not.toHaveBeenCalled();
  });
});
