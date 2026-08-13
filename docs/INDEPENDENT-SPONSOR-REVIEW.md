# Independent sponsor review

City Gate Capital uses a separate reviewer credential for sponsor-control evidence. This is not an administration account and cannot create an admin session, edit evidence, access customer records, or enable financial operations.

## Production setup

1. Appoint a real independent reviewer who is not the City Gate Capital super-administrator.
2. Generate a cryptographically random credential of at least 32 characters outside the application and deliver it to that reviewer through a separate secure channel.
3. Calculate the credential's SHA-256 digest locally.
4. Set `SPONSOR_REVIEWER_EMAIL` to the reviewer's identity and `SPONSOR_REVIEWER_KEY_HASH` to the 64-character lowercase digest in the production environment.
5. Never store the raw credential in source control, deployment notes, chat, a URL or a browser bookmark.
6. Give the reviewer the workspace URL: `https://citygate.capital/sponsor-review`.

The reviewer page keeps the raw credential in page memory only and sends it in an HTTPS request header. Closing the page or selecting **Clear access** removes it from the interface.

## Review boundary

The reviewer can see only evidence whose lifecycle status is `submitted`. Returned fields are limited to controlled reference metadata, SHA-256 digest, owner, dates, notes and the related control. Draft evidence, source documents, credentials, customer records, administrator identities and audit-event internals are excluded.

Approving or rejecting evidence creates the existing immutable sponsor-review and critical-audit records. It does not change `LIVE_PROVIDER_ADAPTERS_IMPLEMENTED=false`, unlock a financial endpoint, create a customer balance, or establish regulatory permission.
