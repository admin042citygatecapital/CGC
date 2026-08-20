# Phase 1 increment 4 — /admin/access management API

**Branch:** `feat/admin-control-plane-rbac`
**Status in cloud:** type-check ✅ · lint ✅ · **526/526 tests ✅** · **build ✅**
**Scope:** additive HTTP API. No auth-path change. Reserved to SUPER_ADMIN by the central authorization policy (`access` → SUPER_ONLY, from increment 1) — defense already in place, no per-route guard needed.

## New endpoints
| Method + path | Purpose |
|---|---|
| `GET /api/admin/access/roles` | RBAC catalogue: every role with its permissions + the flat permission list |
| `GET /api/admin/access/admins` | List managed administrators and their roles |
| `POST /api/admin/access/admins` | Create a managed admin (`email`, `name`, `roles?`, `reason`) — **no sign-in credential** yet (login enablement is the next, reviewed increment) |
| `POST /api/admin/access/admins/:id/roles` | Replace an admin's roles (`roles`, `reason`) with before/after audit |

Every mutation requires a `reason`, validates input before touching storage, writes a **structured audit record** (module/resource/permission/reason/before-after — on top of the blanket mutation-audit middleware), and fails safe (503) when managed-admin storage isn't configured.

## New files
- `src/server/api/admin/access/roles/GET.ts`
- `src/server/api/admin/access/admins/GET.ts`
- `src/server/api/admin/access/admins/POST.ts`
- `src/server/api/admin/access/admins/[id]/roles/POST.ts`
- `src/test/server/adminAccessManagement.test.ts` (policy=SUPER_ONLY, catalogue shape, input validation, DB-absent → 503)

## Changed files
- `src/server/lib/adminRbac.ts` — added `roleCatalogue()` (cumulative file; includes increment-1 content).
- `src/server/entry.ts` — **apply `entry.ts.patch.md`** (two insertions; do not overwrite the file).

## Remaining for operational end-to-end RBAC
- **Login integration** (auth-path change, its own reviewed increment): let managed admins authenticate and derive their session role(s).
- **`/admin/access` React page** (client UI).
- Optional dual-approval workflow.
