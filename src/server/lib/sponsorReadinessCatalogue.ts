import type { AdminRole } from './sessionStore.js';

export const SPONSOR_PACKAGE_ID = 'uk-multicurrency-v1';
export const SPONSOR_PACKAGE_VERSION = '1.0';

export type SponsorCategory =
  | 'legal_entity' | 'sponsor_contracts' | 'safeguarding' | 'kyc_kyb'
  | 'aml_sanctions' | 'fx_payments' | 'ledger_reconciliation' | 'security'
  | 'resilience' | 'privacy' | 'customer_protection';

export interface SponsorControl {
  key: string;
  title: string;
  category: SponsorCategory;
  ownerRole: Exclude<AdminRole, 'SUPER_ADMIN' | 'SUPPORT_ADMIN'>;
  phase: 1 | 2 | 3 | 4;
  required: true;
  description: string;
}

const controls = (
  category: SponsorCategory,
  ownerRole: SponsorControl['ownerRole'],
  rows: Array<[string, string, 1 | 2 | 3 | 4, string]>,
): SponsorControl[] => rows.map(([key, title, phase, description]) => ({
  key, title, category, ownerRole, phase, required: true, description,
}));

export const SPONSOR_CONTROLS: readonly SponsorControl[] = [
  ...controls('legal_entity', 'COMPLIANCE_ADMIN', [
    ['legal_entity_verified', 'Legal entity and ownership evidence', 1, 'Verified incorporation, ownership and authority; entity remains unverified until approved.'],
    ['beneficial_owners_verified', 'Beneficial owners and controllers', 3, 'Ownership, controllers and source-of-funds governance.'],
    ['regulatory_perimeter_opinion', 'UK regulatory perimeter opinion', 1, 'Counsel-approved permissions, agency model and launch boundaries.'],
  ]),
  ...controls('sponsor_contracts', 'FINANCE_ADMIN', [
    ['sponsor_term_sheet', 'Sponsor institution term sheet', 1, 'Commercial and operating scope with an authorised sponsor.'],
    ['programme_contract', 'Programme/provider contract', 2, 'Executed responsibilities, service levels and termination protections.'],
    ['responsibility_matrix', 'Responsibility matrix approval', 1, 'Sponsor, City Gate and provider accountability.'],
  ]),
  ...controls('safeguarding', 'FINANCE_ADMIN', [
    ['safeguarding_method', 'Safeguarding method approval', 2, 'Sponsor-approved account structure and segregation method.'],
    ['safeguarding_reconciliation', 'Safeguarding reconciliation design', 2, 'Daily calculation, reconciliation and break resolution.'],
    ['safeguarding_audit', 'Safeguarding audit and reporting plan', 2, 'Independent assurance and sponsor reporting calendar.'],
  ]),
  ...controls('kyc_kyb', 'COMPLIANCE_ADMIN', [
    ['consumer_kyc_policy', 'Consumer KYC policy', 2, 'Risk-based onboarding for UK individuals.'],
    ['business_kyb_policy', 'Business KYB, UBO and authorised users', 3, 'Legal-person onboarding and control-person verification.'],
    ['identity_provider_diligence', 'Identity provider due diligence', 2, 'Provider coverage, assurance levels and fallback process.'],
  ]),
  ...controls('aml_sanctions', 'COMPLIANCE_ADMIN', [
    ['aml_risk_assessment', 'Enterprise AML risk assessment', 1, 'Customers, products, channels, geographies and controls.'],
    ['screening_provider', 'Sanctions, PEP and adverse-media screening', 2, 'Onboarding and continuing screening design.'],
    ['transaction_monitoring', 'Transaction monitoring programme', 2, 'Scenarios, alert governance, SAR escalation and QA.'],
    ['compliance_officer', 'Named compliance officer', 1, 'Accountable officer with approved mandate and reporting line.'],
  ]),
  ...controls('fx_payments', 'FINANCE_ADMIN', [
    ['fx_provider', 'Provider-executed FX approval', 2, 'Quote, expiry, conversion, pricing and execution ownership.'],
    ['fx_disclosures', 'FX pricing and slippage disclosures', 2, 'Customer-facing price, spread, fee and expiry language.'],
    ['corridor_approval', 'Payment corridor approval register', 2, 'Individual corridor activation gates and limits.'],
    ['returns_reversals', 'Returns and reversals design', 2, 'Provider-authoritative states and customer remediation.'],
  ]),
  ...controls('ledger_reconciliation', 'FINANCE_ADMIN', [
    ['authoritative_ledger', 'Sponsor/core ledger of record', 1, 'Contractual statement that sponsor/core records are authoritative.'],
    ['double_entry_design', 'Double-entry ledger integration design', 2, 'Posting model, identifiers, corrections and immutability.'],
    ['daily_reconciliation', 'Daily reconciliation runbook', 2, 'Provider, safeguarded account and internal sub-ledger matching.'],
    ['breaks_escalation', 'Reconciliation breaks escalation', 2, 'Thresholds, ownership, ageing and resolution evidence.'],
  ]),
  ...controls('security', 'SECURITY_ADMIN', [
    ['penetration_test', 'Independent penetration test', 2, 'Scoped test with remediation and retest evidence.'],
    ['signed_webhooks', 'Signed webhook verification', 1, 'Replay protection, rotation, timestamp and signature rules.'],
    ['privileged_access', 'Privileged access review', 1, 'Least privilege, MFA, recertification and emergency access.'],
  ]),
  ...controls('resilience', 'SECURITY_ADMIN', [
    ['incident_response', 'Incident response plan', 1, 'Severity model, sponsor notification and regulatory escalation.'],
    ['restore_test', 'Business continuity and restore test', 2, 'Tested recovery objectives and evidence of restoration.'],
    ['provider_failure', 'Provider failure and exit playbook', 2, 'Outage, insolvency, data portability and orderly wind-down.'],
  ]),
  ...controls('privacy', 'SECURITY_ADMIN', [
    ['privacy_impact', 'Data protection impact assessment', 2, 'Purpose, lawful basis, minimisation and risk treatment.'],
    ['retention_schedule', 'Retention and deletion schedule', 2, 'System-specific retention, legal holds and verified deletion.'],
    ['cross_border_map', 'Cross-border data transfer map', 2, 'Processors, locations, transfer tools and access boundaries.'],
  ]),
  ...controls('customer_protection', 'COMPLIANCE_ADMIN', [
    ['terms_disclosures', 'Customer terms and product disclosures', 2, 'Plain-language service, safeguarding and risk disclosures.'],
    ['complaints_resolution', 'Complaints and error resolution', 2, 'Ownership, time limits, escalation and ombudsman routes.'],
    ['safeguarding_wording', 'Safeguarding wording approval', 2, 'Accurate, sponsor-approved statements with no deposit-insurance claim.'],
    ['vulnerable_customers', 'Vulnerable customer support', 2, 'Identification, accommodations, monitoring and outcomes testing.'],
  ]),
];

export const PRODUCT_PHASES = [
  { phase: 1, name: 'Sponsor sandbox', scope: 'All six currencies; synthetic customers; no real funds.' },
  { phase: 2, name: 'Controlled consumer pilot', scope: 'UK individuals; GBP/EUR/USD balances; approved local and European corridors.' },
  { phase: 3, name: 'Business expansion', scope: 'KYB, beneficial owners, authorised users; CAD/AUD/CHF added.' },
  { phase: 4, name: 'International payouts', scope: 'Corridors activated individually after sponsor, sanctions, reconciliation and disclosure approval.' },
] as const;

export const PRODUCT_PROFILE = {
  jurisdiction: 'United Kingdom',
  legalEntityState: 'unverified',
  audiences: ['individuals', 'businesses'],
  currencies: ['GBP', 'EUR', 'USD', 'CAD', 'AUD', 'CHF'],
  excluded: ['cards', 'crypto'],
  execution: 'Provider-executed FX and payments; sponsor/core ledger authoritative',
  phases: PRODUCT_PHASES,
} as const;

export function canManageCategory(role: AdminRole, category: SponsorCategory): boolean {
  if (role === 'SUPER_ADMIN') return true;
  return SPONSOR_CONTROLS.some(control => control.category === category && control.ownerRole === role);
}

export function findSponsorControl(key: string): SponsorControl | undefined {
  return SPONSOR_CONTROLS.find(control => control.key === key);
}
