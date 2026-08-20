# Phase 1 (RBAC foundation) — change bundle

**Branch:** `feat/admin-control-plane-rbac` (create off `main`)
**Status in cloud:** type-check ✅ · lint ✅ · **513/513 server tests ✅**
**Scope:** RBAC enforcement engine + role enum migration. Backward-compatible: SUPER_ADMIN keeps full access; no non-super role is issued at login yet, so runtime behavior is unchanged until admin-user management (a later increment) assigns roles. Nothing auto-deploys.

## New files
| Path | What it is |
|---|---|
| `src/server/lib/adminRbac.ts` | Code-authoritative RBAC catalogue: 8 roles, 46 permissions, role→permission matrix, and the route→required-permission policy (`requiredAccessForAdminRequest`). Deny-by-default; `SUPER_ONLY` sentinel for reserved routes. |
| `src/server/db/migrations/0047_admin_rbac_roles.sql` | Extends the `admin_role` Postgres enum with `CONTENT_ADMIN`, `OPERATIONS_ADMIN`, `AUDITOR` (idempotent `ADD VALUE IF NOT EXISTS`). **⚠ Renumber** to follow `main`'s latest migration before committing (the runner applies by sorted filename; this migration is order-independent and idempotent). |

## Changed files
| Path | Change |
|---|---|
| `src/server/lib/adminAuthorizationMiddleware.ts` | Rewritten from single-authority (`return []`) to **permission-based, fail-closed** enforcement. SUPER_ADMIN wildcard (still audited); unmapped + `SUPER_ONLY` routes deny non-super with `SUPER_ADMIN_REQUIRED`; permission-mapped routes check the session role's permissions and return `PERMISSION_REQUIRED` on failure. `allowedRolesForAdminRequest` kept as a derived back-compat export; also re-exports `requiredAccessForAdminRequest`. |
| `src/server/lib/sessionStore.ts` | `AdminRole` widened from 5 to the 8 spec roles. |
| `src/server/db/schema.ts` | `adminRoleEnum` widened to 8 values (matches migration 0047). |

## Security-test contract update (please review)
Introducing live RBAC **necessarily updates 7 tests** that encoded the deliberate "SUPER_ADMIN-only" decision. Each was updated to assert the **required permission** for the route (a stable, intent-revealing property) instead of the old empty-role-list. Genuine safety assertions are preserved and strengthened in `adminAuthorizationMiddleware.test.ts` (deny-by-default, super-only reservations, wrong-role denied, auditor read-only, 5-identity matrix).

| Test file | Old assertion | New assertion |
|---|---|---|
| `adminAuthorizationMiddleware.test.ts` | non-super roles blocked everywhere | full RBAC matrix: super wildcard, deny-by-default, super-only routes, per-permission scoping, auditor read-only |
| `financialSandbox.test.ts` | `allowedRoles(...) == []` | requires `TRANSFERS_READ` / `TRANSFERS_MANAGE` |
| `onboardingControls.test.ts` | `== []` | requires `KYC_MANAGE` / `USERS_MANAGE` / `KYC_READ` |
| `legalEntityVerification.test.ts` | `== []` | requires `KYC_READ` / `KYC_MANAGE` |
| `customerRelationshipControls.test.ts` | `== []` | requires `ACCOUNTS_READ` / `ACCOUNTS_MANAGE` |
| `adminDocumentationAccess.test.ts` | `== []` | requires `SYSTEM_READ` |
| `sponsorReadiness.test.ts` | `== []` | requires `SYSTEM_MANAGE` |

## Not in this increment (next Phase-1 steps)
- Migrations `admin_users / admin_roles / admin_permissions / admin_role_permissions / admin_user_roles / admin_approvals`.
- `audit_log` dedicated columns (reason / request_id / before-after) + redaction allowlist.
- Admin-user & role management API + `/admin/access` page (SUPER_ADMIN-only) — this is what actually *issues* non-super roles.
- Multi-role session resolution with short-TTL cache.

## How to apply
Create branch `feat/admin-control-plane-rbac` off `main`, copy these files over the same paths (renumber the migration to follow main's latest), then `npm ci && npm run type-check && npm run lint && npm run test:ci` before opening the PR.
