# Production-readiness gap analysis

Last reviewed: 2026-08-12

## Launch boundary

The public website is a published financial-technology website. The authenticated application remains a demonstration environment. It must not accept, hold, custody, transmit, exchange, invest, or insure customer funds or assets.

The supplied regulatory checklist is primarily US-focused, while the project currently displays a UK contact location. No US, UK, or other launch jurisdiction has been approved in the repository. Jurisdiction-specific requirements must be confirmed by qualified counsel and the contracted sponsor institution before implementation or launch.

## Evidence-based status

| Area | Current evidence | Status required for live operation |
| --- | --- | --- |
| Public website | Published on the verified custom domain; public pages are indexable. | Maintain accurate, approved claims and jurisdiction-specific legal disclosures. |
| Financial-operation lock | `platformMode.ts` denies production money movement unless the hard-coded provider-adapter gate and every launch attestation are satisfied. | Keep fail-closed until provider adapters, ledger and approvals are independently verified. |
| Ledger | PostgreSQL transactions provide atomic balance mutation, idempotency and concurrency controls. The application stores a customer balance and transaction records; it is not a double-entry general ledger or sponsor ledger of record. | Contract and integrate a double-entry core/sponsor ledger, immutable postings, holds/settlement states, reconciliation and exception handling. |
| Reconciliation | A provider-neutral synthetic harness and draft sponsor-pack procedure exist; no contracted sponsor feed or evidenced daily production control exists. | Contract the provider, approve thresholds and ownership, implement authenticated feeds and breaks workflow, then evidence daily controlled-pilot runs. |
| Payment rails | UI and placeholder transaction routes exist; no reviewed live provider adapters exist. | Executed sponsor/payment contracts, signed webhooks, provider-specific idempotency, settlement/reversal handling and certification. |
| Cards | Demonstration card UI and controls exist. | Sponsor/BIN arrangement, issuer-processor, PCI scope, tokenisation, authorisation/clearing, disputes, chargebacks and fulfilment. |
| Crypto | Demonstration wallet/trading UI exists. No custody or deposit address is issued. | Defer by default. If approved: licensed/authorised custody and execution partners, wallet screening, Travel Rule, key governance and jurisdiction controls. |
| KYC | Admin case review, rationales, audit records and expiry controls exist. Real document upload is provider-gated. | Contracted identity provider, approved consent/retention notices, documentary/non-documentary verification, liveness where required and evidence references. |
| AML/sanctions | Signed allow-listed provider callbacks cover sanctions, PEP and adverse-media onboarding checks and ongoing rescreens. Review/match results fail closed into immutable compliance cases and the admin queue tracks due dates. No provider is contracted or configured. | Named compliance officer/MLRO, approved programme and contracted provider; certify lists/matching thresholds, rescreen cadence, transaction monitoring, escalation and regulatory reporting. |
| Admin controls | Authenticated admin routes, roles, audit logging and compliance queues exist. | Independent RBAC review, least privilege, maker-checker for sensitive actions, privileged-access monitoring and periodic access certification. |
| Security | TLS/HSTS/CSP, secure sessions, 2FA features, rate limiting, encrypted card storage, production secret validation and a repeatable unauthenticated HTTP baseline exist. | Independent authenticated penetration test, remediation closure, secure SDLC evidence, vulnerability management, incident exercises and any applicable SOC 2/PCI programme. |
| Backups/recovery | Local operational snapshots, readiness attestations and a draft recovery-exercise procedure exist. | Provider-managed off-site backups, sponsor-approved RPO/RTO, completed isolated restore exercise and accepted continuity/provider-failure evidence. |
| Render database | The Basic PostgreSQL instance exposes a 3-day point-in-time recovery window. A fresh complete logical export (provider export ID 2) was created on 2026-08-12; an earlier export from 2026-08-10 remains visible. The provider retains export files for at least 7 days. Its external inbound rule currently allows `0.0.0.0/0`. | Replace internet-wide ingress with the narrowest Render/private-network and approved administrative sources, rotate credentials after the rule change, and complete an isolated restore with measured RPO/RTO evidence. Do not treat export creation alone as a successful restore test. |
| Neon candidate database | A separate Neon project has production/staging/development branches and a dedicated application role, but is not established as the deployed system of record. | Resolve target architecture; rotate exported privileged credentials; review least privilege, Data API/BetterAuth exposure, network controls, paid retention and branch protection; complete migration and isolated restore evidence. See `NEON-READINESS-ASSESSMENT.md`. |
| Legal authority | No verified legal entity, target jurisdiction, licence/registration, sponsor institution or approved operating model is recorded. | Written counsel advice, verified entity, required authorisations/registrations, executed sponsor contracts and regulator/provider approval. |
| Customer protection | Preview terms prohibit real funds; database-backed complaint controls and draft privacy/incident procedures exist. | Obtain sponsor/counsel approval for terms, complaint deadlines, funds-protection wording, privacy schedule and consumer-protection procedures. |

## Mandatory launch evidence

The administration readiness report treats all of the following as outstanding until explicitly recorded:

- target jurisdiction and verified legal entity;
- written regulatory-counsel and final compliance approval references;
- sponsor financial institution, programme provider and executed-contract approval;
- KYC, AML, sanctions, transaction-monitoring, payment, card, ledger and custody providers as applicable;
- named compliance officer/MLRO;
- daily reconciliation control and exception runbook;
- customer disclosure, penetration-test, incident-response and data-retention approvals;
- active transaction monitoring, sanctions rescreening, maker-checker, daily reconciliation and signed provider webhooks;
- reviewed production provider adapters and a reconciled double-entry ledger.

Environment values are attestations only. They cannot unlock money movement while `LIVE_PROVIDER_ADAPTERS_IMPLEMENTED` is `false`. Changing that constant requires a reviewed code release supported by provider-specific integration tests and external approval evidence.

## Recommended operating sequence

1. Confirm the legal entity, beneficial owners, target country and exact first product with qualified financial-services counsel.
2. Select the sponsor/authorised-partner operating model and obtain provider acceptance before building live rails.
3. Produce a counsel-reviewed flow-of-funds and responsibility matrix.
4. Contract the ledger, KYC, AML/sanctions, monitoring, payments and any card/custody providers.
5. Integrate one limited product behind provider sandboxes and reconciliation.
6. Complete security, privacy, operational-resilience and customer-protection reviews.
7. Run a controlled pilot only after written sponsor, counsel, compliance and security approvals.
8. Defer crypto and broad geographic expansion until the first product is stable and independently audited.

## Prohibited shortcuts

- An administrator's KYC or AML status is not legal authorisation and cannot substitute for screening evidence.
- A displayed balance or transaction table is not a ledger.
- An API key is not proof of a provider contract, permission or production certification.
- Do not issue invented account, IBAN, routing, sort-code, SWIFT, card or crypto deposit details.
- Do not describe City Gate Capital as a bank or claim deposit insurance/funds protection without approved wording naming the responsible authorised institution and the precise protection that applies.
- Do not accept a real identity document, payment credential, bank credential, money or digital asset in the demonstration environment.
