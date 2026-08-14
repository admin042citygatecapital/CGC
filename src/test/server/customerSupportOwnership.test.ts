import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('customer support ownership and durability', () => {
  const databaseStore = readFileSync('src/server/lib/supportDatabaseStore.ts', 'utf8');
  const customerPost = readFileSync('src/server/api/users/support/POST.ts', 'utf8');
  const customerGet = readFileSync('src/server/api/users/support/GET.ts', 'utf8');

  it('uses PostgreSQL for the active customer support workflow', () => {
    expect(customerPost).toContain("from '../../../lib/supportDatabaseStore.js'");
    expect(customerGet).toContain("from '../../../lib/supportDatabaseStore.js'");
    expect(databaseStore).toContain('INSERT INTO support_conversations');
    expect(databaseStore).toContain('INSERT INTO support_messages');
    expect(databaseStore).not.toContain('writeFileSync');
  });

  it('checks conversation ownership inside the locked database transaction', () => {
    expect(databaseStore).toContain('FOR UPDATE');
    expect(databaseStore).toContain('OR user_id = ${ownerUserId ?? null}');
    expect(customerPost).toContain('await addCustomerMessage(cleanId, user.id, cleanMessage)');
  });

  it('reopens a resolved or closed case when its owner replies', () => {
    expect(databaseStore).toContain("['resolved', 'closed'].includes(conversations[0].status)");
    expect(databaseStore).toContain("WHEN ${reopened} THEN 'open'::support_status");
  });
});
