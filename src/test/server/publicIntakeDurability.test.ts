import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({ createOperationsItem: vi.fn() }));
vi.mock('../../server/lib/operationsInboxStore.js', () => ({
  createOperationsItem: dependencies.createOperationsItem,
  listOperationsItems: vi.fn(),
}));
vi.mock('../../server/lib/operationalControls.js', () => ({ requireIntakeEnabled: () => true }));

function response() {
  const result = { statusCode: 200, body: undefined as unknown };
  const res = {
    status(code: number) { result.statusCode = code; return this; },
    json(body: unknown) { result.body = body; return this; },
  } as unknown as Response;
  return { result, res };
}

beforeEach(() => dependencies.createOperationsItem.mockReset().mockResolvedValue({ id: 'op_1' }));

describe('durable public intake', () => {
  it('does not acknowledge a contact submission when persistence fails', async () => {
    dependencies.createOperationsItem.mockRejectedValueOnce(new Error('database unavailable'));
    const { default: handler } = await import('../../server/api/contact/POST.js');
    const { result, res } = response();
    await handler({ body: { firstName: 'Ada', lastName: 'Cole', email: 'ada@example.test', subject: 'Account help', message: 'Please contact me about my account.' }, ip: '127.0.0.1' } as Request, res);
    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({ error: 'We could not submit your message. Please try again.' });
  });

  it('persists a data-minimised contact record in the operations inbox', async () => {
    const { default: handler } = await import('../../server/api/contact/POST.js');
    const { result, res } = response();
    await handler({ body: { firstName: 'Ada', lastName: 'Cole', email: 'ADA@example.test', company: 'CGC', subject: 'Account help', message: 'Please contact me about my account.' }, ip: '127.0.0.1' } as Request, res);
    expect(result.statusCode).toBe(201);
    expect(dependencies.createOperationsItem).toHaveBeenCalledWith(expect.objectContaining({
      source: 'contact_form', requesterEmail: 'ada@example.test', metadata: expect.objectContaining({ company: 'CGC' }),
    }));
  });

  it('rejects identity, tax, credential, and document data from general applications', async () => {
    const { default: handler } = await import('../../server/api/accounts/apply/POST.js');
    const { result, res } = response();
    await handler({ body: { firstName: 'Ada', lastName: 'Cole', email: 'ada@example.test', phone: '+44123456789', accountType: 'personal', govIdNumber: 'sensitive' } } as Request, res);
    expect(result.statusCode).toBe(400);
    expect(dependencies.createOperationsItem).not.toHaveBeenCalled();
  });

  it('has no direct production flat-file intake path', () => {
    const contact = fs.readFileSync(path.resolve(process.cwd(), 'src/server/api/contact/POST.ts'), 'utf8');
    const application = fs.readFileSync(path.resolve(process.cwd(), 'src/server/api/accounts/apply/POST.ts'), 'utf8');
    const contactsAdmin = fs.readFileSync(path.resolve(process.cwd(), 'src/server/api/admin/contacts/GET.ts'), 'utf8');
    const operations = fs.readFileSync(path.resolve(process.cwd(), 'src/server/lib/operationsInboxStore.ts'), 'utf8');
    for (const source of [contact, application, contactsAdmin]) {
      expect(source).not.toContain('appendFileSync');
      expect(source).not.toContain('privateSubdirectory');
    }
    expect(contactsAdmin).toContain('await listOperationsItems');
    expect(operations).toContain("process.env.NODE_ENV === 'production'");
    expect(operations).toContain('OPERATIONS_DATABASE_UNAVAILABLE');
  });
});
