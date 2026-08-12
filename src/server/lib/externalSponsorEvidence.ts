export interface ExternalSponsorEvidenceRequirement {
  controlKey: 'legal_entity_verified' | 'beneficial_owners_verified' | 'regulatory_perimeter_opinion' | 'sponsor_term_sheet' | 'programme_contract';
  authority: string;
  minimumAcceptance: string;
  insufficientEvidence: string;
}

export const EXTERNAL_SPONSOR_EVIDENCE: readonly ExternalSponsorEvidenceRequirement[] = [
  {
    controlKey: 'legal_entity_verified',
    authority: 'Authoritative corporate registry, certified constitutional records and formal signing-authority records for the proposed contracting entity.',
    minimumAcceptance: 'Exact legal name, number, jurisdiction, registered office, active status, governing documents, directors/controllers and signing authority agree and are current.',
    insufficientEvidence: 'A brand name, domain, website, invoice or unverified company-number match is not evidence.',
  },
  {
    controlKey: 'beneficial_owners_verified',
    authority: 'Certified ownership structure, authoritative ownership/control registers where available, and provider-verified natural-person results under the sponsor-approved threshold.',
    minimumAcceptance: 'The complete chain through intermediate entities to natural persons, including ownership and control bases, percentages, dates and reconciled discrepancies.',
    insufficientEvidence: 'Customer declarations without corroboration, incomplete chains or identity files copied into this workspace are not acceptable.',
  },
  {
    controlKey: 'regulatory_perimeter_opinion',
    authority: 'Written opinion from suitably qualified UK financial-services counsel addressed to the confirmed legal entity and based on the final sponsor model.',
    minimumAcceptance: 'Permissions, responsible entities, agency model, financial-promotion boundaries, safeguarding, redress, disclosures, prohibited activities, assumptions and launch conditions.',
    insufficientEvidence: 'A generic memorandum, marketing review or opinion prepared before the legal entity and sponsor model are confirmed is insufficient.',
  },
  {
    controlKey: 'sponsor_term_sheet',
    authority: 'Dated term sheet or equivalent written commitment issued by an authorised sponsor institution to the confirmed legal entity.',
    minimumAcceptance: 'Regulated model, eligible scope, safeguarding, compliance ownership, commercials, due-diligence conditions, certification stages, dependencies, termination and validity.',
    insufficientEvidence: 'Introductory emails, sales presentations and unsigned pricing sheets are insufficient.',
  },
  {
    controlKey: 'programme_contract',
    authority: 'Fully executed agreement set between confirmed legal entities, including applicable schedules, data-processing terms, service levels and operating manuals.',
    minimumAcceptance: 'Responsibilities, safeguarding, financial-crime controls, ledger authority, payments/FX, reconciliation, complaints, disclosures, security, audit, resilience, exit and wind-down are resolved.',
    insufficientEvidence: 'Drafts, partial signature sets and agreements with unresolved conditions precedent cannot be approved.',
  },
] as const;
