import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { AdminRole } from '../../server/lib/sessionStore.js';
import * as subscriberStore from '../../server/lib/subscriberStore.js';
import { authorizeAdminPermission, authorizeAdminRole } from '../../server/lib/rbacMiddleware.js';
import createUser from '../../server/api/admin/users/create/POST.js';
import editUser from '../../server/api/admin/users/edit/POST.js';
import overrideUser from '../../server/api/admin/users/override/POST.js';
import flushEmailQueue from '../../server/api/admin/email/flush/POST.js';
import requeueEmailQueue from '../../server/api/admin/email/requeue/POST.js';
import getEmailStatus from '../../server/api/admin/email/status/GET.js';
import updateLinks from '../../server/api/admin/links/POST.js';
import sendNewsletterSequence from '../../server/api/newsletter/send-sequence/POST.js';
import getNewsletterSubscribers from '../../server/api/newsletter/subscribers/GET.js';

function request(role?: AdminRole, body: Record<string, unknown> = {}): Request {
  return {
    body,
    ip: '127.0.0.1',
    protocol: 'https',
    hostname: 'example.test',
    adminSession: role ? {
      adminId: 'admin-test',
      email: 'admin@example.test',
      role,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      ip: '127.0.0.1',
      ua: 'vitest',
    } : undefined,
  } as Request;
}

function responseMock() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { response: { status, json } as unknown as Response, status, json };
}

const superAdminHandlers = [
  ['customer create', createUser],
  ['customer edit', editUser],
  ['customer override', overrideUser],
  ['email queue flush', flushEmailQueue],
  ['email queue requeue', requeueEmailQueue],
  ['email status', getEmailStatus],
  ['external-link mutation', updateLinks],
] as const;

describe('high-risk administration route authorization', () => {
  it.each(superAdminHandlers)('returns 401 for unauthenticated %s requests', async (_name, handler) => {
    const response = responseMock();
    await handler(request(), response.response);
    expect(response.status).toHaveBeenCalledWith(401);
  });

  it.each(superAdminHandlers)('returns 403 for non-super-admin %s requests', async (_name, handler) => {
    const response = responseMock();
    await handler(request('SUPPORT_ADMIN'), response.response);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ADMIN_ROLE_REQUIRED' }));
  });

  it('allows a SUPER_ADMIN through the high-risk role boundary', () => {
    const response = responseMock();
    expect(authorizeAdminRole(request('SUPER_ADMIN'), response.response, 'SUPER_ADMIN')).toBe(true);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('does not let a SUPPORT_ADMIN reach customer creation despite users.edit permission', async () => {
    const response = responseMock();
    await createUser(request('SUPPORT_ADMIN', {
      name: 'Blocked Customer',
      email: 'blocked@example.test',
      password: 'NotUsedBecauseAuthorizationRunsFirst!1',
    }), response.response);
    expect(response.status).toHaveBeenCalledWith(403);
  });

  it.each([
    ['customer create', createUser],
    ['customer edit', editUser],
    ['customer override', overrideUser],
  ] as const)('does not let an OPERATIONS_ADMIN reach %s despite users.edit permission', async (_name, handler) => {
    const response = responseMock();
    await handler(request('OPERATIONS_ADMIN'), response.response);
    expect(response.status).toHaveBeenCalledWith(403);
  });

  it('does not let an AUDITOR mutate external links through dashboard.view', async () => {
    const response = responseMock();
    await updateLinks(request('AUDITOR', { links: [] }), response.response);
    expect(response.status).toHaveBeenCalledWith(403);
  });

  it('lets a SUPER_ADMIN reach customer-create validation without executing a write', async () => {
    const response = responseMock();
    await createUser(request('SUPER_ADMIN'), response.response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.status).not.toHaveBeenCalledWith(401);
    expect(response.status).not.toHaveBeenCalledWith(403);
  });
});

describe('newsletter sequence permission boundary', () => {
  it('returns 401 without an administrator session', async () => {
    const response = responseMock();
    await sendNewsletterSequence(request(), response.response);
    expect(response.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 for a read-only AUDITOR', async () => {
    const response = responseMock();
    await sendNewsletterSequence(request('AUDITOR'), response.response);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'ADMIN_PERMISSION_REQUIRED',
      permission: 'email.send',
    }));
  });

  it('allows a SUPPORT_ADMIN with the canonical email.send permission', async () => {
    const response = responseMock();
    expect(await authorizeAdminPermission(request('SUPPORT_ADMIN'), response.response, 'email.send')).toBe(true);
    expect(response.status).not.toHaveBeenCalled();
  });
});

describe('newsletter subscriber PII permission boundary', () => {
  it('returns 401 without an administrator session', async () => {
    const response = responseMock();
    await getNewsletterSubscribers(request(), response.response);
    expect(response.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 before loading subscriber PII when email.view is absent', async () => {
    const getAllSubscribers = vi.spyOn(subscriberStore, 'getAllSubscribers');
    const response = responseMock();
    await getNewsletterSubscribers(request('FINANCE_ADMIN'), response.response);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'ADMIN_PERMISSION_REQUIRED',
      permission: 'email.view',
    }));
    expect(getAllSubscribers).not.toHaveBeenCalled();
    getAllSubscribers.mockRestore();
  });

  it('allows a SUPPORT_ADMIN with the canonical email.view permission', async () => {
    const response = responseMock();
    expect(await authorizeAdminPermission(request('SUPPORT_ADMIN'), response.response, 'email.view')).toBe(true);
    expect(response.status).not.toHaveBeenCalled();
  });
});
