# City Gate Capital

City Gate Capital is a full-stack financial-technology platform with a corporate website, a separately labelled `/demo` workspace, customer authentication and dashboard interfaces, KYC workflows, transfers, multi-currency exchange, card and trading demonstrations, support tools, and a role-aware administration console.

## Technology

- React 19, TypeScript, Vite, Tailwind CSS, and React Router
- Express 5 with server-side rendering and WebSocket market updates
- PostgreSQL through Drizzle ORM and a provider-neutral pooled driver
- Argon2id password hashing, encrypted card data, bounded sessions, audit logging, and request-rate controls
- Vitest, ESLint, and production client/server builds

## Local development

Requirements: Node.js 22 or newer.

```bash
npm install
copy env.example .env
npm run dev
```

Open `http://127.0.0.1:5173`. Local development can use the flat-file fallback; production cannot.

To create the guarded local dashboard account:

```bash
set ENABLE_LOCAL_DEMO_USER=1
npx tsx scripts/create-local-demo-user.ts
```

The script refuses to run in production or while a database connection is configured.

## Quality gates

```bash
npm run type-check
npm run lint
npm test -- --run
npm run build
```

Run every gate with `npm run verify`.

## Database

Set `DATABASE_URL` to a PostgreSQL pooler connection string, then apply and validate migrations:

```bash
npm run db:migrate
npm run db:validate
```

Legacy flat-file data can be checked and imported with `db:import:dry` and `db:import`. Back up both the database and `/private` data before migration.

The Operations Inbox uses PostgreSQL in production and imports its legacy JSONL data idempotently. Daily checksummed operational snapshots are enabled by the Render blueprint; see [`docs/BACKUP-RECOVERY.md`](docs/BACKUP-RECOVERY.md). These local snapshots do not replace provider-managed off-site database backups.

## Production

This application requires a persistent Node.js service because it hosts Express APIs, server-side rendering, background email processing, and WebSockets. Deploy it to a container or long-running Node platform rather than a static-only host.

The checked-in deployment publishes a partnership-led corporate website at `/` and isolates the non-transactional product experience under `/demo`. Demo routes are `noindex`; legacy public product URLs redirect into that boundary. Money-moving, card-lifecycle and live-trading endpoints remain fail-closed, and authenticated screens retain disclosures wherever demonstration balances or transactions appear. `PUBLIC_SITE_PUBLISHED` controls publication and indexing only; it cannot enable financial operations. Do not switch `PLATFORM_MODE` to `live` or enable financial operations until banking/custody partners, regulatory approvals, legal copy, and production integrations have been independently verified.

The provider-specific release sequence and required secrets are documented in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

```bash
npm ci
npm run verify
npm start
```

Production startup fails when critical configuration is absent. At minimum configure:

- `NODE_ENV=production`
- `APP_URL`
- `DATABASE_URL`
- `SESSION_SECRET`
- `CARD_ENCRYPTION_KEY`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_EMAIL`

Configure an email provider before enabling public registration and password resets. Never deploy the local demo account or flat-file persistence as a live banking environment.

## Operational note

The software is a banking-platform codebase, not regulatory authorization to accept deposits, custody assets, issue cards, or move real customer funds. Legal, licensing, compliance, provider, reconciliation, monitoring, incident-response, and penetration-testing requirements must be completed for every jurisdiction before any real-money launch.
