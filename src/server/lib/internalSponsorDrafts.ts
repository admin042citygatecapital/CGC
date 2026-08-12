import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { OPERATIONAL_PROCEDURES } from './operationalProcedures.js';

export interface InternalSponsorDraft {
  controlKey:
    | 'consumer_kyc_policy'
    | 'signed_webhooks'
    | 'complaints_resolution'
    | 'authoritative_ledger'
    | 'privileged_access'
    | 'restore_test'
    | 'safeguarding_reconciliation'
    | 'daily_reconciliation'
    | 'breaks_escalation'
    | 'incident_response'
    | 'privacy_impact'
    | 'retention_schedule'
    | 'provider_failure'
    | 'returns_reversals'
    | 'vulnerable_customers'
    | 'double_entry_design'
    | 'cross_border_map'
    | 'business_kyb_policy'
    | 'aml_risk_assessment'
    | 'transaction_monitoring'
    | 'terms_disclosures';
  title: string;
  owner: string;
  sourceFile: string;
  reference: string;
  sha256: string;
  notes: string;
}

interface DraftSource {
  controlKey: InternalSponsorDraft['controlKey'];
  title: string;
  owner: string;
  sourceFile: string;
  sourceContent?: string;
  notes?: string;
}

const RECONCILIATION_PROCEDURE = '09-safeguarding-reconciliation-procedure.md';
const PRIVACY_PROCEDURE = '10-privacy-and-data-rights-procedure.md';
const INCIDENT_PROCEDURE = '11-incident-breach-response-procedure.md';
const PROVIDER_FAILURE_PROCEDURE = '13-provider-failure-and-exit-procedure.md';
const REVERSALS_PROCEDURE = '14-returns-reversals-and-remediation-procedure.md';
const VULNERABLE_CUSTOMER_PROCEDURE = '15-vulnerable-customer-support-procedure.md';
const DOUBLE_ENTRY_PROCEDURE = '16-double-entry-ledger-integration-procedure.md';
const CROSS_BORDER_PROCEDURE = '17-cross-border-data-transfer-mapping-procedure.md';
const BUSINESS_KYB_PROCEDURE = '18-business-kyb-and-ownership-procedure.md';
const AML_RISK_PROCEDURE = '19-enterprise-aml-risk-assessment-procedure.md';
const TRANSACTION_MONITORING_PROCEDURE = '20-transaction-monitoring-governance-procedure.md';
const TERMS_DISCLOSURE_PROCEDURE = '21-customer-terms-and-disclosure-approval-procedure.md';

const SOURCES: DraftSource[] = [
  {
    controlKey: 'consumer_kyc_policy' as const,
    title: 'Customer onboarding and provider-verification control plane',
    owner: 'Compliance',
    sourceFile: 'docs/ONBOARDING-CONTROL-PLANE.md',
  },
  {
    controlKey: 'signed_webhooks' as const,
    title: 'Signed onboarding-provider webhook controls',
    owner: 'Security',
    sourceFile: 'docs/ONBOARDING-CONTROL-PLANE.md',
  },
  {
    controlKey: 'complaints_resolution' as const,
    title: 'Complaints handling and escalation procedure',
    owner: 'Compliance',
    sourceFile: 'docs/COMPLAINTS-PROCEDURE.md',
  },
  {
    controlKey: 'authoritative_ledger' as const,
    title: 'Ledger-of-record boundary and external dependency register',
    owner: 'Finance',
    sourceFile: 'docs/PRODUCTION-READINESS-GAP-ANALYSIS.md',
  },
  {
    controlKey: 'privileged_access' as const,
    title: 'Privileged administration and separation-of-duties control inventory',
    owner: 'Security',
    sourceFile: 'docs/PROJECT-COMPLETION-REGISTER.md',
  },
  {
    controlKey: 'restore_test' as const,
    title: 'Backup and isolated-restore test runbook',
    owner: 'Security',
    sourceFile: 'docs/BACKUP-RECOVERY.md',
  },
  {
    controlKey: 'safeguarding_reconciliation',
    title: 'Draft safeguarding reconciliation procedure',
    owner: 'Finance',
    sourceFile: `sponsor-pack/${RECONCILIATION_PROCEDURE}`,
    sourceContent: OPERATIONAL_PROCEDURES[RECONCILIATION_PROCEDURE],
    notes: 'Draft control design only. Sponsor approval of the safeguarding structure, accounts, calculation method, thresholds and timetable remains outstanding, as does successful operating evidence.',
  },
  {
    controlKey: 'daily_reconciliation',
    title: 'Draft daily three-way reconciliation runbook',
    owner: 'Finance',
    sourceFile: `sponsor-pack/${RECONCILIATION_PROCEDURE}`,
    sourceContent: OPERATIONAL_PROCEDURES[RECONCILIATION_PROCEDURE],
    notes: 'Draft runbook only. Sponsor approval, contracted provider statement feeds, authoritative ledger mapping, an approved timetable and successful daily-run evidence remain outstanding.',
  },
  {
    controlKey: 'breaks_escalation',
    title: 'Draft reconciliation-break classification and escalation process',
    owner: 'Finance',
    sourceFile: `sponsor-pack/${RECONCILIATION_PROCEDURE}`,
    sourceContent: OPERATIONAL_PROCEDURES[RECONCILIATION_PROCEDURE],
    notes: 'Draft escalation design only. Sponsor approval of materiality and ageing thresholds, named owners and resolved-break operating evidence remain outstanding.',
  },
  {
    controlKey: 'incident_response',
    title: 'Draft security incident, breach and provider-outage procedure',
    owner: 'Security',
    sourceFile: `sponsor-pack/${INCIDENT_PROCEDURE}`,
    sourceContent: OPERATIONAL_PROCEDURES[INCIDENT_PROCEDURE],
    notes: 'Draft response design only. Sponsor approval, named response roles, contractual and regulatory notification matrices and completed exercise evidence remain outstanding.',
  },
  {
    controlKey: 'privacy_impact',
    title: 'Draft privacy impact and data-rights control procedure',
    owner: 'Security',
    sourceFile: `sponsor-pack/${PRIVACY_PROCEDURE}`,
    sourceContent: OPERATIONAL_PROCEDURES[PRIVACY_PROCEDURE],
    notes: 'Draft privacy control design only. Sponsor and DPO/counsel approval, a completed processing inventory, provider-specific DPIA, lawful-basis review and residual-risk acceptance remain outstanding.',
  },
  {
    controlKey: 'retention_schedule',
    title: 'Draft retention, deletion and legal-hold procedure',
    owner: 'Security',
    sourceFile: `sponsor-pack/${PRIVACY_PROCEDURE}`,
    sourceContent: OPERATIONAL_PROCEDURES[PRIVACY_PROCEDURE],
    notes: 'Draft procedure only. Sponsor/counsel approval, a system-specific retention schedule, deletion-job evidence and legal-hold governance remain outstanding.',
  },
  {
    controlKey: 'provider_failure',
    title: 'Draft provider failure, exit and orderly wind-down procedure',
    owner: 'Security',
    sourceFile: `sponsor-pack/${PROVIDER_FAILURE_PROCEDURE}`,
    sourceContent: OPERATIONAL_PROCEDURES[PROVIDER_FAILURE_PROCEDURE],
    notes: 'Draft supplier resilience design only. Sponsor approval, contracted provider exit terms, named owners, portability evidence and completed outage/exit exercises remain outstanding.',
  },
  {
    controlKey: 'returns_reversals',
    title: 'Draft returns, reversals and customer-remediation procedure',
    owner: 'Finance',
    sourceFile: `sponsor-pack/${REVERSALS_PROCEDURE}`,
    sourceContent: OPERATIONAL_PROCEDURES[REVERSALS_PROCEDURE],
    notes: 'Draft lifecycle design only. Sponsor approval, contracted provider state mapping, authoritative ledger integration, corridor rules and provider certification remain outstanding.',
  },
  {
    controlKey: 'vulnerable_customers',
    title: 'Draft vulnerable-customer support and outcomes procedure',
    owner: 'Compliance',
    sourceFile: `sponsor-pack/${VULNERABLE_CUSTOMER_PROCEDURE}`,
    sourceContent: OPERATIONAL_PROCEDURES[VULNERABLE_CUSTOMER_PROCEDURE],
    notes: 'Draft customer-support design only. Sponsor/counsel approval, named owners, staff training, referral routes, accessibility testing and operating-outcomes evidence remain outstanding.',
  },
  {
    controlKey: 'double_entry_design',
    title: 'Draft sponsor-led double-entry ledger integration design',
    owner: 'Finance',
    sourceFile: `sponsor-pack/${DOUBLE_ENTRY_PROCEDURE}`,
    sourceContent: OPERATIONAL_PROCEDURES[DOUBLE_ENTRY_PROCEDURE],
    notes: 'Draft integration design only. Sponsor approval, a contracted sponsor/core ledger, approved chart of accounts, provider identifier mapping, certification and reconciled operating evidence remain outstanding.',
  },
  {
    controlKey: 'cross_border_map',
    title: 'Draft cross-border data-transfer mapping procedure',
    owner: 'Security',
    sourceFile: `sponsor-pack/${CROSS_BORDER_PROCEDURE}`,
    sourceContent: OPERATIONAL_PROCEDURES[CROSS_BORDER_PROCEDURE],
    notes: 'Draft mapping method only. Sponsor and DPO/counsel approval, a complete production data inventory, named processors and subprocessors, confirmed hosting/access locations, transfer assessments and safeguards remain outstanding.',
  },
  {
    controlKey: 'business_kyb_policy',
    title: 'Draft business KYB, ownership and authorised-user procedure',
    owner: 'Compliance',
    sourceFile: `sponsor-pack/${BUSINESS_KYB_PROCEDURE}`,
    sourceContent: OPERATIONAL_PROCEDURES[BUSINESS_KYB_PROCEDURE],
    notes: 'Draft onboarding design only. Sponsor approval of risk appetite, jurisdiction, entity scope and ownership thresholds, contracted verification providers, named compliance ownership and operating evidence remain outstanding.',
  },
  {
    controlKey: 'aml_risk_assessment',
    title: 'Draft enterprise AML risk-assessment methodology',
    owner: 'Compliance',
    sourceFile: `sponsor-pack/${AML_RISK_PROCEDURE}`,
    sourceContent: OPERATIONAL_PROCEDURES[AML_RISK_PROCEDURE],
    notes: 'Draft methodology only. Sponsor and qualified MLRO approval, verified business and geographic scope, authoritative data, calibrated risk appetite, completed assessment and governance evidence remain outstanding.',
  },
  {
    controlKey: 'transaction_monitoring',
    title: 'Draft transaction-monitoring governance procedure',
    owner: 'Compliance',
    sourceFile: `sponsor-pack/${TRANSACTION_MONITORING_PROCEDURE}`,
    sourceContent: OPERATIONAL_PROCEDURES[TRANSACTION_MONITORING_PROCEDURE],
    notes: 'Draft governance design only. Sponsor and qualified MLRO approval, a contracted monitoring provider, authoritative transaction feeds, approved scenarios and thresholds, SAR procedures, validation and operating evidence remain outstanding.',
  },
  {
    controlKey: 'terms_disclosures',
    title: 'Draft customer terms and product-disclosure approval procedure',
    owner: 'Compliance',
    sourceFile: `sponsor-pack/${TERMS_DISCLOSURE_PROCEDURE}`,
    sourceContent: OPERATIONAL_PROCEDURES[TERMS_DISCLOSURE_PROCEDURE],
    notes: 'Draft approval workflow only. Sponsor and qualified counsel approval, final legal entity and provider identities, regulated scope, commercial terms, protection wording, jurisdictional schedules and customer-testing evidence remain outstanding.',
  },
];

export function buildInternalSponsorDrafts(root = process.cwd()): InternalSponsorDraft[] {
  return SOURCES.map(source => {
    const content = source.sourceContent === undefined
      ? fs.readFileSync(path.resolve(root, source.sourceFile))
      : Buffer.from(source.sourceContent, 'utf8');
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    return {
      controlKey: source.controlKey,
      title: source.title,
      owner: source.owner,
      sourceFile: source.sourceFile,
      reference: `${source.sourceContent === undefined ? 'repo' : 'generated'}:${source.sourceFile}:${sha256.slice(0, 16)}`,
      sha256,
      notes: source.notes ?? (source.controlKey === 'authoritative_ledger'
        ? 'Draft boundary and gap evidence only. A contracted authoritative ledger, sponsor approval, reconciliation design and operating evidence remain outstanding.'
        : source.controlKey === 'privileged_access'
          ? 'Draft technical control inventory only. Independent access review, periodic recertification, sponsor approval and operating evidence remain outstanding.'
          : source.controlKey === 'restore_test'
            ? 'Draft recovery design only. A completed isolated restore, measured RPO/RTO, control-owner approval and sponsor acceptance remain outstanding.'
            : 'Draft internal engineering evidence only. Sponsor, counsel, control-owner approval and operating evidence remain outstanding.'),
    };
  });
}
