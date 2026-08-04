# City Gate Capital — production Dockerfile
# Multi-stage build: full devDependencies for the Vite/TS build, then a lean
# production-only runtime image. Targets Node >=22 per package.json engines.
#
# NOTE: this repo had no Dockerfile prior to this remediation pass (confirmed
# absent in AUDIT_REPORT.md §8). Written to match the app's actual build
# output (dist/client + dist/server.bundle.mjs via `npm run build`) and its
# actual runtime port/host binding (process.env.PORT / HOST, src/server/entry.ts).
#
# Uses node:22-slim (Debian/glibc) rather than an Alpine/musl base — the app's
# vite.config.ts SSR externals list includes both -musl and -gnu prebuilt
# binaries for @node-rs/argon2, but glibc is the safer default for broadest
# native-module compatibility without extra build tooling.

# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Install full dependency tree (including devDependencies — needed for the
# Vite/TypeScript build step below).
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source and build.
COPY . .
RUN npm run build

# ── Stage 2: production runtime ──────────────────────────────────────────────
FROM node:22-slim AS runner

ENV NODE_ENV=production
WORKDIR /app

# Production-only dependencies. This also pulls in the platform-specific
# @node-rs/argon2 native binary, which vite.config.ts deliberately keeps
# external (native .node addons can't be bundled by Rollup) — see
# ssr.external in vite.config.ts.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Built output from the builder stage.
COPY --from=builder /app/dist ./dist

# SQL migrations, applied at boot (see entry.ts) via drizzle-orm's migrator —
# only drizzle-orm itself (a regular dependency) is needed to apply these,
# not the drizzle-kit CLI, so this works in this lean, devDependency-free
# runtime image.
COPY --from=builder /app/src/server/db/migrations ./migrations

# Flat-file fallback directories that src/server/api/health/GET.ts probes
# unconditionally (writes a .healthcheck file to each on every health check).
# Created here so the health check doesn't report a false "degraded" status
# purely because these directories don't exist in a fresh container — even
# when DATABASE_URL is set and Postgres is the real backing store. If you
# retire the flat-file fallback entirely, this block (and the health check's
# storage probe) can be removed together.
RUN mkdir -p /private/users /private/admin /private/contacts /private/accounts \
             /shared-storage/public/assets

# Run as a non-root user — banking-grade baseline, not a Node/Debian default.
RUN groupadd --system --gid 1001 cgc && \
    useradd --system --uid 1001 --gid cgc cgc && \
    chown -R cgc:cgc /app /private /shared-storage
USER cgc

# Render (and most PaaS targets) inject PORT at runtime; default matches
# src/server/entry.ts's own fallback (process.env.PORT || "3000").
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000

# Matches the unauthenticated, DB-aware health endpoint at src/server/api/health/GET.ts.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.bundle.mjs"]
