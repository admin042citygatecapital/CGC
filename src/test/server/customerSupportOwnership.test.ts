import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-support-'));

describe('customer support ownership', () => {
  let store: typeof import('../../server/lib/supportStore.js');

  beforeAll(async () => {
    process.env.PRIVATE_DATA_ROOT = testRoot;
    store = await import('../../server/lib/supportStore.js');
  });

  afterAll(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  it('prevents a customer from replying to another customer conversation', () => {
    const conversation = store.createConversation({
      userId: 'customer-a', userName: 'Customer A', userEmail: 'a@example.test',
      subject: 'Account access', category: 'Account Access', message: 'Please help.',
    });

    expect(store.addCustomerMessage(conversation.id, 'customer-b', 'Unauthorized reply')).toBeNull();
    const unchanged = store.getConversationById(conversation.id);
    expect(unchanged?.messages).toHaveLength(1);
  });

  it('adds an owned reply and reopens a resolved conversation', () => {
    const conversation = store.createConversation({
      userId: 'customer-c', userName: 'Customer C', userEmail: 'c@example.test',
      subject: 'Technical issue', category: 'Technical Support', message: 'Initial message.',
    });
    store.updateConversationStatus(conversation.id, 'resolved');
    const updated = store.addCustomerMessage(conversation.id, 'customer-c', 'The issue returned.');
    expect(updated?.messages).toHaveLength(2);
    expect(updated?.status).toBe('open');
  });
});
