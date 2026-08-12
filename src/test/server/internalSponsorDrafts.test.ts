import { describe, expect, it } from 'vitest';
import { buildInternalSponsorDrafts } from '../../server/lib/internalSponsorDrafts.js';
import { findSponsorControl } from '../../server/lib/sponsorReadinessCatalogue.js';

describe('progressive internal sponsor evidence', () => {
  it('produces controlled metadata and valid hashes without claiming external approval', () => {
    const drafts = buildInternalSponsorDrafts();
    expect(drafts.map(item => item.controlKey).sort()).toEqual([
      'authoritative_ledger',
      'aml_risk_assessment',
      'complaints_resolution',
      'consumer_kyc_policy',
      'business_kyb_policy',
      'cross_border_map',
      'daily_reconciliation',
      'breaks_escalation',
      'double_entry_design',
      'incident_response',
      'privacy_impact',
      'privileged_access',
      'provider_failure',
      'retention_schedule',
      'restore_test',
      'returns_reversals',
      'safeguarding_reconciliation',
      'signed_webhooks',
      'terms_disclosures',
      'transaction_monitoring',
      'vulnerable_customers',
      'responsibility_matrix',
      'safeguarding_method',
      'safeguarding_audit',
      'identity_provider_diligence',
      'screening_provider',
      'compliance_officer',
      'fx_provider',
      'fx_disclosures',
      'corridor_approval',
      'penetration_test',
      'safeguarding_wording',
    ].sort());
    for (const draft of drafts) {
      expect(findSponsorControl(draft.controlKey)).toBeDefined();
      expect(draft.reference).toMatch(/^(repo:docs\/[A-Z0-9-]+\.md|generated:sponsor-pack\/[a-z0-9-]+\.md):[a-f0-9]{16}$/i);
      expect(draft.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(draft.notes).toMatch(/approval.*outstanding/i);
      expect(draft).not.toHaveProperty('sourceContent');
    }
    expect(drafts.find(item => item.controlKey === 'authoritative_ledger')?.notes).toMatch(/contracted authoritative ledger.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'restore_test')?.notes).toMatch(/completed isolated restore.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'daily_reconciliation')?.notes).toMatch(/provider statement feeds.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'privacy_impact')?.notes).toMatch(/provider-specific DPIA.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'returns_reversals')?.notes).toMatch(/provider certification.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'vulnerable_customers')?.notes).toMatch(/staff training.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'double_entry_design')?.notes).toMatch(/contracted sponsor\/core ledger.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'cross_border_map')?.notes).toMatch(/named processors.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'business_kyb_policy')?.notes).toMatch(/contracted verification providers.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'aml_risk_assessment')?.notes).toMatch(/qualified MLRO approval.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'transaction_monitoring')?.notes).toMatch(/contracted monitoring provider.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'terms_disclosures')?.notes).toMatch(/qualified counsel approval.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'safeguarding_method')?.notes).toMatch(/authorised sponsor.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'identity_provider_diligence')?.notes).toMatch(/contracted identity provider.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'screening_provider')?.notes).toMatch(/contracted screening provider.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'compliance_officer')?.notes).toMatch(/qualified named individual.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'corridor_approval')?.notes).toMatch(/no production corridor is approved/i);
    expect(drafts.find(item => item.controlKey === 'penetration_test')?.notes).toMatch(/completed test report.*outstanding/i);
    expect(drafts.find(item => item.controlKey === 'safeguarding_wording')?.notes).toMatch(/customer-funds treatment.*outstanding/i);
    expect(drafts.map(item => item.controlKey)).not.toEqual(expect.arrayContaining([
      'legal_entity_verified',
      'beneficial_owners_verified',
      'regulatory_perimeter_opinion',
      'sponsor_term_sheet',
      'programme_contract',
    ]));
  });
});
