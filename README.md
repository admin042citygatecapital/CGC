# City Gate Capital Platform

Sophisticated Vite + React SSR frontend with an Express backend, utilizing Drizzle ORM and Supabase for data persistence.

## Architecture
- **Frontend**: Vite, React, Tailwind CSS.
- **Backend**: Node.js, Express.
- **Database**: PostgreSQL (via Supabase) with Drizzle ORM.
- **Auth**: Role-Based Access Control (RBAC) with Argon2id password hashing.

## Development Mode & Fallbacks
The platform is designed to be "developer-friendly." If `DATABASE_URL` is not provided in the environment, the server will still boot in development mode. 

### Static Identity Fallback
When the database is unavailable, the system falls back to an environment-backed static identity system. This allows developers to test the Admin Panel and authentication flows without needing a live PostgreSQL instance.

- **Admin Login**: Uses `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` for fallback authentication.
- **Data Stores**: Most stores (User, Session, etc.) implement a `.flatfile.ts` fallback that uses JSONL storage or static mocks.

## Getting Started

### Environment Variables
Copy `.env.example` to `.env` and fill in the required secrets.

### Installation
```bash
npm install
```

### Running the App
```bash
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
The project is configured for deployment on **Render**. See `render.yaml` for the service specifications.

## Testing

```bash
npm test
```

Server-side auth, session, and security logic is covered under `src/test/server/`.
