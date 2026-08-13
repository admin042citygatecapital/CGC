export type OnboardingControlStatus =
  | 'implemented'
  | 'provider_required'
  | 'governance_required'
  | 'jurisdiction_decision_required';

export interface OnboardingComplianceControl {
  key: string;
  label: string;
  domain: 'identity' | 'screening' | 'operations' | 'customer_protection' | 'reporting';
  status: OnboardingControlStatus;
  jurisdiction: 'global' | 'US' | 'UK';
  description: string;
  activationEffect: 'NONE';
}

/**
 * Programme-level readiness register. This is deliberately descriptive: it
 * cannot approve a customer, clear screening, file a report, or enable money
 * movement. Jurisdiction-specific controls remain drafts until counsel and a
 * sponsor/provider approve the applicable programme.
 */
export const ONBOARDING_COMPLIANCE_MAP: readonly OnboardingComplianceControl[] = [
  {
    key: 'identity_case_lifecycle',
    label: 'KYC/KYB case lifecycle',
    domain: 'identity',
    status: 'implemented',
    jurisdiction: 'global',
    description: 'Versioned individual and business cases, metadata-only evidence references, immutable events and reasoned review decisions.',
    activationEffect: 'NONE',
  },
  {
    key: 'identity_provider',
    label: 'Documentary, non-documentary and liveness verification',
    domain: 'identity',
    status: 'provider_required',
    jurisdiction: 'global',
    description: 'Requires an approved identity provider for document authenticity, database checks and liveness/biometric results. Administrators cannot manufacture a passed result.',
    activationEffect: 'NONE',
  },
  {
    key: 'verification_tiers',
    label: 'Risk-based verification tiers and limits',
    domain: 'identity',
    status: 'governance_required',
    jurisdiction: 'global',
    description: 'Tier criteria, permitted products, limits, enhanced due diligence triggers and downgrade/expiry rules require approved policy and sponsor alignment.',
    activationEffect: 'NONE',
  },
  {
    key: 'beneficial_ownership',
    label: 'Beneficial owners and controllers',
    domain: 'identity',
    status: 'implemented',
    jurisdiction: 'global',
    description: 'Business relationships can record beneficial owners, directors and authorised users; independent provider verification remains required for an approved KYB decision.',
    activationEffect: 'NONE',
  },
  {
    key: 'sanctions_pep_screening',
    label: 'Sanctions, PEP and adverse-media screening',
    domain: 'screening',
    status: 'provider_required',
    jurisdiction: 'global',
    description: 'Signed provider results, matches, rescreening dates and compliance cases are modelled. No internal button can produce a clear screening result.',
    activationEffect: 'NONE',
  },
  {
    key: 'transaction_monitoring',
    label: 'Transaction monitoring and investigation queue',
    domain: 'screening',
    status: 'provider_required',
    jurisdiction: 'global',
    description: 'Requires authoritative transaction feeds, approved scenarios, thresholds, validation, alert disposition and independent operating evidence.',
    activationEffect: 'NONE',
  },
  {
    key: 'admin_audit_maker_checker',
    label: 'Immutable audit and maker-checker',
    domain: 'operations',
    status: 'implemented',
    jurisdiction: 'global',
    description: 'Sensitive case and financial-simulation changes require authenticated super-admin actions, rationales, immutable events and separation from the submitting or last-editing actor.',
    activationEffect: 'NONE',
  },
  {
    key: 'daily_reconciliation',
    label: 'Provider-to-ledger reconciliation',
    domain: 'operations',
    status: 'provider_required',
    jurisdiction: 'global',
    description: 'The local double-entry simulation does not replace a sponsor/core ledger, daily three-way reconciliation, exception ownership or beneficial-owner balance records.',
    activationEffect: 'NONE',
  },
  {
    key: 'customer_notifications',
    label: 'Transactional and security notifications',
    domain: 'customer_protection',
    status: 'implemented',
    jurisdiction: 'global',
    description: 'Email and in-app notification templates, preferences and delivery logging exist; SMS/push delivery and jurisdiction-approved disclosure text require configured providers and review.',
    activationEffect: 'NONE',
  },
  {
    key: 'disputes_error_resolution',
    label: 'Dispute intake and error resolution',
    domain: 'customer_protection',
    status: 'governance_required',
    jurisdiction: 'US',
    description: 'Support intake exists, but regulated electronic-transfer timelines, notices, provisional-credit decisions and evidence retention require an approved US programme and sponsor workflow.',
    activationEffect: 'NONE',
  },
  {
    key: 'us_cip_bsa_programme',
    label: 'US CIP/BSA/AML programme',
    domain: 'reporting',
    status: 'jurisdiction_decision_required',
    jurisdiction: 'US',
    description: 'Board-approved programme scope, accountable officer, training, independent testing, record retention and sponsor responsibilities cannot be adopted until US launch scope and legal perimeter are approved.',
    activationEffect: 'NONE',
  },
  {
    key: 'us_sar_ctr_workflows',
    label: 'US SAR/CTR workflow and confidentiality',
    domain: 'reporting',
    status: 'jurisdiction_decision_required',
    jurisdiction: 'US',
    description: 'Case preparation, aggregation, filing authority, confidentiality, deadlines and recordkeeping require qualified counsel, a compliance officer and authorised filing access; the platform does not file reports.',
    activationEffect: 'NONE',
  },
  {
    key: 'statements_tax_documents',
    label: 'Statements and tax documents',
    domain: 'reporting',
    status: 'governance_required',
    jurisdiction: 'US',
    description: 'Periodic statement presentation exists, but authoritative statements and tax forms require reconciled ledger data, product classification, tax determination and an approved delivery/retention process.',
    activationEffect: 'NONE',
  },
] as const;

