# UK sponsor, provider and legal approval pack

Status: **DRAFT — NOT APPROVED FOR LAUNCH**

Prepared: 2026-08-12

Product boundary: sponsor-readiness only; no live funds, payments, custody, cards or crypto

## Executive decision

City Gate Capital is technically prepared to begin structured due diligence with a prospective UK authorised bank, authorised EMI or programme provider. It is not yet authorised to present or operate the application as a live bank or payment account. Customer registration and KYC case management may be tested with synthetic data, but an administrator's approval does not create regulatory permission and cannot enable financial operations.

The application invariant remains `LIVE_PROVIDER_ADAPTERS_IMPLEMENTED=false`. Sponsor-readiness evidence, environment settings and super-administrator decisions cannot override it.

## Proposed sponsor-led scope

1. **Sponsor sandbox:** synthetic individuals and businesses; GBP, EUR, USD, CAD, AUD and CHF; no real funds.
2. **Controlled consumer pilot:** UK individuals; GBP, EUR and USD; only sponsor-approved local and European corridors.
3. **Business expansion:** sponsor-approved KYB, beneficial-owner and authorised-user journeys; staged CAD, AUD and CHF.
4. **International payouts:** each corridor activated separately only after sponsor, sanctions, reconciliation and disclosure approval.

Cards, crypto custody and crypto execution are outside this package. The sponsor or contracted core ledger must be authoritative. Application balances and transactions are non-authoritative demonstration records until a contracted integration is certified.

## Evidence required before sponsor submission

| Workstream | Required evidence | Approval owner |
| --- | --- | --- |
| Legal entity | Current registry extract; constitutional documents; directors; beneficial owners/controllers; source of authority to contract; ownership verification | UK counsel, sponsor, super-admin checker |
| Regulatory perimeter | Written advice identifying the exact regulated activities, permissions, agency/programme model, territorial scope and financial-promotion restrictions | UK financial-services counsel |
| Sponsor and programme | Executed term sheet/contract; responsibility matrix; approved customer journey; outsourcing/agent model; audit and termination rights | Sponsor and City Gate board |
| Safeguarding | Named safeguarding institution/account structure; acknowledgement wording; relevant-funds methodology; daily reconciliation; break escalation; resolution pack; audit/reporting calendar | Sponsor, finance, external auditor/counsel |
| KYC/KYB and AML | Approved risk assessment; CDD/EDD; beneficial ownership; sanctions/PEP/adverse media; transaction monitoring; suspicious-activity escalation; retention; MLRO ownership | Sponsor compliance and MLRO |
| Payments and FX | Approved currencies/corridors; limits; quote and fee disclosures; sanctions screening points; returns, recalls, reversals and complaints | Sponsor/product/compliance |
| Ledger and reconciliation | Authoritative ledger contract; balanced postings; idempotency; immutable provider identifiers; statement feeds; daily three-way reconciliation; aged-break thresholds | Sponsor and finance |
| Customer protection | Fair-value and outcomes assessment; vulnerability support; complaints/FOS procedure; freeze/closure communication; precise safeguarding and FSCS wording | Sponsor, counsel and compliance |
| Privacy | Controller/processor allocation; lawful bases; Article 13/14 notices; retention; data-subject rights; international transfers; vendor DPAs; DPIA for identity/biometric processing | DPO/privacy counsel |
| Security and resilience | Independent penetration test and closure; incident plan/exercise; important-business-service map; impact tolerances; BCP/DR; isolated restore; supplier exit plan | Security, board and sponsor |

Only controlled evidence references, owners, dates and SHA-256 hashes belong in the sponsor-readiness workspace. Identity documents, credentials and original legal documents must remain in approved external repositories.

### Evidence mutation and audit integrity

Every sponsor-evidence create, edit, submit, review, expiry, package decision and export first persists a fail-closed central audit intent. The evidence state change and its immutable lifecycle event are then committed together in one PostgreSQL transaction. Concurrent edits or reviews are rejected rather than overwriting a newer decision. A central completion-log failure raises an operational alert while the append-only lifecycle event remains the durable completion record. None of these actions changes `LIVE_PROVIDER_ADAPTERS_IMPLEMENTED` or unlocks financial operations.

The sole super-administrator may create and submit evidence but cannot approve their own submission. A separately authenticated independent checker uses the rate-limited external-review endpoint to approve or reject submitted evidence across all control categories and later review the submitted package. The checker credential is stored only as a SHA-256 hash and cannot create an administration session.

All 32 internally preparable controls can be introduced progressively as **draft** metadata using `npm run sponsor:evidence:drafts`. They cover internal policies, control designs, runbooks and approval procedures across onboarding, safeguarding, AML, providers, FX/payments, ledger/reconciliation, security, resilience, privacy and customer protection. The command is dry-run by default, calculates each source SHA-256 at execution time, and skips controls that already have evidence. The five external controls—verified entity, verified beneficial owners, counsel opinion, sponsor term sheet and executed programme contract—are intentionally excluded because an internal draft cannot satisfy them. Applying the command creates drafts only; it does not submit, approve, or satisfy contracted-provider, independent-review, restore-exercise, sponsor, counsel, or control-owner dependencies.

## Current 2026 regulatory baseline

- The FCA's EMI application guidance requires adequate capital, robust governance and controls, fit-and-proper ownership and management, safeguarding, and Money Laundering Regulations compliance. It also expects supporting material covering risk management, wind-down, incidents, sensitive payment data, business continuity and outsourcing: [FCA — Electronic money institution applicants](https://www.fca.org.uk/firms/apply-emoney-payment-institution/emi).
- The FCA's supplementary safeguarding regime took effect on 7 May 2026. Relevant firms must address CASS/SUP requirements including reconciliations, resolution packs, safeguarding audits and monthly reporting where applicable: [FCA — Safeguarding requirements](https://www.fca.org.uk/firms/emi-payment-institutions-safeguarding-requirements), [FCA — PS25/12](https://www.fca.org.uk/publications/policy-statements/ps25-12-changes-safeguarding-regime-payments-and-e-money-firms).
- UK CDD includes identifying and verifying customers and beneficial owners, understanding the purpose and intended nature of relationships, applying risk-sensitive enhanced measures and retaining current records: [GOV.UK — Customer due diligence](https://www.gov.uk/hmrc-internal-manuals/anti-money-laundering-guidance-for-supervised-businesses/amlg11300).
- Payment and e-money firms are within the FCA operational-resilience framework. Important business services, impact tolerances, mapping, scenario testing, remediation and communications must be governed and reviewed: [FCA — Operational resilience](https://www.fca.org.uk/firms/operational-resilience).
- Retail propositions must evidence Consumer Duty outcomes, including product/service design, price and value, customer understanding, support and customers in vulnerable circumstances: [FCA — Consumer Duty information for firms](https://www.fca.org.uk/firms/consumer-duty/information-firms).
- Identity verification and biometric processing can present high privacy risk and may require a DPIA, appropriate lawful bases, minimisation and data-protection-by-design controls: [ICO — Information security checklist](https://ico.org.uk/for-organisations/advice-for-small-organisations/getting-started-with-gdpr/data-protection-self-assessment-medium-businesses/information-security-checklist/), [ICO — Biometric recognition](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/biometric-data-guidance-biometric-recognition/biometric-recognition/).
- Public language must remain fair, clear and not misleading. Regulated services and investment promotions require the correct permissions or lawful approval/exemption: [FCA — Approving financial promotions](https://www.fca.org.uk/firms/financial-promotions/approving-financial-promotions), [FCA — Checking authorisation](https://www.fca.org.uk/consumers/how-check-firm-individual-authorised).

Qualified UK counsel and the selected sponsor must confirm which rules apply to the final structure. This document is an engineering and due-diligence checklist, not legal advice or regulatory approval.

## Provider due-diligence questionnaire

1. What regulated permissions and contractual model cover each proposed customer journey?
2. Which party contracts with the customer, issues the account/e-money, safeguards funds, owns the ledger and handles complaints?
3. Which customer disclosures, naming conventions and website statements are mandatory or prohibited?
4. Which KYC/KYB, sanctions, PEP, adverse-media and transaction-monitoring providers and thresholds are required?
5. What currencies and corridors are supported, and how is each corridor approved, suspended and exited?
6. How are quotes, fees, value dates, cut-offs, rejected payments, returns and reversals represented?
7. What idempotency, request signing, webhook signing, timestamps, replay windows and provider identifiers are required?
8. Which settlement, safeguarding and ledger reports are authoritative, at what frequency, and how are breaks escalated?
9. What service levels, incident notices, resilience tests, recovery objectives, audit rights and exit assistance apply?
10. What sandbox certification and controlled-pilot exit criteria must be met before any production credential is issued?

## Approval gates

| Gate | Exit criteria | Current state |
| --- | --- | --- |
| A — entity and perimeter | Verified ownership plus written counsel opinion | Not evidenced |
| B — sponsor acceptance | Executed sponsor/programme agreement and approved responsibility matrix | Not evidenced |
| C — control design | Approved safeguarding, AML, ledger, reconciliation, privacy and customer-protection designs | Not evidenced |
| D — integration certification | Contracted sandbox adapters, signed-webhook verification, reconciliation and negative-path certification | Not implemented |
| E — independent assurance | Penetration-test closure, restore exercise, resilience exercise and access review | Not evidenced |
| F — controlled pilot | Written sponsor, counsel, compliance, security and board approvals with limited customers/corridors | Not approved |

Until every gate is evidenced and independently reviewed, exports must remain **DRAFT — NOT APPROVED FOR LAUNCH**, public claims must not imply banking authorisation, and all real-money endpoints must stay locked.
