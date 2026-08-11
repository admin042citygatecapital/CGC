# Legal Entity and Ownership Verification

The administration register at `/admin/legal-entity` records public company-registry metadata and opaque approved-provider references. It does not store identity documents, dates of birth, residential addresses, credentials or raw provider payloads.

The legal entity remains `unverified` until all of the following are true:

1. A Compliance administrator records the legal name, jurisdiction, registration number, legal form, official HTTPS registry reference and optional SHA-256 evidence digest.
2. At least one active beneficial owner or controller is recorded using an opaque controller reference, ownership band, nature of control and opaque approved-provider verification reference.
3. Every active controller record is submitted and verified by a different Compliance administrator or Super Admin.
4. The entity profile is submitted and verified by a different administrator.
5. All entity and controller evidence remains within its expiry date.

Every create, edit, submit and review action is written to the immutable legal-entity event ledger and the central audit log. Editing a reviewed record resets it to draft. Expired evidence fails the structured gate automatically.

Generic sponsor evidence cannot replace this register. Sponsor-package submission readiness now requires both every sponsor control and the structured entity/ownership gate. Neither verification nor sponsor-package approval activates provider adapters or financial operations.

External completion still requires qualified legal advice, ownership evidence from authoritative sources, an approved KYB/identity provider, sponsor due diligence and any required regulatory permissions. An administrator decision is an internal control, not legal or regulatory authorisation.
