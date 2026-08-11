import { LIVE_PROVIDER_ADAPTERS_IMPLEMENTED } from './platformMode.js';

export const CONTROLLED_PILOT_CONTROLS = [
  'legal_entity_verified', 'beneficial_owners_verified', 'regulatory_perimeter_opinion',
  'sponsor_term_sheet', 'responsibility_matrix', 'safeguarding_method', 'safeguarding_reconciliation',
  'consumer_kyc_policy', 'business_kyb_policy', 'identity_provider_diligence', 'aml_risk_assessment',
  'screening_provider', 'transaction_monitoring', 'compliance_officer', 'fx_provider', 'corridor_approval',
  'returns_reversals', 'authoritative_ledger', 'double_entry_design', 'daily_reconciliation',
  'breaks_escalation', 'penetration_test', 'signed_webhooks', 'privileged_access', 'incident_response',
  'restore_test', 'privacy_impact', 'retention_schedule', 'terms_disclosures', 'complaints_resolution',
  'safeguarding_wording',
] as const;

export interface PilotControl { key: string; title: string; status: string; }
export interface PilotRun { subjectType: string; status: string; }

export function assessControlledPilotReadiness(input: {
  legalEntityState: string;
  packageApproved: boolean;
  controls: PilotControl[];
  runs: PilotRun[];
}) {
  const controlMap = new Map(input.controls.map(control => [control.key, control]));
  const controlGaps = CONTROLLED_PILOT_CONTROLS
    .filter(key => controlMap.get(key)?.status !== 'approved')
    .map(key => ({ key, reason: `${controlMap.get(key)?.title ?? key} is not approved` }));
  const passedIndividual = input.runs.some(run => run.subjectType === 'individual' && run.status === 'passed');
  const passedBusiness = input.runs.some(run => run.subjectType === 'business' && run.status === 'passed');
  const gates = [
    { key: 'legal_entity', passed: input.legalEntityState === 'verified', reason: 'Legal entity and beneficial ownership must be evidence-verified.' },
    { key: 'sponsor_package', passed: input.packageApproved, reason: 'The maker-checker sponsor package must be approved.' },
    { key: 'individual_rehearsal', passed: passedIndividual, reason: 'A synthetic individual KYC/payment rehearsal must pass.' },
    { key: 'business_rehearsal', passed: passedBusiness, reason: 'A synthetic business KYB/payment rehearsal must pass.' },
    { key: 'pilot_controls', passed: controlGaps.length === 0, reason: `${controlGaps.length} controlled-pilot evidence controls remain outstanding.` },
  ];
  const rehearsalReady = gates.every(gate => gate.passed);
  return {
    rehearsalReady, gates, controlGaps,
    liveProviderAdaptersImplemented: LIVE_PROVIDER_ADAPTERS_IMPLEMENTED,
    realFundsEnabled: false as const,
    label: rehearsalReady ? 'CONTROLLED PILOT REHEARSAL READY — NO REAL FUNDS' : 'NOT READY FOR CONTROLLED PILOT',
  };
}
