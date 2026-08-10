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
| Data and deployment | Persistent database, backups, GitHub, production hosting, custom domain and health checks. | PostgreSQL migrations, Render pre-deploy migration, managed custom domain, 8-part health endpoint and release guard. | Deployed; managed-backup confirmation and restore exercise still require provider evidence. |
| Regulated financial launch | Move beyond demonstration without bypassing legal, sponsor, safeguarding, KYC/AML, ledger or provider requirements. | Database-backed UK sponsor-readiness control plane, phased product scope and deterministic provider pack. Provider adapter constant remains false. | Preparation implemented; external authorisation and provider work outstanding. |

## Corrections made during this audit

- Removed fabricated platform crypto balances and invented deposit addresses from the administration interface.
- Replaced crypto controls with a read-only deferred-capability view and clearly marked synthetic database activity.
- Added production financial-operation guards to administrator balance adjustment, transaction creation/approval, wallet-address mutation and customer financial-field mutation paths.
- Added these invariants to automated tests and the unsupported-claims scanner.

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
2. Add browser-level end-to-end coverage for the critical admin, customer login, email recovery and production-lock flows.
3. Add automated accessibility checks and keyboard-flow tests for the public site and authenticated dashboards.
4. Once a sponsor is selected, implement one provider sandbox adapter behind the existing provider-neutral contracts, signed-webhook validation and reconciliation harness.
5. Only after sponsor certification, replace the application balance model with the sponsor/core double-entry ledger projection.

## Launch invariant

The website may remain published as a financial-technology product site. Customer funds, custody, live FX, payments, cards and crypto must remain unavailable until the external dependencies and provider-specific engineering work above are evidenced and independently approved. `LIVE_PROVIDER_ADAPTERS_IMPLEMENTED` must remain `false` until then.
