import { describe, expect, it } from 'vitest';
import { buildInternalSponsorDrafts } from '../../server/lib/internalSponsorDrafts.js';
import { findSponsorControl } from '../../server/lib/sponsorReadinessCatalogue.js';

describe('progressive internal sponsor evidence', () => {
  it('produces controlled metadata and valid hashes without claiming external approval', () => {
    const drafts = buildInternalSponsorDrafts();
    expect(drafts.map(item => item.controlKey).sort()).toEqual([
      'authoritative_ledger',
      'complaints_resolution',
      'consumer_kyc_policy',
      'privileged_access',
      'restore_test',
      'signed_webhooks',
    ]);
    for (const draft of drafts) {
      expect(findSponsorControl(draft.controlKey)).toBeDefined();
      expect(draft.reference).toMatch(/^repo:docs\/[A-Z0-9-]+\.md:[a-f0-9]{16}$/i);
      expect(draft.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(draft.notes).toMatch(/approval.*outstanding/i);
    }
    expect(drafts.find(item => item.controlKey === 'authoritative_ledger')?.notes).toMatch(/contracted authoritative ledger.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'restore_test')?.notes).toMatch(/completed isolated restore.*outstanding/i);
  });
});
