import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let root = '';

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-operations-'));
  process.env.PRIVATE_DATA_ROOT = root;
  vi.resetModules();
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.PRIVATE_DATA_ROOT;
});

describe('operations inbox store', () => {
  it('creates, deduplicates, filters, and updates submissions with history', async () => {
    const store = await import('../../server/lib/operationsInboxStore.js');
    const created = store.createOperationsItem({
      source: 'contact_form', referenceId: 'contact-1', title: 'Help needed',
      summary: 'Please contact me', requesterEmail: 'customer@example.test',
    });
    const duplicate = store.createOperationsItem({
      source: 'contact_form', referenceId: 'contact-1', title: 'Duplicate', summary: 'Duplicate',
    });
    expect(duplicate.id).toBe(created.id);
    expect(store.listOperationsItems({ search: 'customer@example.test' }).total).toBe(1);

    const updated = store.updateOperationsItem(created.id, {
      status: 'in_review', priority: 'urgent', assignedTo: 'Compliance', note: 'Identity review required',
    }, 'admin@example.test');
    expect(updated?.status).toBe('in_review');
    expect(updated?.priority).toBe('urgent');
    expect(updated?.adminNotes).toHaveLength(1);
    expect(updated?.history.some(entry => entry.action === 'status_changed')).toBe(true);
    expect(store.getOperationsStats()).toMatchObject({ total: 1, open: 1, urgent: 1, inReview: 1 });
  });

  it('backfills a legacy application once without copying sensitive identity fields', async () => {
    const accountDir = path.join(root, 'accounts');
    fs.mkdirSync(accountDir, { recursive: true });
    fs.writeFileSync(path.join(accountDir, 'applications.jsonl'), `${JSON.stringify({
      id: 'legacy-app-1', firstName: 'Amina', lastName: 'Cole', email: 'amina@example.test',
      accountType: 'business', nationality: 'US', govIdNumber: 'must-not-copy', tin: 'must-not-copy',
    })}\n`);
    const store = await import('../../server/lib/operationsInboxStore.js');
    store.syncLegacyOperationsItems();
    store.syncLegacyOperationsItems();
    const result = store.listOperationsItems({ source: 'account_application' });
    expect(result.total).toBe(1);
    expect(JSON.stringify(result.data[0])).not.toContain('must-not-copy');
  });
});
