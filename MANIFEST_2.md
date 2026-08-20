# Phase 1 increment 3 — Admin identity & role-assignment persistence

**Branch:** `feat/admin-control-plane-rbac`
**Status in cloud:** type-check ✅ · lint ✅ · **522/522 server tests ✅**
**Scope:** additive backend foundation. Does NOT touch the login/auth path. The env-bootstrap SUPER_ADMIN stays the break-glass account.

## Design choice
The role→permission matrix stays **code-authoritative** in `adminRbac.ts` (single source of truth, already enforced). The database stores only **who exists** and **which roles they hold** — no matrix duplication, no drift.

## New files
| Path | What it is |
|---|---|
| `src/server/lib/adminIdentityStore.ts` | Managed-admin CRUD + role assignment (DB-backed, transactional) and permission resolution. Pure, unit-tested helpers: `normalizeRoleAssignments` (validates against the 8 roles, dedups, order-stable), `computeEffectivePermissions` (unions via the code matrix), and `PermissionCache` (short-TTL, injectable clock, invalidated on role change). |
| `src/server/db/migrations/0049_admin_identity.sql` | `admin_users` + `admin_user_roles` tables (FK cascade, unique (user,role)), RLS enabled deny-by-default. **⚠ Renumber** to follow main's latest. |
| `src/test/server/adminIdentityStore.test.ts` | Role normalisation, permission union, SUPER_ADMIN full catalogue, AUDITOR read-only, cache TTL + invalidation. |

## Changed files
| Path | Change |
|---|---|
| `src/server/db/schema.ts` | Adds `adminUsers` + `adminUserRoles` tables and their inferred types. (Cumulative file — also carries increments 1 & 2 schema changes.) |

## Not in this increment (next steps to make RBAC operational end-to-end)
- HTTP API handlers under `src/server/api/admin/access/*` (list/create admin, set roles, list roles+permissions), guarded by the existing `requireSuperAdmin`, wired in `entry.ts`.
- Login integration: `findAdminByEmail` + session role resolution to also consult managed admins (careful, auth-path change — its own reviewed increment).
- The `/admin/access` React page.
- Optional: dual-approval workflow (`admin_approvals`).
