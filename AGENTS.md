# Repository Guidelines

## Project Structure & Module Organization

City-Gate-Capital is a React fullstack application with SSR (server-side rendering). The codebase separates concerns into:

- **`./src/pages/`** — Route-based pages (customer-facing and admin)
- **`./src/components/`** — Reusable UI components (admin, ui, and page-specific)
- **`./src/layouts/`** — Layout templates for different sections
- **`./src/server/api/`** — Express API endpoints (mounted at `/api` in dev)
- **`./src/server/entry.ts`** — Express app and server handler (large file: 628KB)
- **`./src/lib/`** — Utilities for auth, formatting, analytics
- **`airo-secrets/`, `source-mapper/`, `dev-tools/`** — Custom Vite plugins and error handling
- **`./public/`** — Static assets (logo, HTML fallbacks, analytics)

The dual build in `package.json` produces `dist/client/` (frontend) and server bundle.

## Build, Test, and Development Commands

**Development:** `npm run dev` — Runs Vite dev server with API middleware.

**Production Build:** `npm run build` — Builds client to `dist/client/` and SSR bundle to `dist/server.bundle.mjs`.

**Testing:** `npm run test` — Runs Vitest in jsdom environment (process isolation with forks pool, max 4 concurrent). `npm run test:ui` opens the test UI. `npm run test:coverage` generates coverage.

**Type Check:** `npm run type-check` — TypeScript strict mode check.

**Linting:** `npm run lint` — ESLint check. `npm run lint:fix` — Auto-fixes violations.

**Formatting:** `npm run format` — Prettier on source files.

**Cleanup:** `npm run clean` — Removes dist and .vite. `npm run reset` — Clean install.

## Coding Style & Naming Conventions

**TypeScript:** Strict mode with `noUnusedLocals`, `noUnusedParameters`, `noImplicitAny`, and `noFallthroughCasesInSwitch` all enabled. Path aliases: `@/` → `./src/`, `@/api/` → `./src/server/api/`.

**ESLint (flat config):** 
- `@typescript-eslint` enforces typing rules.
- Unused variables must start with `_` (e.g., `const _unused = ...`).
- `prefer-const` and `no-var` required.
- React hooks and refresh rules enforced.
- `@typescript-eslint/no-explicit-any` is a warning.

**Prettier:** Configured for `.ts`, `.tsx`, `.json`, `.md`.

**Tailwind CSS:** Extended theme with HSL color variables and custom animations (float, rotate-clockwise, accordion). Radix UI color/spacing system expected.

## Testing Guidelines

Tests run with **Vitest** (jsdom environment, 5 concurrent tests per file). Setup file: `./src/test/setup.ts`. Coverage uses v8 provider, excluding node_modules and config files.

Run single test: `npx vitest run path/to/test.ts`

## Node & Dependencies

**Node >= 22** required (see `.node-version`).

**Key Dependencies:**
- React 19 + React DOM
- React Router 7 for routing
- Radix UI + Tailwind CSS for components
- Zustand for state, React Query for async
- React Hook Form + Zod for forms
- Lexical for rich text editing
- Supabase client for auth/database
- Express for SSR

Use `npm install` to add deps (lockfile tracked). The build deduplicates React/Router across chunks.
