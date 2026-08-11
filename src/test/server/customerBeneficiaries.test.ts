import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  updateUser: vi.fn(),
  verifyCustomerStepUp: vi.fn(),
  appendAudit: vi.fn(),
}));

vi.mock('../../server/lib/userStore.js', () => ({ updateUser: dependencies.updateUser }));
vi.mock('../../server/lib/customerStepUp.js', () => ({ verifyCustomerStepUp: dependencies.verifyCustomerStepUp }));
vi.mock('../../server/lib/auditLog.js', () => ({ appendAudit: dependencies.appendAudit }));

import addBeneficiary from '../../server/api/users/beneficiaries/add/POST.js';
import deleteBeneficiary from '../../server/api/users/beneficiaries/delete/POST.js';
import { loadBeneficiaries } from '../../server/api/users/beneficiaries/GET.js';

function responseDouble() {
  const result = { status: 200, body: undefined as unknown };
  const res = {
    status(code: number) { result.status = code; return res; },
    json(body: unknown) { result.body = body; return res; },
  } as unknown as Response;
  return { res, result };
}

const user = {
  id: 'user-1', email: 'customer@example.com', passwordHash: 'hash', beneficiaries: [],
};

beforeEach(() => {
  dependencies.updateUser.mockReset().mockResolvedValue(undefined);
  dependencies.verifyCustomerStepUp.mockReset().mockResolvedValue({ ok: true });
  dependencies.appendAudit.mockReset();
});

describe('customer beneficiary controls', () => {
  it('requires an authenticated customer', async () => {
    const response = responseDouble();
    await addBeneficiary({ body: {} } as Request, response.res);
    expect(response.result.status).toBe(401);
    expect(dependencies.updateUser).not.toHaveBeenCalled();
  });

  it('blocks mutation when step-up verification fails', async () => {
    dependencies.verifyCustomerStepUp.mockResolvedValue({ ok: false, status: 401, error: 'Security verification failed.', code: 'INVALID_PASSWORD' });
    const response = responseDouble();
    await addBeneficiary({ customerUser: user, body: {} } as unknown as Request, response.res);
    expect(response.result.status).toBe(401);
    expect(dependencies.updateUser).not.toHaveBeenCalled();
  });

  it('stores only the authenticated customer beneficiary collection and audits creation', async () => {
    const response = responseDouble();
    const req = {
      customerUser: user,
      ip: '127.0.0.1',
      body: { name: 'A Person', accountNumber: '12345678', bankName: 'A Bank', country: 'GB', currency: 'GBP', currentPassword: 'not-logged' },
    } as unknown as Request;
    await addBeneficiary(req, response.res);
    expect(response.result.status).toBe(201);
    expect(dependencies.updateUser).toHaveBeenCalledWith('user-1', expect.objectContaining({ beneficiaries: [expect.objectContaining({ name: 'A Person', verificationState: 'unverified' })] }));
    expect(dependencies.appendAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'customer_beneficiary_created', userId: 'user-1' }));
    expect(JSON.stringify(dependencies.appendAudit.mock.calls)).not.toContain('not-logged');
  });

  it('returns 404 and preserves storage for an unknown beneficiary', async () => {
    const response = responseDouble();
    const existing = { id: 'bene_1', name: 'Existing', type: 'individual', accountNumber: '1234', bankName: 'Bank', country: 'GB', currency: 'GBP', favorite: false, verificationState: 'unverified', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
    await deleteBeneficiary({ customerUser: { ...user, beneficiaries: [existing] }, body: { id: 'foreign-id' } } as unknown as Request, response.res);
    expect(response.result.status).toBe(404);
    expect(dependencies.updateUser).not.toHaveBeenCalled();
  });

  it('normalizes legacy rows without inventing provider verification', () => {
    const rows = loadBeneficiaries([{ id: 'bene_1', name: 'Existing', accountNumber: '1234', bankName: 'Bank', country: 'GB', currency: 'GBP', createdAt: '2026-01-01T00:00:00.000Z' }]);
    expect(rows[0]).toMatchObject({ favorite: false, verificationState: 'unverified', type: 'individual' });
  });
});
