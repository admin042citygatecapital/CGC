# City Gate Capital preview deployment

The checked-in Render blueprint deploys a persistent, non-indexed product preview. It intentionally uses a paid always-on web service and a small persistent disk because the application includes WebSockets, background work, and several administration/CMS stores that are still filesystem-backed. Confirm current provider pricing before creating resources.

## Required external resources

1. A Git repository containing this project.
2. A standard managed PostgreSQL database with SSL enabled.
3. A Render account connected to the repository.
4. An HTTPS preview URL or custom domain.

Email and managed object storage are optional for a private dashboard preview. They are required before public registration, password recovery, KYC uploads, or media administration are enabled for real users.

## Render environment values

When applying `render.yaml`, provide these secret values in the Render dashboard:

- `APP_URL`: the final HTTPS origin, without a trailing slash.
- `DATABASE_URL`: the managed PostgreSQL connection string.
- `SESSION_SECRET`: at least 32 cryptographically random characters.
- `CARD_ENCRYPTION_KEY`: exactly 64 hexadecimal characters.
- `ADMIN_PASSWORD_HASH`: a bcrypt hash with cost 10–12.
- `ADMIN_EMAIL`: the preview administrator email address.
- `PREVIEW_USER_EMAIL`: the customer email used to review the hosted dashboard.
- `PREVIEW_USER_PASSWORD`: a strong temporary password for that preview customer.

Keep these blueprint defaults unchanged for the preview:

- `PLATFORM_MODE=preview`
- `VITE_PLATFORM_MODE=preview`
- `ENABLE_FINANCIAL_OPERATIONS=0`
- `ENABLE_PAPER_TRADING=0`

The service will refuse to start if critical secrets are missing or malformed. Database migrations run before each deployment, followed by an idempotent preview-user seed. The `/private` disk preserves CMS settings, contacts, account applications, reports, and local media across restarts. Public self-registration remains disabled.

## Release sequence

1. Run `npm ci` and `npm run release:check` locally.
2. Push the clean `main` branch to the connected Git repository.
3. Apply the Render blueprint and enter the required secret values.
4. Confirm the pre-deploy migration completed successfully.
5. Confirm `/api/health` returns HTTP 200 with `database.status` set to `ok`.
6. Confirm the public preview disclosure and `X-Robots-Tag: noindex` header.
7. Sign in with a dedicated preview user and verify dashboard navigation, logout, and session expiry.

Do not enable live financial operations from this deployment guide. A live-money release requires separately verified licensing, banking/custody/card providers, legal copy, reconciliation, monitoring, incident response, penetration testing, and production data-retention controls.
