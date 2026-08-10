# City Gate Capital project completion register

Last reviewed: 2026-08-10

## Source of truth

This register reconciles the original shared project conversation (230 user messages across the development history), the current `main` branch, automated release checks, and the deployed `citygate.capital` service. The shared history includes superseded Vercel, Cloudflare Workers, Supabase, Neon and Airo proposals. The current production architecture is authoritative: React/Vite, Express, PostgreSQL and Render on the custom domain.

## Recovered product requirements

| Product area | Original objective | Current evidence | Status |
| --- | --- | --- | --- |
| Brand and public website | Premium City Gate Capital identity, owned logo assets, custom domain and professional public pages. | Brand assets are local, public routes are deployed on `citygate.capital`, website content is admin-managed, and unsupported-claim scanning runs before release. | Implemented; content remains subject to legal approval. |
| Customer access | Secure login, password recovery, dashboard, balance privacy, wallets, transfers, cards, exchange, support and account settings. | Authenticated route suite, customer session middleware, balance visibility controls, support and dashboard pages exist. Production financial mutations are locked. | Demonstration interface complete; live services deferred. |
| Administration | One administration surface for customers, KYC/AML, transactions, content, email, security, integrations, reports and configuration. | 36 administration pages, central authentication/authorization, CSRF protection, audit logging, KYC/AML queues, operations inbox and sponsor-readiness workspace. | Operational control plane implemented; periodic RBAC review remains external work. |
| Email | Domain mailboxes, Zoho-hosted inboxes, branded transactional email and admin diagnostics. | Resend production transport, Zoho mailbox configuration support, branded templates, queue/log controls and admin email centre. | Application integration implemented; mailbox/DNS/provider health remains operationally monitored. |
| Chat and social | Website chat plus administrator-controlled social links and sharing. | Tawk widget configuration, chatbot administration, social profile and share-intent workspace. | Implemented; provider-side staffing and policies remain operational. |
| Security | No hard-coded credentials, protected admin access, 2FA, rate limits, CSRF, audit logs and vulnerability remediation. | Secure cookies, separated sessions, central RBAC, mutation audit middleware, CSP/HSTS, production validation, zero known production npm advisories at this review. | Engineering baseline implemented; independent penetration test remains outstanding. |
| Accessibility | Keyboard access and readable public, customer and administration interfaces. | Automated serious WCAG 2.0/2.1 A/AA scanning covers the homepage, customer/admin login and recovery, both authenticated dashboards and keyboard-only authentication/skip navigation. | Release baseline implemented; expand coverage with each new journey. |
| Data and deployment | Persistent database, backups, GitHub, production hosting, custom domain and health checks. | PostgreSQL migrations, Render pre-deploy migration, managed custom domain, 8-part health endpoint and release guard. | Deployed; managed-backup confirmation and restore exercise still require provider evidence. |
| Regulated financial launch | Move beyond demonstration without bypassing legal, sponsor, safeguarding, KYC/AML, ledger or provider requirements. | Database-backed UK sponsor-readiness control plane, phased product scope and deterministic provider pack. Provider adapter constant remains false. | Preparation implemented; external authorisation and provider work outstanding. |

## Corrections made during this audit

- Removed fabricated platform crypto balances and invented deposit addresses from the administration interface.
- Replaced crypto controls with a read-only deferred-capability view and clearly marked synthetic database activity.
- Added production financial-operation guards to administrator balance adjustment, transaction creation/approval, wallet-address mutation and customer financial-field mutation paths.
- Added these invariants to automated tests and the unsupported-claims scanner.
- Replaced the random 500-record administration transaction feed with the persistent application transaction store.
- Converted transaction administration into a read-only, explicitly labelled demonstration register; exported rows carry the same classification.
- Removed crypto AUM/holdings claims from the executive dashboard and replaced them with the financial-operation lock and sponsor-readiness boundary.
- Corrected the daily chart to count fee records rather than incorrectly treating deposits as revenue.
- Forced legacy market/provider planning records to appear disabled in preview, removed invented provider-health presentation, and guarded every activation path.
- Removed simulated media-optimization savings; the API now reports that no optimizer is configured without altering stored metadata.
- Added a real-browser release suite covering public branding, customer and administrator access control, session persistence, both recovery flows, sponsor-readiness protection and server-side financial-operation locks.
- Isolated browser-test customer, session, audit, support, rate, trading and transaction data under a temporary private-data root; the suite cannot read or alter production or developer records.
- Added automated serious WCAG 2.0/2.1 A/AA scanning and keyboard-only journeys for the public homepage, customer/admin authentication, password recovery and both authenticated dashboards.
- Corrected low-contrast public navigation, pricing, customer-dashboard and administration-dashboard text; fixed the pricing switch semantics and accessible names for icon-only administration controls.
- Repaired the administration security-log and trading-log data contracts so the existing pages no longer call missing endpoints.
- Added a least-privilege customer lookup for support: it exposes only the profile fields the support page needs and never returns credentials, sessions, banking details or identity-document references.
- Classified trading administration logs as deferred planning/audit data and corrected the developer catalogue so persisted application transactions are not described as real-money transactions.
- Replaced unsafe chatbot seed answers about transfer settlement, withdrawal limits and card controls with preview-safe guidance; persisted legacy answers are migrated on read and the admin API rejects those claims if reintroduced.
- Fixed chatbot FAQ category filtering so an empty category result cannot overwrite the persisted knowledge base.
- Removed unmeasured newsletter open/click percentages from administration reporting; campaign delivery records now state that engagement tracking is not configured and the UI displays “Not tracked.”
- Removed API reference files from the public asset tree and placed downloads behind administrator authentication and security-role authorization.
- Reclassified the 2026-06-04 API documents as a historical reference snapshot, removed stale route-count claims from the administration page and identified the current Developer Center/source registry as authoritative.
- Routed active flat-file fallback stores and administrator diagnostics through `PRIVATE_DATA_ROOT` instead of a fixed `/private` path, preserving deployment portability and test isolation.
- Added a regression test that performs representative balance/security writes under a temporary root and rejects fixed private-data literals in active API/store source.
- Replaced the Developer Center's manually counted route display with the running Express route registry, current authentication classification and preview-locked financial descriptions.
- Removed the unauthenticated `/api/test-email` email-sending endpoint; administrator email testing remains available through the protected administration API.
- Restricted Zoho OAuth initiation and secret diagnostics to security/super administrators, escaped callback output and removed OAuth credentials from redirect URLs and browser history.
- Replaced the legacy AIRO/GoDaddy Signals loader with consent-gated first-party analytics, including one-year consent expiry, Global Privacy Control/Do Not Track enforcement and immediate identifier removal on withdrawal.
- Opened only the data-minimised analytics event intake to public visitors while preserving administrator authentication for every analytics report; added a dedicated per-IP event rate limit.
- Removed URL queries and fragments from analytics page paths, reduced referrers to origins in both the JSON body and HTTP request, allowlisted metadata and excluded transfer amounts and arbitrary personal fields.
- Corrected the public Cookie Policy to match actual browser storage and added a working footer preference control above other page overlays.
- Added server, browser-storage and end-to-end privacy regressions proving that no event is sent before consent, consented events are accepted, sensitive URL parameters are excluded and reports remain protected.
- Replaced browser-readable customer bearer credentials with a host-only Secure, HttpOnly, SameSite=Strict session cookie scoped to `/api/users`; login no longer returns a token and legacy local storage is cleared.
- Added exact-origin enforcement for every customer mutation, including login and registration, so missing-origin, cross-site and lookalike-subdomain requests fail closed while financial-operation locks remain unchanged.
- Connected customer session/device listing and revocation to the PostgreSQL session store, exposed only non-reusable hashed session IDs, scoped revocation to the authenticated owner and cleared the cookie when the current session is revoked.
- Updated the Cookie Policy, API guide, OpenAPI snapshot, Postman reference and environment template to describe the cookie-only customer contract; added server and browser regressions for cookie flags, bearer rejection, CSRF rejection and session revocation.

## Work that is genuinely incomplete

### External launch dependencies

1. Verify the legal entity and beneficial ownership evidence.
2. Obtain UK financial-services counsel's perimeter and operating-model advice.
3. Select and pass due diligence with an authorised sponsor/EMI/programme provider.
4. Agree safeguarding structure, sponsor ledger, reconciliation, payment corridors and customer disclosures.
5. Contract KYC/KYB, sanctions/PEP, transaction-monitoring, payments, FX and ledger providers.
6. Complete an independent penetration test, remediation retest and resilience/restore exercise.
7. Obtain final sponsor, compliance, legal and security approvals for a controlled pilot.

These items cannot be completed by application code or by an administrator changing environment values.

### Next engineering work, in order

1. Continue removing or converting legacy mock-oriented admin views so every operational number comes from PostgreSQL or is explicitly labelled synthetic/deferred.
2. Expand accessibility and browser coverage to responsive navigation, administrator role boundaries and database-backed sponsor evidence lifecycle journeys.
3. Once a sponsor is selected, implement one provider sandbox adapter behind the existing provider-neutral contracts, signed-webhook validation and reconciliation harness.
4. Only after sponsor certification, replace the application balance model with the sponsor/core double-entry ledger projection.

## Launch invariant

The website may remain published as a financial-technology product site. Customer funds, custody, live FX, payments, cards and crypto must remain unavailable until the external dependencies and provider-specific engineering work above are evidenced and independently approved. `LIVE_PROVIDER_ADAPTERS_IMPLEMENTED` must remain `false` until then.
