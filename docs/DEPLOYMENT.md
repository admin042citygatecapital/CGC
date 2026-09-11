# City Gate Capital public website and application preview deployment

The checked-in Render blueprint deploys an indexable informational website alongside a persistent application preview. It intentionally uses a paid always-on web service and a small persistent disk because the application includes WebSockets, background work, and several administration/CMS stores that are still filesystem-backed. Financial operations remain disabled. Confirm current provider pricing before creating resources.

For a temporary, no-monthly-compute-cost review environment, use `render.preview.yaml` instead. It provisions one Free web service and one Free Render Postgres database, runs migrations, and seeds the review user during the build. The free web service sleeps after inactivity, its filesystem is ephemeral, and the free database expires after 30 days. This preview-only blueprint must not be used for production or real customer data.

## Required external resources

1. A Git repository containing this project.
2. A standard managed PostgreSQL database with SSL enabled.
3. A Render account connected to the repository.
4. An HTTPS custom domain for the public website.

Email and managed object storage are optional for a private dashboard preview. They are required before public registration, password recovery, KYC uploads, or media administration are enabled for real users.

## Render environment values

When applying `render.yaml`, provide these secret values in the Render dashboard:

- `APP_URL`: the final HTTPS origin, without a trailing slash.
- `DATABASE_URL`: the managed PostgreSQL connection string.
- `SESSION_SECRET`: at least 32 cryptographically random characters.
- `CARD_ENCRYPTION_KEY`: exactly 64 hexadecimal characters.
- `ADMIN_PASSWORD_HASH`: an Argon2id hash (the platform's hash policy); legacy bcrypt hashes with cost 10–12 remain verifiable for existing installations.
- `ADMIN_EMAIL`: the preview administrator email address.
- `PREVIEW_USER_EMAIL`: the customer email used to review the hosted dashboard.
- `PREVIEW_USER_PASSWORD`: a strong temporary password for that preview customer.

Keep these financial-safety defaults unchanged for the application preview:

- `PLATFORM_MODE=preview`
- `VITE_PLATFORM_MODE=preview`
- `PUBLIC_SITE_PUBLISHED=1`
- `VITE_PUBLIC_SITE_PUBLISHED=1`
- `ENABLE_FINANCIAL_OPERATIONS=0`
- `ENABLE_PAPER_TRADING=0`

The service will refuse to start if critical secrets are missing or malformed. Database migrations run before each deployment, followed by an idempotent preview-user seed. The `/private` disk preserves CMS settings, contacts, account applications, reports, and local media across restarts. Public self-registration remains disabled.

## Release sequence

1. Run `npm ci` and `npm run release:check` locally.
2. Push the clean `main` branch to the connected Git repository.
3. Apply the Render blueprint and enter the required secret values.
4. Confirm the pre-deploy migration completed successfully.
5. Confirm `/api/health` returns HTTP 200 with `database.status` set to `ok`.
6. Confirm public pages are indexable, while dashboard, authentication, KYC and administration pages remain `noindex` and financial disclosures remain visible on demonstration experiences.
7. Sign in with a dedicated preview user and verify dashboard navigation, logout, and session expiry.

Do not enable live financial operations from this deployment guide. A live-money release requires separately verified licensing, banking/custody/card providers, legal copy, reconciliation, monitoring, incident response, penetration testing, and production data-retention controls.
