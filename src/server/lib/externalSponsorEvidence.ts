export interface ExternalSponsorEvidenceRequirement {
  controlKey: 'legal_entity_verified' | 'beneficial_owners_verified' | 'regulatory_perimeter_opinion' | 'sponsor_term_sheet' | 'programme_contract';
  responsibleFunction: 'Compliance' | 'Finance';
  requestedFrom: string;
  nextAction: string;
  prerequisite: string;
  authority: string;
  minimumAcceptance: string;
  insufficientEvidence: string;
}

export const EXTERNAL_SPONSOR_EVIDENCE: readonly ExternalSponsorEvidenceRequirement[] = [
  {
    controlKey: 'legal_entity_verified',
    responsibleFunction: 'Compliance',
    requestedFrom: 'The proposed contracting entity, its authorised company officer and the authoritative corporate registry.',
    nextAction: 'Confirm the proposed contracting entity, then obtain a current registry extract, constitutional records and signing-authority evidence through a restricted channel.',
    prerequisite: 'The project owner must identify the exact legal entity proposed to contract; a brand or domain is not sufficient.',
    authority: 'Authoritative corporate registry, certified constitutional records and formal signing-authority records for the proposed contracting entity.',
    minimumAcceptance: 'Exact legal name, number, jurisdiction, registered office, active status, governing documents, directors/controllers and signing authority agree and are current.',
    insufficientEvidence: 'A brand name, domain, website, invoice or unverified company-number match is not evidence.',
  },
  {
    controlKey: 'beneficial_owners_verified',
    responsibleFunction: 'Compliance',
    requestedFrom: 'The confirmed contracting entity and a contracted KYB/identity-verification provider applying the sponsor-approved ownership threshold.',
    nextAction: 'Obtain the complete ownership and control chain, reconcile it to authoritative sources and arrange provider verification of the required natural persons.',
    prerequisite: 'The contracting entity and sponsor-approved ownership/control thresholds must be confirmed first.',
    authority: 'Certified ownership structure, authoritative ownership/control registers where available, and provider-verified natural-person results under the sponsor-approved threshold.',
    minimumAcceptance: 'The complete chain through intermediate entities to natural persons, including ownership and control bases, percentages, dates and reconciled discrepancies.',
    insufficientEvidence: 'Customer declarations without corroboration, incomplete chains or identity files copied into this workspace are not acceptable.',
  },
  {
    controlKey: 'regulatory_perimeter_opinion',
    responsibleFunction: 'Compliance',
    requestedFrom: 'Suitably qualified UK financial-services counsel engaged by the confirmed contracting entity.',
    nextAction: 'Issue counsel the phased product scope, proposed sponsor model and open assumptions, and request a written entity-specific opinion with explicit launch conditions.',
    prerequisite: 'The legal entity, proposed sponsor model, products, jurisdictions, currencies and customer scope must be sufficiently defined.',
    authority: 'Written opinion from suitably qualified UK financial-services counsel addressed to the confirmed legal entity and based on the final sponsor model.',
    minimumAcceptance: 'Permissions, responsible entities, agency model, financial-promotion boundaries, safeguarding, redress, disclosures, prohibited activities, assumptions and launch conditions.',
    insufficientEvidence: 'A generic memorandum, marketing review or opinion prepared before the legal entity and sponsor model are confirmed is insufficient.',
  },
  {
    controlKey: 'sponsor_term_sheet',
    responsibleFunction: 'Finance',
    requestedFrom: 'An authorised UK bank, EMI or programme sponsor after its initial due diligence of the confirmed contracting entity.',
    nextAction: 'Send the draft sponsor pack and RFP to shortlisted authorised institutions, complete their due diligence and request a dated written term sheet covering the proposed programme.',
    prerequisite: 'The contracting entity, ownership pack and credible product/regulatory scope must be available for sponsor due diligence.',
    authority: 'Dated term sheet or equivalent written commitment issued by an authorised sponsor institution to the confirmed legal entity.',
    minimumAcceptance: 'Regulated model, eligible scope, safeguarding, compliance ownership, commercials, due-diligence conditions, certification stages, dependencies, termination and validity.',
    insufficientEvidence: 'Introductory emails, sales presentations and unsigned pricing sheets are insufficient.',
  },
  {
    controlKey: 'programme_contract',
    responsibleFunction: 'Finance',
    requestedFrom: 'The selected authorised sponsor and programme/provider counterparties, with qualified legal review for every contracting entity.',
    nextAction: 'Negotiate and execute the complete agreement set, resolve conditions precedent and record only the exact signed-version references and hashes in this workspace.',
    prerequisite: 'Sponsor selection, due diligence, term-sheet agreement, legal review and resolution of the operating model must be complete.',
    authority: 'Fully executed agreement set between confirmed legal entities, including applicable schedules, data-processing terms, service levels and operating manuals.',
    minimumAcceptance: 'Responsibilities, safeguarding, financial-crime controls, ledger authority, payments/FX, reconciliation, complaints, disclosures, security, audit, resilience, exit and wind-down are resolved.',
    insufficientEvidence: 'Drafts, partial signature sets and agreements with unresolved conditions precedent cannot be approved.',
  },
] as const;
