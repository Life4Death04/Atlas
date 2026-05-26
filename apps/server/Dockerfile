# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Atlas — apps/server multi-stage Dockerfile
#
# Build context: repo root (monorepo)
#   docker build -f apps/server/Dockerfile -t atlas-server:dev .
#
# Two stages:
#   builder  — installs ALL deps, generates Prisma client, compiles TS, and
#              produces a prod-only bundle via `pnpm deploy --prod /deploy`.
#   runtime  — minimal node:20-slim. WORKDIR matches the builder's compiled
#              paths so the Prisma 6 engine is found correctly. Copies only
#              production artefacts: dist/, node_modules (prod-only), prisma/,
#              generated/, package.json. No source .ts files, no devDeps, no
#              .env files, no secrets baked in.
#
# Prisma 6 note: the new prisma-client generator embeds the absolute output
# path and resolves the native engine (.so.node) relative to `dist/generated/
# prisma/` (via import.meta.url). The `.so.node` is in `generated/prisma/` and
# Prisma's runtime falls back to `config.generator.output.value` (the absolute
# path baked in at generate time = /app/apps/server/generated/prisma). This is
# why the runtime WORKDIR MUST be /app/apps/server — matching the builder path.
#
# OCI labels are NOT hardcoded here — they are injected at workflow build time
# via docker/metadata-action `--label` args (see .github/workflows/cd.yml).
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20

# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-slim AS builder
WORKDIR /app

# OpenSSL 3.x is required by Prisma's debian-openssl-3.0.x native engine.
# ca-certificates is needed for HTTPS calls during pnpm install.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# pnpm 9 via corepack — matches root package.json `engines.pnpm >= 9`
RUN corepack enable && corepack prepare pnpm@9 --activate

# ── Layer-cache-friendly dependency install ──────────────────────────────────
# Copy workspace metadata FIRST so that the `pnpm install` layer only
# re-runs when lockfile or package.json manifests change, not on every
# source code change.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
# Intentionally NOT copying apps/client/package.json — this image is server-only.

# Mount the pnpm content-addressed store as a BuildKit cache. The store
# survives across builds; packages are hard-linked, not duplicated.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ── Source copy & Prisma generation ──────────────────────────────────────────
# Copy the rest of the sources AFTER install to keep layer cache intact.
COPY . .

# prisma.config.ts eagerly evaluates env('DATABASE_URL') at CLI boot, even for
# non-DB commands. A placeholder value is sufficient — it is discarded after
# `prisma generate` and is never present in the runtime image.
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV DATABASE_URL=${DATABASE_URL}

# Generate the Prisma client targeting Debian OpenSSL 3.x (matches node:20-slim
# Bookworm). Output lands at apps/server/generated/prisma (per schema.prisma).
# Prisma 6 bakes the absolute path /app/apps/server/generated/prisma into the
# generated JS as config.generator.output.value — the runtime stage preserves
# this path by using WORKDIR /app/apps/server.
RUN pnpm --filter server db:generate

# Compile TypeScript → dist/  (rootDir="."; src/server.ts → dist/src/server.js)
RUN pnpm --filter server build

# Produce a prod-only deployment bundle. `pnpm deploy --prod /deploy` installs
# only production deps and copies the workspace into /deploy. The runtime stage
# selectively copies only the required artefacts, so .env files, src/, and
# config files from /deploy never reach the final image.
RUN pnpm --filter server deploy --prod /deploy

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-slim AS runtime
# WORKDIR must match the builder's apps/server path because Prisma 6 bakes
# the absolute output path (/app/apps/server/generated/prisma) into the compiled
# client at generate time. The runtime engine resolution uses this path as a
# fallback when the .so.node is not found next to client.js.
WORKDIR /app/apps/server

# Same OpenSSL + ca-certificates as builder — required by the Prisma native
# engine (.so.node) at query time.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Production-only node_modules from pnpm deploy output.
# Contains the .pnpm virtual store with prod deps only (no typescript, vitest,
# nodemon, tsx, or prisma CLI). Includes @atlas/shared resolved as a directory.
COPY --from=builder --chown=node:node /deploy/node_modules ./node_modules

# Compiled server output — all JS code that runs at runtime.
# dist/src/server.js is the entry point. @atlas/shared is compiled inline.
COPY --from=builder --chown=node:node /deploy/dist ./dist

# package.json is required by Node.js for package type resolution
# ("type": "module" — server uses ESM imports).
COPY --from=builder --chown=node:node /deploy/package.json ./package.json

# Prisma schema and migrations: only what is needed for runtime schema awareness.
# Seeds are dev-only and excluded. CD does NOT run migrations.
COPY --from=builder --chown=node:node /deploy/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder --chown=node:node /deploy/prisma/migrations ./prisma/migrations

# Prisma generated client. Lives at /app/apps/server/generated/prisma which
# matches config.generator.output.value baked in by the builder's prisma generate.
# The .so.node binary was built for debian-openssl-3.0.x (Bookworm).
COPY --from=builder --chown=node:node /app/apps/server/generated ./generated

# Runtime environment defaults. DATABASE_URL, AUTH0_DOMAIN, AUTH0_AUDIENCE, and
# CLIENT_URL must be supplied at container launch — they are NOT baked into the image.
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Drop to the built-in non-root node user (UID 1000) for security.
USER node

# Direct node invocation avoids spawning pnpm at runtime (smaller PID 1
# footprint). Path matches tsconfig outDir="./dist" + rootDir="." so
# src/server.ts compiles to dist/src/server.js.
CMD ["node", "dist/src/server.js"]
