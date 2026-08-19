# City Gate Capital

A full-stack digital banking platform: customer-facing accounts, cards, transfers, and trading, plus an internal admin panel for KYC, compliance, and support. Vite + React SSR frontend, Express backend, Drizzle ORM over Supabase Postgres.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite 6, React Router (data mode), Tailwind CSS, Radix UI
- **Backend**: Express (custom SSR server, `src/server/entry.ts`), Node.js
- **Database**: Supabase Postgres via [`postgres`](https://github.com/porsager/postgres) (postgres.js) + [Drizzle ORM](https://orm.drizzle.team/)
- **Auth/Storage/Realtime**: Supabase (`src/lib/supabaseClient.ts` for the browser, `src/server/lib/supabaseStorage.ts` for server-side Storage)
- **Email**: Zoho Mail HTTP API (primary) with Resend HTTP API as queue fallback — no raw SMTP
- **Testing**: Vitest

The app runs with **flat-file (JSONL) storage as a dev-only fallback** when `DATABASE_URL` is unset — see `isDatabaseConfigured()` in `src/server/db/db.ts`. Production always requires Supabase.

## Getting Started

```bash
npm install
cp .env.example .env   # fill in your Supabase project's values
npm run dev
```

The dev server runs on `http://localhost:5173` (configurable via `PORT`).

## Environment Variables

See [`.env.example`](.env.example) for the full list with descriptions. At minimum, production needs:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string (Project Settings → Database) |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Supabase project URL (server / client) |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_ANON_KEY` | Public anon/publishable key |
| `SUPABASE_SECRET_KEY` | Server-only service-role key — never expose to the client |

This is a **Vite app, not Next.js** — client-exposed env vars use the `VITE_` prefix (see `envPrefix` in `vite.config.ts`), not `NEXT_PUBLIC_`.

## Available Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (client + SSR bundles) |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the Vitest suite |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run type-check` | `tsc --noEmit` |
| `npm run db:migrate` | Apply pending SQL migrations (`src/server/db/migrations/`) |
| `npm run db:import` | One-time import of flat-file data into Postgres |
| `npm run db:validate` | Validate migrated data integrity |
| `npm run db:rollback` | Drop CGC tables/enums (destructive — see script header) |

## Project Structure

```
src/
├── pages/               # Route content components (public site, dashboard, admin)
├── layouts/              # Shared layout wrappers
├── components/           # Reusable UI components
├── lib/                  # Client-side utilities (incl. supabaseClient.ts)
├── server/
│   ├── entry.ts           # Express app + SSR entrypoint (default export)
│   ├── api/                # File-based API routes (src/server/api/**/METHOD.ts)
│   ├── db/                  # Drizzle schema, db.ts connection, migrations/
│   └── lib/                  # Server-side business logic (auth, stores, email, etc.)
└── test/                 # Vitest setup + specs
```

## Deployment

Deployed on Vercel. The Express app in `src/server/entry.ts` calls `httpServer.listen(port)`, which matches Vercel's native Node.js server auto-detection — no `vercel.json` is required for routing. The build command (`npm run build`) produces `dist/client/` (static assets) and `dist/server.bundle.mjs` (SSR server).

Set all variables from `.env.example` in the Vercel project's Environment Variables (Production) before deploying — the app falls back to local flat-file storage silently if `DATABASE_URL` is missing, so a deployment can succeed while running in a degraded, non-persistent mode if secrets aren't configured.

## Testing

```bash
npm test
```

Server-side auth, session, and security logic is covered under `src/test/server/`.
